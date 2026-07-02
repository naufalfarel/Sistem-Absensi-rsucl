<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\LeaveRequest;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * GET /api/reports/summary
     * Ringkasan absensi untuk dashboard admin
     */
    public function summary(Request $request)
    {
        $today     = today()->toDateString();
        $month     = now()->month;
        $year      = now()->year;
        $totalEmp  = Employee::where('status', 'active')->count();

        // ── Statistik hari ini ──
        $todayAttendances = Attendance::where('date', $today)->get();
        $todayHadir       = $todayAttendances->whereIn('status', ['hadir', 'telat'])->count();
        $todayTelat       = $todayAttendances->where('status', 'telat')->count();
        $todayAlpha       = $totalEmp - $todayHadir -
                            LeaveRequest::where('status', 'approved')
                                ->where('start_date', '<=', $today)
                                ->where('end_date', '>=', $today)
                                ->count();
        $todayCuti        = LeaveRequest::where('status', 'approved')
                                ->where('start_date', '<=', $today)
                                ->where('end_date', '>=', $today)
                                ->count();

        // ── Statistik bulan ini ──
        $monthAttendances = Attendance::whereYear('date', $year)
                                      ->whereMonth('date', $month)
                                      ->get();

        $monthHadir = $monthAttendances->whereIn('status', ['hadir', 'telat'])->count();
        $monthAlpha = $monthAttendances->where('status', 'alpha')->count();

        // ── Pengajuan cuti pending ──
        $pendingLeave = LeaveRequest::where('status', 'pending')->count();

        // ── Absensi per hari (7 hari terakhir) ──
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

        return response()->json([
            'success' => true,
            'data'    => [
                'total_employees'   => $totalEmp,
                'today' => [
                    'hadir'  => $todayHadir,
                    'telat'  => $todayTelat,
                    'alpha'  => max(0, $todayAlpha),
                    'cuti'   => $todayCuti,
                    'belum'  => max(0, $totalEmp - $todayHadir - $todayCuti),
                ],
                'this_month' => [
                    'hadir'  => $monthHadir,
                    'alpha'  => $monthAlpha,
                ],
                'pending_leave'     => $pendingLeave,
                'daily_chart'       => $dailyData,
            ],
        ]);
    }
}
