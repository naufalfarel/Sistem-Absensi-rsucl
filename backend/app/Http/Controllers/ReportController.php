<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Department;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function summary(Request $request)
    {
        $today     = today()->toDateString();
        $month     = now()->month;
        $year      = now()->year;
        $totalEmp  = Employee::where('status', 'active')->count();

        // ── Today stats ──
        $todayAttendances = Attendance::where('date', $today)->get();
        $todayHadir       = $todayAttendances->where('status', 'hadir')->count();
        $todayTelat       = $todayAttendances->where('status', 'telat')->count();
        $todayAlpha       = $totalEmp - ($todayHadir + $todayTelat) -
                            LeaveRequest::where('status', 'approved')
                                ->where('start_date', '<=', $today)
                                ->where('end_date', '>=', $today)
                                ->count();
        $todayCuti        = LeaveRequest::where('status', 'approved')
                                ->where('start_date', '<=', $today)
                                ->where('end_date', '>=', $today)
                                ->count();

        // ── This month stats ──
        $monthAttendances = Attendance::whereYear('date', $year)
                                      ->whereMonth('date', $month)
                                      ->get();

        $monthHadir = $monthAttendances->where('status', 'hadir')->count();
        $monthTelat = $monthAttendances->where('status', 'telat')->count();
        $monthAlpha = $monthAttendances->where('status', 'alpha')->count();
        $monthCuti  = LeaveRequest::where('status', 'approved')
                                  ->whereMonth('start_date', $month)
                                  ->count();

        // ── Previous month stats (for trends) ──
        $prevMonthDate = now()->subMonth();
        $prevMonth     = $prevMonthDate->month;
        $prevYear      = $prevMonthDate->year;

        $prevMonthAttendances = Attendance::whereYear('date', $prevYear)
                                          ->whereMonth('date', $prevMonth)
                                          ->get();
        $prevMonthHadir = $prevMonthAttendances->where('status', 'hadir')->count();
        $prevMonthTelat = $prevMonthAttendances->where('status', 'telat')->count();
        $prevMonthAlpha = $prevMonthAttendances->where('status', 'alpha')->count();
        $prevMonthCuti  = LeaveRequest::where('status', 'approved')
                                      ->whereMonth('start_date', $prevMonth)
                                      ->count();

        // Calculate trends
        $elapsedDaysThisMonth = now()->day;
        $expectedThisMonth    = $totalEmp * $elapsedDaysThisMonth;
        $rateThisMonth        = $expectedThisMonth > 0 ? (($monthHadir + $monthTelat) / $expectedThisMonth) * 100 : 0;

        $daysInPrevMonth      = $prevMonthDate->daysInMonth;
        $expectedPrevMonth    = $totalEmp * $daysInPrevMonth;
        $ratePrevMonth        = $expectedPrevMonth > 0 ? (($prevMonthHadir + $prevMonthTelat) / $expectedPrevMonth) * 100 : 0;

        $presenceTrend = round($rateThisMonth - $ratePrevMonth);
        $lateTrend     = $monthTelat - $prevMonthTelat;
        $alphaTrend    = $monthAlpha - $prevMonthAlpha;
        $cutiTrend     = $monthCuti - $prevMonthCuti;

        $pendingLeave = LeaveRequest::where('status', 'pending')->count();

        // ── 7-day chart ──
        $dailyData = [];
        for ($i = 6; $i >= 0; $i--) {
            $date  = now()->subDays($i)->toDateString();
            $count = Attendance::where('date', $date)->whereIn('status', ['hadir', 'telat'])->count();
            $dailyData[] = [
                'date'  => $date,
                'label' => now()->subDays($i)->locale('id')->isoFormat('ddd D/M'),
                'count' => $count,
                'total' => $totalEmp,
            ];
        }

        // ── 1. Monthly trend (strictly database) ──
        $monthlyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $monthDate = now()->subMonths($i);
            $mNum = $monthDate->month;
            $yNum = $monthDate->year;
            $mLabel = $monthDate->locale('id')->isoFormat('MMM');

            $mAtt = Attendance::whereYear('date', $yNum)->whereMonth('date', $mNum)->get();
            $mH = $mAtt->where('status', 'hadir')->count();
            $mT = $mAtt->where('status', 'telat')->count();
            $mA = $mAtt->where('status', 'alpha')->count();
            $mC = LeaveRequest::where('status', 'approved')
                ->where(function($query) use ($yNum, $mNum) {
                    $query->whereYear('start_date', $yNum)->whereMonth('start_date', $mNum)
                          ->orWhereYear('end_date', $yNum)->whereMonth('end_date', $mNum);
                })->count();

            $monthlyTrend[] = [
                'bulan' => $mLabel,
                'hadir' => $mH,
                'terlambat' => $mT,
                'alpha' => $mA,
                'cuti' => $mC
            ];
        }

        // ── 2. Composition percentages ──
        $tot = $monthHadir + $monthTelat + $monthAlpha + $monthCuti;
        $hadirPct = $tot > 0 ? round(($monthHadir / $tot) * 100) : 0;
        $telatPct = $tot > 0 ? round(($monthTelat / $tot) * 100) : 0;
        $alphaPct = $tot > 0 ? round(($monthAlpha / $tot) * 100) : 0;
        $cutiPct  = $tot > 0 ? round(($monthCuti / $tot) * 100) : 0;

        $composition = [
            ['name' => 'Hadir', 'value' => $hadirPct, 'color' => '#16A34A'],
            ['name' => 'Terlambat', 'value' => $telatPct, 'color' => '#FBBF24'],
            ['name' => 'Alpha', 'value' => $alphaPct, 'color' => '#F87171'],
            ['name' => 'Cuti/Izin', 'value' => $cutiPct, 'color' => '#A78BFA']
        ];

        // ── 3. Weekly late ──
        $weeklyLate = [];
        $dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        $startOfWeek = now()->startOfWeek();
        foreach ($dayLabels as $index => $label) {
            $date = $startOfWeek->copy()->addDays($index)->toDateString();
            $weeklyLate[] = [
                'hari' => $label,
                'count' => Attendance::where('date', $date)->where('status', 'telat')->count()
            ];
        }

        // ── 4. Department breakdown ──
        $deptList = Department::with('employees')->get();
        $deptData = [];
        foreach ($deptList as $dept) {
            $empIds = $dept->employees->pluck('id');
            $actual = Attendance::whereIn('employee_id', $empIds)
                ->whereIn('status', ['hadir', 'telat'])
                ->whereYear('date', $year)
                ->whereMonth('date', $month)
                ->count();
            $expected = $empIds->count() * now()->day;
            $percent = $expected > 0 ? round(($actual / $expected) * 100) : 0;

            $deptData[] = [
                'dept' => $dept->name,
                'persen' => min(100, $percent)
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'total_employees'   => $totalEmp,
                'today' => [
                    'hadir'  => $todayHadir,
                    'telat'  => $todayTelat,
                    'alpha'  => max(0, $todayAlpha),
                    'cuti'   => $todayCuti,
                    'belum'  => max(0, $totalEmp - ($todayHadir + $todayTelat) - $todayCuti),
                ],
                'this_month' => [
                    'hadir'  => $monthHadir,
                    'telat'  => $monthTelat,
                    'alpha'  => $monthAlpha,
                    'cuti'   => $monthCuti,
                ],
                'trends' => [
                    'presence' => $presenceTrend,
                    'late'     => $lateTrend,
                    'alpha'    => $alphaTrend,
                    'cuti'     => $cutiTrend,
                ],
                'pending_leave'     => $pendingLeave,
                'daily_chart'       => $dailyData,
                'monthly_trend'     => $monthlyTrend,
                'composition'       => $composition,
                'weekly_late'       => $weeklyLate,
                'dept_attendance'   => $deptData
            ],
        ]);
    }
}
