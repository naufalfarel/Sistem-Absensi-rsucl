<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    public function index()
    {
        $schedules = Schedule::with(['employees.user', 'employees.department'])->withCount('employees')->get();
        return response()->json(['success' => true, 'data' => $schedules]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:50',
            'start_time' => 'required|date_format:H:i',
            'end_time'   => 'required|date_format:H:i',
            'color'      => 'required|string|max:10',
            'icon'       => 'required|string|max:20',
        ]);

        $schedule = Schedule::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal shift berhasil dibuat.',
            'data'    => $schedule,
        ], 201);
    }

    public function update(Request $request, Schedule $schedule)
    {
        $data = $request->validate([
            'name'       => 'sometimes|string|max:50',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time'   => 'sometimes|date_format:H:i',
            'color'      => 'sometimes|string|max:10',
            'icon'       => 'sometimes|string|max:20',
        ]);

        $schedule->update($data);

        return response()->json(['success' => true, 'message' => 'Jadwal shift berhasil diperbarui.', 'data' => $schedule]);
    }

    public function destroy(Schedule $schedule)
    {
        $schedule->delete();
        return response()->json(['success' => true, 'message' => 'Jadwal shift berhasil dihapus.']);
    }

    public function getEmployeeSchedules()
    {
        $employees = \App\Models\Employee::with(['user', 'schedules'])->where('status', 'active')->get();
        
        $data = $employees->map(function ($emp) {
            $scheduleMap = [];
            foreach ($emp->schedules as $sched) {
                if ($sched->pivot->day_of_week) {
                    $scheduleMap[$sched->pivot->day_of_week] = [
                        'id' => $sched->id,
                        'name' => $sched->name,
                        'color' => $sched->color,
                        'icon' => $sched->icon,
                    ];
                }
            }
            return [
                'employee_id' => $emp->id,
                'name' => $emp->user->name,
                'schedules' => (object)$scheduleMap
            ];
        });

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * GET /api/my-schedule
     * Jadwal shift karyawan yang login untuk hari ini berdasarkan hari dalam seminggu.
     */
    public function mySchedule(\Illuminate\Http\Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Nama hari dalam bahasa Indonesia sesuai pivot day_of_week
        $dayMap = [
            0 => 'Minggu',
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
        ];
        $todayName = $dayMap[now('Asia/Jakarta')->dayOfWeek];

        // Cari jadwal berdasarkan hari ini
        $schedule = $employee->schedules()
            ->wherePivot('day_of_week', $todayName)
            ->first();

        if (!$schedule) {
            return response()->json([
                'success' => true,
                'data'    => null,
                'day'     => $todayName,
            ]);
        }

        return response()->json([
            'success' => true,
            'day'     => $todayName,
            'data'    => [
                'id'         => $schedule->id,
                'name'       => $schedule->name,
                'start_time' => $schedule->start_time,
                'end_time'   => $schedule->end_time,
                'color'      => $schedule->color,
                'icon'       => $schedule->icon,
            ],
        ]);
    }

    public function assignEmployeeSchedule(Request $request)
    {
        $data = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'day_of_week' => 'required|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
            'schedule_id' => 'nullable|exists:schedules,id',
        ]);

        $emp = \App\Models\Employee::findOrFail($data['employee_id']);

        // Remove existing assignment for this day of the week
        $emp->schedules()->wherePivot('day_of_week', $data['day_of_week'])->detach();

        // If schedule_id is provided, attach new assignment
        if ($data['schedule_id']) {
            $emp->schedules()->attach($data['schedule_id'], ['day_of_week' => $data['day_of_week']]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jadwal karyawan berhasil diperbarui.'
        ]);
    }
}
