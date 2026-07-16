<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Tambah kolom ke tabel schedules
        Schema::table('schedules', function (Blueprint $table) {
            $table->time('checkin_window_end_time')->nullable()->after('end_time');
        });

        // 2. Tambah kolom ke tabel attendance
        Schema::table('attendance', function (Blueprint $table) {
            $table->enum('checkin_punctuality', ['tepat_waktu', 'toleransi', 'terlambat'])->nullable()->after('status');
            $table->time('effective_checkin_time')->nullable()->after('check_in');
        });

        // 3. Update nilai default checkin_window_end_time untuk shift kantor reguler
        DB::table('schedules')
            ->whereIn('name', [
                'Normal (08:30–17:00)',
                'Normal (08:00–17:00)',
                'Reguler Kantor (08:30–17:00)',
                'Reguler Kantor (08:00–17:00)'
            ])
            ->update(['checkin_window_end_time' => '12:30:00']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn(['checkin_punctuality', 'effective_checkin_time']);
        });

        Schema::table('schedules', function (Blueprint $table) {
            $table->dropColumn('checkin_window_end_time');
        });
    }
};
