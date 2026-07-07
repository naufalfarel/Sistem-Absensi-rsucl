<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    public function index()
    {
        $schedules = Schedule::with(['employees.user', 'employees.department'])->get();
        
        $schedules->each(function ($schedule) {
            $uniqueCount = $schedule->employees->unique('id')->count();
            $schedule->setAttribute('employees_count', $uniqueCount);
        });

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
        $schedule->setAttribute('employees_count', 0);
        $schedule->setAttribute('employees', []);

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

        $schedule->load(['employees.user', 'employees.department']);
        $uniqueCount = $schedule->employees->unique('id')->count();
        $schedule->setAttribute('employees_count', $uniqueCount);

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

        // Fetch all schedules to locate today's and Saturday's shifts
        $schedules = $employee->schedules()->get();

        $todaySchedule = $schedules->first(function ($s) use ($todayName) {
            return $s->pivot->day_of_week === $todayName;
        });

        $saturdaySchedule = $schedules->first(function ($s) {
            return $s->pivot->day_of_week === 'Sabtu';
        });

        $todayData = null;
        if ($todaySchedule) {
            $todayData = [
                'id'         => $todaySchedule->id,
                'name'       => $todaySchedule->name,
                'start_time' => $todaySchedule->start_time,
                'end_time'   => $todaySchedule->end_time,
                'color'      => $todaySchedule->color,
                'icon'       => $todaySchedule->icon,
            ];
        }

        $saturdayData = null;
        if ($saturdaySchedule) {
            $saturdayData = [
                'id'         => $saturdaySchedule->id,
                'name'       => $saturdaySchedule->name,
                'start_time' => $saturdaySchedule->start_time,
                'end_time'   => $saturdaySchedule->end_time,
                'color'      => $saturdaySchedule->color,
                'icon'       => $saturdaySchedule->icon,
            ];
        }

        return response()->json([
            'success' => true,
            'day'     => $todayName,
            'data'    => $todayData,
            'saturday_shift' => $saturdayData,
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
        $scheduleName = 'Libur (Tidak Ada Shift)';
        if ($data['schedule_id']) {
            $emp->schedules()->attach($data['schedule_id'], ['day_of_week' => $data['day_of_week']]);
            $scheduleObj = \App\Models\Schedule::find($data['schedule_id']);
            if ($scheduleObj) {
                $scheduleName = $scheduleObj->name;
            }
        }

        // Create a notification for the employee informing them of the shift update
        \App\Models\Notification::create([
            'user_id' => $emp->user_id,
            'title'   => 'Jadwal Shift Diperbarui',
            'body'    => 'Jadwal dinas Anda untuk hari ' . $data['day_of_week'] . ' telah diperbarui menjadi "' . $scheduleName . '" oleh Administrator.',
            'type'    => 'system',
            'data'    => ['employee_id' => $emp->id, 'day_of_week' => $data['day_of_week']],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal karyawan berhasil diperbarui.'
        ]);
    }
}
