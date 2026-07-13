<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Setting;

/**
 * Migration: Seed Default Settings untuk Kuota Cuti Tahunan
 *
 * Menambahkan tiga setting baru ke tabel settings:
 * - leave_reset_month : Bulan reset kuota cuti (default: 4 = April)
 * - leave_reset_day   : Tanggal reset kuota cuti (default: 1)
 * - annual_leave_quota_days : Jumlah hari kuota cuti tahunan (default: 12)
 *
 * Pendekatan: Hitung dinamis — kuota dihitung dari total hari cuti
 * berstatus 'approved' dalam periode berjalan (tanpa tabel saldo terpisah).
 * Sisa kuota tahun lalu HANGUS saat reset (tidak carry-over).
 */
return new class extends Migration
{
    public function up(): void
    {
        $defaults = [
            'leave_reset_month'       => '4',  // April
            'leave_reset_day'         => '1',  // Tanggal 1
            'annual_leave_quota_days' => '12', // 12 hari per tahun
        ];

        foreach ($defaults as $key => $value) {
            // Hanya insert jika belum ada, jangan overwrite setting yang sudah dikustomisasi admin
            if (!Setting::where('key', $key)->exists()) {
                Setting::create(['key' => $key, 'value' => $value]);
            }
        }
    }

    public function down(): void
    {
        Setting::whereIn('key', [
            'leave_reset_month',
            'leave_reset_day',
            'annual_leave_quota_days',
        ])->delete();
    }
};
