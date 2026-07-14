<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\Setting;
use Carbon\Carbon;

/**
 * LeaveQuotaHelper
 *
 * Helper statis untuk mengelola kuota cuti tahunan karyawan.
 *
 * ## Pendekatan: Hitung Dinamis
 * Sisa kuota dihitung secara langsung (on-the-fly) dari total hari cuti
 * berstatus 'approved' dan bertipe 'cuti' dalam periode berjalan.
 * Tidak menggunakan tabel saldo terpisah (leave_balances) agar selalu
 * konsisten dan tidak membutuhkan scheduled job yang bisa gagal.
 *
 * ## Kebijakan Carry-Over
 * Sisa kuota tahun lalu HANGUS saat periode baru dimulai. Kuota tidak
 * dibawa ke periode berikutnya (no carry-over). Kebijakan ini dapat
 * diubah di sini jika diinginkan di kemudian hari.
 *
 * ## Jenis Cuti & Kuota
 * HANYA tipe 'cuti' (cuti tahunan) yang dibatasi kuota.
 * Tipe 'izin' dan 'sakit' TIDAK ADA BATAS kuota (by design).
 *
 * ## Konfigurasi (dapat diubah admin via UI Settings)
 * - leave_reset_month       : Bulan reset (1-12, default: 4 = April)
 * - leave_reset_day         : Tanggal reset (1-31, default: 1)
 * - annual_leave_quota_days : Jumlah hari kuota per tahun (default: 12)
 */
class LeaveQuotaHelper
{
    /**
     * Menghitung awal periode kuota cuti yang sedang berjalan.
     *
     * Logika:
     * - Ambil tanggal reset dari setting (bulan + tanggal).
     * - Jika tanggal reset di tahun ini sudah lewat (atau hari ini),
     *   periode berjalan dimulai dari tahun ini.
     * - Jika tanggal reset di tahun ini BELUM terjadi,
     *   periode berjalan dimulai dari tahun lalu.
     *
     * Contoh (reset 1 April):
     * - Hari ini 13 Juli 2026 → periode mulai 1 April 2026
     * - Hari ini 15 Maret 2026 → periode mulai 1 April 2025
     *
     * @param Carbon $now Waktu referensi (biasanya Carbon::now())
     * @return Carbon Awal periode kuota berjalan (jam 00:00:00)
     */
    public static function currentPeriodStart(Carbon $now): Carbon
    {
        $month = (int) Setting::get('leave_reset_month', '4');
        $day   = (int) Setting::get('leave_reset_day', '1');

        // Normalisasi: pastikan hari valid untuk bulan tersebut
        $daysInMonth = Carbon::create($now->year, $month, 1)->daysInMonth;
        $day = min($day, $daysInMonth);

        // Tanggal reset tahun ini
        $resetThisYear = Carbon::create($now->year, $month, $day, 0, 0, 0);

        if ($now->gte($resetThisYear)) {
            // Tanggal reset sudah lewat tahun ini → periode dimulai tahun ini
            return $resetThisYear;
        } else {
            // Tanggal reset belum tiba tahun ini → periode dimulai tahun lalu
            $daysInMonthLastYear = Carbon::create($now->year - 1, $month, 1)->daysInMonth;
            $dayLastYear = min($day, $daysInMonthLastYear);
            return Carbon::create($now->year - 1, $month, $dayLastYear, 0, 0, 0);
        }
    }

    /**
     * Menghitung total hari cuti (type='cuti') berstatus 'approved'
     * dalam periode berjalan untuk karyawan tertentu.
     *
     * Digunakan untuk TAMPILAN "hari terpakai" di UI.
     *
     * @param Employee $employee
     * @param Carbon   $now
     * @return int Total hari cuti yang sudah disetujui dalam periode ini
     */
    public static function usedDays(Employee $employee, Carbon $now): int
    {
        return self::countDays($employee, $now, ['approved']);
    }

    /**
     * Menghitung total hari cuti (type='cuti') yang sudah "dipesan"
     * (status: pending ATAU approved) dalam periode berjalan.
     *
     * Digunakan untuk VALIDASI saat karyawan mengajukan cuti baru,
     * agar cuti yang masih pending tidak bisa di-double-book.
     *
     * Contoh: quota=10, ada pending cuti 8 hari → user hanya boleh
     * ajukan cuti baru maksimal 2 hari lagi (bukan 10 hari lagi).
     *
     * @param Employee $employee
     * @param Carbon   $now
     * @param int|null $excludeId ID leave request yang dikecualikan (untuk edit)
     * @return int Total hari cuti pending + approved dalam periode ini
     */
    public static function committedDays(Employee $employee, Carbon $now, ?int $excludeId = null): int
    {
        return self::countDays($employee, $now, ['pending', 'approved'], $excludeId);
    }

    /**
     * Menghitung sisa kuota cuti yang masih bisa diajukan.
     * Menggunakan committedDays (pending + approved) agar tidak bisa double-book.
     *
     * @param Employee $employee
     * @param Carbon   $now
     * @param int|null $excludeId ID leave request yang dikecualikan
     * @return int Sisa hari kuota yang bisa diajukan (tidak bisa negatif)
     */
    public static function remainingDays(Employee $employee, Carbon $now, ?int $excludeId = null): int
    {
        $quota     = self::quotaDays();
        $committed = self::committedDays($employee, $now, $excludeId);
        return max(0, $quota - $committed);
    }

    /**
     * Mengambil jumlah hari kuota cuti tahunan dari setting.
     *
     * @return int Jumlah hari kuota (default: 12)
     */
    public static function quotaDays(): int
    {
        return (int) Setting::get('annual_leave_quota_days', '12');
    }

    /**
     * Menghasilkan array lengkap info kuota untuk satu karyawan.
     * Berguna untuk response API.
     *
     * - used      : hari cuti yang sudah DISETUJUI (approved)
     * - pending   : hari cuti yang MENUNGGU persetujuan
     * - remaining : sisa kuota yang masih bisa diajukan (quota - committed)
     *
     * @param Employee $employee
     * @param Carbon   $now
     * @return array
     */
    public static function quotaInfo(Employee $employee, Carbon $now): array
    {
        $quota       = self::quotaDays();
        $used        = self::usedDays($employee, $now);
        $committed   = self::committedDays($employee, $now);
        $pending     = max(0, $committed - $used);
        $remaining   = max(0, $quota - $committed);
        $periodStart = self::currentPeriodStart($now);

        return [
            'quota'        => $quota,
            'used'         => $used,        // approved saja (untuk tampilan)
            'pending'      => $pending,     // pending (belum diapprove)
            'remaining'    => $remaining,   // sisa yang masih bisa diajukan
            'period_start' => $periodStart->toDateString(),
            'period_label' => $periodStart->locale('id')->isoFormat('D MMMM YYYY') . ' – ' . $periodStart->copy()->addYear()->subDay()->locale('id')->isoFormat('D MMMM YYYY'),
        ];
    }

    // ── Private Helper ────────────────────────────────────────────────────────

    /**
     * Menghitung total hari cuti dalam periode berjalan berdasarkan status tertentu.
     *
     * @param Employee $employee
     * @param Carbon   $now
     * @param array    $statuses Status yang dihitung (misal: ['approved'] atau ['pending','approved'])
     * @param int|null $excludeId ID yang dikecualikan dari perhitungan
     * @return int
     */
    private static function countDays(Employee $employee, Carbon $now, array $statuses, ?int $excludeId = null): int
    {
        $periodStart = self::currentPeriodStart($now);

        // PERHATIAN: Hanya menghitung pengajuan tipe 'cuti' (cuti tahunan).
        // Tipe 'cuti_khusus' (cuti khusus) secara eksplisit TIDAK dihitung di sini
        // karena cuti khusus memiliki kuota terpisah/tidak dibatasi kuota tahunan.
        $query = $employee->leaveRequests()
            ->where('type', 'cuti')
            ->whereIn('status', $statuses)
            ->where('start_date', '>=', $periodStart->toDateString());

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        $leaveRequests = $query->get();

        $total = 0;
        foreach ($leaveRequests as $lr) {
            $total += $lr->days;
        }

        return $total;
    }
}
