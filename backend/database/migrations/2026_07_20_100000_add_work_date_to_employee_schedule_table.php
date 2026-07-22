<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Tambah kolom work_date ke tabel employee_schedule
 *
 * Memungkinkan penugasan shift per-tanggal spesifik (bukan hanya per hari dalam seminggu).
 * Kolom day_of_week tetap dipertahankan untuk backward compatibility
 * dengan data jadwal mingguan yang sudah ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_schedule', function (Blueprint $table) {
            // Tanggal spesifik penugasan shift (YYYY-MM-DD), nullable untuk backward-compat
            $table->date('work_date')->nullable()->after('day_of_week');

            // Index gabungan untuk mempercepat query get jadwal bulanan
            $table->index(['employee_id', 'work_date'], 'emp_schedule_work_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('employee_schedule', function (Blueprint $table) {
            $table->dropIndex('emp_schedule_work_date_idx');
            $table->dropColumn('work_date');
        });
    }
};
