<?php

namespace App\Http\Controllers;

use App\Models\ShiftAssignmentProposal;
use App\Models\Employee;
use App\Models\Schedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Class ShiftAssignmentProposalController
 * 
 * Mengelola alur pengajuan (proposal) penugasan shift oleh PJ Bagian.
 * 
 * Alur:
 * 1. PJ Bagian mengajukan proposal → status 'pending'
 * 2. Admin menyetujui → penugasan sungguhan dieksekusi ke tabel pivot employee_schedule → status 'approved'
 * 3. Admin menolak → status 'rejected', admin_note wajib diisi
 */
class ShiftAssignmentProposalController extends Controller
{
    /**
     * GET /api/shift-assignment-proposals
     * 
     * Admin: lihat semua proposal (bisa filter status/department).
     * PJ Bagian: lihat hanya proposal yang diajukan oleh dirinya.
     */
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = ShiftAssignmentProposal::with([
            'employee.user',
            'employee.department',
            'schedule',
            'proposedBy',
            'reviewedBy',
        ])->orderBy('created_at', 'desc');

        if ($user->isPjBagian()) {
            // PJ Bagian hanya lihat proposal miliknya sendiri
            $query->where('proposed_by', $user->id);
        } else {
            // Admin: filter opsional
            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }
            if ($request->filled('department_id')) {
                $query->whereHas('employee', function ($q) use ($request) {
                    $q->where('department_id', $request->department_id);
                });
            }
        }

        $proposals = $query->get()->map(fn($p) => $this->format($p));

        return response()->json(['success' => true, 'data' => $proposals]);
    }

    /**
     * POST /api/shift-assignment-proposals
     * 
     * PJ Bagian mengajukan usulan penugasan shift untuk karyawan di departemennya.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->isPjBagian()) {
            return response()->json(['success' => false, 'message' => 'Hanya PJ Bagian yang dapat mengajukan usulan shift.'], 403);
        }

        if (!$user->pj_bagian_department_id) {
            return response()->json(['success' => false, 'message' => 'PJ Bagian belum ditugaskan ke departemen.'], 422);
        }

        $data = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'schedule_id' => 'nullable|exists:schedules,id',
            'day_of_week' => 'required|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
        ]);

        // Pastikan karyawan ada di departemen PJ Bagian
        $employee = Employee::findOrFail($data['employee_id']);
        if ($employee->department_id !== $user->pj_bagian_department_id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda hanya dapat mengusulkan shift untuk karyawan di departemen Anda.',
            ], 403);
        }

        // Pastikan tidak ada proposal pending yang sama untuk karyawan + hari yang sama
        $exists = ShiftAssignmentProposal::where('employee_id', $data['employee_id'])
            ->where('day_of_week', $data['day_of_week'])
            ->where('status', 'pending')
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'Sudah ada usulan shift pending untuk karyawan ini pada hari yang sama.',
            ], 422);
        }

        $proposal = ShiftAssignmentProposal::create([
            'employee_id' => $data['employee_id'],
            'schedule_id' => $data['schedule_id'] ?? null,
            'day_of_week' => $data['day_of_week'],
            'proposed_by' => $user->id,
            'status'      => 'pending',
        ]);

        // Notifikasi ke semua admin
        $admins = \App\Models\User::where('role', 'admin')->get();
        foreach ($admins as $admin) {
            \App\Models\Notification::create([
                'user_id' => $admin->id,
                'title'   => 'Usulan Shift Baru dari PJ Bagian',
                'body'    => $user->name . ' mengusulkan penugasan shift untuk ' . ($employee->user?->name ?? 'karyawan') . ' pada hari ' . $data['day_of_week'] . '.',
                'type'    => 'system',
                'data'    => ['proposal_id' => $proposal->id],
            ]);
        }

        $proposal->load(['employee.user', 'employee.department', 'schedule', 'proposedBy']);

        return response()->json([
            'success' => true,
            'message' => 'Usulan shift berhasil dikirim. Menunggu persetujuan Admin.',
            'data'    => $this->format($proposal),
        ], 201);
    }

    /**
     * PUT /api/shift-assignment-proposals/{id}/approve
     * 
     * Admin menyetujui proposal → eksekusi penugasan shift ke tabel pivot employee_schedule.
     */
    public function approve(Request $request, $id)
    {
        $proposal = ShiftAssignmentProposal::with(['employee', 'schedule', 'proposedBy'])->findOrFail($id);

        if ($proposal->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Usulan ini sudah diproses sebelumnya.'], 422);
        }

        $data = $request->validate(['admin_note' => 'nullable|string|max:300']);

        // Eksekusi penugasan shift: hapus penugasan lama pada hari yang sama, pasang yang baru jika ada
        DB::table('employee_schedule')
            ->where('employee_id', $proposal->employee_id)
            ->where('day_of_week', $proposal->day_of_week)
            ->delete();

        if ($proposal->schedule_id) {
            $proposal->employee->schedules()->attach($proposal->schedule_id, [
                'day_of_week' => $proposal->day_of_week,
            ]);
        }

        // Update status proposal
        $proposal->update([
            'status'      => 'approved',
            'admin_note'  => $data['admin_note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        $scheduleName = $proposal->schedule ? $proposal->schedule->name : 'Libur (Tidak Ada Shift)';

        // Notifikasi ke PJ Bagian yang mengajukan
        \App\Models\Notification::create([
            'user_id' => $proposal->proposed_by,
            'title'   => 'Usulan Shift Disetujui ✅',
            'body'    => 'Usulan penugasan shift untuk ' . ($proposal->employee->user?->name ?? 'karyawan') . ' pada hari ' . $proposal->day_of_week . ' telah disetujui oleh Admin.',
            'type'    => 'system',
            'data'    => ['proposal_id' => $proposal->id],
        ]);

        // Notifikasi ke karyawan yang bersangkutan
        \App\Models\Notification::create([
            'user_id' => $proposal->employee->user_id,
            'title'   => 'Jadwal Shift Diperbarui',
            'body'    => 'Jadwal dinas Anda untuk hari ' . $proposal->day_of_week . ' telah diperbarui menjadi "' . $scheduleName . '".',
            'type'    => 'system',
            'data'    => ['proposal_id' => $proposal->id],
        ]);

        $proposal->load(['employee.user', 'employee.department', 'schedule', 'proposedBy', 'reviewedBy']);

        return response()->json([
            'success' => true,
            'message' => 'Usulan shift disetujui dan penugasan telah dieksekusi.',
            'data'    => $this->format($proposal),
        ]);
    }

    /**
     * PUT /api/shift-assignment-proposals/{id}/reject
     * 
     * Admin menolak proposal — admin_note wajib diisi.
     */
    public function reject(Request $request, $id)
    {
        $proposal = ShiftAssignmentProposal::with(['employee', 'schedule', 'proposedBy'])->findOrFail($id);

        if ($proposal->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Usulan ini sudah diproses sebelumnya.'], 422);
        }

        $data = $request->validate(['admin_note' => 'required|string|max:300']);

        $proposal->update([
            'status'      => 'rejected',
            'admin_note'  => $data['admin_note'],
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        // Notifikasi ke PJ Bagian
        \App\Models\Notification::create([
            'user_id' => $proposal->proposed_by,
            'title'   => 'Usulan Shift Ditolak ❌',
            'body'    => 'Usulan penugasan shift untuk ' . ($proposal->employee->user?->name ?? 'karyawan') . ' pada hari ' . $proposal->day_of_week . ' ditolak. Alasan: ' . $data['admin_note'],
            'type'    => 'system',
            'data'    => ['proposal_id' => $proposal->id],
        ]);

        $proposal->load(['employee.user', 'employee.department', 'schedule', 'proposedBy', 'reviewedBy']);

        return response()->json([
            'success' => true,
            'message' => 'Usulan shift ditolak.',
            'data'    => $this->format($proposal),
        ]);
    }

    /**
     * Format output JSON proposal.
     */
    private function format(ShiftAssignmentProposal $p): array
    {
        return [
            'id'          => $p->id,
            'employee'    => [
                'id'         => $p->employee?->id,
                'name'       => $p->employee?->user?->name,
                'nip'        => $p->employee?->nip ?? $p->employee?->user?->nip,
                'department' => $p->employee?->department?->name,
            ],
            'schedule'    => $p->schedule ? [
                'id'         => $p->schedule->id,
                'name'       => $p->schedule->name,
                'start_time' => $p->schedule->start_time,
                'end_time'   => $p->schedule->end_time,
            ] : null,
            'day_of_week' => $p->day_of_week,
            'proposed_by' => $p->proposedBy ? ['id' => $p->proposedBy->id, 'name' => $p->proposedBy->name] : null,
            'status'      => $p->status,
            'admin_note'  => $p->admin_note,
            'reviewed_by' => $p->reviewedBy ? ['id' => $p->reviewedBy->id, 'name' => $p->reviewedBy->name] : null,
            'reviewed_at' => $p->reviewed_at?->toDateTimeString(),
            'created_at'  => $p->created_at?->toDateTimeString(),
        ];
    }
}
