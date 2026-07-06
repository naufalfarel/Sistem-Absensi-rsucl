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

        // ── Today stats (derived from our dynamic monthly report data) ──
        $monthReport = Attendance::getMonthlyReportData($month, $year);
        $monthReportColl = collect($monthReport);
        
        $todayReport = $monthReportColl->where('date', $today);
        $todayHadir  = $todayReport->where('status', 'hadir')->count();
        $todayTelat  = $todayReport->where('status', 'telat')->count();
        $todayAlpha  = $todayReport->where('status', 'alpha')->count();
        $todayCuti   = $todayReport->whereIn('status', ['cuti', 'izin', 'sakit'])->count();
        
        // ── This month stats ──
        $monthHadir = $monthReportColl->where('status', 'hadir')->count();
        $monthTelat = $monthReportColl->where('status', 'telat')->count();
        $monthAlpha = $monthReportColl->where('status', 'alpha')->count();
        $monthCuti  = $monthReportColl->whereIn('status', ['cuti', 'izin', 'sakit'])->count();

        // ── Previous month stats (for trends) ──
        $prevMonthDate = now()->subMonth();
        $prevMonth     = $prevMonthDate->month;
        $prevYear      = $prevMonthDate->year;

        $prevMonthReport = Attendance::getMonthlyReportData($prevMonth, $prevYear);
        $prevMonthColl = collect($prevMonthReport);
        
        $prevMonthHadir = $prevMonthColl->where('status', 'hadir')->count();
        $prevMonthTelat = $prevMonthColl->where('status', 'telat')->count();
        $prevMonthAlpha = $prevMonthColl->where('status', 'alpha')->count();
        $prevMonthCuti  = $prevMonthColl->whereIn('status', ['cuti', 'izin', 'sakit'])->count();

        // Calculate trends
        $elapsedDaysThisMonth = now()->day;
        // Total expected shifts this month (sum of shifts for all active employees up to today)
        $expectedThisMonth = $monthReportColl->where('date', '<=', $today)->count();
        $rateThisMonth     = $expectedThisMonth > 0 ? (($monthHadir + $monthTelat) / $expectedThisMonth) * 100 : 0;

        // Total expected shifts last month
        $expectedPrevMonth = $prevMonthColl->count();
        $ratePrevMonth     = $expectedPrevMonth > 0 ? (($prevMonthHadir + $prevMonthTelat) / $expectedPrevMonth) * 100 : 0;

        $presenceTrend = round($rateThisMonth - $ratePrevMonth);
        $lateTrend     = $monthTelat - $prevMonthTelat;
        $alphaTrend    = $monthAlpha - $prevMonthAlpha;
        $cutiTrend     = $monthCuti - $prevMonthCuti;

        $pendingLeave = LeaveRequest::where('status', 'pending')->count();

        // ── 7-day chart ──
        // Find earliest attendance date to avoid showing fake Alpha before system started
        $firstAttDate = \App\Models\Attendance::orderBy('date', 'asc')->value('date');
        $systemStart  = $firstAttDate ? \Carbon\Carbon::parse($firstAttDate)->startOfDay() : now();

        $combinedReport = $monthReportColl->merge($prevMonthColl);
        $dailyData = [];
        for ($i = 6; $i >= 0; $i--) {
            $dateCarbon = now('Asia/Jakarta')->subDays($i)->startOfDay();
            $date       = $dateCarbon->toDateString();
            $dayReport  = $combinedReport->where('date', $date);

            $hadirCount = $dayReport->whereIn('status', ['hadir', 'telat'])->count();
            $alphaCount = $dayReport->where('status', 'alpha')->count();

            // If the date is before the system's first attendance, show 0/0 (system wasn't running)
            $beforeSystem = $dateCarbon->lt($systemStart);
            if ($beforeSystem) {
                $hadirCount = 0;
                $alphaCount = 0;
            }

            $dailyData[] = [
                'date'  => $date,
                'label' => $dateCarbon->locale('id')->isoFormat('ddd D/M'),
                'hadir' => $hadirCount,
                'alpha' => $alphaCount,
            ];
        }

        // ── 1. Monthly trend ──
        $monthlyTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $monthDate = now()->subMonths($i);
            $mNum = $monthDate->month;
            $yNum = $monthDate->year;
            $mLabel = $monthDate->locale('id')->isoFormat('MMM');

            $mRep = collect(Attendance::getMonthlyReportData($mNum, $yNum));
            $mH = $mRep->where('status', 'hadir')->count();
            $mT = $mRep->where('status', 'telat')->count();
            $mA = $mRep->where('status', 'alpha')->count();
            $mC = $mRep->whereIn('status', ['cuti', 'izin', 'sakit'])->count();

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
                'count' => $combinedReport->where('date', $date)->where('status', 'telat')->count()
            ];
        }

        // ── 4. Department breakdown ──
        $deptList = Department::with('employees')->get();
        $deptData = [];
        foreach ($deptList as $dept) {
            $empIds = $dept->employees->pluck('id');
            $deptReport = $monthReportColl->whereIn('employee_id', $empIds);
            $actual = $deptReport->whereIn('status', ['hadir', 'telat'])->count();
            $expected = $deptReport->count(); // only count shifts assigned to this department
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
                    'alpha'  => $todayAlpha,
                    'cuti'   => $todayCuti,
                    'belum'  => max(0, $todayReport->count() - ($todayHadir + $todayTelat) - $todayCuti),
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

    public function monthlyRekap(Request $request)
    {
        $month = (int)$request->query('month', now('Asia/Jakarta')->month);
        $year  = (int)$request->query('year', now('Asia/Jakarta')->year);

        $employees = Employee::with(['user', 'department', 'position'])
            ->where('status', 'active')
            ->get()
            ->sortBy(fn($emp) => ($emp->department?->name ?? 'Umum') . '_' . ($emp->user?->name ?? 'Karyawan'));

        $records = Attendance::getMonthlyReportData($month, $year);
        $recordsByEmployee = collect($records)->groupBy('employee_id');

        $rekap = [];
        foreach ($employees as $emp) {
            $empRecords = $recordsByEmployee->get($emp->id, collect());

            $hadir = $empRecords->where('status', 'hadir')->count();
            $telat = $empRecords->where('status', 'telat')->count();
            $izin  = $empRecords->where('status', 'izin')->count();
            $sakit = $empRecords->where('status', 'sakit')->count();
            $cuti  = $empRecords->where('status', 'cuti')->count();
            $alpha = $empRecords->where('status', 'alpha')->count();

            // Durasi kerja (total menit)
            $totalDurationMin = 0;
            foreach ($empRecords as $r) {
                if ($r['check_in'] && $r['check_out']) {
                    $in  = strtotime($r['check_in']);
                    $out = strtotime($r['check_out']);
                    $totalDurationMin += (int) round(($out - $in) / 60);
                }
            }

            $rekap[] = [
                'nip'          => $emp->nip,
                'name'         => $emp->user?->name ?? 'Karyawan',
                'department'   => $emp->department?->name ?? 'Umum',
                'hadir'        => $hadir,
                'telat'        => $telat,
                'izin'         => $izin,
                'sakit'        => $sakit,
                'cuti'         => $cuti,
                'alpha'        => $alpha,
                'duration_min' => $totalDurationMin,
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => $rekap,
        ]);
    }
}
