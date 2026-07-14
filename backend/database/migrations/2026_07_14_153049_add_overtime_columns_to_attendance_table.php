<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->time('jam_pulang_normal')->nullable()->after('is_overtime');
            $table->boolean('is_lembur')->default(false)->after('jam_pulang_normal');
            $table->integer('durasi_lembur_menit')->nullable()->after('is_lembur');
            $table->text('keterangan_lembur')->nullable()->after('durasi_lembur_menit');
            $table->enum('status_approval_lembur', ['pending', 'disetujui', 'ditolak'])->nullable()->after('keterangan_lembur');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn([
                'jam_pulang_normal',
                'is_lembur',
                'durasi_lembur_menit',
                'keterangan_lembur',
                'status_approval_lembur'
            ]);
        });
    }
};
