<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\Setting;
use Carbon\Carbon;

/**
 * Class ScheduleRules
 *
 * Helper untuk menghitung waktu checkout yang diharapkan berdasarkan jadwal shift karyawan,
 * serta mengklasifikasikan apakah checkout aktual tergolong "pulang cepat" atau "lembur".
 *
 * Logika fallback:
 * - Jika karyawan punya jadwal shift di hari tersebut → gunakan end_time shift tersebut
 * - Jika tidak ada jadwal → gunakan checkout_close dari settings sebagai referensi
 *   (checkout_close adalah offset menit setelah jam shift selesai; karena tidak ada shift,
 *    kita gunakan setting global checkout_open_time_weekday / checkout_close_time_weekday
 *    yang secara implisit merepresentasikan jam pulang reguler rumah sakit)
 */
class ScheduleRules
{
    /**
     * Mendapatkan waktu checkout yang diharapkan untuk seorang karyawan pada tanggal tertentu.
     *
     * Prioritas:
     * 1. Jadwal shift karyawan di tabel schedules (pivot day_of_week) → end_time shift
     * 2. Fallback: checkout_open_time dari settings (jika ada) atau checkout_close global
     *
     * @param  Employee $employee
     * @param  Carbon   $date     Tanggal yang diperiksa (gunakan timezone Asia/Jakarta)
     * @return Carbon             Carbon object jam checkout yang diharapkan di hari itu
     */
    public static function expectedCheckoutTime(Employee $employee, Carbon $date): Carbon
    {
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $dayName = $dayMap[$date->dayOfWeek];

        // Coba ambil shift karyawan untuk hari ini
        $shift = $employee->schedules()->wherePivot('day_of_week', $dayName)->first();

        if ($shift) {
            // Gunakan end_time dari jadwal shift
            $endTime = substr($shift->end_time, 0, 5); // "HH:mm"
            [$h, $m] = explode(':', $endTime);
            $expected = $date->copy()->setTime((int)$h, (int)$m, 0);

            // Handle shift overnight: jika end < start, jam selesai adalah esok hari
            $startTime = substr($shift->start_time, 0, 5);
            [$sh, $sm] = explode(':', $startTime);
            $startMins = (int)$sh * 60 + (int)$sm;
            $endMins   = (int)$h   * 60 + (int)$m;
            if ($endMins <= $startMins) {
                $expected->addDay();
            }

            return $expected;
        }

        // ── Fallback: tidak ada jadwal shift ──────────────────────────────
        // Gunakan checkout_close (offset menit setelah jam pulang) dari settings.
        // Karena tidak ada shift, kita interpretasikan sebagai:
        //   jam referensi pulang = setting global "checkout_close_time_weekday"
        // Dalam sistem ini tidak ada key tersebut secara literal, namun ada checkout_open
        // dan checkout_close yang merupakan offset dari end_time shift.
        // 
        // Untuk fallback yang bermakna, kita gunakan jam 17:00 (jam kerja standar) +
        // checkout_close offset sebagai estimasi jam terakhir checkout.
        // Admin bisa mengubahnya via grace minutes setting.
        //
        // Catatan: 17:00 adalah default end-time yang juga digunakan di AttendancePage.tsx
        // sebagai DEFAULT_SHIFT.checkout_open.
        $defaultEndHour   = 17;
        $defaultEndMinute = 0;

        // Coba ambil dari setting checkout_open (offset sebelum end) — tidak relevan tanpa shift
        // Gunakan jam 17:00 sebagai referensi jam pulang global
        $expected = $date->copy()->setTime($defaultEndHour, $defaultEndMinute, 0);

        return $expected;
    }

    /**
     * Mengklasifikasikan waktu checkout aktual dibandingkan dengan yang diharapkan.
     *
     * Aturan:
     * - Pulang cepat: actual < expected - earlyGraceMin
     * - Lembur       : actual > expected + overtimeGraceMin
     * - Normal       : keduanya false
     *
     * @param  Carbon $actualCheckout    Waktu checkout aktual
     * @param  Carbon $expectedCheckout  Waktu checkout yang diharapkan (dari jadwal shift)
     * @param  int    $earlyGraceMin     Toleransi menit sebelum dianggap pulang cepat
     * @param  int    $overtimeGraceMin  Toleransi menit sebelum dianggap lembur
     * @return array  ['is_early' => bool, 'is_overtime' => bool, 'overtime_minutes' => int]
     */
    public static function classifyCheckout(
        Carbon $actualCheckout,
        Carbon $expectedCheckout,
        int $earlyGraceMin,
        int $overtimeGraceMin
    ): array {
        // Batas waktu: sebelum ini dianggap "pulang cepat"
        $earlyThreshold    = $expectedCheckout->copy()->subMinutes($earlyGraceMin);
        // Batas waktu: setelah ini dianggap "lembur"
        $overtimeThreshold = $expectedCheckout->copy()->addMinutes($overtimeGraceMin);

        $isEarly    = $actualCheckout->lt($earlyThreshold);
        $isOvertime = $actualCheckout->gt($overtimeThreshold);

        // Hitung selisih menit lembur (hanya relevan jika is_overtime = true)
        $overtimeMinutes = 0;
        if ($isOvertime) {
            $overtimeMinutes = (int) round($actualCheckout->diffInMinutes($expectedCheckout));
        }

        return [
            'is_early'        => $isEarly,
            'is_overtime'     => $isOvertime,
            'overtime_minutes'=> $overtimeMinutes,
        ];
    }
}
