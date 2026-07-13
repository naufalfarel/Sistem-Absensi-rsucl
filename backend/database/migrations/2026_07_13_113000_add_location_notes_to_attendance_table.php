<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Tambah Kolom Keterangan Lokasi Manual Saat Absensi
 *
 * Menambahkan 2 kolom nullable untuk menyimpan catatan lokasi pegawai saat masuk & pulang:
 * - checkin_location_note  : Catatan lokasi saat masuk (opsional, maks 150 karakter)
 * - checkout_location_note : Catatan lokasi saat pulang (opsional, maks 150 karakter)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->string('checkin_location_note', 150)->nullable()->after('note');
            $table->string('checkout_location_note', 150)->nullable()->after('checkin_location_note');
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn(['checkin_location_note', 'checkout_location_note']);
        });
    }
};
