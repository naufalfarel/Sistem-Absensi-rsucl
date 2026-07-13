<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Tambah Kolom Data Kendaraan Pegawai
 *
 * Menambahkan 4 kolom nullable untuk menyimpan plat nomor kendaraan pegawai:
 * - motor_plate_1 : Plat motor 1 (opsional, maks 15 karakter)
 * - motor_plate_2 : Plat motor 2 (opsional, maks 15 karakter)
 * - car_plate_1   : Plat mobil 1 (opsional, maks 15 karakter)
 * - car_plate_2   : Plat mobil 2 (opsional, maks 15 karakter)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('motor_plate_1', 15)->nullable()->after('status');
            $table->string('motor_plate_2', 15)->nullable()->after('motor_plate_1');
            $table->string('car_plate_1', 15)->nullable()->after('motor_plate_2');
            $table->string('car_plate_2', 15)->nullable()->after('car_plate_1');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['motor_plate_1', 'motor_plate_2', 'car_plate_1', 'car_plate_2']);
        });
    }
};
