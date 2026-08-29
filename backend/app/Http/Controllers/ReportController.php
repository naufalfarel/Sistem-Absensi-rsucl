<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Department;
use App\Exports\VehicleExport;
use App\Exports\SocialMediaExport;
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
        $month     = (int)$request->query('month', now('Asia/Jakarta')->month);
        $year      = (int)$request->query('year', now('Asia/Jakarta')->year);
        $totalEmp  = Employee::where('status', 'active')->count();

        // ── 1. Data absensi hari ini ──
        $todayAtts = Attendance::whereDate('date', $today)->get();
        $todayHadir = $todayAtts->where('status', 'hadir')->count();
        $todayTelat = $todayAtts->where('status', 'telat')->count();

        $todayCuti = LeaveRequest::where('status', 'approved')
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->count();

        $todayPresentTotal = $todayHadir + $todayTelat + $todayCuti;
        $todayAlpha = max(0, $totalEmp - $todayPresentTotal);

        // ── 2. Data absensi bulan berjalan & bulan lalu (Direct SQL Aggregates) ──
        $monthHadir = Attendance::whereMonth('date', $month)->whereYear('date', $year)->where('status', 'hadir')->count();
        $monthTelat = Attendance::whereMonth('date', $month)->whereYear('date', $year)->where('status', 'telat')->count();
        $monthAlpha = Attendance::whereMonth('date', $month)->whereYear('date', $year)->where('status', 'alpha')->count();
        $monthCuti  = LeaveRequest::where('status', 'approved')
            ->where(function($q) use ($month, $year) {
                $q->whereMonth('start_date', $month)->whereYear('start_date', $year);
            })->count();

        $prevMonthDate = \Carbon\Carbon::create($year, $month, 1)->subMonth();
        $prevMonth     = $prevMonthDate->month;
        $prevYear      = $prevMonthDate->year;

        $prevMonthHadir = Attendance::whereMonth('date', $prevMonth)->whereYear('date', $prevYear)->where('status', 'hadir')->count();
        $prevMonthTelat = Attendance::whereMonth('date', $prevMonth)->whereYear('date', $prevYear)->where('status', 'telat')->count();
        $prevMonthAlpha = Attendance::whereMonth('date', $prevMonth)->whereYear('date', $prevYear)->where('status', 'alpha')->count();
        $prevMonthCuti  = LeaveRequest::where('status', 'approved')
            ->where(function($q) use ($prevMonth, $prevYear) {
                $q->whereMonth('start_date', $prevMonth)->whereYear('start_date', $prevYear);
            })->count();

        // Hitung persentase tren kehadiran
        $totThisMonth  = $monthHadir + $monthTelat + $monthAlpha + $monthCuti;
        $rateThisMonth = $totThisMonth > 0 ? (($monthHadir + $monthTelat) / $totThisMonth) * 100 : 0;

        $totPrevMonth  = $prevMonthHadir + $prevMonthTelat + $prevMonthAlpha + $prevMonthCuti;
        $ratePrevMonth = $totPrevMonth > 0 ? (($prevMonthHadir + $prevMonthTelat) / $totPrevMonth) * 100 : 0;

        $presenceTrend = round($rateThisMonth - $ratePrevMonth);
        $lateTrend     = $monthTelat - $prevMonthTelat;
        $alphaTrend    = $monthAlpha - $prevMonthAlpha;
        $cutiTrend     = $monthCuti - $prevMonthCuti;

        // Hitung pengajuan cuti yang butuh persetujuan
        $pendingLeave = LeaveRequest::where('pj_status', 'approved')->where('status', 'pending')->count();

        // ── Statistik Pulang Cepat & Lembur ──
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
            $reqDateStr = $req->date instanceof \Carbon\Carbon ? $req->date->toDateString() : (string) $req->date;
            $att = Attendance::where('employee_id', $req->employee_id)
                ->whereDate('date', $reqDateStr)
                ->first();
            if ($att) {
                $overtimeTotalMinutes += $att->overtime_minutes ?? 0;
            }
        }

        // Holiday Work Summary
        $holidayWorkRecords = Attendance::whereMonth('date', $month)->whereYear('date', $year)
            ->where('is_holiday_work', true)->get();
        $holidayWorkTotal = $holidayWorkRecords->count();

        // ── 3. Data grafik absensi harian (7 hari terakhir) ──
        $isCurrentMonth = ($month === (int)now('Asia/Jakarta')->month && $year === (int)now('Asia/Jakarta')->year);
        $chartEndDate   = $isCurrentMonth
            ? now('Asia/Jakarta')
            : \Carbon\Carbon::create($year, $month, 1)->endOfMonth();

        $dailyData = [];
        for ($i = 6; $i >= 0; $i--) {
            $dateCarbon = $chartEndDate->copy()->subDays($i)->startOfDay();
            $date       = $dateCarbon->toDateString();

            $hadirCount = Attendance::whereDate('date', $date)->whereIn('status', ['hadir', 'telat'])->count();
            $alphaCount = Attendance::whereDate('date', $date)->where('status', 'alpha')->count();

            $dailyData[] = [
                'date'  => $date,
                'label' => $dateCarbon->locale('id')->isoFormat('ddd D/M'),
                'hadir' => $hadirCount,
                'alpha' => $alphaCount,
            ];
        }

        // ── 4. Tren bulanan (7 bulan) ──
        $monthlyTrend = [];
        $selectedDate = \Carbon\Carbon::create($year, $month, 1);
        for ($i = 6; $i >= 0; $i--) {
            $monthDate = $selectedDate->copy()->subMonths($i);
            $mNum   = $monthDate->month;
            $yNum   = $monthDate->year;
            $mLabel = $monthDate->locale('id')->isoFormat('MMM Y');

            $mH = Attendance::whereMonth('date', $mNum)->whereYear('date', $yNum)->where('status', 'hadir')->count();
            $mT = Attendance::whereMonth('date', $mNum)->whereYear('date', $yNum)->where('status', 'telat')->count();
            $mA = Attendance::whereMonth('date', $mNum)->whereYear('date', $yNum)->where('status', 'alpha')->count();
            $mC = LeaveRequest::where('status', 'approved')
                ->where(function($q) use ($mNum, $yNum) {
                    $q->whereMonth('start_date', $mNum)->whereYear('start_date', $yNum);
                })->count();

            $monthlyTrend[] = [
                'bulan'     => $mLabel,
                'hadir'     => $mH,
                'terlambat' => $mT,
                'alpha'     => $mA,
                'cuti'      => $mC
            ];
        }

        // ── 5. Persentase komposisi status absensi ──
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

        // ── 6. Keterlambatan per minggu ──
        $weeklyLate = [];
        $monthStart = \Carbon\Carbon::create($year, $month, 1)->startOfDay();
        $monthEnd   = \Carbon\Carbon::create($year, $month, 1)->endOfMonth()->endOfDay();
        $weekNum    = 1;
        $weekCursor = $monthStart->copy()->startOfWeek(\Carbon\Carbon::MONDAY);
        while ($weekCursor->lte($monthEnd) && $weekNum <= 6) {
            $weekStart = $weekCursor->copy();
            $weekEnd   = $weekCursor->copy()->endOfWeek(\Carbon\Carbon::SUNDAY);
            $effectiveStart = $weekStart->lt($monthStart) ? $monthStart->copy() : $weekStart->copy();
            $effectiveEnd   = $weekEnd->gt($monthEnd) ? $monthEnd->copy() : $weekEnd->copy();

            $count = Attendance::whereBetween('date', [$effectiveStart->toDateString(), $effectiveEnd->toDateString()])
                ->where('status', 'telat')
                ->count();

            $weeklyLate[] = [
                'hari'  => 'Mg ' . $weekNum,
                'count' => $count,
            ];
            $weekCursor->addWeek();
            $weekNum++;
        }

        // ── 7. Tingkat kehadiran per Unit Kerja ──
        $deptList = Department::with('employees')->get();
        $deptData = [];
        foreach ($deptList as $dept) {
            $empIds = $dept->employees->pluck('id');
            $actual = Attendance::whereIn('employee_id', $empIds)
                ->whereMonth('date', $month)
                ->whereYear('date', $year)
                ->whereIn('status', ['hadir', 'telat'])
                ->count();
            $totalAtts = Attendance::whereIn('employee_id', $empIds)
                ->whereMonth('date', $month)
                ->whereYear('date', $year)
                ->count();

            $percent = $totalAtts > 0 ? round(($actual / $totalAtts) * 100) : 0;
            $deptData[] = [
                'dept'   => $dept->name,
                'persen' => min(100, $percent)
            ];
        }

        // ── 8. Rangking Kedisiplinan ──
        $todayDate = today()->toDateString();
        $dailyRankingRecords = Attendance::whereDate('date', $todayDate)
            ->where('status', 'hadir')
            ->whereNotNull('check_in')
            ->with(['employee.user', 'employee.department'])
            ->orderBy('check_in', 'asc')
            ->take(10)
            ->get();

        $dailyDiligenceRanking = [];
        $rankIdx = 1;
        foreach ($dailyRankingRecords as $rec) {
            $dailyDiligenceRanking[] = [
                'rank'        => $rankIdx++,
                'employee_id' => $rec->employee_id,
                'name'        => $rec->employee?->user?->name ?? 'Karyawan',
                'department'  => $rec->employee?->department?->name ?? 'Umum',
                'check_in'    => $rec->check_in ? substr($rec->check_in, 0, 5) : '--:--',
            ];
        }

        // Rangking Bulanan
        $rankAtts = Attendance::whereMonth('date', $month)
            ->whereYear('date', $year)
            ->with(['employee.user', 'employee.department'])
            ->get()
            ->groupBy('employee_id');

        $monthlyDiligenceRanking = [];
        foreach ($rankAtts as $empId => $empRecords) {
            $hadirCount = $empRecords->where('status', 'hadir')->count();
            $telatCount = $empRecords->where('status', 'telat')->count();
            $alphaCount = $empRecords->where('status', 'alpha')->count();
            $activeDays = $hadirCount + $telatCount;
            $punctualityRate = $activeDays > 0 ? round(($hadirCount / $activeDays) * 100) : 0;

            if ($hadirCount > 0) {
                $firstRecord = $empRecords->first();
                $monthlyDiligenceRanking[] = [
                    'employee_id'      => $empId,
                    'name'             => $firstRecord->employee?->user?->name ?? 'Karyawan',
                    'department'       => $firstRecord->employee?->department?->name ?? 'Umum',
                    'hadir_count'      => $hadirCount,
                    'telat_count'      => $telatCount,
                    'alpha_count'      => $alphaCount,
                    'punctuality_rate' => $punctualityRate,
                ];
            }
        }

        usort($monthlyDiligenceRanking, function($a, $b) {
            $hadirComp = $b['hadir_count'] <=> $a['hadir_count'];
            if ($hadirComp !== 0) return $hadirComp;
            $telatComp = $a['telat_count'] <=> $b['telat_count'];
            if ($telatComp !== 0) return $telatComp;
            return $a['alpha_count'] <=> $b['alpha_count'];
        });

        $monthlyDiligenceRanking = array_slice($monthlyDiligenceRanking, 0, 10);
        foreach ($monthlyDiligenceRanking as $idx => &$item) {
            $item['rank'] = $idx + 1;
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'diligence_ranking' => [
                    'daily'   => $dailyDiligenceRanking,
                    'monthly' => $monthlyDiligenceRanking,
                ],
                'total_employees'   => $totalEmp,
                'today' => [
                    'hadir'  => $todayHadir,
                    'telat'  => $todayTelat,
                    'alpha'  => $todayAlpha,
                    'cuti'   => $todayCuti,
                    'belum'  => max(0, $totalEmp - $todayPresentTotal),
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

        // Pre-fetch overtime requests sekaligus (menghindari N+1 query)
        $approvedReqsByEmp = \App\Models\OvertimeRequest::whereMonth('date', $month)
            ->whereYear('date', $year)
            ->where('status', 'approved')
            ->get()
            ->groupBy('employee_id');

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
            $approvedReqs = $approvedReqsByEmp->get($emp->id, collect());
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

    /**
     * GET /api/reports/social-media/export
     *
     * Mengekspor data media sosial seluruh pegawai ke file Excel (.xlsx).
     *
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function exportSocialMedia()
    {
        return Excel::download(new SocialMediaExport, 'Data_Media_Sosial_Pegawai_RSUCL.xlsx');
    }

    /**
     * GET /api/reports/lateness
     * 
     * Menghasilkan laporan keterlambatan dan kalkulasi potongan Rupiah per pegawai.
     * Tarif potongan per menit dibaca secara dinamis dari tabel settings (key: late_fee_per_minute).
     * Optimized: Langsung query absensi terlambat di bulan tersebut tanpa looping synthetic berat.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function latenessRekap(Request $request)
    {
        $month = (int)$request->query('month', now('Asia/Jakarta')->month);
        $year  = (int)$request->query('year', now('Asia/Jakarta')->year);
        $departmentFilter = $request->query('department', 'all');

        $ratePerMinute = (int) \App\Models\Setting::get('late_fee_per_minute', '500');

        $employeesQuery = Employee::with(['user', 'department', 'position'])
            ->where('status', 'active');

        if ($departmentFilter && $departmentFilter !== 'all') {
            $employeesQuery->whereHas('department', function ($q) use ($departmentFilter) {
                $q->where('name', $departmentFilter);
            });
        }

        $employees = $employeesQuery->get()
            ->sortBy(fn($emp) => ($emp->department?->name ?? 'Umum') . '_' . ($emp->user?->name ?? 'Karyawan'));

        // Query HANYA data absensi yang terlambat pada bulan & tahun tersebut (Langsung & Sangat Cepat)
        $lateAttendances = Attendance::with(['schedule'])
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->where(function ($q) {
                $q->where('status', 'telat')
                  ->orWhere('checkin_punctuality', 'terlambat');
            })
            ->get()
            ->groupBy('employee_id');

        $result = [];
        $grandTotalLateMinutes = 0;
        $grandTotalDeduction = 0;

        $dayMap = [0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu'];

        foreach ($employees as $emp) {
            $empLateRecords = $lateAttendances->get($emp->id, collect());

            $details = [];
            $employeeLateMinutes = 0;

            foreach ($empLateRecords as $r) {
                $checkIn = $r->check_in;
                $dateStr = $r->date ? $r->date->toDateString() : null;
                if (!$dateStr) continue;

                $shiftName = $r->schedule?->name ?? 'Reguler';
                $shiftStartStr = $r->schedule?->start_time ?? '08:30:00';

                // Fallback jika schedule pada record absensi null
                if (!$r->schedule && isset($emp->schedules)) {
                    $dateCarbon = \Carbon\Carbon::parse($dateStr);
                    $dayName = $dayMap[$dateCarbon->dayOfWeek];
                    $sched = $emp->schedules->first(fn($s) => isset($s->pivot) && $s->pivot->day_of_week === $dayName);
                    if ($sched && $sched->start_time) {
                        $shiftName = $sched->name;
                        $shiftStartStr = $sched->start_time;
                    }
                }

                $lateMins = 0;
                if ($checkIn) {
                    $inTimeSec = strtotime($dateStr . ' ' . $checkIn);
                    $shiftStartSec = strtotime($dateStr . ' ' . $shiftStartStr);
                    if ($inTimeSec > $shiftStartSec) {
                        $lateMins = (int) floor(($inTimeSec - $shiftStartSec) / 60);
                    }
                }

                if ($lateMins <= 0) {
                    $lateMins = 1;
                }

                $deduction = $lateMins * $ratePerMinute;
                $employeeLateMinutes += $lateMins;

                $details[] = [
                    'attendance_id'  => $r->id,
                    'date'           => $dateStr,
                    'shift_name'     => $shiftName,
                    'shift_start'    => substr($shiftStartStr, 0, 5),
                    'check_in'       => $checkIn ? substr($checkIn, 0, 5) : '--:--',
                    'late_minutes'   => $lateMins,
                    'deduction'      => $deduction,
                ];
            }

            $totalEmpDeduction = $employeeLateMinutes * $ratePerMinute;
            $grandTotalLateMinutes += $employeeLateMinutes;
            $grandTotalDeduction += $totalEmpDeduction;

            $result[] = [
                'employee_id'        => $emp->id,
                'nik_ktp'            => $emp->nik_ktp,
                'name'               => $emp->user?->name ?? 'Karyawan',
                'department'         => $emp->department?->name ?? 'Umum',
                'position'           => $emp->position?->name ?? 'Staff',
                'total_late_days'    => count($details),
                'total_late_minutes' => $employeeLateMinutes,
                'rate_per_minute'    => $ratePerMinute,
                'total_deduction'    => $totalEmpDeduction,
                'details'            => $details,
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'month'                 => $month,
                'year'                  => $year,
                'rate_per_minute'       => $ratePerMinute,
                'grand_total_late_mins' => $grandTotalLateMinutes,
                'grand_total_deduction' => $grandTotalDeduction,
                'records'               => $result,
            ],
        ]);
    }
}
