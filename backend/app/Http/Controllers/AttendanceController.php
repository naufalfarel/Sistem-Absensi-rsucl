<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    /**
     * GET /api/attendance/today
     * Absensi hari ini milik pegawai yang login
     */
    public function today(Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        $record = Attendance::where('employee_id', $employee->id)
                            ->where('date', today()->toDateString())
                            ->first();

        return response()->json([
            'success' => true,
            'data'    => $record ? $this->formatRecord($record) : null,
        ]);
    }

    /**
     * GET /api/attendance/all-today  (admin only)
     * Semua absensi hari ini
     */
    public function allToday()
    {
        $records = Attendance::with(['employee.user', 'employee.department', 'employee.position'])
                             ->where('date', today()->toDateString())
                             ->get()
                             ->map(fn($r) => $this->formatRecord($r, withEmployee: true));

        return response()->json(['success' => true, 'data' => $records]);
    }

    /**
     * POST /api/attendance/check-in
     */
    public function checkIn(Request $request)
    {
        // Cek apakah sistem aktif
        $systemActive = Setting::get('system_active', '1');
        if ($systemActive === '0') {
            return response()->json([
                'success' => false,
                'message' => 'Sistem absensi sedang dinonaktifkan oleh administrator.',
            ], 403);
        }

        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Cek apakah sudah check-in hari ini
        $existing = Attendance::where('employee_id', $employee->id)
                              ->where('date', today()->toDateString())
                              ->first();

        if ($existing && $existing->check_in) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah melakukan check-in hari ini pada pukul ' . $existing->check_in . '.',
            ], 422);
        }

        // Tentukan status: hadir vs telat
        $now        = Carbon::now('Asia/Jakarta');
        $lateLimit  = Setting::get('late_limit', '08:30');   // batas tepat waktu
        $closeLimit = Setting::get('close_checkin', '09:00'); // batas tutup absen

        [$closeH, $closeM] = explode(':', $closeLimit);
        if ($now->hour > (int)$closeH || ($now->hour === (int)$closeH && $now->minute > (int)$closeM)) {
            return response()->json([
                'success' => false,
                'message' => "Batas check-in sudah tutup pukul {$closeLimit} WIB.",
            ], 422);
        }

        [$lateH, $lateM] = explode(':', $lateLimit);
        $status = ($now->hour < (int)$lateH || ($now->hour === (int)$lateH && $now->minute <= (int)$lateM))
                  ? 'hadir'
                  : 'telat';

        $record = Attendance::create([
            'employee_id' => $employee->id,
            'date'        => today()->toDateString(),
            'check_in'    => $now->format('H:i:s'),
            'status'      => $status,
            'latitude'    => $request->latitude,
            'longitude'   => $request->longitude,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Check-in berhasil.',
            'data'    => $this->formatRecord($record),
        ]);
    }

    /**
     * POST /api/attendance/check-out
     */
    public function checkOut(Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        $record = Attendance::where('employee_id', $employee->id)
                            ->where('date', today()->toDateString())
                            ->first();

        if (!$record || !$record->check_in) {
            return response()->json([
                'success' => false,
                'message' => 'Anda belum melakukan check-in hari ini.',
            ], 422);
        }

        if ($record->check_out) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah melakukan check-out hari ini pada pukul ' . $record->check_out . '.',
            ], 422);
        }

        $now = Carbon::now('Asia/Jakarta');
        $record->update([
            'check_out' => $now->format('H:i:s'),
            'latitude'  => $request->latitude ?? $record->latitude,
            'longitude' => $request->longitude ?? $record->longitude,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Check-out berhasil.',
            'data'    => $this->formatRecord($record),
        ]);
    }

    /**
     * GET /api/attendance/history
     * Riwayat absensi 30 hari terakhir (karyawan sendiri, atau semua jika admin)
     */
    public function history(Request $request)
    {
        $user = $request->user();
        $query = Attendance::with(['employee.user', 'employee.department'])
                           ->orderBy('date', 'desc')
                           ->limit(100);

        if (!$user->isAdmin()) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
            }
            $query->where('employee_id', $employee->id);
        }

        $records = $query->get()->map(fn($r) => $this->formatRecord($r, withEmployee: $user->isAdmin()));

        return response()->json(['success' => true, 'data' => $records]);
    }

    // ── Helper ────────────────────────────────────────────────────────
    private function formatRecord(Attendance $r, bool $withEmployee = false): array
    {
        $data = [
            'id'           => $r->id,
            'date'         => $r->date?->toDateString(),
            'check_in'     => $r->check_in,
            'check_out'    => $r->check_out,
            'status'       => $r->status,
            'duration_min' => $r->duration_minutes_attribute ?? null,
            'latitude'     => $r->latitude,
            'longitude'    => $r->longitude,
            'note'         => $r->note,
        ];

        if ($withEmployee && $r->employee) {
            $data['employee'] = [
                'id'         => $r->employee->id,
                'name'       => $r->employee->user?->name,
                'nip'        => $r->employee->nip,
                'department' => $r->employee->department?->name,
            ];
        }

        return $data;
    }
}
