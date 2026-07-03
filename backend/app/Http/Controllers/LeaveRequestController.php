<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\Notification;
use Illuminate\Http\Request;

class LeaveRequestController extends Controller
{
    /**
     * GET /api/leave-requests
     * Karyawan: milik sendiri. Admin: semua.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = LeaveRequest::with(['employee.user', 'employee.department', 'reviewer'])
                             ->orderBy('created_at', 'desc');

        if (!$user->isAdmin()) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
            }
            $query->where('employee_id', $employee->id);
        }

        $requests = $query->get()->map(fn($lr) => $this->format($lr));

        return response()->json(['success' => true, 'data' => $requests]);
    }

    /**
     * POST /api/leave-requests
     * Karyawan mengajukan permohonan cuti/izin/sakit
     */
    public function store(Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        $data = $request->validate([
            'type'       => 'required|in:cuti,izin,sakit',
            'start_date' => 'required|date|after_or_equal:today',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'reason'     => 'required|string|max:500',
        ]);

        $lr = LeaveRequest::create([
            'employee_id' => $employee->id,
            ...$data,
            'status' => 'pending',
        ]);

        // Beri notifikasi ke semua admin
        $admins = \App\Models\User::where('role', 'admin')->get();
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'title'   => 'Pengajuan ' . ucfirst($data['type']) . ' Baru',
                'body'    => $employee->user?->name . ' mengajukan ' . $data['type'] .
                             ' dari ' . $data['start_date'] . ' s/d ' . $data['end_date'] . '.',
                'type'    => 'leave',
                'data'    => ['leave_request_id' => $lr->id],
            ]);
        }

        $lr->load(['employee.user', 'employee.department', 'reviewer']);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan ' . $data['type'] . ' berhasil dikirim.',
            'data'    => $this->format($lr),
        ], 201);
    }

    /**
     * PUT /api/leave-requests/{id}/approve
     */
    public function approve(Request $request, LeaveRequest $leaveRequest)
    {
        return $this->review($request, $leaveRequest, 'approved');
    }

    /**
     * PUT /api/leave-requests/{id}/reject
     */
    public function reject(Request $request, LeaveRequest $leaveRequest)
    {
        return $this->review($request, $leaveRequest, 'rejected');
    }

    // ── Private ───────────────────────────────────────────────────────
    private function review(Request $request, LeaveRequest $lr, string $newStatus)
    {
        if ($lr->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan ini sudah diproses sebelumnya.',
            ], 422);
        }

        $data = $request->validate(['admin_note' => 'nullable|string|max:300']);

        $lr->update([
            'status'      => $newStatus,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'admin_note'  => $data['admin_note'] ?? null,
        ]);

        if ($newStatus === 'approved') {
            $start = \Carbon\Carbon::parse($lr->start_date);
            $end = \Carbon\Carbon::parse($lr->end_date);
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                $dateStr = $date->toDateString();
                \App\Models\Attendance::updateOrCreate(
                    [
                        'employee_id' => $lr->employee_id,
                        'date'        => $dateStr,
                    ],
                    [
                        'status'             => $lr->type,
                        'check_in'           => null,
                        'check_out'          => null,
                        'note'               => "Masa " . ucfirst($lr->type) . ": " . $lr->reason,
                        'latitude'           => null,
                        'longitude'          => null,
                        'accuracy'           => null,
                        'is_within_geofence' => false,
                        'image_check_in'     => null,
                        'image_check_out'    => null,
                    ]
                );
            }
        }

        // Notifikasi ke karyawan
        $statusLabel = $newStatus === 'approved' ? 'Disetujui ✅' : 'Ditolak ❌';
        Notification::create([
            'user_id' => $lr->employee->user_id,
            'title'   => 'Pengajuan ' . ucfirst($lr->type) . ' ' . $statusLabel,
            'body'    => 'Pengajuan ' . $lr->type . ' Anda untuk ' . $lr->start_date->toDateString() .
                         ' s/d ' . $lr->end_date->toDateString() . ' telah ' .
                         ($newStatus === 'approved' ? 'disetujui.' : 'ditolak.') .
                         ($data['admin_note'] ? ' Catatan admin: ' . $data['admin_note'] : ''),
            'type'    => 'leave',
            'data'    => ['leave_request_id' => $lr->id],
        ]);

        $lr->load(['employee.user', 'employee.department', 'reviewer']);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan berhasil ' . ($newStatus === 'approved' ? 'disetujui' : 'ditolak') . '.',
            'data'    => $this->format($lr),
        ]);
    }

    private function format(LeaveRequest $lr): array
    {
        return [
            'id'          => $lr->id,
            'type'        => $lr->type,
            'start_date'  => $lr->start_date?->toDateString(),
            'end_date'    => $lr->end_date?->toDateString(),
            'days'        => $lr->days_count,
            'reason'      => $lr->reason,
            'status'      => $lr->status,
            'admin_note'  => $lr->admin_note,
            'reviewed_at' => $lr->reviewed_at?->toDateTimeString(),
            'created_at'  => $lr->created_at?->toDateTimeString(),
            'employee'    => [
                'id'         => $lr->employee?->id,
                'name'       => $lr->employee?->user?->name,
                'nip'        => $lr->employee?->nip,
                'department' => $lr->employee?->department?->name,
            ],
            'reviewer'    => $lr->reviewer ? ['name' => $lr->reviewer->name] : null,
        ];
    }
}
