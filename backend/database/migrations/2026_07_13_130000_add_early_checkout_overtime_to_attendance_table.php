<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Tambah kolom Pulang Cepat (Early Checkout) dan Lembur (Overtime) ke tabel attendance.
 * 
 * - is_early_checkout: penanda apakah checkout terjadi sebelum jadwal shift selesai (minus toleransi)
 * - early_checkout_reason: alasan yang diisi pegawai saat pulang cepat (wajib jika is_early_checkout = true)
 * - early_checkout_status: status persetujuan admin (pending / approved / rejected)
 * - early_checkout_admin_note: catatan admin saat approve/reject
 * - is_overtime: penanda apakah checkout melewati jadwal shift + toleransi
 * - overtime_minutes: selisih menit aktual vs jadwal shift (dihitung otomatis)
 * - overtime_note: keterangan pekerjaan lembur dari pegawai (opsional)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            // ── Pulang Cepat ──────────────────────────────────────
            $table->boolean('is_early_checkout')->default(false)->after('checkout_location_note');
            $table->string('early_checkout_reason', 150)->nullable()->after('is_early_checkout');
            $table->enum('early_checkout_status', ['pending', 'approved', 'rejected'])->nullable()->after('early_checkout_reason');
            $table->string('early_checkout_admin_note', 255)->nullable()->after('early_checkout_status');

            // ── Lembur ────────────────────────────────────────────
            $table->boolean('is_overtime')->default(false)->after('early_checkout_admin_note');
            $table->integer('overtime_minutes')->nullable()->after('is_overtime');
            $table->string('overtime_note', 150)->nullable()->after('overtime_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn([
                'is_early_checkout',
                'early_checkout_reason',
                'early_checkout_status',
                'early_checkout_admin_note',
                'is_overtime',
                'overtime_minutes',
                'overtime_note',
            ]);
        });
    }
};
