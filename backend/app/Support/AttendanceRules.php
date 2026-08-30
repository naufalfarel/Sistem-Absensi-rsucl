<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\Employee;
use App\Models\Schedule;
use Carbon\Carbon;

class AttendanceRules
{
    /**
     * Menghitung jarak antara dua titik koordinat menggunakan rumus Haversine (meter).
     * 
     * @param float $lat1 Lintang titik pertama
     * @param float $lon1 Bujur titik pertama
     * @param float $lat2 Lintang titik kedua
     * @param float $lon2 Bujur titik kedua
     * @return float Jarak dalam meter
     */
    public static function haversineDistanceMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R    = 6371000; // Radius rata-rata bumi dalam meter
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $deltaPhi   = deg2rad($lat2 - $lat1);
        $deltaLambda   = deg2rad($lon2 - $lon1);

        $a = sin($deltaPhi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($deltaLambda / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $R * $c;
    }

    /**
     * Memeriksa apakah koordinat tertentu berada di dalam radius geofence RSUCL.
     * 
     * @param float $lat Lintang perangkat
     * @param float $lon Bujur perangkat
     * @return bool True jika di dalam radius, false jika di luar
     */
    public static function isWithinGeofence(float $lat, float $lon): bool
    {
        if (Setting::get('enable_gps_validation', '1') === '0') {
            return true;
        }

        $hospLat    = (float) Setting::get('hospital_latitude', Setting::get('hospital_lat', '5.552740480177099'));
        $hospLng    = (float) Setting::get('hospital_longitude', Setting::get('hospital_lng', '95.33486560781716'));
        $hospRadius = (float) Setting::get('attendance_radius_meters', Setting::get('gps_radius', '100'));

        $distance = self::haversineDistanceMeters($lat, $lon, $hospLat, $hospLng);

        return $distance <= $hospRadius;
    }

    /**
     * Memeriksa apakah pegawai dibebaskan dari validasi GPS (karena dinas luar / surat tugas).
     * 
     * @param Employee $employee
     * @param Carbon $date
     * @return bool
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
     * @param Employee $employee
     * @param Carbon $date
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
     * Mencari data hari libur untuk tanggal tertentu.
     * 
     * @param Carbon $date
     * @return \App\Models\Holiday|null
     */
    public static function holidayOn(Carbon $date): ?\App\Models\Holiday
    {
        return \App\Models\Holiday::whereDate('date', $date->toDateString())->first();
    }

    /**
     * Memeriksa apakah pegawai ditugaskan bekerja pada hari libur tertentu.
     * 
     * @param Employee $employee
     * @param \App\Models\Holiday $holiday
     * @return bool
     */
    public static function isAssignedToWorkOnHoliday(Employee $employee, \App\Models\Holiday $holiday): bool
    {
        return \App\Models\HolidayWorkAssignment::where('holiday_id', $holiday->id)
            ->where('employee_id', $employee->id)
            ->exists();
    }

    /**
     * Menemukan jadwal shift aktif pegawai untuk tanggal tertentu, termasuk sub-shift anak jika ada.
     * 
     * @param Employee $employee
     * @param Carbon $date
     * @return \App\Models\Schedule|null
     */
    /**
     * Memeriksa apakah record absensi yang belum check-out masih berada dalam batas waktu checkout yang valid.
     * Mengembalikan false jika batas waktu checkout untuk shift tersebut sudah kedaluwarsa (expired).
     */
    public static function isOpenAttendanceValidForCheckout(\App\Models\Attendance $attendance, ?Carbon $now = null): bool
    {
        if ($attendance->check_in === null || $attendance->check_out !== null) {
            return false;
        }

        $now = $now ?? Carbon::now('Asia/Jakarta');
        $attDate = Carbon::parse($attendance->date);

        $sched = $attendance->schedule_id ? \App\Models\Schedule::find($attendance->schedule_id) : null;
        if (!$sched) {
            $employee = $attendance->employee;
            if ($employee) {
                $sched = self::resolveShiftFor($employee, $attDate);
            }
        }

        $startTimeStr = $sched ? ($sched->start_time ?? '08:30:00') : '08:30:00';
        $endTimeStr   = $sched ? ($sched->end_time   ?? '17:00:00') : '17:00:00';

        $startMins = (int)substr($startTimeStr, 0, 2) * 60 + (int)substr($startTimeStr, 3, 2);
        $endMins   = (int)substr($endTimeStr, 0, 2) * 60 + (int)substr($endTimeStr, 3, 2);

        $isOvernight = $endMins <= $startMins;

        if ($isOvernight) {
            // Shift Malam (lintas hari): misal 20:00 -> 08:00 (berakhir jam 08:00 hari berikutnya)
            // Batas akhir checkout toleransi 3 jam setelah jam pulang (11:00 AM hari berikutnya)
            $shiftEnd = Carbon::parse($attDate->toDateString() . ' ' . $endTimeStr)->addDay();
            $checkoutCutoff = $shiftEnd->copy()->addHours(3);

            return $now->lte($checkoutCutoff);
        } else {
            // Shift Siang / Pagi (hari yang sama): misal 08:00 -> 14:00 atau 14:00 -> 20:00
            // Jika tanggal absensi sudah hari kemarin dan jam sekarang sudah melewati cutoff jam pulang (+ 4 jam)
            $shiftEnd = Carbon::parse($attDate->toDateString() . ' ' . $endTimeStr);
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
        $dayName   = $dayMap[$dayOfWeek];
        $dayNameEn = $dayMapEn[$dayOfWeek];

        $shifts = [];

        $expandSchedule = function($sched) use ($dayOfWeek) {
            if (!$sched) return [];
            if ($sched->parent_id === null && $sched->children()->exists()) {
                $children = $sched->children()->get();
                if ($dayOfWeek === 6) {
                    $satChildren = $children->filter(fn($c) => str_contains(strtolower($c->name), 'sabtu'));
                    if ($satChildren->isNotEmpty()) return $satChildren->values()->all();
                }
                $nonSatChildren = $children->filter(fn($c) => !str_contains(strtolower($c->name), 'sabtu'));
                if ($nonSatChildren->isNotEmpty()) return $nonSatChildren->values()->all();
                return $children->values()->all();
            }
            return [$sched];
        };

        // ── Prioritas 1: Cek jadwal tanggal spesifik (work_date) ──────────────
        $rawDateRows = \Illuminate\Support\Facades\DB::table('employee_schedule')
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
                $sched = \App\Models\Schedule::find($rRow->schedule_id);
                if ($sched) {
                    foreach ($expandSchedule($sched) as $s) {
                        $shifts[] = $s;
                    }
                }
            }
            if ($rawDateRows->contains(fn($r) => $r->schedule_id === null) && empty($shifts)) {
                return []; // Eksplisit set Libur
            }
            if (!empty($shifts)) {
                return collect($shifts)->unique('id')->values()->all();
            }
        }

        // ── Prioritas 2: Fallback ke jadwal mingguan (day_of_week) ──────────
        $schedules = $employee->schedules()->get();
        $todaySchedules = $schedules->filter(function($s) use ($dayName, $dayNameEn) {
            $dow = $s->pivot->day_of_week ?? null;
            return $dow === $dayName || strcasecmp((string)$dow, $dayNameEn) === 0;
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
                $deptSchedules = \App\Models\Schedule::whereNull('parent_id')
                    ->where('owner_department_id', $employee->department_id)
                    ->where(function($q) {
                        $q->where('status', 'approved')->orWhereNull('status');
                    })
                    ->get();

                if ($deptSchedules->isNotEmpty()) {
                    foreach ($deptSchedules as $deptSchedule) {
                        foreach ($expandSchedule($deptSchedule) as $s) {
                            $shifts[] = $s;
                        }
                    }
                    if (!empty($shifts)) {
                        return collect($shifts)->unique('id')->values()->all();
                    }
                }
            }

            // B. Fallback ke shift kantor / reguler umum
            $regulerParents = \App\Models\Schedule::whereNull('parent_id')
                ->where(function($q) {
                    $q->where('name', 'LIKE', '%office%')
                      ->orWhere('name', 'LIKE', '%kantor%')
                      ->orWhere('name', 'LIKE', 'Reguler%')
                      ->orWhere('name', 'LIKE', 'Administrasi%');
                })
                ->where(function($q) {
                    $q->where('status', 'approved')->orWhereNull('status');
                })
                ->get();

            if ($regulerParents->isNotEmpty()) {
                foreach ($regulerParents as $regulerParent) {
                    foreach ($expandSchedule($regulerParent) as $s) {
                        $shifts[] = $s;
                    }
                }
                if (!empty($shifts)) {
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
        if (empty($allShifts)) return null;
        if (count($allShifts) === 1) return $allShifts[0];

        $now = $now ?? Carbon::now('Asia/Jakarta');
        $dateStr = $date->toDateString();

        // 1. Jika pegawai sudah check-in dan belum check-out untuk salah satu shift, pilih shift tersebut
        foreach ($allShifts as $sched) {
            $existing = \App\Models\Attendance::where('employee_id', $employee->id)
                ->where('date', $dateStr)
                ->where('schedule_id', $sched->id)
                ->first();

            if ($existing && $existing->check_in && !$existing->check_out) {
                return $sched;
            }
        }

        // 2. Evaluasi shift mana yang paling cocok dengan $now
        $bestMatch = null;
        $minDiff = 99999999;

        foreach ($allShifts as $sched) {
            $startTimeStr = $sched->start_time ?? '08:00:00';
            $endTimeStr   = $sched->end_time   ?? '17:00:00';

            $shiftStart = Carbon::parse($dateStr . ' ' . $startTimeStr);
            $shiftEnd   = Carbon::parse($dateStr . ' ' . $endTimeStr);

            $startMins = (int)substr($startTimeStr, 0, 2) * 60 + (int)substr($startTimeStr, 3, 2);
            $endMins   = (int)substr($endTimeStr, 0, 2) * 60 + (int)substr($endTimeStr, 3, 2);

            if ($endMins <= $startMins) {
                $shiftEnd->addDay();
            }

            // Window check-in dibuka 2.5 jam sebelum shiftStart
            $windowStart = $shiftStart->copy()->subMinutes(150);

            // Cek apakah $now berada di dalam rentang [windowStart, shiftEnd]
            if ($now->gte($windowStart) && $now->lte($shiftEnd)) {
                $diff = abs($now->timestamp - $shiftStart->timestamp);
                if ($diff < $minDiff) {
                    $existing = \App\Models\Attendance::where('employee_id', $employee->id)
                        ->where('date', $dateStr)
                        ->where('schedule_id', $sched->id)
                        ->first();
                    if (!$existing || !$existing->check_out) {
                        $minDiff = $diff;
                        $bestMatch = $sched;
                    }
                }
            }
        }

        // 3. Fallback: Jika tidak ada shift yang window-nya sedang aktif (misal sebelum windowStart pertama), pilih shift dengan start_time paling dekat
        if (!$bestMatch) {
            foreach ($allShifts as $sched) {
                $startTimeStr = $sched->start_time ?? '08:00:00';
                $shiftStart = Carbon::parse($dateStr . ' ' . $startTimeStr);
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
     * @param Carbon $checkinTime Waktu absen
     * @param Carbon $shiftStart Jam mulai shift
     * @param Carbon $checkinWindowEnd Jam tutup jendela absen
     * @param int $tepatWaktuMinutes Batas tepat waktu setelah shift mulai (menit, misal: 10)
     * @param int $toleranceMinutes Batas toleransi setelah shift mulai (menit, misal: 10)
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
     * @param \App\Models\Attendance $attendance
     * @param \App\Models\Employee|null $employee
     * @param mixed $referenceTime Waktu acuan (default Carbon::now())
     * @return bool
     */
    public static function isAttendanceIncomplete(\App\Models\Attendance $attendance, ?Employee $employee = null, $referenceTime = null): bool
    {
        if ($attendance->check_out !== null) {
            return false;
        }
        if ($attendance->check_in === null) {
            return false;
        }

        $employee = $employee ?? $attendance->employee;
        if (!$employee) {
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
        $shiftEnd = Carbon::parse($attendanceDate->toDateString() . ' ' . $endTimeStr);

        // Penanganan jika shift start > shift end (shift malam melewati tengah malam)
        $startTimeStr = $todayShift ? $todayShift->start_time : '08:30:00';
        $shiftStart = Carbon::parse($attendanceDate->toDateString() . ' ' . $startTimeStr);
        if ($shiftEnd->lte($shiftStart)) {
            $shiftEnd->addDay();
        }

        return $ref->gt($shiftEnd);
    }
}
