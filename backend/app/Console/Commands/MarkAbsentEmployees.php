<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Employee;
use App\Models\Attendance;
use App\Models\LeaveRequest;
use App\Support\AttendanceRules;
use Carbon\Carbon;

class MarkAbsentEmployees extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:mark-absent {date?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mark active employees who missed check-in as absent (alpha)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dateStr = $this->argument('date') ?: today('Asia/Jakarta')->toDateString();
        $date = Carbon::parse($dateStr);
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $dayName = $dayMap[$date->dayOfWeek];

        $this->info("Processing absences for date: {$dateStr} ({$dayName})");

        $employees = Employee::where('status', 'active')->get();
        $holiday = AttendanceRules::holidayOn($date);

        $count = 0;
        foreach ($employees as $emp) {
            // Check if already has attendance (any status)
            $hasAttendance = Attendance::where('employee_id', $emp->id)
                ->whereDate('date', $dateStr)
                ->exists();
            if ($hasAttendance) {
                continue;
            }

            // Check if there is an approved leave request
            $hasLeave = LeaveRequest::where('employee_id', $emp->id)
                ->where('status', 'approved')
                ->whereDate('start_date', '<=', $dateStr)
                ->where(function($q) use ($dateStr) {
                    $q->where(function($q2) use ($dateStr) {
                        $q2->whereNull('actual_end_date')
                           ->whereDate('end_date', '>=', $dateStr);
                    })->orWhere(function($q2) use ($dateStr) {
                        $q2->whereNotNull('actual_end_date')
                           ->whereDate('actual_end_date', '>=', $dateStr);
                    });
                })
                ->exists();
            if ($hasLeave) {
                continue;
            }

            // Check schedule for today
            $hasSchedule = $emp->schedules()
                ->where(function($q) use ($dayName, $dateStr) {
                    $q->where('employee_schedule.date', $dateStr)
                      ->orWhere(function($q2) use ($dayName) {
                          $q2->where('employee_schedule.day_of_week', $dayName)
                             ->whereNull('employee_schedule.date');
                      });
                })->exists();
            if (!$hasSchedule) {
                continue;
            }

            // Holiday check
            if ($holiday) {
                $isAssigned = AttendanceRules::isAssignedToWorkOnHoliday($emp, $holiday);
                if (!$isAssigned) {
                    // Pegawai tidak ditugaskan di hari libur, lewati (tidak alpha)
                    continue;
                }
            }

            // Create absent record
            Attendance::create([
                'employee_id' => $emp->id,
                'date' => $dateStr,
                'status' => 'alpha',
                'note' => 'Tidak Hadir Tanpa Keterangan' . ($holiday ? ' (Mangkir Penugasan)' : ''),
                'is_holiday_work' => false,
                'holiday_id' => $holiday ? $holiday->id : null,
            ]);

            $count++;
        }

        $this->info("Successfully marked {$count} employees as absent.");
    }
}
