<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Models\Employee;
use App\Models\LeaveRequest;
use Carbon\Carbon;

class Attendance extends Model
{
    use SoftDeletes;

    protected $table = 'attendance';

    protected $fillable = [
        'employee_id', 'date', 'check_in', 'check_out',
        'status', 'latitude', 'longitude', 'accuracy',
        'is_within_geofence', 'note',
        'image_check_in', 'image_check_out',
    ];

    protected $casts = [
        'date'             => 'date',
        'is_within_geofence' => 'boolean',
        'accuracy'         => 'float',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /** Hitung durasi kerja dalam menit */
    public function getDurationMinutesAttribute(): ?int
    {
        if (!$this->check_in || !$this->check_out) return null;
        $in  = strtotime($this->check_in);
        $out = strtotime($this->check_out);
        return (int) round(($out - $in) / 60);
    }

    /**
     * Generate real-time report data for a specific month and year.
     * Computes "Alpa" and filters based on employee shift assignments.
     */
    public static function getMonthlyReportData(int $month, int $year, ?int $employeeId = null): array
    {
        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = Carbon::createFromDate($year, $month, 1)->endOfMonth();

        // Get active employees
        $employeesQuery = Employee::with(['user', 'department', 'position', 'schedules'])
            ->where('status', 'active');
        if ($employeeId) {
            $employeesQuery->where('id', $employeeId);
        }
        $employees = $employeesQuery->get();

        // Get attendances for this month
        $attendancesQuery = self::whereYear('date', $year)
            ->whereMonth('date', $month);
        if ($employeeId) {
            $attendancesQuery->where('employee_id', $employeeId);
        }
        $attendances = $attendancesQuery->get()->groupBy(fn($att) => $att->employee_id . '_' . $att->date->toDateString());

        // Get approved leave requests for this month
        $leaveRequestsQuery = LeaveRequest::where('status', 'approved')
            ->where(function($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate->toDateString(), $endDate->toDateString()])
                  ->orWhereBetween('end_date', [$startDate->toDateString(), $endDate->toDateString()])
                  ->orWhere(function($q2) use ($startDate, $endDate) {
                      $q2->where('start_date', '<=', $startDate->toDateString())
                         ->where('end_date', '>=', $endDate->toDateString());
                  });
            });
        if ($employeeId) {
            $leaveRequestsQuery->where('employee_id', $employeeId);
        }
        $leaveRequests = $leaveRequestsQuery->get()->groupBy('employee_id');

        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];

        // Limit Alpa checking to today's date if checking current month
        $today = Carbon::today('Asia/Jakarta');
        $limitDate = $endDate->gt($today) ? $today : $endDate;

        // Find the earliest attendance date in the system (across all months)
        // Alpha records should NOT be generated before this date — the system wasn't running yet
        $firstAttendanceDate = self::orderBy('date', 'asc')->value('date');
        $systemStartDate = $firstAttendanceDate
            ? Carbon::parse($firstAttendanceDate)->startOfDay()
            : $today; // If no records at all, default to today (no alpha for anyone)

        $reportRecords = [];

        // Loop through each calendar day of the month
        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            $dateStr = $date->toDateString();
            $dayOfWeekName = $dayMap[$date->dayOfWeek];

            foreach ($employees as $emp) {
                // 1. Check if employee has a shift on this day of the week
                $hasShift = $emp->schedules->contains(function($schedule) use ($dayOfWeekName) {
                    return $schedule->pivot->day_of_week === $dayOfWeekName;
                });

                if (!$hasShift) {
                    continue; // Skip off-days
                }

                $key = $emp->id . '_' . $dateStr;

                // 2. Check if there is an attendance record
                if (isset($attendances[$key])) {
                    $attRecord = $attendances[$key]->first();
                    $reportRecords[] = [
                        'id' => $attRecord->id,
                        'employee_id' => $emp->id,
                        'date' => $dateStr,
                        'check_in' => $attRecord->check_in,
                        'check_out' => $attRecord->check_out,
                        'status' => $attRecord->status,
                        'duration_min' => $attRecord->duration_minutes,
                        'latitude' => $attRecord->latitude,
                        'longitude' => $attRecord->longitude,
                        'accuracy' => $attRecord->accuracy,
                        'is_within_geofence' => (bool)$attRecord->is_within_geofence,
                        'note' => $attRecord->note,
                        'employee' => [
                            'id' => $emp->id,
                            'name' => $emp->user?->name ?? 'Karyawan',
                            'nip' => $emp->nip,
                            'department' => $emp->department?->name ?? 'Umum',
                            'position' => $emp->position?->name ?? 'Staff',
                        ],
                        'image_check_in' => $attRecord->image_check_in,
                        'image_check_out' => $attRecord->image_check_out,
                    ];
                } else {
                    // 3. No attendance. Check if there is an approved leave request
                    $empLeaves = $leaveRequests->get($emp->id, collect());
                    $matchingLeave = $empLeaves->first(function($leave) use ($dateStr) {
                        return $dateStr >= $leave->start_date && $dateStr <= $leave->end_date;
                    });

                    if ($matchingLeave) {
                        $reportRecords[] = [
                            'id' => null,
                            'employee_id' => $emp->id,
                            'date' => $dateStr,
                            'check_in' => null,
                            'check_out' => null,
                            'status' => $matchingLeave->type, // cuti, izin, sakit
                            'duration_min' => null,
                            'latitude' => null,
                            'longitude' => null,
                            'accuracy' => null,
                            'is_within_geofence' => false,
                            'note' => $matchingLeave->reason,
                            'employee' => [
                                'id' => $emp->id,
                                'name' => $emp->user?->name ?? 'Karyawan',
                                'nip' => $emp->nip,
                                'department' => $emp->department?->name ?? 'Umum',
                                'position' => $emp->position?->name ?? 'Staff',
                            ],
                            'image_check_in' => null,
                            'image_check_out' => null,
                        ];
                    } else {
                        // 4. No attendance and no leave.
                        // Only mark as Alpha if:
                        //  a) The date is in the past or today (not the future)
                        //  b) The date is >= systemStartDate (system was operational)
                        if ($date->lte($limitDate) && $date->gte($systemStartDate)) {
                            $reportRecords[] = [
                                'id' => null,
                                'employee_id' => $emp->id,
                                'date' => $dateStr,
                                'check_in' => null,
                                'check_out' => null,
                                'status' => 'alpha',
                                'duration_min' => null,
                                'latitude' => null,
                                'longitude' => null,
                                'accuracy' => null,
                                'is_within_geofence' => false,
                                'note' => 'Tidak Hadir Tanpa Keterangan',
                                'employee' => [
                                    'id' => $emp->id,
                                    'name' => $emp->user?->name ?? 'Karyawan',
                                    'nip' => $emp->nip,
                                    'department' => $emp->department?->name ?? 'Umum',
                                    'position' => $emp->position?->name ?? 'Staff',
                                ],
                                'image_check_in' => null,
                                'image_check_out' => null,
                            ];
                        }
                    }
                }
            }
        }

        // Sort by date desc, then by department name asc, then by employee name asc
        usort($reportRecords, function($a, $b) {
            $dateComp = strcmp($b['date'], $a['date']);
            if ($dateComp !== 0) return $dateComp;

            $deptComp = strcmp($a['employee']['department'], $b['employee']['department']);
            if ($deptComp !== 0) return $deptComp;

            return strcmp($a['employee']['name'], $b['employee']['name']);
        });

        return $reportRecords;
    }
}
