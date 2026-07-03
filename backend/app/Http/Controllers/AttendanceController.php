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

        // Cek cuti aktif hari ini
        $todayStr = today()->toDateString();
        $activeLeave = \App\Models\LeaveRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->where('start_date', '<=', $todayStr)
            ->where('end_date', '>=', $todayStr)
            ->first();

        $leaveData = null;
        if ($activeLeave) {
            $leaveData = [
                'type'   => $activeLeave->type,
                'reason' => $activeLeave->reason,
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => $record ? $this->formatRecord($record) : null,
            'active_leave' => $leaveData,
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
        \Illuminate\Support\Facades\Log::info('Check-in request inputs: ' . json_encode($request->all()));
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

        // Cek apakah sedang dalam masa cuti/izin/sakit yang disetujui hari ini
        $todayStr = today()->toDateString();
        $activeLeave = \App\Models\LeaveRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->where('start_date', '<=', $todayStr)
            ->where('end_date', '>=', $todayStr)
            ->first();

        if ($activeLeave) {
            $typeName = 'Cuti';
            if ($activeLeave->type === 'izin') {
                $typeName = 'Izin';
            } elseif ($activeLeave->type === 'sakit') {
                $typeName = 'Sakit';
            }
            return response()->json([
                'success' => false,
                'message' => "Check-in ditolak: Anda sedang dalam masa {$typeName} yang telah disetujui untuk hari ini.",
            ], 422);
        }

        // Cek apakah sudah check-in hari ini
        $existing = Attendance::where('employee_id', $employee->id)
                              ->where('date', today()->toDateString())
                              ->first();

        if ($existing && $existing->check_in) {
            // Mode simulasi: hapus record lama agar bisa check-in ulang untuk testing
            if ($request->has('simulated_time')) {
                $existing->delete();
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda sudah melakukan check-in hari ini pada pukul ' . $existing->check_in . '.',
                ], 422);
            }
        }

        // ── Validasi Geofence (server-side Haversine) ─────────────────
        $hospLat    = (float) Setting::get('hospital_lat',  '5.552740480177099');
        $hospLng    = (float) Setting::get('hospital_lng',  '95.33486560781716');
        $hospRadius = (float) Setting::get('gps_radius',    '40');

        $clientLat  = $request->input('latitude');
        $clientLng  = $request->input('longitude');
        $clientAcc  = $request->input('accuracy');

        $isWithinGeofence = false;
        if ($clientLat !== null && $clientLng !== null) {
            $distance = $this->haversine((float)$clientLat, (float)$clientLng, $hospLat, $hospLng);
            $isWithinGeofence = ($distance <= $hospRadius);

            if (!$isWithinGeofence) {
                return response()->json([
                    'success' => false,
                    'message' => sprintf(
                        'Check-in ditolak: Anda berada %.0f meter dari RSUCL. Maksimal radius adalah %.0f meter. Pastikan Anda berada di dalam area rumah sakit.',
                        $distance,
                        $hospRadius
                    ),
                ], 422);
            }
        } else {
            // Koordinat tidak dikirim — tolak untuk keamanan
            return response()->json([
                'success' => false,
                'message' => 'Koordinat GPS diperlukan untuk melakukan check-in. Aktifkan GPS pada perangkat Anda.',
            ], 422);
        }

        // Tentukan status: hadir vs telat
        $now        = Carbon::now('Asia/Jakarta');
        if ($request->has('simulated_time')) {
            $simTime = $request->input('simulated_time');
            try {
                $parts = explode(':', $simTime);
                if (count($parts) >= 2) {
                    $now->setTime((int)$parts[0], (int)$parts[1], (int)($parts[2] ?? 0));
                }
            } catch (\Exception $e) {}
        }
        // ── Tentukan batas check-in berdasarkan shift karyawan ──────────────
        $todayShift = $this->getEmployeeTodayShift($employee);
        if ($todayShift) {
            $shiftStart = substr($todayShift->start_time, 0, 5); // "HH:mm"
            $lateLimit  = $this->addMins($shiftStart, 30);       // mulai + 30 menit
            $closeLimit = $this->addMins($shiftStart, 60);       // mulai + 60 menit
        } else {
            $lateLimit  = Setting::get('late_limit',    '08:30');
            $closeLimit = Setting::get('close_checkin', '09:00');
        }

        $nowMins   = $now->hour * 60 + $now->minute;
        $closeMins = $this->timeToMins($closeLimit);

        if ($nowMins > $closeMins) {
            return response()->json([
                'success' => false,
                'message' => "Batas check-in sudah tutup pukul {$closeLimit} WIB.",
            ], 422);
        }

        $lateMins = $this->timeToMins($lateLimit);
        $status   = ($nowMins <= $lateMins) ? 'hadir' : 'telat';

        $imageUrl = null;
        if ($request->has('image')) {
            $imageUrl = $this->storeBase64Image($request->input('image'), 'selfie_in_' . $employee->id . '_' . time());
        }

        $record = Attendance::create([
            'employee_id'       => $employee->id,
            'date'              => today()->toDateString(),
            'check_in'          => $now->format('H:i:s'),
            'status'            => $status,
            'latitude'          => $clientLat,
            'longitude'         => $clientLng,
            'accuracy'          => $clientAcc,
            'is_within_geofence'=> $isWithinGeofence,
            'image_check_in'    => $imageUrl,
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
        \Illuminate\Support\Facades\Log::info('Check-out request inputs: ' . json_encode($request->all()));
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

        // ── Validasi Geofence (server-side Haversine) ─────────────────
        $hospLat    = (float) Setting::get('hospital_lat',  '5.552740480177099');
        $hospLng    = (float) Setting::get('hospital_lng',  '95.33486560781716');
        $hospRadius = (float) Setting::get('gps_radius',    '40');

        $clientLat  = $request->input('latitude');
        $clientLng  = $request->input('longitude');
        $clientAcc  = $request->input('accuracy');

        $isWithinGeofence = false;
        if ($clientLat !== null && $clientLng !== null) {
            $distance = $this->haversine((float)$clientLat, (float)$clientLng, $hospLat, $hospLng);
            $isWithinGeofence = ($distance <= $hospRadius);

            if (!$isWithinGeofence) {
                return response()->json([
                    'success' => false,
                    'message' => sprintf(
                        'Check-out ditolak: Anda berada %.0f meter dari RSUCL. Maksimal radius adalah %.0f meter. Pastikan Anda berada di dalam area rumah sakit.',
                        $distance,
                        $hospRadius
                    ),
                ], 422);
            }
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Koordinat GPS diperlukan untuk melakukan check-out. Aktifkan GPS pada perangkat Anda.',
            ], 422);
        }

        $imageUrl = null;
        if ($request->has('image')) {
            $imageUrl = $this->storeBase64Image($request->input('image'), 'selfie_out_' . $employee->id . '_' . time());
        }

        $now = Carbon::now('Asia/Jakarta');
        if ($request->has('simulated_time')) {
            $simTime = $request->input('simulated_time');
            try {
                $parts = explode(':', $simTime);
                if (count($parts) >= 2) {
                    $now->setTime((int)$parts[0], (int)$parts[1], (int)($parts[2] ?? 0));
                }
            } catch (\Exception $e) {}
        }

        // ── Tentukan jam checkout berdasarkan shift karyawan ────────────────
        $todayShift = $this->getEmployeeTodayShift($employee);
        if ($todayShift) {
            $shiftStart    = substr($todayShift->start_time, 0, 5); // "HH:mm"
            $shiftEnd      = substr($todayShift->end_time,   0, 5); // "HH:mm"
            $checkoutOpen  = $shiftEnd;
            $checkoutClose = $this->addMins($shiftEnd, 60); // end + 60 menit toleransi
            $isOvernight   = $this->timeToMins($shiftEnd) < $this->timeToMins($shiftStart);
        } else {
            $isSaturday = $now->isSaturday();
            if ($isSaturday) {
                $checkoutOpen  = Setting::get('sat_checkout_open', '13:00');
            } else {
                $checkoutOpen  = Setting::get('checkout_open', '17:00');
            }
            $checkoutClose = $this->addMins($checkoutOpen, 60); // Selalu tutup 1 jam setelah buka
            $isOvernight   = false;
        }

        $nowMins   = $now->hour * 60 + $now->minute;
        $openMins  = $this->timeToMins($checkoutOpen);
        $closeMins = $this->timeToMins($checkoutClose);

        if ($isOvernight) {
            // Shift lintas tengah malam (mis. Malam 21:00–07:00)
            // Setelah jam mulai shift: check-out belum dibuka
            // Setelah tengah malam hingga jam tutup: dalam window check-out
            $startMins = $this->timeToMins(isset($shiftStart) ? $shiftStart : '21:00');
            if ($nowMins >= $startMins) {
                // Masih malam hari (sebelum tengah malam) → belum saatnya checkout
                return response()->json([
                    'success' => false,
                    'message' => "Check-out belum dibuka. Waktu check-out shift ini dibuka pukul {$checkoutOpen} WIB (hari berikutnya).",
                ], 422);
            }
            // Setelah tengah malam: cek apakah masih dalam window checkout
            if ($nowMins > $closeMins) {
                return response()->json([
                    'success' => false,
                    'message' => "Batas akhir check-out sudah lewat pukul {$checkoutClose} WIB.",
                ], 422);
            }
        } else {
            // Shift normal (tidak lintas tengah malam)
            if ($nowMins < $openMins) {
                return response()->json([
                    'success' => false,
                    'message' => "Check-out belum dibuka. Waktu check-out dibuka mulai pukul {$checkoutOpen} WIB.",
                ], 422);
            }
            if ($nowMins > $closeMins) {
                return response()->json([
                    'success' => false,
                    'message' => "Batas akhir check-out sudah lewat pukul {$checkoutClose} WIB.",
                ], 422);
            }
        }

        $record->update([
            'check_out'          => $now->format('H:i:s'),
            'latitude'           => $clientLat,
            'longitude'          => $clientLng,
            'accuracy'           => $clientAcc,
            'is_within_geofence' => $isWithinGeofence,
            'image_check_out'    => $imageUrl,
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

    // ── Private Helpers ───────────────────────────────────────────────

    /**
     * Konversi "HH:mm" atau "HH:mm:ss" ke menit dari tengah malam.
     */
    private function timeToMins(string $hhmm): int
    {
        [$h, $m] = explode(':', $hhmm);
        return (int)$h * 60 + (int)$m;
    }

    /**
     * Tambah sejumlah menit ke string "HH:mm", kembalikan "HH:mm" baru.
     */
    private function addMins(string $hhmm, int $mins): string
    {
        $total = $this->timeToMins($hhmm) + $mins;
        return sprintf('%02d:%02d', intdiv($total, 60) % 24, $total % 60);
    }

    /**
     * Ambil shift karyawan yang berlaku hari ini berdasarkan hari dalam seminggu.
     * Mengembalikan Schedule model atau null jika tidak ada assignment.
     */
    private function getEmployeeTodayShift(\App\Models\Employee $employee): ?\App\Models\Schedule
    {
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $todayName = $dayMap[now('Asia/Jakarta')->dayOfWeek];
        return $employee->schedules()->wherePivot('day_of_week', $todayName)->first();
    }

    /**
     * Rumus Haversine — mengembalikan jarak dalam meter.
     */
    private function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R    = 6371000; // radius bumi dalam meter
        $φ1   = deg2rad($lat1);
        $φ2   = deg2rad($lat2);
        $Δφ   = deg2rad($lat2 - $lat1);
        $Δλ   = deg2rad($lon2 - $lon1);

        $a = sin($Δφ / 2) ** 2 + cos($φ1) * cos($φ2) * sin($Δλ / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $R * $c;
    }

    /**
     * Simpan gambar base64 ke storage, kembalikan path relatif.
     */
    private function storeBase64Image(string $imgData, string $baseName): ?string
    {
        if (!preg_match('/^data:image\/(\w+);base64,/', $imgData, $type)) {
            return null;
        }
        $imgData = substr($imgData, strpos($imgData, ',') + 1);
        $type    = strtolower($type[1]); // png, jpg, jpeg

        if (!in_array($type, ['jpg', 'jpeg', 'png'])) {
            return null;
        }
        $decoded = base64_decode($imgData);
        if ($decoded === false) {
            return null;
        }

        $fileName = $baseName . '.' . $type;
        \Illuminate\Support\Facades\Storage::disk('public')->put('selfies/' . $fileName, $decoded);

        return '/storage/selfies/' . $fileName;
    }

    private function formatRecord(Attendance $r, bool $withEmployee = false): array
    {
        $data = [
            'id'                 => $r->id,
            'date'               => $r->date?->toDateString(),
            'check_in'           => $r->check_in,
            'check_out'          => $r->check_out,
            'status'             => $r->status,
            'duration_min'       => $r->duration_minutes_attribute ?? null,
            'latitude'           => $r->latitude,
            'longitude'          => $r->longitude,
            'accuracy'           => $r->accuracy,
            'is_within_geofence' => $r->is_within_geofence,
            'note'               => $r->note,
            'image_check_in'     => $r->image_check_in  ? url($r->image_check_in)  : null,
            'image_check_out'    => $r->image_check_out ? url($r->image_check_out) : null,
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
