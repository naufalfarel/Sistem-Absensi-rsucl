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

        $todayStr = today()->toDateString();
        $now = Carbon::now('Asia/Jakarta');

        // Ambil seluruh data absensi hari ini jika ada
        $allRecords = Attendance::where('employee_id', $employee->id)
                             ->where('date', $todayStr)
                             ->get();

        $activeShift = AttendanceRules::resolveShiftFor($employee, $now, $now);
        $allShifts   = AttendanceRules::resolveAllShiftsFor($employee, $now);

        // Pilih record yang matching dengan activeShift atau record paling akhir
        $record = null;
        if ($activeShift) {
            $record = $allRecords->firstWhere('schedule_id', $activeShift->id);
        }
        if (!$record) {
            $record = $allRecords->last();
        }

        // Cek apakah ada pengajuan cuti/izin/sakit yang aktif hari ini
        $activeLeave = \App\Models\LeaveRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->where('start_date', '<=', $todayStr)
            ->where(function($q) use ($todayStr) {
                $q->where(function($q2) use ($todayStr) {
                    $q2->whereNull('actual_end_date')
                       ->whereDate('end_date', '>=', $todayStr);
                })->orWhere(function($q2) use ($todayStr) {
                    $q2->whereNotNull('actual_end_date')
                       ->whereDate('actual_end_date', '>=', $todayStr);
                });
            })
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

        $isExempt = AttendanceRules::isExemptFromGps($employee, Carbon::today('Asia/Jakarta'));
        $dinasReason = null;
        if ($isExempt) {
            $approvedLetter = $employee->approvedAssignmentLetterOn(Carbon::today('Asia/Jakarta'));
            if ($approvedLetter) {
                $dinasReason = 'Surat Tugas: ' . $approvedLetter->title;
            } else {
                $dayName = AttendanceRules::dayNameFor(Carbon::today('Asia/Jakarta'));
                $sched = $employee->schedules()->wherePivot('day_of_week', $dayName)->first();
                $dinasReason = 'Shift: ' . ($sched ? $sched->name : 'Dinas Luar');
            }
        }

        return response()->json([
            'success' => true,
            'data'    => $record ? new AttendanceResource($record) : null,
            'records' => AttendanceResource::collection($allRecords),
            'active_shift' => $activeShift ? [
                'id' => $activeShift->id,
                'name' => $activeShift->name,
                'start_time' => $activeShift->start_time,
                'end_time' => $activeShift->end_time,
                'color' => $activeShift->color,
            ] : null,
            'today_shifts' => array_map(fn($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'start_time' => $s->start_time,
                'end_time' => $s->end_time,
                'color' => $s->color,
            ], $allShifts),
            'active_leave' => $leaveData,
            'holiday' => $holidayData,
            'is_exempt_from_gps' => $isExempt,
            'dinas_reason' => $dinasReason,
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

        // Ambil data absensi aktual hari ini (utamakan record yang sudah memiliki check_in dan check_out)
        $attendancesList = Attendance::where('date', $todayStr)
            ->orderByRaw('CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN 1 WHEN check_in IS NOT NULL THEN 2 WHEN check_out IS NOT NULL THEN 3 ELSE 4 END')
            ->orderBy('id', 'desc')
            ->get();

        $attendances = collect();
        foreach ($attendancesList as $attRec) {
            if (!$attendances->has($attRec->employee_id)) {
                $attendances->put($attRec->employee_id, $attRec);
            }
        }

        // Pre-fetch roster tanggal spesifik (work_date) hari ini
        $todayRosters = \Illuminate\Support\Facades\DB::table('employee_schedule')
            ->join('schedules', 'employee_schedule.schedule_id', '=', 'schedules.id')
            ->where('employee_schedule.work_date', $todayStr)
            ->whereNotNull('employee_schedule.work_date')
            ->select('employee_schedule.employee_id', 'schedules.*')
            ->get()
            ->keyBy('employee_id');

        $records = [];
        foreach ($employees as $emp) {
            if ($attendances->has($emp->id)) {
                $att = $attendances->get($emp->id);
                $records[] = $this->formatRecord($att, withEmployee: true);
            } else {
                // Cari jadwal shift hari ini (Prioritas 1: Roster tanggal spesifik, Prioritas 2: Mingguan)
                $dateRoster = $todayRosters->get($emp->id);
                $schedule = null;

                if ($dateRoster) {
                    $schedule = $dateRoster;
                } else {
                    $schedule = $emp->schedules->first(function($s) use ($todayName) {
                        return $s->pivot->day_of_week === $todayName;
                    });
                }

                $isOffShift = false;
                if ($schedule) {
                    $uName = strtoupper($schedule->name);
                    if (str_contains($uName, 'LIBUR') || str_contains($uName, 'LJ') || str_contains($uName, 'OFF')) {
                        $isOffShift = true;
                    }
                }

                if (!$schedule || $isOffShift) {
                    $status = 'tidak_ada_shift';
                    $shiftName = $schedule ? $schedule->name : 'Tidak Ada Shift';
                    $note = $isOffShift ? 'Libur Jaga (LJ) — Tidak Wajib Absen' : 'Hari Libur / Tidak Ada Shift';
                } else {
                    $shiftName = $schedule->name;
                    
                    // Evaluasi apakah batas waktu check-in sudah terlewati
                    $now = Carbon::now('Asia/Jakarta');
                    $shiftStart = $schedule->start_time; // "HH:mm:ss"
                    $resolvedCloseTime = $schedule->checkin_window_end_time;
                    if (empty($resolvedCloseTime)) {
                        $startCarbon = Carbon::parse($schedule->start_time);
                        $endCarbon = Carbon::parse($schedule->end_time);
                        if ($endCarbon->lt($startCarbon)) {
                            $endCarbon->addDay();
                        }
                        $duration = $startCarbon->diffInMinutes($endCarbon);
                        $half = (int) ($duration / 2);
                        $resolvedCloseTime = $startCarbon->copy()->addMinutes($half)->format('H:i:s');
                    }
                    $shiftStartCarbon = Carbon::today('Asia/Jakarta')->setTimeFromTimeString($shiftStart);
                    $closeLimitCarbon = Carbon::today('Asia/Jakarta')->setTimeFromTimeString($resolvedCloseTime);

                    // Cek jika hari libur nasional
                    $holiday = AttendanceRules::holidayOn(Carbon::today('Asia/Jakarta'));
                    $isAssigned = $holiday ? AttendanceRules::isAssignedToWorkOnHoliday($emp, $holiday) : false;

                    if ($holiday && !$isAssigned) {
                        $status = 'belum_hadir';
                        $note = 'Hari Libur (Tidak Wajib)';
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
                        'nik_ktp'    => $emp->nik_ktp,
                        'department' => $emp->department?->name ?? 'Umum',
                        'position'   => $emp->position?->name ?? 'Staff',
                        'profile_picture' => $emp->user?->profile_picture ? url($emp->user->profile_picture) : null,
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

        // 2. Validasi apakah karyawan bersangkutan sedang cuti/izin/sakit yang disetujui hari ini (diperbolehkan check-in untuk deteksi lapor masuk lebih awal)

        // 4. Tentukan waktu check-in & resolve active shift untuk saat ini
        $now = Carbon::now('Asia/Jakarta');

        $todayShift = AttendanceRules::resolveShiftFor($employee, $now, $now);
        $isFallback = false;

        if (!$todayShift) {
            return response()->json([
                'success' => false,
                'message' => 'Anda belum memiliki jadwal shift untuk saat ini. Silakan hubungi Penanggung Jawab Bagian atau Administrator.',
            ], 422);
        }

        // 3. Validasi absensi ganda pada shift yang sama hari ini
        $existing = Attendance::withTrashed()
                              ->where('employee_id', $employee->id)
                              ->where('date', today()->toDateString())
                              ->where(function($q) use ($todayShift) {
                                  $q->where('schedule_id', $todayShift->id)
                                    ->orWhereNull('schedule_id');
                              })
                              ->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
                $existing->status = 'alpha';
                $existing->save();
            }

            if (in_array($existing->status, ['sakit', 'izin', 'cuti'])) {
                $typeName = $existing->status === 'sakit' ? 'Sakit' : ($existing->status === 'izin' ? 'Izin' : 'Cuti');
                return response()->json([
                    'success' => false,
                    'message' => "Check-in ditolak: Anda sedang dalam masa {$typeName} untuk hari ini.",
                ], 422);
            }

            if ($existing->check_in) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda sudah melakukan check-in untuk ' . $todayShift->name . ' hari ini pukul ' . substr($existing->check_in, 0, 5) . '.',
                    'errors' => null,
                ], 409);
            }
        }

        // Tentukan tipe shift harian
        $shiftType = AttendanceRules::shiftTypeFor($employee, $now);

        // 5. Validasi Geofence (menggunakan rumus Matematika Haversine)
        $clientLat  = $request->input('latitude');
        $clientLng  = $request->input('longitude');
        $clientAcc  = $request->input('accuracy');

        $enableGpsValidation = (Setting::get('enable_gps_validation', '1') !== '0');
        $isWithinGeofence = false;
        $distance = null;

        if ($clientLat !== null && $clientLng !== null) {
            $refLat  = (float) Setting::get('hospital_latitude', Setting::get('hospital_lat', '5.552740480177099'));
            $refLng  = (float) Setting::get('hospital_longitude', Setting::get('hospital_lng', '95.33486560781716'));
            $distance = AttendanceRules::haversineDistanceMeters((float)$clientLat, (float)$clientLng, $refLat, $refLng);
            $maxRadius = (float) Setting::get('attendance_radius_meters', Setting::get('gps_radius', '100'));
            $isWithinGeofence = ($distance <= $maxRadius);
        }

        if (!$enableGpsValidation) {
            $isWithinGeofence = true;
        }

        if ($enableGpsValidation && !AttendanceRules::isExemptFromGps($employee, $now)) {
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

        // 6. Tentukan status ketepatan waktu check-in
        $today = today()->toDateString();
        $dateObj = Carbon::parse($today);

        // Cari jam mulai shift dari database / helper
        $shiftStartTimeStr = $todayShift->start_time ?? ($shiftType === 'saturday' ? '08:30:00' : '08:30:00');
        $shiftStart = Carbon::parse($today . ' ' . $shiftStartTimeStr);
        $checkinWindowEnd = $shiftStart->copy()->addHours(6);

        $tepatWaktuMinutes = (int) Setting::get('tepat_waktu_tolerance_minutes', '10');
        $toleranceMinutes  = (int) Setting::get('attendance_late_tolerance_minutes', '10');

        $classification = AttendanceRules::classifyCheckin($now, $shiftStart, $checkinWindowEnd, $tepatWaktuMinutes, $toleranceMinutes);
        $status                 = $classification['status'];
        $punctuality            = $classification['punctuality'];
        $effectiveCheckinTime   = $classification['effective_checkin_time'];

        // Simpan file foto check-in (sama seperti check-out)
        $photoUrl = null;
        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('attendance-photos', 'public');
            $photoUrl = '/storage/' . $path;
        } elseif ($request->input('photo_url')) {
            // Fallback: jika dikirim sebagai string URL (base64 atau URL langsung)
            $photoUrl = $request->input('photo_url');
        }

        // 7. Simpan atau update record absensi secara atomic (DB Transaction dengan Pessimistic Locking)
        try {
            $record = \Illuminate\Support\Facades\DB::transaction(function () use (
                $employee, $today, $todayShift, $now, $status, $punctuality, $effectiveCheckinTime,
                $clientLat, $clientLng, $clientAcc, $isWithinGeofence, $distance, $photoUrl, $request
            ) {
                $lockedExisting = Attendance::where('employee_id', $employee->id)
                    ->where('date', $today)
                    ->where(function($q) use ($todayShift) {
                        $q->where('schedule_id', $todayShift->id)
                          ->orWhereNull('schedule_id');
                    })
                    ->lockForUpdate()
                    ->first();

                if ($lockedExisting) {
                    if ($lockedExisting->trashed()) {
                        $lockedExisting->restore();
                        $lockedExisting->status = 'alpha';
                        $lockedExisting->save();
                    }

                    if (in_array($lockedExisting->status, ['sakit', 'izin', 'cuti'])) {
                        $typeName = $lockedExisting->status === 'sakit' ? 'Sakit' : ($lockedExisting->status === 'izin' ? 'Izin' : 'Cuti');
                        throw new \Exception("Check-in ditolak: Anda sedang dalam masa {$typeName} untuk hari ini.", 422);
                    }

                    if ($lockedExisting->check_in) {
                        $timeStr = substr($lockedExisting->check_in, 0, 5);
                        throw new \Exception("Anda sudah melakukan check-in untuk {$todayShift->name} hari ini pukul {$timeStr}.", 409);
                    }
                }

                $attendanceData = [
                    'schedule_id'             => $todayShift->id,
                    'check_in'                => $now->format('H:i:s'),
                    'status'                  => $status,
                    'note'                    => null, // Reset/clear stale leave note upon check-in
                    'checkin_punctuality'     => $punctuality,
                    'effective_checkin_time'  => $effectiveCheckinTime,
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
                ];

                if ($lockedExisting) {
                    $lockedExisting->update($attendanceData);
                    return $lockedExisting;
                } else {
                    $attendanceData['employee_id'] = $employee->id;
                    $attendanceData['date']        = $today;
                    return Attendance::create($attendanceData);
                }
            });
        } catch (\Illuminate\Database\QueryException $e) {
            \Log::error('Check-in QueryException: ' . $e->getMessage(), [
                'code' => $e->getCode(),
                'errorInfo' => $e->errorInfo,
            ]);
            // Tangkap duplikasi entry jika constraint unique terpicu
            if (isset($e->errorInfo[1]) && $e->errorInfo[1] == 1062) {
                $dup = Attendance::where('employee_id', $employee->id)
                                 ->where('date', $today)
                                 ->first();
                $timeStr = $dup && $dup->check_in ? substr($dup->check_in, 0, 5) : '--:--';
                return response()->json([
                    'success' => false,
                    'message' => "Anda sudah melakukan check-in hari ini pukul {$timeStr}.",
                    'errors'  => null,
                ], 409);
            }
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan database saat menyimpan absensi.',
                'error_detail' => $e->getMessage()
            ], 500);
        } catch (\Exception $e) {
            $code = $e->getCode();
            if ($code === 409) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'errors'  => null,
                ], 409);
            }
            if ($code === 422) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                ], 422);
            }
            throw $e;
        }

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
                $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
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
                $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
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
        $now = Carbon::now('Asia/Jakarta');
        $todayShift = AttendanceRules::resolveShiftFor($employee, $now, $now);

        $record = null;
        if ($todayShift) {
            $record = Attendance::where('employee_id', $employee->id)
                                ->where('date', today()->toDateString())
                                ->where('schedule_id', $todayShift->id)
                                ->whereNotNull('check_in')
                                ->whereNull('check_out')
                                ->first();
        }

        if (!$record) {
            $record = Attendance::where('employee_id', $employee->id)
                                ->where('date', today()->toDateString())
                                ->whereNotNull('check_in')
                                ->whereNull('check_out')
                                ->first();
        }

        if (!$record) {
            $record = Attendance::where('employee_id', $employee->id)
                                ->where('date', today()->toDateString())
                                ->whereNotNull('check_in')
                                ->first();
        }

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
                    if ($shiftEnd <= $shiftStart) {
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
        $todayShift = null;
        if ($record->schedule_id) {
            $todayShift = \App\Models\Schedule::find($record->schedule_id);
        }
        if (!$todayShift) {
            $todayShift = AttendanceRules::resolveShiftFor($employee, $shiftDate, $now);
        }
        if (!$todayShift) {
            $todayShift = $this->getEmployeeTodayShift($employee, $shiftDate);
        }

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

        $enableGpsValidation = (Setting::get('enable_gps_validation', '1') !== '0');
        $isWithinGeofence = false;
        $distance = null;

        if ($clientLat !== null && $clientLng !== null) {
            $refLat  = (float) Setting::get('hospital_latitude', Setting::get('hospital_lat', '5.552740480177099'));
            $refLng  = (float) Setting::get('hospital_longitude', Setting::get('hospital_lng', '95.33486560781716'));
            $distance = AttendanceRules::haversineDistanceMeters((float)$clientLat, (float)$clientLng, $refLat, $refLng);
            $maxRadius = (float) Setting::get('attendance_radius_meters', Setting::get('gps_radius', '100'));
            $isWithinGeofence = ($distance <= $maxRadius);
        }

        if (!$enableGpsValidation) {
            $isWithinGeofence = true;
        }

        if ($enableGpsValidation && !AttendanceRules::isExemptFromGps($employee, $shiftDate)) {
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

        // Tentukan waktu check-out
        $now = Carbon::now('Asia/Jakarta');

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
        // Batas akhir checkout dihapus agar karyawan tetap bisa checkout terlambat (lembur)
        // dan keterangannya tersimpan ke database untuk diproses persetujuannya oleh admin.

        // 6. Klasifikasi Pulang Cepat / Lembur
        $employee->load('schedules'); // Pastikan relasi ter-load untuk ScheduleRules
        $expectedCheckout = ScheduleRules::expectedCheckoutTime($employee, $shiftDate, $todayShift);
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

        // Data lembur (Sistem Baru & Lama Berdampingan untuk Kompatibilitas)
        $attendanceService = new \App\Services\AttendanceService();
        $overtimeCalc = $attendanceService->hitungStatusLembur($employee, $now, $shiftDate, $todayShift);

        if ($overtimeCalc['is_lembur']) {
            // Simpan ke kolom baru (internal detection)
            $updateData['jam_pulang_normal']      = $overtimeCalc['jam_pulang_normal'];
            $updateData['is_lembur']              = true;
            $updateData['durasi_lembur_menit']    = $overtimeCalc['durasi_lembur_menit'];
            $updateData['keterangan_lembur']      = null;
            $updateData['status_approval_lembur'] = null; // New system uses OvertimeRequest for approval flow

            // Sinkronkan ke kolom legacy demi kompatibilitas backward
            $updateData['is_overtime']            = true;
            $updateData['overtime_minutes']       = $overtimeCalc['durasi_lembur_menit'];
            $updateData['overtime_note']          = null;
            $updateData['overtime_status']        = null;
        } else {
            // Set data lembur kosong jika tidak lembur
            $updateData['jam_pulang_normal']      = $overtimeCalc['jam_pulang_normal'];
            $updateData['is_lembur']              = false;
            $updateData['durasi_lembur_menit']    = 0;
            $updateData['keterangan_lembur']      = null;
            $updateData['status_approval_lembur'] = null;
            $updateData['overtime_status']        = null;
        }

        // 8. Update database
        $record->update($updateData);

        $message = 'Check-out berhasil.';
        if ($overtimeCalc['is_lembur']) {
            $message = 'Check-out berhasil. Kamu melewati batas jam checkout (tetapi tetap dapat absen pulang).';
        }

        return response()->json([
            'success'    => true,
            'message'    => $message,
            'data'       => new AttendanceResource($record),
            'is_early_checkout' => $classification['is_early'],
            'is_overtime'       => $overtimeCalc['is_lembur'],
            'overtime_minutes'  => $overtimeCalc['durasi_lembur_menit'],
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
            if ($user->role === 'employee') {
                foreach ($records as &$record) {
                    unset(
                        $record['is_overtime'],
                        $record['overtime_minutes'],
                        $record['overtime_note'],
                        $record['overtime_status'],
                        $record['overtime_reviewed_by'],
                        $record['overtime_reviewed_at'],
                        $record['overtime_admin_note'],
                        $record['jam_pulang_normal'],
                        $record['is_lembur'],
                        $record['durasi_lembur_menit'],
                        $record['keterangan_lembur'],
                        $record['status_approval_lembur']
                    );
                }
            }
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
        // 1. Coba resolve via AttendanceRules (Mendukung work_date, roster tanggal spesifik & sub-shift)
        $schedule = AttendanceRules::resolveShiftFor($employee, $now, $now);

        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $todayName = $dayMap[$now->dayOfWeek];

        // 2. Fallback ke pivot mingguan
        if (!$schedule) {
            $schedule = $employee->schedules()->wherePivot('day_of_week', $todayName)->first();
        }

        if (!$schedule) {
            return null;
        }

        // Jika schedule adalah parent template yang memiliki children, kita cari sub-shift yang cocok
        if ($schedule->parent_id === null && $schedule->children()->exists()) {
            // Cek apakah karyawan sudah melakukan check-in hari ini
            $record = \App\Models\Attendance::where('employee_id', $employee->id)
                ->whereDate('date', $now->toDateString())
                ->first();
            
            $timeToMatch = $now;
            if ($record && $record->check_in) {
                // Gunakan jam check-in yang sudah tercatat
                $timeToMatch = Carbon::parse($record->check_in);
            }

            $matchedChild = $this->resolveActiveSubShift($schedule, $todayName, $timeToMatch);
            if ($matchedChild) {
                // Kloning parent model dan timpa start_time / end_time menggunakan data anak agar tidak merusak logika penanganan absensi di tempat lain
                $cloned = $schedule->replicate();
                $cloned->id = $matchedChild->id; // Gunakan ID anak agar data attendance mereferensikan sub-shift secara benar
                $cloned->start_time = $matchedChild->start_time;
                $cloned->end_time = $matchedChild->end_time;
                $cloned->name = $matchedChild->name;
                $cloned->exists = true;
                return $cloned;
            }
        }

        return $schedule;
    }

    /**
     * Mencocokkan sub-shift (anak) yang aktif di bawah parent template berdasarkan jam kerja/check-in saat ini.
     *
     * @param \App\Models\Schedule $parent
     * @param string $todayName
     * @param Carbon $now
     * @return \App\Models\Schedule|null
     */
    private function resolveActiveSubShift(\App\Models\Schedule $parent, string $todayName, Carbon $now): ?\App\Models\Schedule
    {
        $children = $parent->children()->get();
        if ($children->isEmpty()) {
            return null;
        }

        $nowMins = $now->hour * 60 + $now->minute;

        // Toleransi global dari settings (default: 30 menit sebelum, 60 menit sesudah)
        $checkinOpenOffset  = (int) \App\Models\Setting::get('checkin_open', '30');
        $closeCheckinOffset = (int) \App\Models\Setting::get('close_checkin', '60');

        $matched = null;
        $closestDiff = 999999;

        foreach ($children as $child) {
            // Evaluasi kecocokan berdasarkan hari jika nama sub-shift memuat hari spesifik (seperti Sabtu, Senin-Jumat)
            $nameLower = strtolower($child->name);
            if (str_contains($nameLower, 'sabtu') && $todayName !== 'Sabtu') {
                continue;
            }
            if (str_contains($nameLower, 'senin–jumat') && $todayName === 'Sabtu') {
                continue;
            }
            if (str_contains($nameLower, 'sen-jum') && $todayName === 'Sabtu') {
                continue;
            }

            // Hitung rentang check-in untuk sub-shift ini
            $startTime = substr($child->start_time, 0, 5);
            $startMins = $this->timeToMins($startTime);

            $openLimitMins  = $startMins - $checkinOpenOffset;
            $closeLimitMins = $startMins + $closeCheckinOffset;

            // Handle overnight check-in window
            if ($openLimitMins < 0) {
                $openLimitMins += 1440;
            }

            // Evaluasi apakah waktu sekarang berada dalam rentang pintu absensi masuk
            $inWindow = false;
            if ($closeLimitMins > $openLimitMins) {
                $inWindow = ($nowMins >= $openLimitMins && $nowMins <= $closeLimitMins);
            } else {
                // Window melewati tengah malam
                $inWindow = ($nowMins >= $openLimitMins || $nowMins <= $closeLimitMins);
            }

            if ($inWindow) {
                return $child;
            }

            // Fallback: cari sub-shift dengan selisih waktu mulai terdekat dengan jam sekarang
            $diff = abs($nowMins - $startMins);
            if ($diff > 720) {
                $diff = 1440 - $diff;
            }
            if ($diff < $closestDiff) {
                $closestDiff = $diff;
                $matched = $child;
            }
        }

        return $matched;
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

    private function formatPhotoUrl(?string $path): ?string
    {
        if (empty($path)) {
            return null;
        }
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, 'data:')) {
            return $path;
        }
        return url($path);
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

        $isIncomplete = AttendanceRules::isAttendanceIncomplete($r, $r->employee);
        $displayStatus = $isIncomplete ? 'tidak_lengkap' : $r->status;

        $data = [
            'id'                 => $r->id,
            'date'               => $r->date?->toDateString(),
            'check_in'           => $r->check_in,
            'check_out'          => $r->check_out,
            'status'             => $r->status,
            'display_status'     => $displayStatus,
            'checkin_punctuality'     => $r->checkin_punctuality,
            'effective_checkin_time'  => $r->effective_checkin_time,
            'duration_min'       => $r->duration_minutes_attribute ?? null,
            'latitude'           => $r->latitude,
            'longitude'          => $r->longitude,
            'accuracy'           => $r->accuracy,
            'is_within_geofence' => $r->is_within_geofence,
            'note'               => $r->note,
            'checkin_location_note'  => $r->checkin_location_note,
            'checkout_location_note' => $r->checkout_location_note,
            'image_check_in'     => $this->formatPhotoUrl($r->image_check_in),
            'image_check_out'    => $this->formatPhotoUrl($r->image_check_out),
            'checkin_photo_url'  => $this->formatPhotoUrl($r->checkin_photo_url ?? $r->image_check_in),
            'checkout_photo_url' => $this->formatPhotoUrl($r->checkout_photo_url ?? $r->image_check_out),
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
                'nik_ktp'    => $r->employee->nik_ktp,
                'department' => $r->employee->department?->name,
                'profile_picture' => $this->formatPhotoUrl($r->employee->user?->profile_picture),
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

    /**
     * GET /api/attendance
     *
     * Get paginated history of employees attendance and leave period rows.
     */
    public function adminAttendanceHistory(Request $request)
    {
        $rows = $this->getHistoryRows($request);

        // Filter by status if provided
        if ($request->filled('status')) {
            $statuses = (array)$request->input('status');
            $rows = array_filter($rows, function($row) use ($statuses) {
                $rowStatus = $row['display_status'] ?? $row['status'];
                return in_array($rowStatus, $statuses);
            });
            $rows = array_values($rows); // reset array keys
        }

        // Manual pagination
        $currentPage = \Illuminate\Pagination\LengthAwarePaginator::resolveCurrentPage() ?: 1;
        $perPage = (int)$request->query('per_page', 20);
        if ($perPage < 1) $perPage = 20;
        if ($perPage > 100) $perPage = 100;

        $col = collect($rows);
        $currentPageResults = $col->slice(($currentPage - 1) * $perPage, $perPage)->values();

        $paginated = new \Illuminate\Pagination\LengthAwarePaginator(
            $currentPageResults,
            $col->count(),
            $perPage,
            $currentPage,
            ['path' => \Illuminate\Pagination\LengthAwarePaginator::resolveCurrentPath()]
        );

        return response()->json([
            'success' => true,
            'data'    => $paginated->items(),
            'meta'    => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ]
        ]);
    }

    /**
     * GET /api/attendance/status-summary
     *
     * Get attendance counts/summary for the active filters.
     */
    public function adminStatusSummary(Request $request)
    {
        $rows = $this->getHistoryRows($request);

        $hadir = 0;
        $telat = 0;
        $alpha = 0;
        $cuti = 0;
        $tidakLengkap = 0;

        foreach ($rows as $row) {
            $status = $row['display_status'] ?? $row['status'];
            if ($status === 'tidak_lengkap') {
                $tidakLengkap++;
            } elseif ($status === 'hadir') {
                $hadir++;
            } elseif ($status === 'telat') {
                $telat++;
            } elseif ($status === 'alpha' || $status === 'belum_hadir') {
                $alpha++;
            } elseif (in_array($status, ['izin', 'sakit', 'cuti', 'cuti_khusus'])) {
                $cuti++;
            }
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'hadir'         => $hadir,
                'terlambat'     => $telat,
                'alpha'         => $alpha,
                'cuti'          => $cuti,
                'tidak_lengkap' => $tidakLengkap,
            ]
        ]);
    }

    /**
     * Helper to get attendance and leave period rows based on request filters.
     * Before status filtering and pagination.
     */
    private function getHistoryRows(Request $request): array
    {
        $user = $request->user();
        $dateFrom = $request->query('date_from');
        $dateTo   = $request->query('date_to');
        
        $isRangeMode = !empty($dateFrom) && !empty($dateTo);
        
        // 1. Get active employees matching search and department filters
        $empQuery = \App\Models\Employee::where('status', 'active')
            ->with(['user', 'department', 'position', 'schedules']);

        // Scope to PJ Bagian department(s) if user is PJ Bagian and not Admin
        if ($user->isPjBagian() && !$user->isAdmin()) {
            $deptIds = $user->getPjDepartmentIds();
            if (!empty($deptIds)) {
                $empQuery->whereIn('department_id', $deptIds);
            }
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $empQuery->where(function($q) use ($search) {
                $q->where('nik_ktp', 'like', "%{$search}%")
                  ->orWhereHas('user', function($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('department', function($dq) use ($search) {
                      $dq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->filled('department_id')) {
            $empQuery->where('department_id', $request->query('department_id'));
        }

        $employees = $empQuery->get();
        $employeeIds = $employees->pluck('id')->toArray();

        $rows = [];
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];

        if (!$isRangeMode) {
            // Mode Harian (Single Date)
            $targetDate = $request->query('date', today('Asia/Jakarta')->toDateString());
            $carbonDate = Carbon::parse($targetDate);
            $dayName = $dayMap[$carbonDate->dayOfWeek];

            // Fetch attendances for this single date (gabungkan row check_in & check_out jika terpisah)
            $attList = Attendance::whereIn('employee_id', $employeeIds)
                ->whereDate('date', $targetDate)
                ->with(['holiday'])
                ->orderBy('id', 'asc')
                ->get()
                ->groupBy('employee_id');

            $attendances = collect();
            foreach ($attList as $empId => $attGroup) {
                if ($attGroup->count() === 1) {
                    $attendances->put($empId, $attGroup->first());
                } else {
                    $checkInRow = $attGroup->first(fn($a) => !empty($a->check_in));
                    $checkOutRow = $attGroup->first(fn($a) => !empty($a->check_out));

                    if ($checkInRow && $checkOutRow && $checkInRow->id !== $checkOutRow->id) {
                        $merged = clone $checkOutRow;
                        $merged->check_in = $checkInRow->check_in;
                        $merged->image_check_in = $checkInRow->image_check_in;
                        $merged->checkin_photo_url = $checkInRow->checkin_photo_url ?? $checkInRow->image_check_in;
                        $merged->checkin_latitude = $checkInRow->checkin_latitude;
                        $merged->checkin_longitude = $checkInRow->checkin_longitude;
                        $merged->checkin_distance_meters = $checkInRow->checkin_distance_meters;
                        $merged->checkin_location_note = $checkInRow->checkin_location_note;
                        $attendances->put($empId, $merged);
                    } else {
                        $best = $attGroup->sortBy(function($a) {
                            if (!empty($a->check_in) && !empty($a->check_out)) return 1;
                            if (!empty($a->check_in)) return 2;
                            if (!empty($a->check_out)) return 3;
                            return 4;
                        })->first();
                        $attendances->put($empId, $best);
                    }
                }
            }

            // Fetch approved leaves overlapping this single date
            $leaves = \App\Models\LeaveRequest::where('status', 'approved')
                ->whereIn('employee_id', $employeeIds)
                ->whereDate('start_date', '<=', $targetDate)
                ->where(function($q) use ($targetDate) {
                    $q->where(function($q2) use ($targetDate) {
                        $q2->whereNull('actual_end_date')
                           ->whereDate('end_date', '>=', $targetDate);
                    })->orWhere(function($q2) use ($targetDate) {
                        $q2->whereNotNull('actual_end_date')
                           ->whereDate('actual_end_date', '>=', $targetDate);
                    });
                })
                ->with(['specialLeaveCategory'])
                ->get()
                ->keyBy('employee_id');

            $holiday = AttendanceRules::holidayOn($carbonDate);
            
            // For Alpha/Belum Hadir calculation limits
            $firstAttDate = Attendance::orderBy('date', 'asc')->value('date');
            $systemStartDate = $firstAttDate ? Carbon::parse($firstAttDate)->startOfDay() : today('Asia/Jakarta');
            $today = Carbon::today('Asia/Jakarta');
            $limitDate = $carbonDate->gt($today) ? $today : $carbonDate;

            foreach ($employees as $emp) {
                $matchingShift = $emp->schedules->first(function($s) use ($dayName) {
                    return $s->pivot->day_of_week === $dayName;
                });
                
                $hasShift = !empty($matchingShift);

                if ($attendances->has($emp->id)) {
                    $att = $attendances->get($emp->id);
                    $rows[] = $this->formatRowFromAttendance($att, $emp, $matchingShift);
                } elseif ($leaves->has($emp->id)) {
                    $leave = $leaves->get($emp->id);
                    $rows[] = $this->formatRowFromLeave($leave, $emp, $targetDate, $matchingShift, 'daily');
                } else {
                    $isOffShift = false;
                    if ($matchingShift) {
                        $uName = strtoupper($matchingShift->name);
                        if (str_contains($uName, 'LIBUR') || str_contains($uName, 'LJ') || str_contains($uName, 'OFF')) {
                            $isOffShift = true;
                        }
                    }

                    if (!$hasShift || $isOffShift) {
                        continue;
                    }

                    if ($holiday) {
                        $isAssigned = AttendanceRules::isAssignedToWorkOnHoliday($emp, $holiday);
                        if (!$isAssigned) {
                            continue;
                        }
                    }

                    if ($carbonDate->lte($limitDate) && $carbonDate->gte($systemStartDate)) {
                        $status = 'alpha';
                        $note = 'Tidak Hadir Tanpa Keterangan' . ($holiday ? ' (Mangkir Penugasan)' : '');

                        if ($carbonDate->isToday() && $matchingShift) {
                            $now = Carbon::now('Asia/Jakarta');
                            $shiftStart = $matchingShift->start_time;
                            $resolvedCloseTime = $matchingShift->checkin_window_end_time;
                            if (empty($resolvedCloseTime)) {
                                $startCarbon = Carbon::parse($matchingShift->start_time);
                                $endCarbon = Carbon::parse($matchingShift->end_time);
                                if ($endCarbon->lt($startCarbon)) {
                                    $endCarbon->addDay();
                                }
                                $duration = $startCarbon->diffInMinutes($endCarbon);
                                $half = (int) ($duration / 2);
                                $resolvedCloseTime = $startCarbon->copy()->addMinutes($half)->format('H:i:s');
                            }
                            $shiftStartCarbon = Carbon::today('Asia/Jakarta')->setTimeFromTimeString($shiftStart);
                            $closeLimitCarbon = Carbon::today('Asia/Jakarta')->setTimeFromTimeString($resolvedCloseTime);

                        if ($carbonDate->isToday()) {
                            $status = 'belum_hadir';
                            $note = 'Belum Absen Masuk';
                        }
                        }

                        $rows[] = $this->formatRowForAbsent($emp, $targetDate, $status, $note, $matchingShift);
                    }
                }
            }
        } else {
            // Mode Rentang Tanggal
            // Fetch attendances in range
            $attendances = Attendance::whereIn('employee_id', $employeeIds)
                ->whereBetween('date', [$dateFrom, $dateTo])
                ->with(['holiday'])
                ->get();

            // Fetch approved leaves overlapping range
            $leaves = \App\Models\LeaveRequest::where('status', 'approved')
                ->whereIn('employee_id', $employeeIds)
                ->whereDate('start_date', '<=', $dateTo)
                ->where(function($q) use ($dateFrom) {
                    $q->where(function($q2) use ($dateFrom) {
                        $q2->whereNull('actual_end_date')
                           ->whereDate('end_date', '>=', $dateFrom);
                    })->orWhere(function($q2) use ($dateFrom) {
                        $q2->whereNotNull('actual_end_date')
                           ->whereDate('actual_end_date', '>=', $dateFrom);
                    });
                })
                ->with(['specialLeaveCategory'])
                ->get();

            foreach ($attendances as $att) {
                $emp = $employees->firstWhere('id', $att->employee_id);
                if (!$emp) continue;
                
                $dayName = $dayMap[$att->date->dayOfWeek];
                $matchingShift = $emp->schedules->first(function($s) use ($dayName) {
                    return $s->pivot->day_of_week === $dayName;
                });
                
                $rows[] = $this->formatRowFromAttendance($att, $emp, $matchingShift);
            }

            foreach ($leaves as $leave) {
                $emp = $employees->firstWhere('id', $leave->employee_id);
                if (!$emp) continue;

                $startDateCarbon = Carbon::parse($leave->start_date);
                $dayName = $dayMap[$startDateCarbon->dayOfWeek];
                $matchingShift = $emp->schedules->first(function($s) use ($dayName) {
                    return $s->pivot->day_of_week === $dayName;
                });

                // Row type: leave_period
                $rows[] = $this->formatRowFromLeave($leave, $emp, $leave->start_date, $matchingShift, 'leave_period');
            }
        }

        // Sort: date DESC, name A-Z
        usort($rows, function($a, $b) {
            $dateA = $a['row_type'] === 'leave_period' ? $a['start_date'] : $a['date'];
            $dateB = $b['row_type'] === 'leave_period' ? $b['start_date'] : $b['date'];

            $dateComp = strcmp($dateB, $dateA);
            if ($dateComp !== 0) {
                return $dateComp;
            }

            return strcmp($a['employee']['name'], $b['employee']['name']);
        });

        return $rows;
    }

    private function formatRowFromAttendance($att, $emp, $matchingShift)
    {
        $isIncomplete = AttendanceRules::isAttendanceIncomplete($att, $emp);
        $displayStatus = $isIncomplete ? 'tidak_lengkap' : $att->status;

        return [
            'id' => $att->id,
            'employee_id' => $emp->id,
            'date' => $att->date ? $att->date->toDateString() : null,
            'check_in' => $att->check_in,
            'check_out' => $att->check_out,
            'status' => $att->status,
            'display_status' => $displayStatus,
            'duration_min' => $att->duration_minutes,
            'latitude' => $att->latitude,
            'longitude' => $att->longitude,
            'accuracy' => $att->accuracy,
            'is_within_geofence' => (bool)$att->is_within_geofence,
            'note' => (in_array($displayStatus, ['hadir', 'telat']) && $att->note && str_starts_with($att->note, 'Masa ')) ? null : $att->note,
            'checkin_location_note' => $att->checkin_location_note,
            'checkout_location_note' => $att->checkout_location_note,
            'checkin_photo_url' => $this->formatPhotoUrl($att->checkin_photo_url ?? $att->image_check_in),
            'checkout_photo_url' => $this->formatPhotoUrl($att->checkout_photo_url ?? $att->image_check_out),
            'image_check_in' => $this->formatPhotoUrl($att->image_check_in),
            'image_check_out' => $this->formatPhotoUrl($att->image_check_out),
            'checkin_latitude' => $att->checkin_latitude,
            'checkin_longitude' => $att->checkin_longitude,
            'checkout_latitude' => $att->checkout_latitude,
            'checkout_longitude' => $att->checkout_longitude,
            'checkin_distance_meters' => $att->checkin_distance_meters,
            'checkout_distance_meters' => $att->checkout_distance_meters,
            'shift_name' => $matchingShift ? $matchingShift->name : 'Reguler',
            'shift_type' => $matchingShift ? ($matchingShift->shift_type ?? 'normal') : 'normal',
            'is_holiday_work' => (bool)$att->is_holiday_work,
            'holiday' => $att->relationLoaded('holiday') && $att->holiday ? $att->holiday->name : ($att->holiday ? $att->holiday->name : null),
            'row_type' => 'daily',
            'employee' => [
                'id' => $emp->id,
                'name' => $emp->user?->name,
                'nik_ktp' => $emp->nik_ktp,
                'department' => $emp->department?->name,
                'position' => $emp->position?->name,
                'profile_picture' => $this->formatPhotoUrl($emp->user?->profile_picture),
            ],
        ];
    }

    private function formatRowFromLeave($leave, $emp, $date, $matchingShift, $rowType)
    {
        return [
            'id' => 'leave_' . $leave->id,
            'employee_id' => $emp->id,
            'date' => $date,
            'start_date' => $leave->start_date ? $leave->start_date->toDateString() : null,
            'end_date' => $leave->end_date ? $leave->end_date->toDateString() : null,
            'days' => $leave->days_count,
            'check_in' => null,
            'check_out' => null,
            'status' => $leave->type, // cuti, izin, sakit, cuti_khusus
            'duration_min' => null,
            'latitude' => null,
            'longitude' => null,
            'accuracy' => null,
            'is_within_geofence' => false,
            'note' => $leave->reason,
            'checkin_location_note' => null,
            'checkout_location_note' => null,
            'checkin_photo_url' => null,
            'checkout_photo_url' => null,
            'image_check_in' => null,
            'image_check_out' => null,
            'checkin_latitude' => null,
            'checkin_longitude' => null,
            'checkout_latitude' => null,
            'checkout_longitude' => null,
            'checkin_distance_meters' => null,
            'checkout_distance_meters' => null,
            'shift_name' => $matchingShift ? $matchingShift->name : 'Reguler',
            'shift_type' => $matchingShift ? ($matchingShift->shift_type ?? 'normal') : 'normal',
            'is_holiday_work' => false,
            'holiday' => null,
            'row_type' => $rowType,
            'employee' => [
                'id' => $emp->id,
                'name' => $emp->user?->name,
                'nik_ktp' => $emp->nik_ktp,
                'department' => $emp->department?->name,
                'position' => $emp->position?->name,
                'profile_picture' => $this->formatPhotoUrl($emp->user?->profile_picture),
            ],
        ];
    }

    private function formatRowForAbsent($emp, $date, $status, $note, $matchingShift)
    {
        return [
            'id' => null,
            'employee_id' => $emp->id,
            'date' => $date,
            'check_in' => null,
            'check_out' => null,
            'status' => $status,
            'duration_min' => null,
            'latitude' => null,
            'longitude' => null,
            'accuracy' => null,
            'is_within_geofence' => false,
            'note' => $note,
            'checkin_location_note' => null,
            'checkout_location_note' => null,
            'checkin_photo_url' => null,
            'checkout_photo_url' => null,
            'image_check_in' => null,
            'image_check_out' => null,
            'checkin_latitude' => null,
            'checkin_longitude' => null,
            'checkout_latitude' => null,
            'checkout_longitude' => null,
            'checkin_distance_meters' => null,
            'checkout_distance_meters' => null,
            'shift_name' => $matchingShift ? $matchingShift->name : 'Reguler',
            'shift_type' => $matchingShift ? ($matchingShift->shift_type ?? 'normal') : 'normal',
            'is_holiday_work' => false,
            'holiday' => null,
            'row_type' => 'daily',
            'employee' => [
                'id' => $emp->id,
                'name' => $emp->user?->name,
                'nik_ktp' => $emp->nik_ktp,
                'department' => $emp->department?->name,
                'position' => $emp->position?->name,
                'profile_picture' => $this->formatPhotoUrl($emp->user?->profile_picture),
            ],
        ];
    }

    /**
     * GET /api/attendance/overtimes
     * 
     * Mengambil daftar lembur pegawai (is_overtime = true) dengan paginasi.
     */
    public function overtimes(Request $request)
    {
        $status = $request->query('status', 'pending');
        
        $dateFrom = $request->query('date_from', now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', now()->endOfMonth()->toDateString());
        
        $query = Attendance::where('is_overtime', true)
            ->with(['employee.user', 'employee.department'])
            ->whereBetween('date', [$dateFrom, $dateTo]);

        if (in_array($status, ['pending', 'approved', 'rejected'])) {
            $query->where('overtime_status', $status);
        }

        if ($request->filled('department_id')) {
            $query->whereHas('employee', function ($q) use ($request) {
                $q->where('department_id', $request->query('department_id'));
            });
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->whereHas('employee', function ($q) use ($search) {
                $q->where('nik_ktp', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $query->orderBy('date', 'desc');

        $perPage = (int) $request->query('per_page', 20);
        if ($perPage < 1) $perPage = 20;
        if ($perPage > 100) $perPage = 100;

        $paginator = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => AttendanceResource::collection($paginator->items()),
            'meta'    => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ]
        ]);
    }

    /**
     * GET /api/attendance/overtimes/summary
     * 
     * Mengambil ringkasan data statistik lembur berdasarkan filter yang dipilih.
     */
    public function overtimesSummary(Request $request)
    {
        $dateFrom = $request->query('date_from', now()->startOfMonth()->toDateString());
        $dateTo   = $request->query('date_to', now()->endOfMonth()->toDateString());
        
        $baseQuery = Attendance::where('is_overtime', true)
            ->whereBetween('date', [$dateFrom, $dateTo]);

        if ($request->filled('department_id')) {
            $baseQuery->whereHas('employee', function ($q) use ($request) {
                $q->where('department_id', $request->query('department_id'));
            });
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $baseQuery->whereHas('employee', function ($q) use ($search) {
                $q->where('nik_ktp', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $pending  = (clone $baseQuery)->where('overtime_status', 'pending')->count();
        $approved = (clone $baseQuery)->where('overtime_status', 'approved')->count();
        $rejected = (clone $baseQuery)->where('overtime_status', 'rejected')->count();
        
        $totalMinutes = (int) (clone $baseQuery)->where('overtime_status', 'approved')->sum('overtime_minutes');
        $totalHours = round($totalMinutes / 60, 1);

        return response()->json([
            'success' => true,
            'data'    => [
                'pending'       => $pending,
                'approved'      => $approved,
                'rejected'      => $rejected,
                'total_minutes' => $totalMinutes,
                'total_hours'   => $totalHours,
            ]
        ]);
    }

    /**
     * PUT /api/attendance/{id}/overtime/approve
     * 
     * Admin menyetujui lembur karyawan.
     */
    public function approveOvertime(Request $request, int $id)
    {
        $record = Attendance::findOrFail($id);

        if (!$record->is_overtime) {
            return response()->json([
                'success' => false,
                'message' => 'Rekaman ini tidak terdeteksi lembur.',
            ], 422);
        }

        if ($record->overtime_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status lembur rekaman ini sudah diputuskan sebelumnya.',
            ], 422);
        }

        $record->update([
            'overtime_status'        => 'approved',
            'overtime_reviewed_by'   => $request->user()->id,
            'overtime_reviewed_at'   => now(),
            'overtime_admin_note'    => $request->input('overtime_admin_note'),
            'status_approval_lembur' => 'disetujui', // sync backward compatibility
        ]);

        // Kirim notifikasi ke karyawan
        \App\Models\Notification::create([
            'user_id' => $record->employee->user_id,
            'title'   => 'Lembur Disetujui ✅',
            'body'    => 'Lembur Anda tanggal ' . ($record->date ? $record->date->toDateString() : '-') . ' telah disetujui.',
            'type'    => 'overtime',
            'data'    => ['attendance_id' => $record->id]
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lembur disetujui.',
            'data'    => new AttendanceResource($record->fresh(['employee.user', 'employee.department'])),
        ]);
    }

    /**
     * PUT /api/attendance/{id}/overtime/reject
     * 
     * Admin menolak lembur karyawan. Catatan alasan wajib diisi.
     */
    public function rejectOvertime(Request $request, int $id)
    {
        $request->validate([
            'overtime_admin_note' => 'required|string|min:1|max:255',
        ], [
            'overtime_admin_note.required' => 'Alasan penolakan wajib diisi.',
        ]);

        $record = Attendance::findOrFail($id);

        if (!$record->is_overtime) {
            return response()->json([
                'success' => false,
                'message' => 'Rekaman ini tidak terdeteksi lembur.',
            ], 422);
        }

        if ($record->overtime_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Status lembur rekaman ini sudah diputuskan sebelumnya.',
            ], 422);
        }

        $record->update([
            'overtime_status'        => 'rejected',
            'overtime_reviewed_by'   => $request->user()->id,
            'overtime_reviewed_at'   => now(),
            'overtime_admin_note'    => $request->input('overtime_admin_note'),
            'status_approval_lembur' => 'ditolak', // sync backward compatibility
        ]);

        // Kirim notifikasi ke karyawan
        \App\Models\Notification::create([
            'user_id' => $record->employee->user_id,
            'title'   => 'Lembur Ditolak ❌',
            'body'    => 'Lembur Anda tanggal ' . ($record->date ? $record->date->toDateString() : '-') . ' ditolak. Alasan: ' . $request->input('overtime_admin_note'),
            'type'    => 'overtime',
            'data'    => ['attendance_id' => $record->id]
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lembur ditolak.',
            'data'    => new AttendanceResource($record->fresh(['employee.user', 'employee.department'])),
        ]);
    }
}
