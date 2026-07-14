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
}
