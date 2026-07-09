<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Class AttendanceController
 * 
 * Mengelola alur absen masuk (check-in) dan absen pulang (check-out) karyawan.
 * Mendukung validasi lokasi geofence (Haversine formula), batasan jam shift dinamis,
 * penyimpanan foto selfie (Base64), penanganan shift lintas hari (overnight),
 * riwayat kehadiran, serta notifikasi keterlambatan real-time.
 */
class AttendanceController extends Controller
{
    /**
     * GET /api/attendance/today
     * 
     * Mengambil status absensi hari ini milik karyawan yang sedang login.
     * Juga mendeteksi apakah hari ini karyawan sedang dalam masa cuti/izin/sakit aktif.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function today(Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Ambil data absensi hari ini jika ada
        $record = Attendance::where('employee_id', $employee->id)
                             ->where('date', today()->toDateString())
                             ->first();

        // Cek apakah ada pengajuan cuti/izin/sakit yang aktif hari ini
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
     * GET /api/attendance/all-today
     * 
     * Mengambil data kehadiran seluruh karyawan untuk hari berjalan (hanya untuk Admin).
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function allToday()
    {
        $records = Attendance::with(['employee.user', 'employee.department', 'employee.position', 'employee.schedules'])
                             ->where('date', today()->toDateString())
                             ->get()
                             ->map(fn($r) => $this->formatRecord($r, withEmployee: true));

        return response()->json(['success' => true, 'data' => $records]);
    }

    /**
     * POST /api/attendance/check-in
     * 
     * Melakukan absensi masuk (check-in) karyawan.
     * Meliputi validasi status sistem, validasi masa cuti/izin aktif, pencegahan absensi ganda,
     * validasi radius koordinat GPS (geofence), penentuan status (hadir vs telat),
     * serta penyimpanan foto selfie.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkIn(Request $request)
    {
        \Illuminate\Support\Facades\Log::info('Check-in request inputs: ' . json_encode($request->all()));
        
        // 1. Validasi keaktifan sistem absensi secara global
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

        // 2. Validasi apakah karyawan bersangkutan sedang cuti/izin/sakit yang disetujui hari ini
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

        // 3. Validasi absensi ganda pada hari yang sama
        $existing = Attendance::where('employee_id', $employee->id)
                              ->where('date', today()->toDateString())
                              ->first();

        if ($existing) {
            if (in_array($existing->status, ['sakit', 'izin', 'cuti'])) {
                $typeName = $existing->status === 'sakit' ? 'Sakit' : ($existing->status === 'izin' ? 'Izin' : 'Cuti');
                return response()->json([
                    'success' => false,
                    'message' => "Check-in ditolak: Anda sedang dalam masa {$typeName} untuk hari ini.",
                ], 422);
            }

            if ($existing->check_in) {
                // Mendukung mode simulasi waktu untuk keperluan testing di frontend/development
                if ($request->has('simulated_time')) {
                    $existing->delete();
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'Anda sudah melakukan check-in hari ini pada pukul ' . $existing->check_in . '.',
                    ], 422);
                }
            }
        }

        // 4. Validasi Geofence (menggunakan rumus Matematika Haversine)
        $hospLat    = (float) Setting::get('hospital_lat',  '5.552740480177099');
        $hospLng    = (float) Setting::get('hospital_lng',  '95.33486560781716');
        $hospRadius = (float) Setting::get('gps_radius',    '40'); // Radius default 40 meter

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
            return response()->json([
                'success' => false,
                'message' => 'Koordinat GPS diperlukan untuk melakukan check-in. Aktifkan GPS pada perangkat Anda.',
            ], 422);
        }

        // 5. Tentukan waktu check-in (mendukung simulasi)
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

        // Pastikan karyawan memiliki jadwal shift dinas hari ini
        $todayShift = $this->getEmployeeTodayShift($employee, $now);
        if (!$todayShift) {
            return response()->json([
                'success' => false,
                'message' => 'Check-in ditolak: Hari ini adalah hari libur Anda (tidak ada jadwal shift).',
            ], 422);
        }

        // 6. Evaluasi batas waktu check-in berdasarkan konfigurasi shift
        $shiftStart = substr($todayShift->start_time, 0, 5); // Format: "HH:mm"

        $checkinOpenOffset  = (int) Setting::get('checkin_open', '0'); // Menit sebelum shift dimulai absensi dibuka
        $lateLimitOffset    = (int) Setting::get('late_limit', '30');  // Menit toleransi keterlambatan
        $closeCheckinOffset = (int) Setting::get('close_checkin', '60'); // Menit penutupan akses check-in

        $openLimit  = ($checkinOpenOffset > 0) ? $this->subMins($shiftStart, $checkinOpenOffset) : $shiftStart;
        $lateLimit  = $this->addMins($shiftStart, $lateLimitOffset);
        $closeLimit = $this->addMins($shiftStart, $closeCheckinOffset);

        $nowMins   = $now->hour * 60 + $now->minute;

        // Cek jika tombol check-in ditekan sebelum waktu buka
        if ($nowMins < $this->timeToMins($openLimit)) {
            return response()->json([
                'success' => false,
                'message' => "Check-in belum dibuka. Waktu check-in dibuka mulai pukul {$openLimit} WIB.",
            ], 422);
        }

        // Cek jika batas check-in sudah ditutup
        $closeMins = $this->timeToMins($closeLimit);
        if ($nowMins > $closeMins) {
            return response()->json([
                'success' => false,
                'message' => "Batas check-in sudah tutup pukul {$closeLimit} WIB.",
            ], 422);
        }

        // Tentukan apakah status absensinya 'hadir' (tepat waktu) atau 'telat'
        $lateMins = $this->timeToMins($lateLimit);
        $status   = ($nowMins <= $lateMins) ? 'hadir' : 'telat';

        // Simpan foto selfie check-in jika terlampir
        $imageUrl = null;
        if ($request->has('image')) {
            $imageUrl = $this->storeBase64Image($request->input('image'), 'selfie_in_' . $employee->id . '_' . time());
        }

        // 7. Simpan absensi baru ke database
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

        // Kirim notifikasi keterlambatan ke administrator jika statusnya terlambat
        if ($status === 'telat') {
            $notifLate = \App\Models\Setting::get('notif_late', '1');
            if ($notifLate !== '0') {
                $admins = \App\Models\User::where('role', 'admin')->get();
                foreach ($admins as $admin) {
                    // Cegah duplikasi notifikasi harian untuk karyawan terlambat yang sama
                    $exists = \App\Models\Notification::where('user_id', $admin->id)
                        ->where('type', 'attendance')
                        ->where('data->employee_id', $employee->id)
                        ->whereDate('created_at', today())
                        ->exists();

                    if (!$exists) {
                        \App\Models\Notification::create([
                            'user_id' => $admin->id,
                            'title'   => 'Karyawan Terlambat',
                            'body'    => ($employee->user?->name ?? 'Karyawan') . ' terlambat check-in pada pukul ' . substr($record->check_in, 0, 5) . ' WIB.',
                            'type'    => 'attendance',
                            'data'    => ['attendance_id' => $record->id, 'employee_id' => $employee->id],
                        ]);
                    }
                }
            }

            // Kirim notifikasi email ke admin jika diaktifkan
            $notifEmail = \App\Models\Setting::get('notif_email', '1');
            if ($notifEmail !== '0') {
                $admins = \App\Models\User::where('role', 'admin')->get();
                foreach ($admins as $admin) {
                    try {
                        \Illuminate\Support\Facades\Mail::raw(
                            "Halo {$admin->name},\n\nKaryawan " . ($employee->user?->name ?? 'Karyawan') . " terlambat melakukan check-in hari ini.\n\nDetail:\n- Jam Absen: " . substr($record->check_in, 0, 5) . " WIB\n- Status: Terlambat\n\nSilakan cek detail absensi di sistem RSUCL.",
                            function ($message) use ($admin) {
                                $message->to($admin->email)
                                        ->subject('Peringatan Keterlambatan Karyawan - RSUCL');
                            }
                        );
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::error('Gagal mengirim email keterlambatan: ' . $e->getMessage());
                    }
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Check-in berhasil.',
            'data'    => $this->formatRecord($record),
        ]);
    }

    /**
     * POST /api/attendance/check-out
     * 
     * Melakukan absensi pulang (check-out) karyawan.
     * Mendukung deteksi shift normal maupun shift lintas malam (overnight).
     * Melakukan validasi geofence, window waktu check-out (termasuk diskriminasi hari Sabtu),
     * serta meng-update database absensi berjalan.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkOut(Request $request)
    {
        \Illuminate\Support\Facades\Log::info('Check-out request inputs: ' . json_encode($request->all()));
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // 1. Cari data check-in hari ini
        $record = Attendance::where('employee_id', $employee->id)
                            ->where('date', today()->toDateString())
                            ->first();

        // 2. Fallback untuk shift lintas malam (Overnight / Night shift):
        // Jika check-in hari ini belum ada, cek apakah ada check-in kemarin yang belum di-checkout
        if (!$record) {
            $yesterdayRecord = Attendance::where('employee_id', $employee->id)
                                         ->where('date', today()->subDay()->toDateString())
                                         ->first();
            if ($yesterdayRecord && !$yesterdayRecord->check_out) {
                // Pastikan shift kemarin memang shift overnight (jam pulang < jam masuk)
                $yesterdayShift = $this->getEmployeeTodayShift($employee, Carbon::now('Asia/Jakarta')->subDay());
                if ($yesterdayShift) {
                    $shiftStart = $this->timeToMins(substr($yesterdayShift->start_time, 0, 5));
                    $shiftEnd   = $this->timeToMins(substr($yesterdayShift->end_time, 0, 5));
                    if ($shiftEnd < $shiftStart) {
                        $record = $yesterdayRecord; // Gunakan record kemarin sebagai target update checkout
                    }
                }
            }
        }

        if (!$record || !$record->check_in) {
            return response()->json([
                'success' => false,
                'message' => 'Anda belum melakukan check-in.',
            ], 422);
        }

        if ($record->check_out) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah melakukan check-out hari ini pada pukul ' . $record->check_out . '.',
            ], 422);
        }

        // 3. Validasi Geofence (Haversine)
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

        // Simpan foto selfie check-out jika terlampir
        $imageUrl = null;
        if ($request->has('image')) {
            $imageUrl = $this->storeBase64Image($request->input('image'), 'selfie_out_' . $employee->id . '_' . time());
        }

        // Tentukan waktu check-out (mendukung simulasi)
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

        // Gunakan tanggal dari record check-in asli untuk validasi shift
        $shiftDate = Carbon::parse($record->date);
        $todayShift = $this->getEmployeeTodayShift($employee, $shiftDate);

        if (!$todayShift) {
            return response()->json([
                'success' => false,
                'message' => 'Check-out ditolak: Tidak ada jadwal shift yang terasosiasi dengan absensi ini.',
            ], 422);
        }

        $shiftStart    = substr($todayShift->start_time, 0, 5);
        $shiftEnd      = substr($todayShift->end_time,   0, 5);

        // 4. Hitung parameter batas pembukaan & penutupan check-out (Diferensiasi Hari Sabtu vs Hari Biasa)
        $isSaturday = \Carbon\Carbon::parse($record->date)->dayOfWeek === \Carbon\Carbon::SATURDAY;
        if ($isSaturday) {
            $satOpenOffset  = (int) Setting::get('sat_checkout_open', '0');
            $satCloseOffset = (int) Setting::get('sat_checkout_close', '60');
            $checkoutOpen   = ($satOpenOffset > 0) ? $this->subMins($shiftEnd, $satOpenOffset) : $shiftEnd;
            $checkoutClose  = $this->addMins($shiftEnd, $satCloseOffset);
        } else {
            $wkOpenOffset   = (int) Setting::get('checkout_open', '0');
            $wkCloseOffset  = (int) Setting::get('checkout_close', '60');
            $checkoutOpen   = ($wkOpenOffset > 0) ? $this->subMins($shiftEnd, $wkOpenOffset) : $shiftEnd;
            $checkoutClose  = $this->addMins($shiftEnd, $wkCloseOffset);
        }
        $isOvernight   = $this->timeToMins($shiftEnd) < $this->timeToMins($shiftStart);

        $nowMins   = $now->hour * 60 + $now->minute;
        $openMins  = $this->timeToMins($checkoutOpen);
        $closeMins = $this->timeToMins($checkoutClose);

        // 5. Validasi window check-out
        if ($isOvernight) {
            // Lintas tengah malam
            $startMins = $this->timeToMins(isset($shiftStart) ? $shiftStart : '21:00');
            if ($nowMins >= $startMins) {
                // Masih di malam hari sebelum tengah malam → tombol check-out dinonaktifkan
                return response()->json([
                    'success' => false,
                    'message' => "Check-out belum dibuka. Waktu check-out shift ini dibuka pukul {$checkoutOpen} WIB (hari berikutnya).",
                ], 422);
            }
            if ($nowMins > $closeMins) {
                return response()->json([
                    'success' => false,
                    'message' => "Batas akhir check-out sudah lewat pukul {$checkoutClose} WIB.",
                ], 422);
            }
        } else {
            // Shift normal di hari yang sama
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

        // 6. Update database dengan data check-out
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
     * 
     * Mengambil riwayat absensi.
     * Jika melampirkan parameter query 'month' & 'year', sistem akan menjana (generate) laporan bulanan lengkap
     * termasuk kalkulasi Alpa/off-day (menggunakan model Attendance::getMonthlyReportData).
     * Jika tanpa parameter, akan mengambil 100 log riwayat absensi mentah terakhir.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function history(Request $request)
    {
        $user = $request->user();
        \Illuminate\Support\Facades\Log::info('History request by user ID: ' . ($user ? $user->id : 'null') . ' | Role: ' . ($user ? $user->role : 'null'));
        \Illuminate\Support\Facades\Log::info('Query params: ' . json_encode($request->all()));

        // Kasus A: Filter bulanan spesifik (menghasilkan laporan lengkap)
        if ($request->has('month') && $request->has('year')) {
            $month = (int)$request->query('month');
            $year  = (int)$request->query('year');
            $employeeId = !$user->isAdmin() ? ($user->employee?->id) : null;
            \Illuminate\Support\Facades\Log::info("Monthly history filter applied. Month: {$month}, Year: {$year}, Employee ID: " . ($employeeId ?? 'null'));

            if (!$user->isAdmin() && !$employeeId) {
                return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
            }

            $records = Attendance::getMonthlyReportData($month, $year, $employeeId);
            \Illuminate\Support\Facades\Log::info('Monthly records count returned: ' . count($records));
            return response()->json(['success' => true, 'data' => $records]);
        }

        // Kasus B: Mengambil 100 log absensi mentah terakhir
        $query = Attendance::with(['employee.user', 'employee.department', 'employee.schedules'])
                           ->orderBy('date', 'desc')
                           ->limit(100);

        if (!$user->isAdmin()) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
            }
            \Illuminate\Support\Facades\Log::info("Filtering history query for non-admin employee ID: {$employee->id}");
            $query->where('employee_id', $employee->id);
        } else {
            \Illuminate\Support\Facades\Log::info("User is admin. No employee filter applied to history query.");
        }

        $records = $query->get()->map(fn($r) => $this->formatRecord($r, withEmployee: $user->isAdmin()));
        \Illuminate\Support\Facades\Log::info('Query records count returned: ' . count($records));

        return response()->json(['success' => true, 'data' => $records]);
    }

    // ── Private Helpers ───────────────────────────────────────────────

    /**
     * Mengubah string format waktu "HH:mm" atau "HH:mm:ss" ke jumlah total menit dari tengah malam.
     * Mempermudah operasi matematika pembandingan waktu.
     * 
     * @param string $hhmm
     * @return int Jumlah menit
     */
    private function timeToMins(string $hhmm): int
    {
        [$h, $m] = explode(':', $hhmm);
        return (int)$h * 60 + (int)$m;
    }

    /**
     * Menambahkan sejumlah menit ke format string "HH:mm".
     * 
     * @param string $hhmm
     * @param int $mins
     * @return string String "HH:mm" baru
     */
    private function addMins(string $hhmm, int $mins): string
    {
        $total = $this->timeToMins($hhmm) + $mins;
        return sprintf('%02d:%02d', intdiv($total, 60) % 24, $total % 60);
    }

    /**
     * Mengurangi sejumlah menit dari format string "HH:mm".
     * 
     * @param string $hhmm
     * @param int $mins
     * @return string String "HH:mm" baru
     */
    private function subMins(string $hhmm, int $mins): string
    {
        $total = $this->timeToMins($hhmm) - $mins;
        if ($total < 0) {
            $total += 24 * 60;
        }
        return sprintf('%02d:%02d', intdiv($total, 60) % 24, $total % 60);
    }

    /**
     * Mengambil jadwal shift kerja karyawan yang berlaku hari ini.
     * 
     * @param Employee $employee
     * @param Carbon $now Tanggal/waktu pembanding
     * @return \App\Models\Schedule|null
     */
    private function getEmployeeTodayShift(\App\Models\Employee $employee, Carbon $now): ?\App\Models\Schedule
    {
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $todayName = $dayMap[$now->dayOfWeek];
        return $employee->schedules()->wherePivot('day_of_week', $todayName)->first();
    }

    /**
     * Menghitung jarak antara dua titik koordinat GPS menggunakan Rumus Haversine (meter).
     * 
     * @param float $lat1 Lintang titik pertama
     * @param float $lon1 Bujur titik pertama
     * @param float $lat2 Lintang titik kedua
     * @param float $lon2 Bujur titik kedua
     * @return float Jarak dalam satuan meter
     */
    private function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R    = 6371000; // Radius rata-rata bumi dalam meter
        $φ1   = deg2rad($lat1);
        $φ2   = deg2rad($lat2);
        $Δφ   = deg2rad($lat2 - $lat1);
        $Δλ   = deg2rad($lon2 - $lon1);

        $a = sin($Δφ / 2) ** 2 + cos($φ1) * cos($φ2) * sin($Δλ / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $R * $c;
    }

    /**
     * Menyimpan gambar Base64 (foto selfie) ke public storage disk.
     * 
     * @param string $imgData String Base64 gambar
     * @param string $baseName Nama dasar file unik
     * @return string|null Path relatif file gambar hasil penyimpanan
     */
    private function storeBase64Image(string $imgData, string $baseName): ?string
    {
        if (!preg_match('/^data:image\/(\w+);base64,/', $imgData, $type)) {
            return null;
        }
        $imgData = substr($imgData, strpos($imgData, ',') + 1);
        $type    = strtolower($type[1]); // jpeg, png, webp

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

    /**
     * Memformat output record absensi agar konsisten untuk dikonsumsi frontend.
     * 
     * @param Attendance $r Record absensi
     * @param bool $withEmployee Sertakan detail profile karyawan
     * @return array
     */
    private function formatRecord(Attendance $r, bool $withEmployee = false): array
    {
        $shiftName = 'Reguler';
        if ($r->employee && $r->date) {
            $dayMap = [
                0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
                3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
            ];
            $carbonDate = \Carbon\Carbon::parse($r->date);
            $dayName = $dayMap[$carbonDate->dayOfWeek];
            
            // Periksa apakah relasi schedules sudah di-load untuk efisiensi kueri database (Eager Loading)
            if ($r->employee->relationLoaded('schedules')) {
                $sched = $r->employee->schedules->first(function ($s) use ($dayName) {
                    return $s->pivot->day_of_week === $dayName;
                });
                if ($sched) {
                    $shiftName = $sched->name;
                }
            } else {
                $sched = $r->employee->schedules()->wherePivot('day_of_week', $dayName)->first();
                if ($sched) {
                    $shiftName = $sched->name;
                }
            }
        }

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
            'shift_name'         => $shiftName,
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
