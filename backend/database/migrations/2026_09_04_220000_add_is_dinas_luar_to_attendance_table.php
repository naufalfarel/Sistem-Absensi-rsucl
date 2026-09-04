<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambahkan kolom is_dinas_luar ke tabel attendance.
     *
     * Kolom ini diisi otomatis oleh sistem saat proses check-in, jika pegawai
     * terdeteksi memiliki Surat Tugas yang disetujui dan aktif pada tanggal absensi.
     * Jika true, validasi radius geofencing dilewati; pegawai cukup upload foto + koordinat saat itu.
     */
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            if (!Schema::hasColumn('attendance', 'is_dinas_luar')) {
                $table->boolean('is_dinas_luar')
                    ->default(false)
                    ->comment('True jika pegawai sedang dinas luar (Surat Tugas aktif) — GPS bypass aktif');
            }
            // FK ke surat tugas yang aktif saat absensi ini dilakukan
            if (!Schema::hasColumn('attendance', 'assignment_letter_id')) {
                $table->foreignId('assignment_letter_id')
                    ->nullable()
                    ->constrained('assignment_letters')
                    ->onDelete('set null')
                    ->comment('FK ke surat tugas yang aktif saat absensi ini dilakukan');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            if (Schema::hasColumn('attendance', 'assignment_letter_id')) {
                $table->dropForeign(['assignment_letter_id']);
                $table->dropColumn('assignment_letter_id');
            }
            if (Schema::hasColumn('attendance', 'is_dinas_luar')) {
                $table->dropColumn('is_dinas_luar');
            }
        });
    }
};
