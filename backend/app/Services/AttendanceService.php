<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Setting;
use Carbon\Carbon;

class AttendanceService
{
    /**
     * Menghitung status lembur berdasarkan shift kerja karyawan dan waktu checkout.
     *
     * @param Employee $employee
     * @param Carbon $checkoutTime Waktu checkout aktual (timezone Asia/Jakarta)
     * @param Carbon|null $shiftDate Tanggal shift (date record absensi)
     * @return array ['is_lembur' => bool, 'durasi_lembur_menit' => int, 'jam_pulang_normal' => string]
     */
    public function hitungStatusLembur(Employee $employee, Carbon $checkoutTime, ?Carbon $shiftDate = null): array
    {
        if (!$shiftDate) {
            $shiftDate = $checkoutTime->copy()->startOfDay();
        }

        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $dayName = $dayMap[$shiftDate->dayOfWeek];

        // Cari shift/schedule untuk hari ini
        $shift = $employee->schedules()->wherePivot('day_of_week', $dayName)->first();

        // Tentukan jam pulang normal
        if ($shift) {
            $jamPulangNormal = substr($shift->end_time, 0, 5); // "HH:mm"
            $startTimeStr = substr($shift->start_time, 0, 5);
        } else {
            // Default normal checkout time if no shift: 17:00
            $jamPulangNormal = '17:00';
            $startTimeStr = '08:00';
        }

        // Tentukan waktu checkout yang diharapkan
        [$h, $m] = explode(':', $jamPulangNormal);
        $expectedCheckout = $shiftDate->copy()->setTime((int)$h, (int)$m, 0);

        // Kasus shift malam: jika start_time > end_time, maka end_time jatuh pada hari berikutnya
        [$sh, $sm] = explode(':', $startTimeStr);
        $startMins = (int)$sh * 60 + (int)$sm;
        $endMins   = (int)$h   * 60 + (int)$m;
        if ($endMins <= $startMins) {
            $expectedCheckout->addDay();
        }

        // Toleransi lembur (overtime grace minutes)
        $overtimeGrace = (int) Setting::get('overtime_grace_minutes', '15');

        // Hitung selisih menit checkout dengan expected checkout
        $diffMinutes = $expectedCheckout->diffInMinutes($checkoutTime, false); // false = signed difference

        $isLembur = false;
        $durasiLemburMenit = 0;

        if ($diffMinutes > 0) {
            // Jika melebihi batas toleransi
            if ($diffMinutes > $overtimeGrace) {
                $isLembur = true;
                $durasiLemburMenit = (int) $diffMinutes;
            }
        }

        return [
            'is_lembur' => $isLembur,
            'durasi_lembur_menit' => $durasiLemburMenit,
            'jam_pulang_normal' => $expectedCheckout->format('H:i:s'),
        ];
    }
}
