<?php

namespace App\Support;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\HolidayWorkAssignment;
use App\Models\Schedule;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AttendanceRules
{
    public const DEFAULT_GPS_MAX_ACCURACY_METERS = 100.0;

    public const DEFAULT_GPS_MAX_AGE_SECONDS = 30;

    public const GPS_FUTURE_TOLERANCE_SECONDS = 10;

    /**
     * Menghitung jarak antara dua titik koordinat menggunakan rumus Haversine (meter).
     *
     * @param  float  $lat1  Lintang titik pertama
     * @param  float  $lon1  Bujur titik pertama
     * @param  float  $lat2  Lintang titik kedua
     * @param  float  $lon2  Bujur titik kedua
     * @return float Jarak dalam meter
     */
    public static function haversineDistanceMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R = 6371000; // Radius rata-rata bumi dalam meter
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $deltaPhi = deg2rad($lat2 - $lat1);
        $deltaLambda = deg2rad($lon2 - $lon1);

        $a = sin($deltaPhi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($deltaLambda / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $R * $c;
    }

    /**
     * Memeriksa apakah koordinat tertentu berada di dalam radius geofence RSUCL.
     *
     * @param  float  $lat  Lintang perangkat
     * @param  float  $lon  Bujur perangkat
     * @return bool True jika di dalam radius, false jika di luar
     */
    public static function isWithinGeofence(float $lat, float $lon): bool
    {
        if (Setting::get('enable_gps_validation', '1') === '0') {
            return true;
        }

        $hospLat = (float) Setting::get('hospital_latitude', Setting::get('hospital_lat', '5.552740480177099'));
        $hospLng = (float) Setting::get('hospital_longitude', Setting::get('hospital_lng', '95.33486560781716'));
        $hospRadius = (float) Setting::get('attendance_radius_meters', Setting::get('gps_radius', '100'));

        $distance = self::haversineDistanceMeters($lat, $lon, $hospLat, $hospLng);

        return $distance <= $hospRadius;
    }

    /**
     * Batas ketidakpastian GPS yang masih dapat dipakai untuk absensi.
     * Nilai accuracy dari browser adalah radius ketidakpastian dalam meter,
     * sehingga semakin kecil nilainya semakin presisi hasil pembacaannya.
     */
    public static function gpsMaxAccuracyMeters(): float
    {
        $configured = (float) Setting::get(
            'gps_max_accuracy_meters',
            (string) self::DEFAULT_GPS_MAX_ACCURACY_METERS
        );

        return is_finite($configured) && $configured > 0
            ? $configured
            : self::DEFAULT_GPS_MAX_ACCURACY_METERS;
    }

    /**
     * Umur maksimal sampel lokasi agar koordinat cache/lokasi lama tidak
     * digunakan untuk absensi.
     */
    public static function gpsMaxAgeSeconds(): int
    {
        $configured = (int) Setting::get(
            'gps_max_age_seconds',
            (string) self::DEFAULT_GPS_MAX_AGE_SECONDS
        );

        return $configured > 0 ? $configured : self::DEFAULT_GPS_MAX_AGE_SECONDS;
    }

    /**
     * Memvalidasi kualitas dan kesegaran satu pembacaan GPS dari perangkat.
     * `location_timestamp` menerima epoch milidetik dari Geolocation API,
     * epoch detik, atau string tanggal ISO sebagai fallback kompatibilitas.
     *
     * @return array<string, mixed>
     */
    public static function validateGpsReading(
        mixed $latitude,
        mixed $longitude,
        mixed $accuracy,
        mixed $locationTimestamp,
        ?Carbon $now = null
    ): array {
        $maxAccuracy = self::gpsMaxAccuracyMeters();
        $maxAge = self::gpsMaxAgeSeconds();

        if (! is_numeric($latitude) || ! is_numeric($longitude)) {
            return self::invalidGpsResult(
                'GPS_LOCATION_REQUIRED',
                'Koordinat GPS belum tersedia. Aktifkan lokasi, tunggu hingga GPS stabil, lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
        }

        $latitude = (float) $latitude;
        $longitude = (float) $longitude;

        if (! is_finite($latitude) || ! is_finite($longitude)
            || $latitude < -90 || $latitude > 90
            || $longitude < -180 || $longitude > 180) {
            return self::invalidGpsResult(
                'GPS_COORDINATES_INVALID',
                'Koordinat GPS tidak valid. Muat ulang lokasi lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
        }

        if (! is_numeric($accuracy)) {
            return self::invalidGpsResult(
                'GPS_ACCURACY_REQUIRED',
                'Data akurasi GPS belum tersedia. Tunggu hingga lokasi stabil, lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
        }

        $accuracy = (float) $accuracy;
        if (! is_finite($accuracy) || $accuracy <= 0) {
            return self::invalidGpsResult(
                'GPS_ACCURACY_INVALID',
                'Data akurasi GPS tidak valid. Muat ulang lokasi lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
        }

        if ($accuracy > $maxAccuracy) {
            $result = self::invalidGpsResult(
                'GPS_ACCURACY_TOO_LOW',
                sprintf(
                    'Akurasi GPS masih sekitar +/-%.0f meter (maksimal +/-%.0f meter). Tunggu di area yang lebih terbuka hingga lokasi stabil, lalu coba kembali.',
                    $accuracy,
                    $maxAccuracy
                ),
                $maxAccuracy,
                $maxAge
            );
            $result['accuracy'] = $accuracy;

            return $result;
        }

        if ($locationTimestamp === null || $locationTimestamp === '') {
            return self::invalidGpsResult(
                'GPS_TIMESTAMP_REQUIRED',
                'Waktu pembacaan GPS belum tersedia. Perbarui lokasi lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
        }

        try {
            if (is_numeric($locationTimestamp)) {
                $timestamp = (float) $locationTimestamp;
                // GeolocationPosition.timestamp menggunakan epoch milidetik.
                if (abs($timestamp) > 100000000000) {
                    $timestamp /= 1000;
                }
                $capturedAtUnix = (int) floor($timestamp);
            } elseif (is_string($locationTimestamp)) {
                $capturedAtUnix = Carbon::parse((string) $locationTimestamp)->getTimestamp();
            } else {
                throw new \InvalidArgumentException('Unsupported GPS timestamp type.');
            }
        } catch (\Throwable) {
            return self::invalidGpsResult(
                'GPS_TIMESTAMP_INVALID',
                'Waktu pembacaan GPS tidak valid. Perbarui lokasi lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
        }

        // Timestamp terlalu kecil/besar tidak boleh lolos hanya karena dapat di-cast.
        if ($capturedAtUnix <= 0) {
            return self::invalidGpsResult(
                'GPS_TIMESTAMP_INVALID',
                'Waktu pembacaan GPS tidak valid. Perbarui lokasi lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
        }

        $now = $now ?? Carbon::now('Asia/Jakarta');
        $ageSeconds = $now->getTimestamp() - $capturedAtUnix;

        if ($ageSeconds < -self::GPS_FUTURE_TOLERANCE_SECONDS) {
            $result = self::invalidGpsResult(
                'GPS_TIMESTAMP_INVALID',
                'Waktu perangkat tidak sesuai. Aktifkan pengaturan tanggal dan waktu otomatis, lalu coba kembali.',
                $maxAccuracy,
                $maxAge
            );
            $result['age_seconds'] = $ageSeconds;

            return $result;
        }

        if ($ageSeconds > $maxAge) {
            $result = self::invalidGpsResult(
                'GPS_LOCATION_STALE',
                sprintf(
                    'Lokasi GPS sudah kedaluwarsa (%d detik). Perbarui lokasi dan tunggu hingga stabil, lalu coba kembali.',
                    $ageSeconds
                ),
                $maxAccuracy,
                $maxAge
            );
            $result['age_seconds'] = $ageSeconds;

            return $result;
        }

        return [
            'valid' => true,
            'code' => null,
            'message' => null,
            'retryable' => false,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy,
            'age_seconds' => max(0, $ageSeconds),
            'max_accuracy_meters' => $maxAccuracy,
            'max_age_seconds' => $maxAge,
        ];
    }

    /**
     * Menilai geofence dengan memperhitungkan lingkar ketidakpastian GPS.
     * Hanya posisi yang seluruh rentang ketidakpastiannya berada di dalam
     * radius yang dinyatakan "inside". Posisi di batas dikembalikan sebagai
     * "uncertain" agar perangkat mengambil sampel yang lebih presisi.
     *
     * @return array{status:string,is_within:bool,distance_meters:float,accuracy_meters:float,radius_meters:float,nearest_possible_distance_meters:float,farthest_possible_distance_meters:float}
     */
    public static function evaluateGeofence(float $latitude, float $longitude, float $accuracy): array
    {
        $hospitalLatitude = (float) Setting::get(
            'hospital_latitude',
            Setting::get('hospital_lat', '5.552740480177099')
        );
        $hospitalLongitude = (float) Setting::get(
            'hospital_longitude',
            Setting::get('hospital_lng', '95.33486560781716')
        );
        $radius = (float) Setting::get(
            'attendance_radius_meters',
            Setting::get('gps_radius', '100')
        );
        $distance = self::haversineDistanceMeters(
            $latitude,
            $longitude,
            $hospitalLatitude,
            $hospitalLongitude
        );
        $nearestDistance = max(0.0, $distance - $accuracy);
        $farthestDistance = $distance + $accuracy;

        if ($farthestDistance <= $radius) {
            $status = 'inside';
        } elseif ($nearestDistance > $radius) {
            $status = 'outside';
        } else {
            $status = 'uncertain';
        }

        return [
            'status' => $status,
            'is_within' => $status === 'inside',
            'distance_meters' => $distance,
            'accuracy_meters' => $accuracy,
            'radius_meters' => $radius,
            'nearest_possible_distance_meters' => $nearestDistance,
            'farthest_possible_distance_meters' => $farthestDistance,
        ];
    }

    /** @return array<string, mixed> */
    private static function invalidGpsResult(
        string $code,
        string $message,
        float $maxAccuracy,
        int $maxAge
    ): array {
        return [
            'valid' => false,
            'code' => $code,
            'message' => $message,
            'retryable' => true,
            'max_accuracy_meters' => $maxAccuracy,
            'max_age_seconds' => $maxAge,
        ];
    }

    /**
     * Memeriksa apakah pegawai dibebaskan dari validasi GPS (karena dinas luar / surat tugas).
     */
    public static function isExemptFromGps(Employee $employee, Carbon $date): bool
    {
        if (self::shiftTypeFor($employee, $date) === 'dinas_luar') {
            return true;
        }

        if ($employee->hasApprovedAssignmentLetterOn($date)) {
            return true;
        }

        return false;
    }

    /**
     * Menentukan kategori/tipe shift pegawai untuk tanggal tertentu.
     * Mencari jadwal aktif pegawai untuk hari itu berdasarkan pivot day_of_week;
     * jika tidak ditemukan jadwal, mengembalikan 'normal'.
     *
     * @return string 'normal' atau 'dinas_luar'
     */
    public static function shiftTypeFor(Employee $employee, Carbon $date): string
    {
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $dayName = $dayMap[$date->dayOfWeek];

        $schedule = $employee->schedules()
            ->wherePivot('day_of_week', $dayName)
            ->first();

        if ($schedule) {
            return $schedule->shift_type ?? 'normal';
        }

        return 'normal';
    }

    /**
     * Mengembalikan nama hari dalam Bahasa Indonesia untuk Carbon date tertentu.
     */
    public static function dayNameFor(Carbon $date): string
    {
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];

        return $dayMap[$date->dayOfWeek];
    }

    /**
     * Mencari data hari libur untuk tanggal tertentu.
     */
    public static function holidayOn(Carbon $date): ?Holiday
    {
        return Holiday::whereDate('date', $date->toDateString())->first();
    }

    /**
     * Memeriksa apakah pegawai ditugaskan bekerja pada hari libur tertentu.
     */
    public static function isAssignedToWorkOnHoliday(Employee $employee, Holiday $holiday): bool
    {
        return HolidayWorkAssignment::where('holiday_id', $holiday->id)
            ->where('employee_id', $employee->id)
            ->exists();
    }

    /**
     * Menemukan jadwal shift aktif pegawai untuk tanggal tertentu, termasuk sub-shift anak jika ada.
     *
     * @param  Employee  $employee
     * @param  Carbon  $date
     * @return Schedule|null
     */
    /**
     * Memeriksa apakah record absensi yang belum check-out masih berada dalam batas waktu checkout yang valid.
     * Mengembalikan false jika batas waktu checkout untuk shift tersebut sudah kedaluwarsa (expired).
     */
    public static function isOpenAttendanceValidForCheckout(Attendance $attendance, ?Carbon $now = null): bool
    {
        if ($attendance->check_in === null || $attendance->check_out !== null) {
            return false;
        }

        $now = $now ?? Carbon::now('Asia/Jakarta');
        $attDate = Carbon::parse($attendance->date);

        $sched = $attendance->schedule_id ? Schedule::find($attendance->schedule_id) : null;
        if (! $sched) {
            $employee = $attendance->employee;
            if ($employee) {
                $sched = self::resolveShiftFor($employee, $attDate);
            }
        }

        $startTimeStr = $sched ? ($sched->start_time ?? '08:30:00') : '08:30:00';
        $endTimeStr = $sched ? ($sched->end_time ?? '17:00:00') : '17:00:00';

        $startMins = (int) substr($startTimeStr, 0, 2) * 60 + (int) substr($startTimeStr, 3, 2);
        $endMins = (int) substr($endTimeStr, 0, 2) * 60 + (int) substr($endTimeStr, 3, 2);

        $isOvernight = $endMins <= $startMins;

        if ($isOvernight) {
            // Shift Malam (lintas hari): misal 20:00 -> 08:00 (berakhir jam 08:00 hari berikutnya)
            // Batas akhir checkout toleransi 3 jam setelah jam pulang (11:00 AM hari berikutnya)
            $shiftEnd = Carbon::parse($attDate->toDateString().' '.$endTimeStr)->addDay();
            $checkoutCutoff = $shiftEnd->copy()->addHours(3);

            return $now->lte($checkoutCutoff);
        } else {
            // Shift Siang / Pagi (hari yang sama): misal 08:00 -> 14:00 atau 14:00 -> 20:00
            // Jika tanggal absensi sudah hari kemarin dan jam sekarang sudah melewati cutoff jam pulang (+ 4 jam)
            $shiftEnd = Carbon::parse($attDate->toDateString().' '.$endTimeStr);
            $checkoutCutoff = $shiftEnd->copy()->addHours(4);

            if ($now->toDateString() > $attDate->toDateString() && $now->gt($checkoutCutoff)) {
                return false;
            }

            return $now->lte($checkoutCutoff);
        }
    }

    /**
     * Mengambil seluruh daftar shift yang ditugaskan kepada karyawan pada tanggal tertentu.
     * Mendukung multi-shift dalam 1 hari (cth: Shift Pagi & Shift Malam/Dadakan).
     */
    public static function resolveAllShiftsFor(Employee $employee, Carbon $date): array
    {
        $todayStr = $date->toDateString();
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $dayMapEn = [
            0 => 'Sunday', 1 => 'Monday', 2 => 'Tuesday',
            3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday',
        ];
        $dayOfWeek = $date->dayOfWeek;
        $dayName = $dayMap[$dayOfWeek];
        $dayNameEn = $dayMapEn[$dayOfWeek];

        $shifts = [];

        $expandSchedule = function ($sched) use ($dayOfWeek) {
            if (! $sched) {
                return [];
            }
            if ($sched->parent_id === null && $sched->children()->exists()) {
                $children = $sched->children()->get();

                // Master LJ global berlaku sebagai status bebas tugas pada hari
                // apa pun, termasuk Minggu. Jangan terapkan pemilihan nama hari.
                if (LiburJagaSchedule::isName($sched->name)) {
                    return $children->values()->all();
                }

                if ($dayOfWeek === 6) {
                    $regularSaturday = $children->filter(function ($child) {
                        $name = strtolower($child->name ?? '');

                        return str_contains($name, 'sabtu') && ! str_contains($name, 'khusus');
                    });
                    if ($regularSaturday->isNotEmpty()) {
                        return $regularSaturday->values()->all();
                    }

                    $satChildren = $children->filter(fn ($c) => str_contains(strtolower($c->name ?? ''), 'sabtu'));
                    if ($satChildren->isNotEmpty()) {
                        return $satChildren->values()->all();
                    }
                }

                if ($dayOfWeek === 0) {
                    $sundayChildren = $children->filter(fn ($c) => str_contains(strtolower($c->name ?? ''), 'minggu'));
                    if ($sundayChildren->isNotEmpty()) {
                        return $sundayChildren->values()->all();
                    }

                    return [];
                }

                // Senin-Jumat tidak boleh ikut membawa sub-shift Sabtu/Minggu.
                $weekdayChildren = $children->filter(function ($child) {
                    $name = strtolower($child->name ?? '');

                    return ! str_contains($name, 'sabtu') && ! str_contains($name, 'minggu');
                });
                if ($weekdayChildren->isNotEmpty()) {
                    return $weekdayChildren->values()->all();
                }

                return $children->values()->all();
            }

            return [$sched];
        };

        // ── Prioritas 1: Cek jadwal tanggal spesifik (work_date) ──────────────
        $rawDateRows = DB::table('employee_schedule')
            ->where('employee_id', $employee->id)
            ->where('work_date', $todayStr)
            ->whereNotNull('work_date')
            ->get();

        if ($rawDateRows->isNotEmpty()) {
            foreach ($rawDateRows as $rRow) {
                if ($rRow->schedule_id === null) {
                    // Eksplisit Libur pada tanggal ini
                    continue;
                }
                $sched = Schedule::find($rRow->schedule_id);
                if ($sched) {
                    // Jika shift ini adalah "Libur / OFF" (bukan Libur Jaga/LJ),
                    // perlakukan sama seperti eksplisit libur
                    $uName = strtoupper($sched->name);
                    $isLiburOff = (str_contains($uName, 'LIBUR') || str_contains($uName, 'OFF'))
                                  && ! str_contains($uName, 'JAGA')
                                  && $uName !== 'LJ';
                    if ($isLiburOff) {
                        continue; // Skip, treat as libur
                    }

                    foreach ($expandSchedule($sched) as $s) {
                        $shifts[] = $s;
                    }
                }
            }
            // Jika semua record adalah libur (schedule_id null atau shift "Libur / OFF"), return kosong
            if (empty($shifts)) {
                return []; // Eksplisit set Libur
            }

            return collect($shifts)->unique('id')->values()->all();
        }

        // ── Prioritas 2: Fallback ke jadwal mingguan (day_of_week) ──────────
        $schedules = $employee->schedules()->get();
        $todaySchedules = $schedules->filter(function ($s) use ($dayName, $dayNameEn) {
            $dow = $s->pivot->day_of_week ?? null;

            return $dow === $dayName || strcasecmp((string) $dow, $dayNameEn) === 0;
        });

        if ($todaySchedules->isNotEmpty()) {
            foreach ($todaySchedules as $todaySchedule) {
                foreach ($expandSchedule($todaySchedule) as $s) {
                    $shifts[] = $s;
                }
            }

            return collect($shifts)->unique('id')->values()->all();
        }

        // ── Prioritas 3: Fallback ke jadwal departemen / kantor reguler untuk seluruh pegawai ──
        if ($dayOfWeek !== 0) { // Selain hari Minggu
            // A. Cari shift khusus yang dibuat untuk departemen pegawai ini
            if ($employee->department_id) {
                $deptSchedules = Schedule::whereNull('parent_id')
                    ->where('owner_department_id', $employee->department_id)
                    ->where(function ($q) {
                        $q->where('status', 'approved')->orWhereNull('status');
                    })
                    ->get();

                if ($deptSchedules->isNotEmpty()) {
                    foreach ($deptSchedules as $deptSchedule) {
                        foreach ($expandSchedule($deptSchedule) as $s) {
                            $shifts[] = $s;
                        }
                    }
                    if (! empty($shifts)) {
                        return collect($shifts)->unique('id')->values()->all();
                    }
                }
            }

            // B. Fallback ke shift kantor / reguler umum (hanya yang global atau milik departemen pegawai)
            $regulerParents = Schedule::whereNull('parent_id')
                ->where(function ($q) use ($employee) {
                    $q->whereNull('owner_department_id');
                    if ($employee->department_id) {
                        $q->orWhere('owner_department_id', $employee->department_id);
                    }
                })
                ->where(function ($q) {
                    $q->where('name', 'LIKE', '%office%')
                        ->orWhere('name', 'LIKE', '%kantor%')
                        ->orWhere('name', 'LIKE', 'Reguler%')
                        ->orWhere('name', 'LIKE', 'Administrasi%');
                })
                ->where(function ($q) {
                    $q->where('status', 'approved')->orWhereNull('status');
                })
                ->get();

            if ($regulerParents->isNotEmpty()) {
                foreach ($regulerParents as $regulerParent) {
                    foreach ($expandSchedule($regulerParent) as $s) {
                        $shifts[] = $s;
                    }
                }
                if (! empty($shifts)) {
                    return collect($shifts)->unique('id')->values()->all();
                }
            }
        }

        return collect($shifts)->unique('id')->values()->all();
    }

    /**
     * Menentukan shift spesifik yang aktif/cocok untuk absen pada saat ini ($now).
     */
    public static function resolveShiftFor(Employee $employee, Carbon $date, ?Carbon $now = null): ?Schedule
    {
        $allShifts = self::resolveAllShiftsFor($employee, $date);
        if (empty($allShifts)) {
            return null;
        }
        if (count($allShifts) === 1) {
            return $allShifts[0];
        }

        $now = $now ?? Carbon::now('Asia/Jakarta');
        $dateStr = $date->toDateString();

        // 1. Jika pegawai sudah check-in dan belum check-out untuk salah satu shift, pilih shift tersebut
        foreach ($allShifts as $sched) {
            $existing = Attendance::where('employee_id', $employee->id)
                ->where('date', $dateStr)
                ->where('schedule_id', $sched->id)
                ->first();

            if ($existing && $existing->check_in && ! $existing->check_out) {
                return $sched;
            }
        }

        // 2. Evaluasi shift mana yang paling cocok dengan $now
        $bestMatch = null;
        $minDiff = 99999999;

        foreach ($allShifts as $sched) {
            $startTimeStr = $sched->start_time ?? '08:00:00';
            $endTimeStr = $sched->end_time ?? '17:00:00';

            $shiftStart = Carbon::parse($dateStr.' '.$startTimeStr);
            $shiftEnd = Carbon::parse($dateStr.' '.$endTimeStr);

            $startMins = (int) substr($startTimeStr, 0, 2) * 60 + (int) substr($startTimeStr, 3, 2);
            $endMins = (int) substr($endTimeStr, 0, 2) * 60 + (int) substr($endTimeStr, 3, 2);

            if ($endMins <= $startMins) {
                $shiftEnd->addDay();
            }

            // Window check-in dibuka 2.5 jam sebelum shiftStart
            $windowStart = $shiftStart->copy()->subMinutes(150);

            // Cek apakah $now berada di dalam rentang [windowStart, shiftEnd]
            if ($now->gte($windowStart) && $now->lte($shiftEnd)) {
                $diff = abs($now->timestamp - $shiftStart->timestamp);
                if ($diff < $minDiff) {
                    $existing = Attendance::where('employee_id', $employee->id)
                        ->where('date', $dateStr)
                        ->where('schedule_id', $sched->id)
                        ->first();
                    if (! $existing || ! $existing->check_out) {
                        $minDiff = $diff;
                        $bestMatch = $sched;
                    }
                }
            }
        }

        // 3. Fallback: Jika tidak ada shift yang window-nya sedang aktif (misal sebelum windowStart pertama), pilih shift dengan start_time paling dekat
        if (! $bestMatch) {
            foreach ($allShifts as $sched) {
                $startTimeStr = $sched->start_time ?? '08:00:00';
                $shiftStart = Carbon::parse($dateStr.' '.$startTimeStr);
                $diff = abs($now->timestamp - $shiftStart->timestamp);
                if ($diff < $minDiff) {
                    $minDiff = $diff;
                    $bestMatch = $sched;
                }
            }
        }

        return $bestMatch ?? $allShifts[0];
    }

    /**
     * Mengklasifikasikan waktu check-in berdasarkan toleransi keterlambatan.
     *
     * @param  Carbon  $checkinTime  Waktu absen
     * @param  Carbon  $shiftStart  Jam mulai shift
     * @param  Carbon  $checkinWindowEnd  Jam tutup jendela absen
     * @param  int  $tepatWaktuMinutes  Batas tepat waktu setelah shift mulai (menit, misal: 10)
     * @param  int  $toleranceMinutes  Batas toleransi setelah shift mulai (menit, misal: 10)
     * @return array ['status' => string, 'punctuality' => string, 'effective_checkin_time' => string]
     */
    public static function classifyCheckin(Carbon $checkinTime, Carbon $shiftStart, Carbon $checkinWindowEnd, int $tepatWaktuMinutes = 10, int $toleranceMinutes = 10): array
    {
        $checkinSec = $checkinTime->timestamp;
        $startSec = $shiftStart->timestamp;
        // Toleransi tepat waktu adalah 10 menit setelah jam masuk shift (misal 08:30 -> 08:40, 11:00 -> 11:10)
        $tepatWaktuSec = $startSec + (max($tepatWaktuMinutes, $toleranceMinutes) * 60);

        if ($checkinSec <= $tepatWaktuSec) {
            return [
                'status' => 'hadir',
                'punctuality' => 'tepat_waktu',
                'effective_checkin_time' => $checkinTime->lt($shiftStart) ? $shiftStart->format('H:i:s') : $checkinTime->format('H:i:s'),
            ];
        } else {
            // Absen di atas toleransi 10 menit tetap diizinkan check-in dengan status terlambat (telat)
            return [
                'status' => 'telat',
                'punctuality' => 'terlambat',
                'effective_checkin_time' => $checkinTime->format('H:i:s'),
            ];
        }
    }

    /**
     * Memeriksa apakah pegawai sudah check-in tetapi tidak check-out
     * setelah jam shift berakhir pada hari itu.
     *
     * @param  mixed  $referenceTime  Waktu acuan (default Carbon::now())
     */
    public static function isAttendanceIncomplete(Attendance $attendance, ?Employee $employee = null, $referenceTime = null): bool
    {
        if ($attendance->check_out !== null) {
            return false;
        }
        if ($attendance->check_in === null) {
            return false;
        }

        $employee = $employee ?? $attendance->employee;
        if (! $employee) {
            return false;
        }

        $ref = $referenceTime ? Carbon::parse($referenceTime) : Carbon::now('Asia/Jakarta');
        $attendanceDate = Carbon::parse($attendance->date);

        // Jika waktu acuan di hari sebelum hari absensi, belum incomplete
        if ($ref->toDateString() < $attendanceDate->toDateString()) {
            return false;
        }

        // Resolusi shift pegawai untuk hari tersebut
        $todayShift = self::resolveShiftFor($employee, $attendanceDate);
        $endTimeStr = '17:00:00'; // Default fallback

        if ($todayShift) {
            $endTimeStr = $todayShift->end_time;
        }

        // Bentuk Carbon instance untuk jam berakhir shift pada tanggal absensi
        $shiftEnd = Carbon::parse($attendanceDate->toDateString().' '.$endTimeStr);

        // Penanganan jika shift start > shift end (shift malam melewati tengah malam)
        $startTimeStr = $todayShift ? $todayShift->start_time : '08:30:00';
        $shiftStart = Carbon::parse($attendanceDate->toDateString().' '.$startTimeStr);
        if ($shiftEnd->lte($shiftStart)) {
            $shiftEnd->addDay();
        }

        return $ref->gt($shiftEnd);
    }
}
