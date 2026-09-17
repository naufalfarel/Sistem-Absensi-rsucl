<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambahkan kolom recorded_by dan director_type ke tabel resignation_requests.
     *
     * recorded_by  : ID user admin/super_admin yang mencatat resign secara langsung
     *                (null berarti resign diajukan sendiri oleh karyawan)
     * director_type: Pilihan direktur penandatangan surat
     *                'pt_director'  → Amir Hidayat, ST, MKM (Direktur PT Cempaka Lima)
     *                'rs_director'  → dr. Meri Lidiawati, MM, MKM, CHLQM (Direktur RS Cempaka Lima)
     */
    public function up(): void
    {
        Schema::table('resignation_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('resignation_requests', 'recorded_by')) {
                $table->unsignedBigInteger('recorded_by')->nullable()->after('admin_note');
                $table->foreign('recorded_by')->references('id')->on('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('resignation_requests', 'director_type')) {
                $table->enum('director_type', ['pt_director', 'rs_director'])
                      ->nullable()
                      ->default(null)
                      ->after('recorded_by')
                      ->comment('Pilihan direktur penandatangan surat: pt_director atau rs_director');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('resignation_requests', function (Blueprint $table) {
            $table->dropForeign(['recorded_by']);
            $table->dropColumn(['recorded_by', 'director_type']);
        });
    }
};
