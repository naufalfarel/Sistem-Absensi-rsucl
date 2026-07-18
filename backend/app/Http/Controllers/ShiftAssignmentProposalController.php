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
     * Dinonaktifkan - PJ Bagian sekarang langsung mengatur shift tanpa usulan.
     */
    public function store(Request $request)
    {
        return response()->json([
            'success' => false,
            'message' => 'Fitur pengajuan usulan shift dinonaktifkan. Silakan gunakan menu Jadwal Shift untuk mengatur jadwal secara langsung.'
        ], 403);
    }

    /**
     * PUT /api/shift-assignment-proposals/{id}/approve
     * 
     * Dinonaktifkan - Persetujuan usulan tidak lagi digunakan.
     */
    public function approve(Request $request, $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Fitur persetujuan usulan shift dinonaktifkan.'
        ], 403);
    }

    /**
     * PUT /api/shift-assignment-proposals/{id}/reject
     * 
     * Dinonaktifkan - Penolakan usulan tidak lagi digunakan.
     */
    public function reject(Request $request, $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'Fitur penolakan usulan shift dinonaktifkan.'
        ], 403);
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
                'nik_ktp'    => $p->employee?->nik_ktp ?? $p->employee?->user?->nik_ktp,
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
