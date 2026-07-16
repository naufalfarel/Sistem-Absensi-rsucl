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

        if ($user->role === 'employee') {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Profil pegawai tidak ditemukan.'], 404);
            }
            $query->where('employee_id', $employee->id);
        } else {
            // Admin Filters
            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
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
                    $q->where('nip', 'like', "%{$search}%")
                      ->orWhereHas('user', function ($uq) use ($search) {
                          $uq->where('name', 'like', "%{$search}%");
                      });
                });
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
                $q->where('nip', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $pending = (clone $query)->where('status', 'pending')->count();
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

        $overtimeRequest = OvertimeRequest::create([
            'employee_id'   => $employee->id,
            'date'          => $dateStr,
            'reason'        => $request->reason,
            'photo_url'     => $photoUrl,
            'location_note' => $request->location_note,
            'status'        => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan lembur berhasil dikirim.',
            'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department']))
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

    /**
     * Approve the specified overtime request.
     */
    public function approve(UpdateOvertimeRequestStatusRequest $request, $id)
    {
        $overtimeRequest = OvertimeRequest::findOrFail($id);

        if ($overtimeRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status pengajuan lembur ini sudah diputuskan sebelumnya.'
            ], 422);
        }

        $overtimeRequest->update([
            'status'      => 'approved',
            'admin_note'  => $request->input('admin_note'),
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        // Kirim notifikasi ke pegawai
        \App\Models\Notification::create([
            'user_id' => $overtimeRequest->employee->user_id,
            'title'   => 'Pengajuan Lembur Disetujui ✅',
            'body'    => 'Pengajuan lembur Anda tanggal ' . $overtimeRequest->date->toDateString() . ' telah disetujui.',
            'type'    => 'overtime',
            'data'    => ['overtime_request_id' => $overtimeRequest->id]
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan lembur disetujui.',
            'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department']))
        ]);
    }

    /**
     * Reject the specified overtime request.
     */
    public function reject(UpdateOvertimeRequestStatusRequest $request, $id)
    {
        $overtimeRequest = OvertimeRequest::findOrFail($id);

        if ($overtimeRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status pengajuan lembur ini sudah diputuskan sebelumnya.'
            ], 422);
        }

        $overtimeRequest->update([
            'status'      => 'rejected',
            'admin_note'  => $request->input('admin_note'),
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        // Kirim notifikasi ke pegawai
        \App\Models\Notification::create([
            'user_id' => $overtimeRequest->employee->user_id,
            'title'   => 'Pengajuan Lembur Ditolak ❌',
            'body'    => 'Pengajuan lembur Anda tanggal ' . $overtimeRequest->date->toDateString() . ' ditolak. Alasan: ' . $request->input('admin_note'),
            'type'    => 'overtime',
            'data'    => ['overtime_request_id' => $overtimeRequest->id]
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan lembur ditolak.',
            'data'    => new OvertimeRequestResource($overtimeRequest->fresh(['employee.user', 'employee.department']))
        ]);
    }
}
