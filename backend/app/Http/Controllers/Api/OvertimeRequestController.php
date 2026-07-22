<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OvertimeRequest;
use App\Http\Requests\StoreOvertimeRequestRequest;
use App\Http\Requests\UpdateOvertimeRequestStatusRequest;
use App\Http\Resources\OvertimeRequestResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class OvertimeRequestController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = OvertimeRequest::with(['employee.user', 'employee.department']);

        if ($request->query('personal') == '1') {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Profil pegawai tidak ditemukan.'], 404);
            }
            $query->where('employee_id', $employee->id);
        } else {
            if ($user->role === 'employee') {
                $employee = $user->employee;
                if (!$employee) {
                    return response()->json(['success' => false, 'message' => 'Profil pegawai tidak ditemukan.'], 404);
                }
                $query->where('employee_id', $employee->id);
            } elseif ($user->isPjBagian()) {
                // PJ Bagian: hanya lihat lembur dari departemennya
                if (!$user->pj_bagian_department_id) {
                    return response()->json(['success' => false, 'message' => 'PJ Bagian belum ditugaskan ke departemen.'], 422);
                }
                $query->whereHas('employee', function ($q) use ($user) {
                    $q->where('department_id', $user->pj_bagian_department_id);
                });
                if ($request->filled('status') && $request->status !== 'all') {
                    if ($request->status === 'pending') {
                        $query->where('pj_status', 'pending')
                              ->where('status', 'pending');
                    } elseif ($request->status === 'approved') {
                        $query->where('pj_status', 'approved');
                    } elseif ($request->status === 'rejected') {
                        $query->where(function ($q) {
                            $q->where('pj_status', 'rejected')
                              ->orWhere('status', 'rejected');
                        });
                    } else {
                        $query->where('pj_status', $request->status);
                    }
                }
            } else {
                // Admin: bisa filter tambahan
                if ($request->filled('status') && $request->status !== 'all') {
                    if ($request->status === 'draft') {
                        $query->where('pj_status', 'pending')
                              ->where('status', 'pending');
                    } elseif ($request->status === 'pending') {
                        $query->where('pj_status', 'approved')
                              ->where('status', 'pending');
                    } else {
                        $query->where('status', $request->status);
                    }
                }
                if ($request->filled('date_from') && $request->filled('date_to')) {
                    $query->whereBetween('date', [$request->date_from, $request->date_to]);
                }
                if ($request->filled('department_id')) {
                    $query->whereHas('employee', function ($q) use ($request) {
                        $q->where('department_id', $request->department_id);
                    });
                }
                if ($request->filled('search')) {
                    $search = $request->search;
                    $query->whereHas('employee', function ($q) use ($search) {
                        $q->where('nik_ktp', 'like', "%{$search}%")
                          ->orWhereHas('user', function ($uq) use ($search) {
                              $uq->where('name', 'like', "%{$search}%");
                          });
                    });
                }
            }
        }

        $query->orderBy('date', 'desc');

        $perPage = (int)$request->query('per_page', 20);
        if ($perPage < 1) $perPage = 20;
        if ($perPage > 100) $perPage = 100;

        $paginator = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => OvertimeRequestResource::collection($paginator->items()),
            'meta'    => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ]
        ]);
    }

    /**
     * Get summary counts for admin dashboard
     */
    public function summary(Request $request)
    {
        $query = OvertimeRequest::query();

        if ($request->filled('date_from') && $request->filled('date_to')) {
            $query->whereBetween('date', [$request->date_from, $request->date_to]);
        }
        if ($request->filled('department_id')) {
            $query->whereHas('employee', function ($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('employee', function ($q) use ($search) {
                $q->where('nik_ktp', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $pending = (clone $query)->where('pj_status', 'approved')->where('status', 'pending')->count();
        $draft = (clone $query)->where('pj_status', 'pending')->where('status', 'pending')->count();
        $approved = (clone $query)->where('status', 'approved')->count();
        $rejected = (clone $query)->where('status', 'rejected')->count();

        // Total hours/minutes from approved requests
        $approvedRequests = (clone $query)->where('status', 'approved')->get();
        $totalMinutes = 0;
        foreach ($approvedRequests as $req) {
            $att = \App\Models\Attendance::where('employee_id', $req->employee_id)
                ->whereDate('date', $req->date->toDateString())
                ->first();
            if ($att) {
                $totalMinutes += $att->overtime_minutes ?? 0;
            }
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'pending'       => $pending,
                'draft'         => $draft,
                'approved'      => $approved,
                'rejected'      => $rejected,
                'total_minutes' => $totalMinutes,
                'total_hours'   => round($totalMinutes / 60, 1),
            ]
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreOvertimeRequestRequest $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Profil pegawai tidak ditemukan.'], 404);
        }

        // Cek duplicate request
        $dateStr = Carbon::parse($request->date)->toDateString();
        $exists = OvertimeRequest::where('employee_id', $employee->id)
            ->whereDate('date', $dateStr)
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah mengajukan lembur untuk tanggal ini.'
            ], 422);
        }

        // Upload bukti foto
        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('overtime-photos', 'public');
            $photoUrl = '/storage/' . $path;
        }

        // Cari PJ Bagian yang bertanggung jawab atas departemen karyawan ini
        $pjBagian = null;
        if ($employee->department_id) {
            $pjBagian = \App\Models\User::where('role', 'pj_bagian')
                ->where('pj_bagian_department_id', $employee->department_id)
                ->first();
        }

        // Tentukan pj_status secara otomatis
        $pjStatus = 'pending';
        if (!$pjBagian || $pjBagian->id === $request->user()->id) {
            $pjStatus = 'approved';
        }

        $overtimeRequest = OvertimeRequest::create([
            'employee_id'       => $employee->id,
            'date'              => $dateStr,
            'reason'            => $request->reason,
            'photo_url'         => $photoUrl,
            'location_note'     => $request->location_note,
            'status'            => 'pending',
            'pj_status'         => $pjStatus,
            'unit_kerja'        => $request->unit_kerja ?? $employee->department?->name ?? 'Umum',
            'overtime_day_type' => $request->overtime_day_type ?? 'workday',
            'start_time'        => $request->start_time ?? '17:00',
            'end_time'          => $request->end_time ?? '19:00',
            'tasks'             => $request->tasks ?? $request->reason,
        ]);

        if ($pjBagian && $pjBagian->id !== $request->user()->id) {
            \App\Models\Notification::create([
                'user_id' => $pjBagian->id,
                'title'   => 'Pengajuan Lembur Baru',
                'body'    => ($employee->user?->name ?? 'Karyawan') . ' mengajukan lembur untuk tanggal ' . $dateStr . '.',
                'type'    => 'overtime',
                'data'    => ['overtime_request_id' => $overtimeRequest->id],
            ]);
        } else {
            $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
            foreach ($admins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $admin->id,
                    'title'   => 'Pengajuan Lembur Baru',
                    'body'    => ($employee->user?->name ?? 'Karyawan') . ' mengajukan lembur untuk tanggal ' . $dateStr . '.',
                    'type'    => 'overtime',
                    'data'    => ['overtime_request_id' => $overtimeRequest->id],
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan lembur berhasil dikirim.',
            'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department', 'pjReviewer']))
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $overtimeRequest = OvertimeRequest::with(['employee.user', 'employee.department'])->findOrFail($id);
        return response()->json([
            'success' => true,
            'data'    => new OvertimeRequestResource($overtimeRequest)
        ]);
    }

    public function approve(UpdateOvertimeRequestStatusRequest $request, $id)
    {
        $user = $request->user();
        $overtimeRequest = OvertimeRequest::with('employee')->findOrFail($id);

        // Guard PJ Bagian
        if ($user->isPjBagian()) {
            if ($overtimeRequest->employee?->user_id === $user->id) {
                return response()->json(['success' => false, 'message' => 'Anda tidak dapat memproses pengajuan lembur milik sendiri.'], 403);
            }
            if ($overtimeRequest->employee?->department_id !== $user->pj_bagian_department_id) {
                return response()->json(['success' => false, 'message' => 'Anda hanya dapat memproses pengajuan dari departemen yang Anda awasi.'], 403);
            }
        }

        if ($overtimeRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status pengajuan lembur ini sudah diputuskan secara final sebelumnya.'
            ], 422);
        }

        // 1. JIKA DI-APPROVE OLEH PJ BAGIAN
        if ($user->isPjBagian()) {
            $overtimeRequest->update([
                'pj_status'      => 'approved',
                'pj_reviewed_by' => $user->id,
                'pj_reviewed_at' => now(),
                'pj_note'        => $request->input('admin_note'),
            ]);

            // Kirim notifikasi ke Admin
            $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
            foreach ($admins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $admin->id,
                    'title'   => 'Pengajuan Lembur Di-ACC PJ Bagian',
                    'body'    => ($overtimeRequest->employee?->user?->name ?? 'Karyawan') . ' mengajukan lembur tanggal ' . $overtimeRequest->date->toDateString() . ' dan telah di-ACC PJ Bagian. Menunggu persetujuan final Anda.',
                    'type'    => 'overtime',
                    'data'    => ['overtime_request_id' => $overtimeRequest->id]
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan lembur disetujui oleh PJ Bagian (menunggu persetujuan Admin).',
                'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department', 'pjReviewer']))
            ]);
        }

        // 2. JIKA DI-APPROVE OLEH ADMIN
        if ($user->isAdmin()) {
            if ($overtimeRequest->pj_status === 'pending') {
                $overtimeRequest->pj_status = 'approved';
                $overtimeRequest->pj_reviewed_by = $user->id;
                $overtimeRequest->pj_reviewed_at = now();
                $overtimeRequest->pj_note = $request->input('admin_note') ?? 'Disetujui langsung oleh Admin';
            }

            $overtimeRequest->update([
                'status'         => 'approved',
                'admin_note'     => $request->input('admin_note'),
                'reviewed_by'    => $user->id,
                'reviewed_at'    => now(),
                'pj_status'      => $overtimeRequest->pj_status,
                'pj_reviewed_by' => $overtimeRequest->pj_reviewed_by,
                'pj_reviewed_at' => $overtimeRequest->pj_reviewed_at,
                'pj_note'        => $overtimeRequest->pj_note,
            ]);

            // Kirim notifikasi ke pegawai
            \App\Models\Notification::create([
                'user_id' => $overtimeRequest->employee->user_id,
                'title'   => 'Pengajuan Lembur Disetujui ✅',
                'body'    => 'Pengajuan lembur Anda tanggal ' . $overtimeRequest->date->toDateString() . ' telah disetujui oleh Admin.',
                'type'    => 'overtime',
                'data'    => ['overtime_request_id' => $overtimeRequest->id]
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan lembur disetujui oleh Admin.',
                'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department', 'pjReviewer']))
            ]);
        }

        return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
    }

    public function reject(UpdateOvertimeRequestStatusRequest $request, $id)
    {
        $user = $request->user();
        $overtimeRequest = OvertimeRequest::with('employee')->findOrFail($id);

        // Guard PJ Bagian
        if ($user->isPjBagian()) {
            if ($overtimeRequest->employee?->user_id === $user->id) {
                return response()->json(['success' => false, 'message' => 'Anda tidak dapat memproses pengajuan lembur milik sendiri.'], 403);
            }
            if ($overtimeRequest->employee?->department_id !== $user->pj_bagian_department_id) {
                return response()->json(['success' => false, 'message' => 'Anda hanya dapat memproses pengajuan dari departemen yang Anda awasi.'], 403);
            }
        }

        if ($overtimeRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status pengajuan lembur ini sudah diputuskan secara final sebelumnya.'
            ], 422);
        }

        // 1. JIKA DI-REJECT OLEH PJ BAGIAN
        if ($user->isPjBagian()) {
            $overtimeRequest->update([
                'pj_status'      => 'rejected',
                'pj_reviewed_by' => $user->id,
                'pj_reviewed_at' => now(),
                'pj_note'        => $request->input('admin_note'),
                'status'         => 'rejected',
                'reviewed_by'    => $user->id,
                'reviewed_at'    => now(),
                'admin_note'     => $request->input('admin_note') ?? 'Ditolak PJ Bagian',
            ]);

            // Kirim notifikasi ke pegawai
            \App\Models\Notification::create([
                'user_id' => $overtimeRequest->employee->user_id,
                'title'   => 'Pengajuan Lembur Ditolak ❌',
                'body'    => 'Pengajuan lembur Anda tanggal ' . $overtimeRequest->date->toDateString() . ' ditolak oleh PJ Bagian. Alasan: ' . ($request->input('admin_note') ?? '-'),
                'type'    => 'overtime',
                'data'    => ['overtime_request_id' => $overtimeRequest->id]
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan lembur ditolak oleh PJ Bagian.',
                'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department', 'pjReviewer']))
            ]);
        }

        // 2. JIKA DI-REJECT OLEH ADMIN
        if ($user->isAdmin()) {
            if ($overtimeRequest->pj_status === 'pending') {
                $overtimeRequest->pj_status = 'rejected';
                $overtimeRequest->pj_reviewed_by = $user->id;
                $overtimeRequest->pj_reviewed_at = now();
                $overtimeRequest->pj_note = $request->input('admin_note') ?? 'Ditolak langsung oleh Admin';
            }

            $overtimeRequest->update([
                'status'         => 'rejected',
                'admin_note'     => $request->input('admin_note'),
                'reviewed_by'    => $user->id,
                'reviewed_at'    => now(),
                'pj_status'      => $overtimeRequest->pj_status,
                'pj_reviewed_by' => $overtimeRequest->pj_reviewed_by,
                'pj_reviewed_at' => $overtimeRequest->pj_reviewed_at,
                'pj_note'        => $overtimeRequest->pj_note,
            ]);

            // Kirim notifikasi ke pegawai
            \App\Models\Notification::create([
                'user_id' => $overtimeRequest->employee->user_id,
                'title'   => 'Pengajuan Lembur Ditolak ❌',
                'body'    => 'Pengajuan lembur Anda tanggal ' . $overtimeRequest->date->toDateString() . ' ditolak oleh Admin. Alasan: ' . ($request->input('admin_note') ?? '-'),
                'type'    => 'overtime',
                'data'    => ['overtime_request_id' => $overtimeRequest->id]
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan lembur ditolak oleh Admin.',
                'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department', 'pjReviewer']))
            ]);
        }

        return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
    }

    /**
     * Membatalkan pengajuan lembur oleh pegawai sendiri jika belum disetujui.
     */
    public function cancel(Request $request, $id)
    {
        $user     = $request->user();
        $employee = $user->employee;
        $overtime = OvertimeRequest::findOrFail($id);

        if (!$employee || $overtime->employee_id !== $employee->id) {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses untuk membatalkan pengajuan lembur ini.'], 403);
        }

        if ($overtime->status !== 'pending' || $overtime->pj_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan lembur yang sudah disetujui tidak dapat dibatalkan oleh pegawai.',
            ], 422);
        }

        if ($overtime->photo_url) {
            $path = str_replace('/storage/', '', $overtime->photo_url);
            Storage::disk('public')->delete($path);
        }

        $overtime->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan lembur berhasil dibatalkan.',
        ]);
    }
}
