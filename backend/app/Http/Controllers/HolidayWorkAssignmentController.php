<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Models\HolidayWorkAssignment;
use App\Models\Employee;
use App\Http\Requests\StoreHolidayWorkAssignmentRequest;
use Illuminate\Http\Request;

class HolidayWorkAssignmentController extends Controller
{
    /**
     * GET /api/holidays/{id}/work-assignments
     * Daftar pegawai yang ditugaskan pada hari libur tertentu.
     */
    public function index($id)
    {
        $holiday = Holiday::findOrFail($id);
        $assignments = HolidayWorkAssignment::where('holiday_id', $holiday->id)
            ->with(['employee.user', 'employee.department', 'employee.position', 'assignedBy'])
            ->get();

        $formatted = $assignments->map(function ($assignment) {
            return [
                'id' => $assignment->id,
                'employee_id' => $assignment->employee_id,
                'employee_name' => $assignment->employee->user?->name ?? 'Pegawai',
                'nip' => $assignment->employee->nip,
                'department' => $assignment->employee->department?->name ?? 'Umum',
                'position' => $assignment->employee->position?->name ?? 'Staff',
                'note' => $assignment->note,
                'assigned_by_name' => $assignment->assignedBy?->name ?? 'Admin',
                'created_at' => $assignment->created_at->toDateTimeString(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $formatted,
        ]);
    }

    /**
     * POST /api/holidays/{id}/work-assignments
     * Menugaskan beberapa pegawai pada hari libur.
     */
    public function store(StoreHolidayWorkAssignmentRequest $request, $id)
    {
        $holiday = Holiday::findOrFail($id);
        $data = $request->validated();
        $employeeIds = $data['employee_ids'];
        $note = $data['note'] ?? null;
        $adminId = $request->user()->id;

        $created = [];
        foreach ($employeeIds as $empId) {
            $assignment = HolidayWorkAssignment::updateOrCreate(
                [
                    'holiday_id' => $holiday->id,
                    'employee_id' => $empId,
                ],
                [
                    'note' => $note,
                    'assigned_by' => $adminId,
                ]
            );
            $created[] = $assignment;
        }

        return response()->json([
            'success' => true,
            'message' => count($created) . ' pegawai berhasil ditugaskan.',
            'data' => $created,
        ], 201);
    }

    /**
     * DELETE /api/holidays/{id}/work-assignments/{employeeId}
     * Membatalkan penugasan kerja pada hari libur.
     */
    public function destroy($id, $employeeId)
    {
        $holiday = Holiday::findOrFail($id);
        
        $deleted = HolidayWorkAssignment::where('holiday_id', $holiday->id)
            ->where('employee_id', $employeeId)
            ->delete();

        if ($deleted) {
            return response()->json([
                'success' => true,
                'message' => 'Penugasan kerja pegawai berhasil dibatalkan.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Penugasan tidak ditemukan.',
        ], 404);
    }
}
