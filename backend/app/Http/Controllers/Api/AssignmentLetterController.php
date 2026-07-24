<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssignmentLetter;
use App\Models\Employee;
use App\Models\User;
use App\Models\Notification;
use App\Http\Requests\StoreAssignmentLetterRequest;
use App\Http\Requests\UpdateAssignmentLetterStatusRequest;
use App\Http\Resources\AssignmentLetterResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class AssignmentLetterController extends Controller
{
    /**
     * Menampilkan daftar pengajuan / penerbitan surat tugas.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Mode Personal: jika pengguna bukan admin ATAU ada parameter ?personal=1
        if (!$user->isAdmin() || $request->boolean('personal')) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json([
                    'success' => true,
                    'data'    => [],
                    'meta'    => ['current_page' => 1, 'last_page' => 1, 'per_page' => 15, 'total' => 0]
                ]);
            }

            $query = AssignmentLetter::with(['employee.user', 'employee.department', 'reviewer'])
                ->where('employee_id', $employee->id)
                ->orderBy('created_at', 'desc');

            if ($request->filled('status') && $request->input('status') !== 'all') {
                $query->where('status', $request->input('status'));
            }

            $letters = $query->get();

            return response()->json([
                'success' => true,
                'data'    => AssignmentLetterResource::collection($letters),
                'meta'    => [
                    'current_page' => 1,
                    'last_page'    => 1,
                    'per_page'     => count($letters),
                    'total'        => count($letters),
                ]
            ]);
        }

        // Mode Admin: memuat semua pengajuan surat tugas masuk dengan filter
        $query = AssignmentLetter::with(['employee.user', 'employee.department', 'reviewer'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('start_date', '>=', $request->input('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('end_date', '<=', $request->input('end_date'));
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
            'data'    => AssignmentLetterResource::collection($paginated->items()),
            'meta'    => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ]
        ]);
    }

    /**
     * Menyimpan pengajuan surat tugas dari Pegawai (Skenario 1 - Step 1).
     */
    public function store(StoreAssignmentLetterRequest $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        $validated = $request->validated();

        // 1. Unggah dokumen pendukung jika ada
        $documentUrl = null;
        if ($request->hasFile('document')) {
            $file = $request->file('document');
            $fileName = 'assignment_request_' . $employee->id . '_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('assignment-letters', $fileName, 'public');
            $documentUrl = '/storage/' . $path;
        }

        // 2. Unggah foto bukti kehadiran / foto kegiatan (opsional/tambahan)
        $attendanceProofUrl = null;
        if ($request->hasFile('attendance_proof')) {
            $proofFile = $request->file('attendance_proof');
            $proofName = 'assignment_proof_' . $employee->id . '_' . time() . '.' . $proofFile->getClientOriginalExtension();
            $proofPath = $proofFile->storeAs('assignment-proofs', $proofName, 'public');
            $attendanceProofUrl = '/storage/' . $proofPath;
        }

        $letter = AssignmentLetter::create([
            'employee_id'          => $employee->id,
            'source'               => 'employee_request',
            'letter_number'        => $validated['letter_number'] ?? null,
            'title'                => $validated['title'],
            'issuing_institution'  => $validated['issuing_institution'],
            'purpose'              => $validated['purpose'],
            'start_date'           => $validated['start_date'],
            'end_date'             => $validated['end_date'],
            'document_url'         => $documentUrl,
            'attendance_proof_url' => $attendanceProofUrl,
            'status'               => 'pending',
        ]);

        // Kirim Notifikasi ke Pemohon
        Notification::create([
            'user_id' => $request->user()->id,
            'title'   => 'Pengajuan Surat Tugas Terkirim',
            'body'    => "Pengajuan surat tugas untuk kegiatan '{$letter->title}' berhasil terkirim dan menunggu persetujuan/balasan dari Admin.",
            'type'    => 'assignment_letter',
            'data'    => ['assignment_letter_id' => $letter->id],
        ]);

        // Kirim Notifikasi ke Admin
        $admins = User::whereIn('role', ['admin', 'super_admin'])->get();
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'title'   => 'Pengajuan Surat Tugas Baru',
                'body'    => "Pegawai " . ($request->user()->name) . " mengajukan surat tugas baru untuk '{$letter->title}'.",
                'type'    => 'assignment_letter',
                'data'    => ['assignment_letter_id' => $letter->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan surat tugas berhasil dikirim.',
            'data'    => new AssignmentLetterResource($letter),
        ], 201);
    }

    /**
     * Menerbitkan Surat Tugas Langsung oleh Admin kepada Pegawai (Skenario 2 - Step 1).
     */
    public function adminStore(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $validated = $request->validate([
            'employee_id'         => 'required|exists:employees,id',
            'title'               => 'required|string|max:200',
            'issuing_institution' => 'required|string|max:200',
            'purpose'             => 'required|string|max:1000',
            'start_date'          => 'required|date',
            'end_date'            => 'required|date|after_or_equal:start_date',
            'document'            => 'required|file|mimes:pdf,jpg,jpeg,png|max:2048',
            'admin_note'          => 'nullable|string|max:255',
        ]);

        $employee = Employee::with('user')->findOrFail($validated['employee_id']);

        // Unggah File Surat Tugas Resmi
        $file = $request->file('document');
        $fileName = 'assignment_official_' . $employee->id . '_' . time() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('assignment-letters', $fileName, 'public');
        $documentUrl = '/storage/' . $path;

        $letter = AssignmentLetter::create([
            'employee_id'         => $employee->id,
            'source'              => 'admin_assignment',
            'title'               => $validated['title'],
            'issuing_institution' => $validated['issuing_institution'],
            'purpose'             => $validated['purpose'],
            'start_date'          => $validated['start_date'],
            'end_date'            => $validated['end_date'],
            'document_url'        => $documentUrl,
            'status'              => 'approved',
            'admin_note'          => $validated['admin_note'] ?? 'Diterbitkan langsung oleh Admin.',
            'reviewed_by'         => $request->user()->id,
            'reviewed_at'         => now(),
        ]);

        // Kirim Notifikasi ke Pegawai
        if ($employee->user) {
            Notification::create([
                'user_id' => $employee->user->id,
                'title'   => 'Surat Tugas Resmi Diterbitkan',
                'body'    => "Admin telah menerbitkan surat tugas resmi untuk kegiatan '{$letter->title}'. Silakan unduh dokumen surat tugas.",
                'type'    => 'assignment_letter',
                'data'    => ['assignment_letter_id' => $letter->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Surat tugas berhasil diterbitkan untuk pegawai.',
            'data'    => new AssignmentLetterResource($letter),
        ], 201);
    }

    /**
     * Menampilkan detail surat tugas.
     */
    public function show($id)
    {
        $letter = AssignmentLetter::with(['employee.user', 'employee.department', 'reviewer'])->findOrFail($id);
        return response()->json([
            'success' => true,
            'data'    => new AssignmentLetterResource($letter),
        ]);
    }

    /**
     * Menyetujui pengajuan surat tugas & mengirimkan file Surat Tugas resmi balasan (Admin - Skenario 1 Step 2).
     */
    public function approve($id, Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $letter = AssignmentLetter::findOrFail($id);

        $updateData = [
            'status'      => 'approved',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'admin_note'  => $request->input('admin_note'),
        ];

        // Jika Admin mengunggah file Surat Tugas balasan resmi
        if ($request->hasFile('document')) {
            $file = $request->file('document');
            $fileName = 'assignment_official_' . $letter->employee_id . '_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('assignment-letters', $fileName, 'public');
            $updateData['document_url'] = '/storage/' . $path;
        }

        $letter->update($updateData);

        // Kirim notifikasi ke pegawai
        if ($letter->employee && $letter->employee->user) {
            Notification::create([
                'user_id' => $letter->employee->user->id,
                'title'   => 'Surat Tugas Disetujui & Diterbitkan',
                'body'    => "Pengajuan surat tugas untuk kegiatan '{$letter->title}' telah disetujui. Dokumen Surat Tugas resmi sudah dapat diunduh.",
                'type'    => 'assignment_letter',
                'data'    => ['assignment_letter_id' => $letter->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan surat tugas berhasil disetujui.',
            'data'    => new AssignmentLetterResource($letter),
        ]);
    }

    /**
     * Menolak pengajuan surat tugas (Admin).
     */
    public function reject($id, UpdateAssignmentLetterStatusRequest $request)
    {
        $letter = AssignmentLetter::findOrFail($id);
        $validated = $request->validated();

        $letter->update([
            'status'      => 'rejected',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'admin_note'  => $validated['admin_note'] ?? null,
        ]);

        // Kirim notifikasi ke pegawai yang bersangkutan
        if ($letter->employee && $letter->employee->user) {
            Notification::create([
                'user_id' => $letter->employee->user->id,
                'title'   => 'Surat Tugas Ditolak',
                'body'    => "Pengajuan surat tugas Anda untuk kegiatan '{$letter->title}' ditolak oleh admin. Alasan: " . ($validated['admin_note'] ?? '-'),
                'type'    => 'assignment_letter',
                'data'    => ['assignment_letter_id' => $letter->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan surat tugas berhasil ditolak.',
            'data'    => new AssignmentLetterResource($letter),
        ]);
    }

    /**
     * Mengunggah Foto Kegiatan & Keterangan Laporan (Pegawai - Step 3).
     */
    public function uploadReport($id, Request $request)
    {
        $letter = AssignmentLetter::findOrFail($id);
        $user = $request->user();

        // Otorisasi: Pegawai bersangkutan atau Admin
        if (!$user->isAdmin() && ($user->employee && $user->employee->id !== $letter->employee_id)) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $validated = $request->validate([
            'attendance_proof' => 'required|file|mimes:jpg,jpeg,png,pdf|max:2048',
            'activity_notes'   => 'required|string|max:1000',
        ]);

        // Unggah Foto Kegiatan / Bukti Kehadiran
        $proofFile = $request->file('attendance_proof');
        $proofName = 'assignment_report_' . $letter->employee_id . '_' . time() . '.' . $proofFile->getClientOriginalExtension();
        $proofPath = $proofFile->storeAs('assignment-proofs', $proofName, 'public');

        $letter->update([
            'attendance_proof_url' => '/storage/' . $proofPath,
            'activity_notes'        => $validated['activity_notes'],
            'status'               => 'completed',
        ]);

        // Kirim notifikasi ke Admin
        $admins = User::whereIn('role', ['admin', 'super_admin'])->get();
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'title'   => 'Laporan Surat Tugas Diunggah',
                'body'    => "Pegawai " . ($letter->employee?->user?->name ?? 'Pegawai') . " telah mengunggah foto kegiatan & keterangan laporan untuk '{$letter->title}'.",
                'type'    => 'assignment_letter',
                'data'    => ['assignment_letter_id' => $letter->id],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Foto kegiatan & keterangan laporan berhasil disimpan. Status surat tugas: Selesai.',
            'data'    => new AssignmentLetterResource($letter),
        ]);
    }

    /**
     * Membatalkan pengajuan surat tugas oleh pegawai sendiri jika belum disetujui.
     */
    public function cancel(Request $request, $id)
    {
        $user     = $request->user();
        $employee = $user->employee;
        $letter   = AssignmentLetter::findOrFail($id);

        if (!$employee || $letter->employee_id !== $employee->id) {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki akses untuk membatalkan pengajuan ini.'], 403);
        }

        if ($letter->source !== 'employee_request' || $letter->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan surat tugas yang sudah disetujui tidak dapat dibatalkan oleh pegawai.',
            ], 422);
        }

        if ($letter->document_url) {
            $path = str_replace('/storage/', '', $letter->document_url);
            Storage::disk('public')->delete($path);
        }

        $letter->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan surat tugas berhasil dibatalkan.',
        ]);
    }

    /**
     * Menghapus surat tugas (Admin).
     */
    public function destroy(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $letter = AssignmentLetter::findOrFail($id);

        // Hapus file dokumen pendukung jika ada
        if ($letter->document_url) {
            $path = str_replace('/storage/', '', $letter->document_url);
            Storage::disk('public')->delete($path);
        }

        // Hapus file bukti kehadiran jika ada
        if ($letter->attendance_proof_url) {
            $path = str_replace('/storage/', '', $letter->attendance_proof_url);
            Storage::disk('public')->delete($path);
        }

        $letter->delete();

        return response()->json([
            'success' => true,
            'message' => 'Surat tugas berhasil dihapus.',
        ]);
    }
}
