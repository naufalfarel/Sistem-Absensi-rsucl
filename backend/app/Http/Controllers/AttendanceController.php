<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Setting;
use App\Support\ScheduleRules;
use App\Support\AttendanceRules;
use App\Http\Requests\CheckInRequest;
use App\Http\Requests\CheckOutRequest;
use App\Http\Resources\AttendanceResource;
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

        $holiday = AttendanceRules::holidayOn(Carbon::today('Asia/Jakarta'));
        $holidayData = null;
        if ($holiday) {
            $holidayData = [
                'name' => $holiday->name,
                'is_assigned' => AttendanceRules::isAssignedToWorkOnHoliday($employee, $holiday),
            ];
        }

        return response()->json([
            'success' => true,
            'data'    => $record ? new AttendanceResource($record) : null,
            'active_leave' => $leaveData,
            'holiday' => $holidayData,
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
        $todayStr = today()->toDateString();
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $todayName = $dayMap[today()->dayOfWeek];

        // Ambil semua karyawan aktif beserta relasinya
        $employees = Employee::with(['user', 'department', 'position', 'schedules'])
                             ->where('status', 'active')
                             ->get();

        // Ambil data absensi aktual hari ini
        $attendances = Attendance::where('date', $todayStr)->get()->keyBy('employee_id');

        $records = [];
        foreach ($employees as $emp) {
            if ($attendances->has($emp->id)) {
                $att = $attendances->get($emp->id);
                $records[] = $this->formatRecord($att, withEmployee: true);
            } else {
                // Cari jadwal shift hari ini
                $schedule = $emp->schedules->first(function($s) use ($todayName) {
                    return $s->pivot->day_of_week === $todayName;
                });

                if (!$schedule) {
                    $status = 'tidak_ada_shift';
                    $shiftName = 'Tidak Ada Shift';
                    $note = 'Hari Libur / Tidak Ada Shift';
                } else {
                    $shiftName = $schedule->name;
                    
                    // Evaluasi apakah batas waktu check-in sudah terlewati
                    $now = Carbon::now('Asia/Jakarta');
                    $shiftStart = $schedule->start_time; // "HH:mm:ss"
                    $closeCheckinOffset = (int) Setting::get('close_checkin', '60');
                    $shiftStartCarbon = Carbon::today('Asia/Jakarta')->setTimeFromTimeString($shiftStart);
                    $closeLimitCarbon = $shiftStartCarbon->copy()->addMinutes($closeCheckinOffset);

                    // Cek jika hari libur nasional
                    $holiday = AttendanceRules::holidayOn(Carbon::today('Asia/Jakarta'));
                    $isAssigned = $holiday ? AttendanceRules::isAssignedToWorkOnHoliday($emp, $holiday) : false;

                    if ($now->gt($closeLimitCarbon)) {
                        if ($holiday && !$isAssigned) {
                            $status = 'belum_hadir';
                            $note = 'Hari Libur (Tidak Wajib)';
                        } else {
                            $status = 'alpha';
                            $note = 'Tidak Hadir Tanpa Keterangan';
                        }
                    } else {
                        $status = 'belum_hadir';
                        $note = 'Belum Absen Masuk';
                    }
                }

                $records[] = [
                    'id'                 => null,
                    'date'               => $todayStr,
                    'check_in'           => null,
                    'check_out'          => null,
                    'status'             => $status,
                    'duration_min'       => null,
                    'latitude'           => null,
                    'longitude'          => null,
                    'accuracy'           => null,
                    'is_within_geofence' => false,
                    'note'               => $note,
                    'image_check_in'     => null,
                    'image_check_out'    => null,
                    'shift_name'         => $shiftName,
                    'employee'           => [
                        'id'         => $emp->id,
                        'name'       => $emp->user?->name ?? 'Karyawan',
                        'nip'        => $emp->nip,
                        'department' => $emp->department?->name ?? 'Umum',
                        'position'   => $emp->position?->name ?? 'Staff',
                    ]
                ];
            }
        }

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
    public function checkIn(CheckInRequest $request)
    {
        \Illuminate\Support\Facades\Log::info('Check-in request inputs: ' . json_encode($request->all()));
        
        $validated = $request->validated();

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

        // 4. Tentukan waktu check-in (mendukung simulasi)
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

        // Tentukan tipe shift harian
        $shiftType = AttendanceRules::shiftTypeFor($employee, $now);

        // 5. Validasi Geofence (menggunakan rumus Matematika Haversine)
        $clientLat  = $request->input('latitude');
        $clientLng  = $request->input('longitude');
        $clientAcc  = $request->input('accuracy');

        $isWithinGeofence = false;
        $distance = null;

        if ($clientLat !== null && $clientLng !== null) {
            $refLat  = (float) Setting::get('hospital_latitude',  '5.552740480177099');
            $refLng  = (float) Setting::get('hospital_longitude',  '95.33486560781716');
            $distance = AttendanceRules::haversineDistanceMeters((float)$clientLat, (float)$clientLng, $refLat, $refLng);
            $isWithinGeofence = ($distance <= (float) Setting::get('attendance_radius_meters', '100'));
        }

        if ($shiftType !== 'dinas_luar') {
            if ($clientLat === null || $clientLng === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Koordinat GPS diperlukan untuk melakukan check-in. Aktifkan GPS pada perangkat Anda.',
                ], 422);
            }

            if (!$isWithinGeofence) {
                \Illuminate\Support\Facades\Log::warning(sprintf(
                    'Check-in ditolak karena berada %.0f meter dari RSUCL (di luar radius wajib).',
                    $distance
                ));

                return response()->json([
                    'success' => false,
                    'message' => 'Anda berada di luar radius lokasi absensi yang diizinkan.',
                ], 422);
            }
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

        // Simpan file foto check-in wajib
        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('attendance-photos', 'public');
            $photoUrl = '/storage/' . $path;
        }

        // 7. Simpan absensi baru ke database
        $record = Attendance::create([
            'employee_id'             => $employee->id,
            'date'                    => today()->toDateString(),
            'check_in'                => $now->format('H:i:s'),
            'status'                  => $status,
            'latitude'                => $clientLat,
            'longitude'               => $clientLng,
            'accuracy'                => $clientAcc,
            'is_within_geofence'      => $isWithinGeofence,
            'checkin_photo_url'       => $photoUrl,
            'image_check_in'          => $photoUrl, // backward compatibility
            'checkin_latitude'        => $clientLat,
            'checkin_longitude'       => $clientLng,
            'checkin_distance_meters' => $distance !== null ? (int)round($distance) : null,
            'checkin_location_note'   => $request->input('location_note'),
        ]);

        $holiday = AttendanceRules::holidayOn(Carbon::parse($record->date));
        if ($holiday) {
            $record->update([
                'is_holiday_work' => true,
                'holiday_id' => $holiday->id,
            ]);
        }

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
            'data'    => new AttendanceResource($record),
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
    public function checkOut(CheckOutRequest $request)
    {
        \Illuminate\Support\Facades\Log::info('Check-out request inputs: ' . json_encode($request->all()));
        
        $validated = $request->validated();

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

        // Gunakan tanggal dari record check-in asli untuk validasi shift
        $shiftDate = Carbon::parse($record->date);
        $todayShift = $this->getEmployeeTodayShift($employee, $shiftDate);

        if (!$todayShift) {
            return response()->json([
                'success' => false,
                'message' => 'Check-out ditolak: Tidak ada jadwal shift yang terasosiasi dengan absensi ini.',
            ], 422);
        }

        // Tentukan tipe shift harian
        $shiftType = AttendanceRules::shiftTypeFor($employee, $shiftDate);

        // 3. Validasi Geofence (Haversine)
        $clientLat  = $request->input('latitude');
        $clientLng  = $request->input('longitude');
        $clientAcc  = $request->input('accuracy');

        $isWithinGeofence = false;
        $distance = null;

        if ($clientLat !== null && $clientLng !== null) {
            $refLat  = (float) Setting::get('hospital_latitude',  '5.552740480177099');
            $refLng  = (float) Setting::get('hospital_longitude',  '95.33486560781716');
            $distance = AttendanceRules::haversineDistanceMeters((float)$clientLat, (float)$clientLng, $refLat, $refLng);
            $isWithinGeofence = ($distance <= (float) Setting::get('attendance_radius_meters', '100'));
        }

        if ($shiftType !== 'dinas_luar') {
            if ($clientLat === null || $clientLng === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'Koordinat GPS diperlukan untuk melakukan check-out. Aktifkan GPS pada perangkat Anda.',
                ], 422);
            }

            if (!$isWithinGeofence) {
                \Illuminate\Support\Facades\Log::warning(sprintf(
                    'Check-out ditolak karena berada %.0f meter dari RSUCL (di luar radius wajib).',
                    $distance
                ));

                return response()->json([
                    'success' => false,
                    'message' => 'Anda berada di luar radius lokasi absensi yang diizinkan.',
                ], 422);
            }
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

        $shiftStart    = substr($todayShift->start_time, 0, 5);
        $shiftEnd      = substr($todayShift->end_time,   0, 5);

        // 4. Hitung parameter batas pembukaan & penutupan check-out (Diferensiasi Hari Sabtu vs Hari Biasa)
        $isSaturday = Carbon::parse($record->date)->dayOfWeek === Carbon::SATURDAY;
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
            $startMins = $this->timeToMins($shiftStart ?? '21:00');
            if ($nowMins >= $startMins && $nowMins > $closeMins) {
                return response()->json([
                    'success' => false,
                    'message' => "Batas akhir check-out sudah lewat pukul {$checkoutClose} WIB.",
                ], 422);
            }
        } else {
            if ($nowMins > $closeMins) {
                return response()->json([
                    'success' => false,
                    'message' => "Batas akhir check-out sudah lewat pukul {$checkoutClose} WIB.",
                ], 422);
            }
        }

        // 6. Klasifikasi Pulang Cepat / Lembur
        $employee->load('schedules'); // Pastikan relasi ter-load untuk ScheduleRules
        $expectedCheckout = ScheduleRules::expectedCheckoutTime($employee, $shiftDate);
        $earlyGrace    = (int) Setting::get('early_checkout_grace_minutes', '15');
        $overtimeGrace = (int) Setting::get('overtime_grace_minutes', '15');

        $classification = ScheduleRules::classifyCheckout($now, $expectedCheckout, $earlyGrace, $overtimeGrace);

        // Validasi: jika pulang cepat, alasan WAJIB diisi
        if ($classification['is_early'] && empty($request->input('early_checkout_reason'))) {
            return response()->json([
                'success' => false,
                'message' => 'Anda pulang lebih cepat dari jadwal shift. Wajib mengisi alasan pulang cepat.',
                'requires_early_checkout_reason' => true,
            ], 422);
        }

        // Simpan file foto check-out wajib
        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('attendance-photos', 'public');
            $photoUrl = '/storage/' . $path;
        }

        // 7. Bangun data update untuk database
        $updateData = [
            'check_out'                => $now->format('H:i:s'),
            'latitude'                 => $clientLat,
            'longitude'                => $clientLng,
            'accuracy'                 => $clientAcc,
            'is_within_geofence'       => $isWithinGeofence,
            'checkout_photo_url'       => $photoUrl,
            'image_check_out'          => $photoUrl, // backward compatibility
            'checkout_latitude'        => $clientLat,
            'checkout_longitude'       => $clientLng,
            'checkout_distance_meters' => $distance !== null ? (int)round($distance) : null,
            'checkout_location_note'   => $request->input('location_note'),
        ];

        // Data pulang cepat — dicatat saja, tidak memerlukan persetujuan
        if ($classification['is_early']) {
            $updateData['is_early_checkout']     = true;
            $updateData['early_checkout_reason'] = $request->input('early_checkout_reason');
        }

        // Data lembur
        if ($classification['is_overtime']) {
            $updateData['is_overtime']      = true;
            $updateData['overtime_minutes'] = $classification['overtime_minutes'];
            if ($request->filled('overtime_note')) {
                $updateData['overtime_note'] = $request->input('overtime_note');
            }
        }

        // 8. Update database
        $record->update($updateData);

        return response()->json([
            'success'    => true,
            'message'    => 'Check-out berhasil.',
            'data'       => new AttendanceResource($record),
            'is_early_checkout' => $classification['is_early'],
            'is_overtime'       => $classification['is_overtime'],
            'overtime_minutes'  => $classification['overtime_minutes'],
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

        $records = AttendanceResource::collection($query->get());
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
        $shiftName = 'Tidak Ada Shift';
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
            'checkin_location_note'  => $r->checkin_location_note,
            'checkout_location_note' => $r->checkout_location_note,
            'image_check_in'     => $r->image_check_in  ? url($r->image_check_in)  : null,
            'image_check_out'    => $r->image_check_out ? url($r->image_check_out) : null,
            'shift_name'         => $shiftName,
            // ── Pulang Cepat ──────────────────────────────────────────────
            'is_early_checkout'        => (bool) $r->is_early_checkout,
            'early_checkout_reason'    => $r->early_checkout_reason,
            'early_checkout_status'    => $r->early_checkout_status,
            'early_checkout_admin_note'=> $r->early_checkout_admin_note,
            // ── Lembur ────────────────────────────────────────────────────
            'is_overtime'      => (bool) $r->is_overtime,
            'overtime_minutes' => $r->overtime_minutes,
            'overtime_note'    => $r->overtime_note,
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

    /**
     * GET /api/attendance/early-checkouts
     * 
     * Mengambil daftar absensi yang ditandai pulang cepat (is_early_checkout = true).
     * Hanya dapat diakses oleh Administrator.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function earlyCheckouts(Request $request)
    {
        $query = Attendance::with(['employee.user', 'employee.department'])
            ->where('is_early_checkout', true)
            ->orderBy('date', 'desc');

        // Filter berdasarkan status persetujuan
        if ($request->has('status') && in_array($request->query('status'), ['pending', 'approved', 'rejected'])) {
            $query->where('early_checkout_status', $request->query('status'));
        }

        // Filter bulan & tahun opsional
        if ($request->has('month') && $request->has('year')) {
            $query->whereMonth('date', (int)$request->query('month'))
                  ->whereYear('date', (int)$request->query('year'));
        }

        $records = AttendanceResource::collection($query->limit(200)->get());

        return response()->json([
            'success' => true,
            'data'    => $records,
        ]);
    }

    /**
     * PUT /api/attendance/{id}/early-checkout/approve
     * 
     * Admin menyetujui laporan pulang cepat. Opsional: simpan catatan admin.
     * 
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function approveEarlyCheckout(Request $request, int $id)
    {
        $record = Attendance::findOrFail($id);

        if (!$record->is_early_checkout) {
            return response()->json([
                'success' => false,
                'message' => 'Rekaman ini bukan pulang cepat.',
            ], 422);
        }

        $record->update([
            'early_checkout_status'     => 'approved',
            'early_checkout_admin_note' => $request->input('admin_note'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pulang cepat disetujui.',
            'data'    => new AttendanceResource($record->fresh(['employee.user', 'employee.department'])),
        ]);
    }

    /**
     * PUT /api/attendance/{id}/early-checkout/reject
     * 
     * Admin menolak laporan pulang cepat. Catatan admin WAJIB diisi.
     * 
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function rejectEarlyCheckout(Request $request, int $id)
    {
        $request->validate([
            'admin_note' => 'required|string|min:1|max:255',
        ], [
            'admin_note.required' => 'Catatan admin wajib diisi saat menolak pulang cepat.',
        ]);

        $record = Attendance::findOrFail($id);

        if (!$record->is_early_checkout) {
            return response()->json([
                'success' => false,
                'message' => 'Rekaman ini bukan pulang cepat.',
            ], 422);
        }

        $record->update([
            'early_checkout_status'     => 'rejected',
            'early_checkout_admin_note' => $request->input('admin_note'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pulang cepat ditolak.',
            'data'    => new AttendanceResource($record->fresh(['employee.user', 'employee.department'])),
        ]);
    }

    /**
     * PUT /api/attendance/overtime-note
     *
     * Memperbarui catatan lembur (overtime_note) setelah check-out berhasil.
     */
    public function updateOvertimeNote(Request $request)
    {
        $request->validate([
            'overtime_note' => 'required|string|max:150',
        ]);

        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Cari record kehadiran hari ini (atau kemarin jika overnight shift) yang is_overtime = true
        $record = Attendance::where('employee_id', $employee->id)
            ->where('is_overtime', true)
            ->where(function ($query) {
                $query->whereDate('date', today())
                      ->orWhereDate('date', today()->subDay());
            })
            ->orderBy('date', 'desc')
            ->orderBy('id', 'desc')
            ->first();

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => 'Rekaman absensi lembur tidak ditemukan atau Anda tidak terdeteksi lembur hari ini.',
            ], 404);
        }

        $record->update([
            'overtime_note' => $request->input('overtime_note'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Catatan lembur berhasil diperbarui.',
            'data'    => new AttendanceResource($record),
        ]);
    }
}
