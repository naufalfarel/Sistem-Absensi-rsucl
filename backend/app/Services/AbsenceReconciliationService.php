<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\HolidayWorkAssignment;
use App\Models\LeaveRequest;
use App\Models\Setting;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AbsenceReconciliationService
{
    private const DAY_NAMES = [
        0 => 'Minggu',
        1 => 'Senin',
        2 => 'Selasa',
        3 => 'Rabu',
        4 => 'Kamis',
        5 => 'Jumat',
        6 => 'Sabtu',
    ];

    public function reconcileOutstanding(?CarbonInterface $now = null): int
    {
        $now = $now ? Carbon::instance($now) : Carbon::now('Asia/Jakarta');
        $endDate = $now->copy()->subDay()->startOfDay();
        $lastReconciled = Setting::get('alpha_reconciled_through');

        if ($lastReconciled) {
            $startDate = Carbon::parse($lastReconciled, 'Asia/Jakarta')->addDay()->startOfDay();
        } else {
            $firstAttendanceDate = Attendance::withTrashed()->orderBy('date')->value('date');
            if (! $firstAttendanceDate) {
                return 0;
            }
            $startDate = Carbon::parse($firstAttendanceDate, 'Asia/Jakarta')->startOfDay();
        }

        if ($startDate->gt($endDate)) {
            return 0;
        }

        $created = 0;
        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            $created += $this->reconcileDate($date, $now);
            Setting::set('alpha_reconciled_through', $date->toDateString());
        }

        return $created;
    }

    public function reconcileDate(string|CarbonInterface $date, ?CarbonInterface $now = null): int
    {
        $date = ($date instanceof CarbonInterface ? Carbon::instance($date) : Carbon::parse($date, 'Asia/Jakarta'))->startOfDay();
        $now = $now ? Carbon::instance($now) : Carbon::now('Asia/Jakarta');

        if ($date->gt($now->copy()->startOfDay())) {
            return 0;
        }

        $employees = Employee::query()
            ->where('status', 'active')
            ->where(function ($query) use ($date) {
                $query->whereNull('join_date')->orWhereDate('join_date', '<=', $date->toDateString());
            })
            ->get(['id']);

        if ($employees->isEmpty()) {
            return 0;
        }

        $employeeIds = $employees->pluck('id');
        $dateString = $date->toDateString();
        $existingEmployeeIds = Attendance::withTrashed()
            ->whereDate('date', $dateString)
            ->whereIn('employee_id', $employeeIds)
            ->pluck('employee_id')
            ->flip();
        $leaveEmployeeIds = $this->approvedLeaveEmployeeIds($employeeIds, $dateString);
        $dateSchedules = $this->dateSchedules($employeeIds, $dateString);
        $weeklySchedules = $this->weeklySchedules($employeeIds, self::DAY_NAMES[$date->dayOfWeek]);
        $holiday = Holiday::whereDate('date', $dateString)->first();
        $holidayAssignments = $holiday
            ? HolidayWorkAssignment::where('holiday_id', $holiday->id)->pluck('employee_id')->flip()
            : collect();

        $timestamp = now();
        $rows = [];

        foreach ($employees as $employee) {
            if ($existingEmployeeIds->has($employee->id) || $leaveEmployeeIds->has($employee->id)) {
                continue;
            }

            $scheduleRows = $dateSchedules->has($employee->id)
                ? $dateSchedules->get($employee->id)
                : $weeklySchedules->get($employee->id, collect());
            $schedule = $this->workingSchedule($scheduleRows);

            if (! $schedule) {
                continue;
            }

            if ($holiday && ! $holidayAssignments->has($employee->id)) {
                continue;
            }

            if ($date->isToday() && ! $this->isCheckinWindowClosed($date, $schedule, $now)) {
                continue;
            }

            $rows[] = [
                'employee_id' => $employee->id,
                'schedule_id' => $schedule->id,
                'date' => $dateString,
                'status' => 'alpha',
                'note' => 'Tidak Hadir Tanpa Keterangan'.($holiday ? ' (Mangkir Penugasan)' : ''),
                'is_holiday_work' => false,
                'holiday_id' => $holiday?->id,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        return $rows === [] ? 0 : DB::table('attendance')->insertOrIgnore($rows);
    }

    public function isCheckinWindowClosed(CarbonInterface $date, object $schedule, ?CarbonInterface $now = null): bool
    {
        $now = $now ? Carbon::instance($now) : Carbon::now('Asia/Jakarta');
        $shiftStart = Carbon::parse($date->toDateString().' '.$schedule->start_time, 'Asia/Jakarta');

        if (! empty($schedule->checkin_window_end_time)) {
            $windowEnd = Carbon::parse($date->toDateString().' '.$schedule->checkin_window_end_time, 'Asia/Jakarta');
            if ($windowEnd->lte($shiftStart)) {
                $windowEnd->addDay();
            }
        } else {
            $shiftEnd = Carbon::parse($date->toDateString().' '.$schedule->end_time, 'Asia/Jakarta');
            if ($shiftEnd->lte($shiftStart)) {
                $shiftEnd->addDay();
            }
            $windowEnd = $shiftStart->copy()->addMinutes((int) ($shiftStart->diffInMinutes($shiftEnd) / 2));
        }

        return $now->gt($windowEnd);
    }

    private function approvedLeaveEmployeeIds(Collection $employeeIds, string $date): Collection
    {
        return LeaveRequest::where('status', 'approved')
            ->whereIn('employee_id', $employeeIds)
            ->whereDate('start_date', '<=', $date)
            ->where(function ($query) use ($date) {
                $query->where(function ($nested) use ($date) {
                    $nested->whereNull('actual_end_date')->whereDate('end_date', '>=', $date);
                })->orWhere(function ($nested) use ($date) {
                    $nested->whereNotNull('actual_end_date')->whereDate('actual_end_date', '>=', $date);
                });
            })
            ->pluck('employee_id')
            ->flip();
    }

    private function dateSchedules(Collection $employeeIds, string $date): Collection
    {
        return DB::table('employee_schedule')
            ->join('schedules', 'employee_schedule.schedule_id', '=', 'schedules.id')
            ->whereIn('employee_schedule.employee_id', $employeeIds)
            ->whereDate('employee_schedule.work_date', $date)
            ->select(
                'employee_schedule.employee_id',
                'schedules.id',
                'schedules.name',
                'schedules.start_time',
                'schedules.end_time',
                'schedules.checkin_window_end_time',
            )
            ->get()
            ->groupBy('employee_id');
    }

    private function weeklySchedules(Collection $employeeIds, string $dayName): Collection
    {
        return DB::table('employee_schedule')
            ->join('schedules', 'employee_schedule.schedule_id', '=', 'schedules.id')
            ->whereIn('employee_schedule.employee_id', $employeeIds)
            ->where('employee_schedule.day_of_week', $dayName)
            ->whereNull('employee_schedule.work_date')
            ->select(
                'employee_schedule.employee_id',
                'schedules.id',
                'schedules.name',
                'schedules.start_time',
                'schedules.end_time',
                'schedules.checkin_window_end_time',
            )
            ->get()
            ->groupBy('employee_id');
    }

    private function workingSchedule(Collection $schedules): ?object
    {
        return $schedules->first(function (object $schedule): bool {
            $name = mb_strtoupper($schedule->name ?? '');

            return ! str_contains($name, 'LIBUR')
                && ! str_contains($name, 'LJ')
                && ! str_contains($name, 'OFF');
        });
    }
}
