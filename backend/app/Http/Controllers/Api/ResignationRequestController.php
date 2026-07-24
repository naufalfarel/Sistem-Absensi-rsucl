<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ResignationRequest;
use App\Models\Employee;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class ResignationRequestController extends Controller
{
    /**
     * Menampilkan daftar pengajuan surat pengunduran diri.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Mode Personal: jika pengguna bukan admin & bukan pj_bagian, ATAU meminta data personal (?personal=1)
        if ((!$user->isAdmin() && !$user->isPjBagian()) || $request->boolean('personal')) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json([
                    'success' => true,
                    'data'    => [],
                    'meta'    => ['current_page' => 1, 'last_page' => 1, 'per_page' => 15, 'total' => 0]
                ]);
            }

            $query = ResignationRequest::with(['employee.user', 'employee.department', 'reviewer', 'pjReviewer'])
                ->where('employee_id', $employee->id)
                ->orderBy('created_at', 'desc');

            if ($request->filled('status') && $request->input('status') !== 'all') {
                $query->where('status', $request->input('status'));
            }

            $items = $query->get();

            return response()->json([
                'success' => true,
                'data'    => $items,
                'meta'    => [
                    'current_page' => 1,
                    'last_page'    => 1,
                    'per_page'     => count($items),
                    'total'        => count($items),
                ]
            ]);
        }

        // Mode Admin / PJ Bagian: memuat pengajuan pengunduran diri dengan filter
        $query = ResignationRequest::with(['employee.user', 'employee.department', 'reviewer', 'pjReviewer'])
            ->orderBy('created_at', 'desc');

        if ($user->isPjBagian()) {
            if (!$user->pj_bagian_department_id) {
                return response()->json(['success' => false, 'message' => 'PJ Bagian belum ditugaskan ke departemen.'], 422);
            }
            $query->whereHas('employee', function ($q) use ($user) {
                $q->where('department_id', $user->pj_bagian_department_id);
            });
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('department_id')) {
            $query->whereHas('employee', function ($q) use ($request) {
                $q->where('department_id', $request->input('department_id'));
            });
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('employee', function ($q) use ($search) {
                $q->where('nik_ktp', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($qu) use ($search) {
                      $qu->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $paginated = $query->paginate(15);

        return response()->json([
            'success' => true,
            'data'    => $paginated->items(),
            'meta'    => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ]
        ]);
    }

    /**
     * Menyimpan pengajuan surat pengunduran diri baru (Pegawai / PJ Bagian).
     */
    public function store(Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Cek apakah sudah ada pengajuan aktif/pending yang masih berjalan
        $activePending = ResignationRequest::where('employee_id', $employee->id)
            ->whereIn('status', ['pending', 'approved'])
            ->first();

        if ($activePending) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan pengunduran diri yang sedang aktif atau diproses.',
            ], 422);
        }

        $validated = $request->validate([
            'effective_date' => 'required|date',
            'reason'         => 'required|string|min:10|max:2000',
            'attachment'     => 'nullable|file|mimes:pdf|max:5120',
        ]);

        $requestDate   = Carbon::today();
        $effectiveDate = Carbon::parse($validated['effective_date'])->startOfDay();

        // VALIDASI ATURAN MINIMAL 30 HARI (ONE MONTH NOTICE)
        $minEffectiveDate = $requestDate->copy()->addDays(30);
        if ($effectiveDate->lt($minEffectiveDate)) {
            return response()->json([
                'success' => false,
                'message' => 'Sesuai kebijakan One Month Notice, Tanggal Efektif Berhenti wajib minimal 30 hari (1 bulan) sejak tanggal pengajuan (Minimal: ' . $minEffectiveDate->translatedFormat('d F Y') . ').',
            ], 422);
        }

        $noticeDays = (int) $requestDate->diffInDays($effectiveDate);

        // Unggah dokumen pendukung jika ada
        $attachmentUrl = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $fileName = 'resignation_' . $employee->id . '_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('resignation-documents', $fileName, 'public');
            $attachmentUrl = '/storage/' . $path;
        }

        // Cari PJ Bagian yang bertanggung jawab atas departemen karyawan ini
        $pjBagian = null;
        if ($employee->department_id) {
            $pjBagian = User::where('role', 'pj_bagian')
                ->where('pj_bagian_department_id', $employee->department_id)
                ->first();
        }

        // Tentukan pj_status secara otomatis
        $pjStatus = 'pending';
        $pjReviewedBy = null;
        $pjReviewedAt = null;
        $pjNote = null;

        if (!$pjBagian || $pjBagian->id === $request->user()->id) {
            $pjStatus = 'approved';
            $pjReviewedBy = $request->user()->id;
            $pjReviewedAt = now();
            $pjNote = 'Disetujui otomatis (diajukan oleh PJ Bagian / Departemen tanpa PJ)';
        }

        $resignation = ResignationRequest::create([
            'employee_id'    => $employee->id,
            'request_date'   => $requestDate->format('Y-m-d'),
            'effective_date' => $effectiveDate->format('Y-m-d'),
            'notice_days'    => $noticeDays,
            'reason'         => $validated['reason'],
            'attachment_url' => $attachmentUrl,
            'posisi'         => $employee->position?->name ?? 'Staf',
            'unit_kerja'     => $employee->department?->name ?? 'RSU Cempaka Lima',
            'status'         => 'pending',
            'pj_status'      => $pjStatus,
            'pj_reviewed_by' => $pjReviewedBy,
            'pj_reviewed_at' => $pjReviewedAt,
            'pj_note'        => $pjNote,
        ]);

        // Notifikasi untuk Pemohon
        $applicantBody = $pjStatus === 'approved' 
            ? "Pengajuan surat pengunduran diri Anda (Efektif: {$effectiveDate->format('d/m/Y')}) telah diajukan dan diteruskan ke Admin."
            : "Pengajuan surat pengunduran diri Anda (Efektif: {$effectiveDate->format('d/m/Y')}) telah berhasil dikirim dan menunggu persetujuan PJ Bagian.";
        
        Notification::create([
            'user_id' => $request->user()->id,
            'title'   => 'Pengajuan Pengunduran Diri Terkirim',
            'body'    => $applicantBody,
            'type'    => 'resignation',
            'data'    => ['resignation_id' => $resignation->id],
        ]);

        if ($pjStatus === 'approved') {
            // Notifikasi untuk Admin & Super Admin
            $admins = User::whereIn('role', ['admin', 'super_admin'])->get();
            foreach ($admins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'title'   => 'Pengajuan Resign Baru (Di-ACC PJ)',
                    'body'    => "Pegawai " . ($request->user()->name) . " mengajukan pengunduran diri efektif per " . $effectiveDate->format('d/m/Y') . " (Notice: {$noticeDays} hari). Pengajuan telah disetujui PJ Bagian.",
                    'type'    => 'resignation',
                    'data'    => ['resignation_id' => $resignation->id],
                ]);
            }
        } else {
            // Notifikasi untuk PJ Bagian
            Notification::create([
                'user_id' => $pjBagian->id,
                'title'   => 'Pengajuan Resign Baru Staf',
                'body'    => "Staf Anda " . ($request->user()->name) . " mengajukan pengunduran diri efektif per " . $effectiveDate->format('d/m/Y') . " dan membutuhkan persetujuan Anda.",
                'type'    => 'resignation',
                'data'    => ['resignation_id' => $resignation->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Surat pengunduran diri berhasil diajukan.',
            'data'    => $resignation->load(['employee.user', 'employee.department']),
        ], 201);
    }

    /**
     * Membatalkan pengajuan pengunduran diri oleh pegawai sendiri jika masih pending.
     */
    public function cancel(Request $request, $id)
    {
        $user     = $request->user();
        $employee = $user->employee;
        $resignation = ResignationRequest::findOrFail($id);

        if (!$employee || $resignation->employee_id !== $employee->id) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        if ($resignation->status !== 'pending' || $resignation->pj_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan yang sudah disetujui atau ditolak tidak dapat dibatalkan.',
            ], 422);
        }

        if ($resignation->attachment_url) {
            $path = str_replace('/storage/', '', $resignation->attachment_url);
            Storage::disk('public')->delete($path);
        }

        $resignation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan pengunduran diri telah berhasil dibatalkan.',
        ]);
    }

    /**
     * Meninjau / Memproses persetujuan pengunduran diri oleh Admin / HRD.
     */
    public function review(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak. Fitur ini khusus Administrator/HRD.'], 403);
        }

        $request->validate([
            'status'     => 'required|in:approved,rejected',
            'admin_note' => 'nullable|string|max:1000',
        ]);

        $resignation = ResignationRequest::with(['employee.user'])->findOrFail($id);
        $status      = $request->input('status');
        $adminNote   = $request->input('admin_note');

        // Jika admin memproses langsung saat pj_status masih pending, setel pj_status secara otomatis
        $pjStatus = $resignation->pj_status;
        $pjReviewedBy = $resignation->pj_reviewed_by;
        $pjReviewedAt = $resignation->pj_reviewed_at;
        $pjNote = $resignation->pj_note;

        if ($pjStatus === 'pending') {
            $pjStatus = $status;
            $pjReviewedBy = $request->user()->id;
            $pjReviewedAt = now();
            $pjNote = $adminNote ?? 'Disetujui langsung oleh Admin';
        }

        $resignation->update([
            'status'         => $status,
            'reviewed_by'    => $request->user()->id,
            'reviewed_at'    => now(),
            'admin_note'     => $adminNote,
            'pj_status'      => $pjStatus,
            'pj_reviewed_by' => $pjReviewedBy,
            'pj_reviewed_at' => $pjReviewedAt,
            'pj_note'        => $pjNote,
        ]);

        // Kirim Notifikasi ke Pemohon
        if ($resignation->employee && $resignation->employee->user) {
            $statusLabel = $status === 'approved' ? 'DISETUJUI' : 'DITOLAK';
            Notification::create([
                'user_id' => $resignation->employee->user->id,
                'title'   => "Pengajuan Resign {$statusLabel}",
                'body'    => "Pengajuan pengunduran diri Anda per " . Carbon::parse($resignation->effective_date)->format('d/m/Y') . " telah {$statusLabel} oleh HRD/Admin. " . ($adminNote ? "Catatan: {$adminNote}" : ''),
                'type'    => 'resignation',
                'data'    => ['resignation_id' => $resignation->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Status pengunduran diri berhasil diperbarui.',
            'data'    => $resignation->load(['employee.user', 'employee.department', 'reviewer', 'pjReviewer']),
        ]);
    }

    /**
     * Meninjau / Memproses persetujuan pengunduran diri oleh PJ Bagian.
     */
    public function pjReview(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isPjBagian()) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak. Fitur ini khusus PJ Bagian.'], 403);
        }

        $request->validate([
            'status'  => 'required|in:approved,rejected',
            'pj_note' => 'nullable|string|max:1000',
        ]);

        $resignation = ResignationRequest::with(['employee.user'])->findOrFail($id);
        $status      = $request->input('status');
        $pjNote      = $request->input('pj_note');

        // PJ Bagian tidak boleh approve/reject pengajuan miliknya sendiri
        if ($resignation->employee && $resignation->employee->user_id === $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat memproses pengajuan resign milik sendiri.',
            ], 403);
        }

        // PJ Bagian hanya boleh proses pengajuan dari departemennya
        if ($resignation->employee?->department_id !== $user->pj_bagian_department_id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda hanya dapat memproses pengajuan dari departemen yang Anda awasi.',
            ], 403);
        }

        // Cegah pemrosesan ulang data yang sudah disetujui/ditolak di tingkat final atau PJ Bagian
        if ($resignation->status !== 'pending' || $resignation->pj_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan ini sudah diproses sebelumnya.',
            ], 422);
        }

        if ($status === 'approved') {
            $resignation->update([
                'pj_status'      => 'approved',
                'pj_reviewed_by' => $user->id,
                'pj_reviewed_at' => now(),
                'pj_note'        => $pjNote,
            ]);

            // Kirim notifikasi ke Admin
            $admins = User::whereIn('role', ['admin', 'super_admin'])->get();
            foreach ($admins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'title'   => 'Pengajuan Resign Di-ACC PJ Bagian',
                    'body'    => "Pengajuan pengunduran diri " . ($resignation->employee?->user?->name) . " telah di-ACC oleh PJ Bagian (" . $user->name . "). Menunggu persetujuan final Anda.",
                    'type'    => 'resignation',
                    'data'    => ['resignation_id' => $resignation->id],
                ]);
            }
        } else {
            // Jika ditolak oleh PJ Bagian, status utama juga langsung ditolak secara final
            $resignation->update([
                'pj_status'      => 'rejected',
                'pj_reviewed_by' => $user->id,
                'pj_reviewed_at' => now(),
                'pj_note'        => $pjNote,
                'status'         => 'rejected',
                'reviewed_by'    => $user->id,
                'reviewed_at'    => now(),
                'admin_note'     => $pjNote ?? 'Ditolak oleh PJ Bagian',
            ]);

            // Kirim notifikasi ke pegawai
            Notification::create([
                'user_id' => $resignation->employee->user_id,
                'title'   => 'Pengajuan Resign Ditolak PJ Bagian ❌',
                'body'    => 'Pengajuan pengunduran diri Anda telah ditolak oleh PJ Bagian. Catatan: ' . ($pjNote ?? '-'),
                'type'    => 'resignation',
                'data'    => ['resignation_id' => $resignation->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan pengunduran diri berhasil diproses oleh PJ Bagian.',
            'data'    => $resignation->load(['employee.user', 'employee.department', 'reviewer', 'pjReviewer']),
        ]);
    }
}
