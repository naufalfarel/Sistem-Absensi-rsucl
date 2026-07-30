<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\Employee;
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
        $hospLat    = (float) Setting::get('hospital_latitude',  '5.552740480177099');
        $hospLng    = (float) Setting::get('hospital_longitude',  '95.33486560781716');
        $hospRadius = (float) Setting::get('attendance_radius_meters', '100');

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
     * Menemukan jadwal shift aktif pegawai untuk tanggal tertentu, termasuk sub-shift anak jika ada.
     * 
     * @param Employee $employee
     * @param Carbon $date
     * @return \App\Models\Schedule|null
     */
    public static function resolveShiftFor(Employee $employee, Carbon $date): ?\App\Models\Schedule
    {
        $todayStr = $date->toDateString();
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $dayOfWeek = $date->dayOfWeek;
        $dayName   = $dayMap[$dayOfWeek];

        // ── Prioritas 1: Cek jadwal tanggal spesifik (work_date) ──────────────
        $dateRow = \Illuminate\Support\Facades\DB::table('employee_schedule')
            ->join('schedules', 'employee_schedule.schedule_id', '=', 'schedules.id')
            ->where('employee_schedule.employee_id', $employee->id)
            ->where('employee_schedule.work_date', $todayStr)
            ->whereNotNull('employee_schedule.work_date')
            ->select('schedules.*')
            ->first();

        if ($dateRow) {
            $sched = \App\Models\Schedule::find($dateRow->id);
            if ($sched) return $sched;
        }

        // ── Prioritas 2: Fallback ke jadwal mingguan (day_of_week) ──────────
        $schedules = $employee->schedules()->get();
        $todaySchedule = $schedules->first(fn($s) => $s->pivot->day_of_week === $dayName);

        if ($todaySchedule) {
            $matchedShift = $todaySchedule;
            if ($todaySchedule->parent_id === null && $todaySchedule->children()->exists()) {
                $children = $todaySchedule->children()->get();
                $sub = null;
                if ($dayOfWeek === 6) {
                    $sub = $children->first(fn($c) => str_contains(strtolower($c->name), 'sabtu'));
                } else {
                    $sub = $children->first(fn($c) => !str_contains(strtolower($c->name), 'sabtu'));
                }
                if ($sub) {
                    $matchedShift = $sub;
                }
            }
            return $matchedShift;
        }

        // ── Prioritas 3: Fallback ke jadwal kantor reguler ─────────────────
        if ($dayOfWeek !== 0) { // Bukan hari Minggu
            $regulerParent = \App\Models\Schedule::whereNull('parent_id')
                ->where(function($q) {
                    $q->where('name', 'LIKE', 'Reguler Kantor%')
                      ->orWhere('name', 'LIKE', 'Administrasi%')
                      ->orWhere('name', 'LIKE', '%Office%');
                })
                ->first();

            $subShift = null;
            if ($regulerParent) {
                if ($dayOfWeek === 6) {
                    $subShift = $regulerParent->children()->where('name', 'LIKE', '%Sabtu%')->first();
                } else {
                    $subShift = $regulerParent->children()->where(function($q) {
                        $q->where('name', 'LIKE', '%Senin%')
                          ->orWhere('name', 'LIKE', '%Normal%');
                    })->first();
                }
            }

            if ($subShift) {
                return $subShift;
            } elseif ($regulerParent) {
                return $regulerParent;
            }
        }

        return null;
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
