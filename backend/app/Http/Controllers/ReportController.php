<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Department;
use App\Exports\VehicleExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Http\Request;

/**
 * Class ReportController
 * 
 * Mengolah dan menghasilkan data statistik absensi karyawan untuk dashboard admin,
 * grafik perkembangan kehadiran mingguan/bulanan, serta rekapitulasi laporan bulanan.
 */
class ReportController extends Controller
{
    /**
     * GET /api/reports/summary
     * 
     * Mengambil data statistik absensi lengkap untuk dashboard administrator.
     * Mengkalkulasi tren kehadiran, status hari ini, diagram lingkaran komposisi absensi,
     * grafik absensi 7 hari terakhir, keterlambatan per hari dalam seminggu, dan breakdown departemen.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function summary(Request $request)
    {
        $today     = today()->toDateString();
        // Terima parameter month & year dari query string, default ke bulan/tahun berjalan
        $month     = (int)$request->query('month', now('Asia/Jakarta')->month);
        $year      = (int)$request->query('year', now('Asia/Jakarta')->year);
        $totalEmp  = Employee::where('status', 'active')->count();

        // ── 1. Data absensi bulan berjalan secara real-time ──
        $monthReport = Attendance::getMonthlyReportData($month, $year);
        $monthReportColl = collect($monthReport);
        
        // Pengecekan status absensi untuk hari ini
        $todayReport = $monthReportColl->where('date', $today);
        $todayHadir  = $todayReport->where('status', 'hadir')->count();
        $todayTelat  = $todayReport->where('status', 'telat')->count();
        $todayAlpha  = $todayReport->where('status', 'alpha')->count();
        $todayCuti   = $todayReport->whereIn('status', ['cuti', 'izin', 'sakit'])->count();
        
        // Akumulasi statistik bulan berjalan
        $monthHadir = $monthReportColl->where('status', 'hadir')->count();
        $monthTelat = $monthReportColl->where('status', 'telat')->count();
        $monthAlpha = $monthReportColl->where('status', 'alpha')->count();
        $monthCuti  = $monthReportColl->whereIn('status', ['cuti', 'izin', 'sakit'])->count();

        // ── 2. Data absensi bulan lalu (untuk analisis tren kenaikan/penurunan) ──
        $prevMonthDate = now()->subMonth();
        $prevMonth     = $prevMonthDate->month;
        $prevYear      = $prevMonthDate->year;

        $prevMonthReport = Attendance::getMonthlyReportData($prevMonth, $prevYear);
        $prevMonthColl = collect($prevMonthReport);
        
        $prevMonthHadir = $prevMonthColl->where('status', 'hadir')->count();
        $prevMonthTelat = $prevMonthColl->where('status', 'telat')->count();
        $prevMonthAlpha = $prevMonthColl->where('status', 'alpha')->count();
        $prevMonthCuti  = $prevMonthColl->whereIn('status', ['cuti', 'izin', 'sakit'])->count();

        // Hitung persentase tren kehadiran
        $elapsedDaysThisMonth = now()->day;
        // Total ekspektasi shift yang seharusnya berjalan bulan ini s.d hari ini
        $expectedThisMonth = $monthReportColl->where('date', '<=', $today)->count();
        $rateThisMonth     = $expectedThisMonth > 0 ? (($monthHadir + $monthTelat) / $expectedThisMonth) * 100 : 0;

        // Total ekspektasi shift bulan lalu
        $expectedPrevMonth = $prevMonthColl->count();
        $ratePrevMonth     = $expectedPrevMonth > 0 ? (($prevMonthHadir + $prevMonthTelat) / $expectedPrevMonth) * 100 : 0;

        // Hitung tren (selisih bulan berjalan dengan bulan lalu)
        $presenceTrend = round($rateThisMonth - $ratePrevMonth);
        $lateTrend     = $monthTelat - $prevMonthTelat;
        $alphaTrend    = $monthAlpha - $prevMonthAlpha;
        $cutiTrend     = $monthCuti - $prevMonthCuti;

        // Hitung pengajuan cuti yang butuh persetujuan
        $pendingLeave = LeaveRequest::where('pj_status', 'approved')->where('status', 'pending')->count();

        // ── Statistik Pulang Cepat & Lembur (bulan berjalan) ────────────────
        $earlyCheckoutQuery = Attendance::whereMonth('date', $month)->whereYear('date', $year)
            ->where('is_early_checkout', true);
        $earlyTotal    = (clone $earlyCheckoutQuery)->count();
        $earlyPending  = (clone $earlyCheckoutQuery)->where('early_checkout_status', 'pending')->count();
        $earlyApproved = (clone $earlyCheckoutQuery)->where('early_checkout_status', 'approved')->count();
        $earlyRejected = (clone $earlyCheckoutQuery)->where('early_checkout_status', 'rejected')->count();

        $approvedOvertimeRequests = \App\Models\OvertimeRequest::whereMonth('date', $month)
            ->whereYear('date', $year)
            ->where('status', 'approved')
            ->get();
        $overtimeTotalIncidents = $approvedOvertimeRequests->count();
        $overtimeTotalMinutes   = 0;
        foreach ($approvedOvertimeRequests as $req) {
            $att = Attendance::where('employee_id', $req->employee_id)
                ->whereDate('date', $req->date->toDateString())
                ->first();
            if ($att) {
                $overtimeTotalMinutes += $att->overtime_minutes ?? 0;
            }
        }

        // Holiday Work Summary
        $holidayWorkRecords = Attendance::whereMonth('date', $month)->whereYear('date', $year)
            ->where('is_holiday_work', true)->get();
        $holidayWorkTotal = $holidayWorkRecords->count();

        // ── 3. Data grafik absensi harian (7 hari terakhir dalam bulan yang dipilih) ──
        // Jika bulan yang dipilih adalah bulan berjalan, ambil 7 hari terakhir sampai hari ini.
        // Jika bulan lalu, ambil 7 hari terakhir dari bulan tersebut.
        $firstAttDate = \App\Models\Attendance::orderBy('date', 'asc')->value('date');
        $systemStart  = $firstAttDate ? \Carbon\Carbon::parse($firstAttDate)->startOfDay() : now();

        $combinedReport = $monthReportColl->merge($prevMonthColl);

        // Tentukan hari terakhir untuk daily chart
        $isCurrentMonth = ($month === (int)now('Asia/Jakarta')->month && $year === (int)now('Asia/Jakarta')->year);
        $chartEndDate   = $isCurrentMonth
            ? now('Asia/Jakarta')
            : \Carbon\Carbon::create($year, $month, 1)->endOfMonth();

        $dailyData = [];
        for ($i = 6; $i >= 0; $i--) {
            $dateCarbon = $chartEndDate->copy()->subDays($i)->startOfDay();
            $date       = $dateCarbon->toDateString();
            $dayReport  = $monthReportColl->where('date', $date);

            $hadirCount = $dayReport->whereIn('status', ['hadir', 'telat'])->count();
            $alphaCount = $dayReport->where('status', 'alpha')->count();

            // Set ke 0 jika tanggal tersebut mendahului tanggal sistem absensi diaktifkan
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

        // ── 4. Tren bulanan (6 bulan sebelum bulan yang dipilih + bulan dipilih) ──
        $monthlyTrend = [];
        $selectedDate = \Carbon\Carbon::create($year, $month, 1);
        for ($i = 6; $i >= 0; $i--) {
            $monthDate = $selectedDate->copy()->subMonths($i);
            $mNum = $monthDate->month;
            $yNum = $monthDate->year;
            $mLabel = $monthDate->locale('id')->isoFormat('MMM Y');

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

        // ── 5. Persentase komposisi status absensi bulan berjalan ──
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

        // ── 6. Statistik keterlambatan per minggu dalam bulan yang dipilih ──
        $weeklyLate = [];
        $monthStart = \Carbon\Carbon::create($year, $month, 1)->startOfDay();
        $monthEnd   = \Carbon\Carbon::create($year, $month, 1)->endOfMonth()->endOfDay();
        // Hitung jumlah minggu dalam bulan yang dipilih (maks 6 minggu)
        $weekNum = 1;
        $weekCursor = $monthStart->copy()->startOfWeek(\Carbon\Carbon::MONDAY);
        while ($weekCursor->lte($monthEnd) && $weekNum <= 6) {
            $weekStart = $weekCursor->copy();
            $weekEnd   = $weekCursor->copy()->endOfWeek(\Carbon\Carbon::SUNDAY);
            // Kliping ke batas bulan
            $effectiveStart = $weekStart->lt($monthStart) ? $monthStart->copy() : $weekStart->copy();
            $effectiveEnd   = $weekEnd->gt($monthEnd) ? $monthEnd->copy() : $weekEnd->copy();
            $count = $monthReportColl->filter(function ($r) use ($effectiveStart, $effectiveEnd) {
                $d = \Carbon\Carbon::parse($r['date'])->startOfDay();
                return $r['status'] === 'telat'
                    && $d->gte($effectiveStart->startOfDay())
                    && $d->lte($effectiveEnd->endOfDay());
            })->count();
            $weeklyLate[] = [
                'hari'  => 'Mg ' . $weekNum,
                'count' => $count,
            ];
            $weekCursor->addWeek();
            $weekNum++;
        }

        // ── 7. Tingkat persentase kehadiran per Departemen/Bagian Unit Kerja ──
        $deptList = Department::with('employees')->get();
        $deptData = [];
        foreach ($deptList as $dept) {
            $empIds = $dept->employees->pluck('id');
            $deptReport = $monthReportColl->whereIn('employee_id', $empIds);
            $actual = $deptReport->whereIn('status', ['hadir', 'telat'])->count();
            $expected = $deptReport->count(); // total shift terjadwal pada departemen tersebut
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
                    'belum'  => max(0, $todayReport->count() - ($todayHadir + $todayTelat) - $todayCuti - $todayAlpha),
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
                'dept_attendance'   => $deptData,
                // ── Pulang Cepat & Lembur ──
                'early_checkout_summary' => [
                    'total'    => $earlyTotal,
                    'pending'  => $earlyPending,
                    'approved' => $earlyApproved,
                    'rejected' => $earlyRejected,
                ],
                'overtime_summary' => [
                    'total_incidents' => $overtimeTotalIncidents,
                    'total_minutes'   => $overtimeTotalMinutes,
                ],
                'holiday_work_summary' => [
                    'total_days' => $holidayWorkTotal,
                ],
            ],
        ]);
    }

    /**
     * GET /api/reports/monthly-rekap
     * 
     * Menghasilkan rekapitulasi data absensi tabular bulanan per karyawan.
     * Output menyajikan akumulasi jumlah Hadir, Terlambat, Izin, Sakit, Cuti, Alpha, dan total durasi kerja (menit).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function monthlyRekap(Request $request)
    {
        // Filter bulan & tahun rekap, default menggunakan bulan berjalan
        $month = (int)$request->query('month', now('Asia/Jakarta')->month);
        $year  = (int)$request->query('year', now('Asia/Jakarta')->year);

        // Ambil data seluruh karyawan aktif
        $employees = Employee::with(['user', 'department', 'position'])
            ->where('status', 'active')
            ->get()
            ->sortBy(fn($emp) => ($emp->department?->name ?? 'Umum') . '_' . ($emp->user?->name ?? 'Karyawan'));

        // Generate database laporan bulanan real-time
        $records = Attendance::getMonthlyReportData($month, $year);
        $recordsByEmployee = collect($records)->groupBy('employee_id');

        $rekap = [];
        foreach ($employees as $emp) {
            $empRecords = $recordsByEmployee->get($emp->id, collect());

            // Hitung akumulasi status absensi
            $hadir = $empRecords->where('status', 'hadir')->count();
            $telat = $empRecords->where('status', 'telat')->count();
            $izin  = $empRecords->where('status', 'izin')->count();
            $sakit = $empRecords->where('status', 'sakit')->count();
            $cuti  = $empRecords->where('status', 'cuti')->count();
            $alpha = $empRecords->where('status', 'alpha')->count();

            // Hitung akumulasi durasi kerja dalam menit (selisih check-in & check-out)
            $totalDurationMin = 0;
            foreach ($empRecords as $r) {
                if ($r['check_in'] && $r['check_out']) {
                    $checkInTime = $r['effective_checkin_time'] ?? $r['check_in'];
                    $in  = strtotime($checkInTime);
                    $out = strtotime($r['check_out']);
                    $totalDurationMin += (int) round(($out - $in) / 60);
                }
            }

            // Hitung overtime minutes dari OvertimeRequest approved
            $approvedReqs = \App\Models\OvertimeRequest::where('employee_id', $emp->id)
                ->whereMonth('date', $month)
                ->whereYear('date', $year)
                ->where('status', 'approved')
                ->get();
                
            $overtimeMinutes = 0;
            foreach ($approvedReqs as $req) {
                $attRecord = $empRecords->first(function($r) use ($req) {
                    $rDate = $r['date'] instanceof \Carbon\Carbon ? $r['date']->toDateString() : $r['date'];
                    return $rDate === $req->date->toDateString();
                });
                if ($attRecord) {
                    $overtimeMinutes += $attRecord['overtime_minutes'] ?? 0;
                }
            }

            $rekap[] = [
                'nik_ktp'             => $emp->nik_ktp,
                'name'                => $emp->user?->name ?? 'Karyawan',
                'department'          => $emp->department?->name ?? 'Umum',
                'hadir'               => $hadir,
                'telat'               => $telat,
                'izin'                => $izin,
                'sakit'               => $sakit,
                'cuti'                => $cuti,
                'alpha'               => $alpha,
                'duration_min'        => $totalDurationMin,
                // ── Pulang Cepat & Lembur ──
                'early_checkout_count'=> $empRecords->where('is_early_checkout', true)->count(),
                'overtime_minutes'    => $overtimeMinutes,
                'holiday_work_days'   => $empRecords->where('is_holiday_work', true)->count(),
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => $rekap,
        ]);
    }

    /**
     * GET /api/reports/vehicles/export
     *
     * Mengekspor data plat nomor kendaraan seluruh pegawai aktif/tidak aktif ke file Excel (.xlsx).
     *
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function exportVehicles()
    {
        return Excel::download(new VehicleExport, 'Data_Kendaraan_Pegawai_RSUCL.xlsx');
    }
}
