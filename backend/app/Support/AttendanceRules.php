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
                             ->wherePivot('date', $date->toDateString())
                             ->first();
        if (!$schedule) {
            $schedule = $employee->schedules()
                                 ->wherePivot('day_of_week', $dayName)
                                 ->wherePivotNull('date')
                                 ->first();
        }

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
    public static function resolveShiftFor(Employee $employee, Carbon $date): ?\App\Models\Schedule
    {
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $dayName = $dayMap[$date->dayOfWeek];
        $schedule = $employee->schedules()->wherePivot('date', $date->toDateString())->first();
        if (!$schedule) {
            $schedule = $employee->schedules()
                                 ->wherePivot('day_of_week', $dayName)
                                 ->wherePivotNull('date')
                                 ->first();
        }

        if (!$schedule) {
            return null;
        }

        // Jika schedule adalah parent template yang memiliki children, kita cari sub-shift yang cocok
        if ($schedule->parent_id === null && $schedule->children()->exists()) {
            // Cek apakah karyawan sudah melakukan check-in hari ini
            $record = \App\Models\Attendance::where('employee_id', $employee->id)
                ->whereDate('date', $date->toDateString())
                ->first();
            
            $timeToMatch = $date;
            if ($record && $record->check_in) {
                // Gunakan jam check-in yang sudah tercatat
                $timeToMatch = Carbon::parse($record->check_in);
            }

            $children = $schedule->children()->get();
            if ($children->isNotEmpty()) {
                $nowMins = $timeToMatch->hour * 60 + $timeToMatch->minute;

                // Gunakan setting baru early_checkin_window_minutes, fallback 150 menit
                $checkinOpenOffset = (int) Setting::get('early_checkin_window_minutes', '150');
                
                // Cari close limit: fallback setengah durasi shift
                $matched = null;
                $closestDiff = 999999;

                foreach ($children as $child) {
                    $nameLower = strtolower($child->name);
                    if (str_contains($nameLower, 'sabtu') && $dayName !== 'Sabtu') {
                        continue;
                    }
                    if (str_contains($nameLower, 'senin–jumat') && $dayName === 'Sabtu') {
                        continue;
                    }
                    if (str_contains($nameLower, 'sen-jum') && $dayName === 'Sabtu') {
                        continue;
                    }

                    $startTime = substr($child->start_time, 0, 5);
                    [$ch, $cm] = explode(':', $startTime);
                    $startMins = (int)$ch * 60 + (int)$cm;

                    $openLimitMins = $startMins - $checkinOpenOffset;
                    if ($openLimitMins < 0) {
                        $openLimitMins += 1440;
                    }

                    // Tentukan close limit untuk child sub-shift ini
                    $resolvedCloseTime = $child->checkin_window_end_time;
                    if (empty($resolvedCloseTime)) {
                        // Fallback setengah durasi
                        $s = Carbon::parse($child->start_time);
                        $e = Carbon::parse($child->end_time);
                        if ($e->lt($s)) {
                            $e->addDay();
                        }
                        $duration = $s->diffInMinutes($e);
                        $half = (int) ($duration / 2);
                        $resolvedCloseTime = $s->copy()->addMinutes($half)->format('H:i:s');
                    }

                    [$c_h, $c_m] = explode(':', substr($resolvedCloseTime, 0, 5));
                    $closeLimitMins = (int)$c_h * 60 + (int)$c_m;

                    // Cek apakah in window
                    $inWindow = false;
                    if ($closeLimitMins > $openLimitMins) {
                        $inWindow = ($nowMins >= $openLimitMins && $nowMins <= $closeLimitMins);
                    } else {
                        // Window melewati tengah malam
                        $inWindow = ($nowMins >= $openLimitMins || $nowMins <= $closeLimitMins);
                    }

                    if ($inWindow) {
                        $cloned = $schedule->replicate();
                        $cloned->id = $child->id;
                        $cloned->start_time = $child->start_time;
                        $cloned->end_time = $child->end_time;
                        $cloned->name = $child->name;
                        $cloned->checkin_window_end_time = $child->checkin_window_end_time;
                        $cloned->exists = true;
                        return $cloned;
                    }

                    $diff = abs($nowMins - $startMins);
                    if ($diff > 720) {
                        $diff = 1440 - $diff;
                    }
                    if ($diff < $closestDiff) {
                        $closestDiff = $diff;
                        $matched = $child;
                    }
                }

                if ($matched) {
                    $cloned = $schedule->replicate();
                    $cloned->id = $matched->id;
                    $cloned->start_time = $matched->start_time;
                    $cloned->end_time = $matched->end_time;
                    $cloned->name = $matched->name;
                    $cloned->checkin_window_end_time = $matched->checkin_window_end_time;
                    $cloned->exists = true;
                    return $cloned;
                }
            }
        }

        return $schedule;
    }

    /**
     * Mengklasifikasikan waktu check-in berdasarkan toleransi keterlambatan.
     * 
     * @param Carbon $checkinTime Waktu absen
     * @param Carbon $shiftStart Jam mulai shift
     * @param Carbon $checkinWindowEnd Jam tutup jendela absen
     * @param int $toleranceMinutes Toleransi keterlambatan (menit)
     * @return array ['status' => string, 'punctuality' => string, 'effective_checkin_time' => string]
     */
    public static function classifyCheckin(Carbon $checkinTime, Carbon $shiftStart, Carbon $checkinWindowEnd, int $toleranceMinutes): array
    {
        $checkinSec = $checkinTime->timestamp;
        $startSec = $shiftStart->timestamp;
        $endSec = $checkinWindowEnd->timestamp;
        $toleranceSec = $startSec + ($toleranceMinutes * 60);

        if ($checkinSec <= $startSec) {
            return [
                'status' => 'hadir',
                'punctuality' => 'tepat_waktu',
                'effective_checkin_time' => $shiftStart->format('H:i:s'),
            ];
        } elseif ($checkinSec <= $toleranceSec) {
            return [
                'status' => 'hadir',
                'punctuality' => 'toleransi',
                'effective_checkin_time' => $checkinTime->format('H:i:s'),
            ];
        } elseif ($checkinSec <= $endSec) {
            return [
                'status' => 'telat',
                'punctuality' => 'terlambat',
                'effective_checkin_time' => $checkinTime->format('H:i:s'),
            ];
        } else {
            return [
                'status' => 'closed',
                'punctuality' => null,
                'effective_checkin_time' => null,
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
        if ($shiftEnd->lt($shiftStart)) {
            $shiftEnd->addDay();
        }

        return $ref->gt($shiftEnd);
    }
}
