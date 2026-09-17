<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah kolom untuk Surat Tugas Digital (tidak perlu upload file lagi).
     * - director_type: pilihan direktur penandatangan (rs_director / pt_director)
     * - letter_number_seq: nomor urut surat (angka saja, format di-generate otomatis)
     * - letter_date: tanggal surat
     * - travel_purpose: maksud perjalanan
     * - travel_date: hari/tanggal kegiatan (string bebas, misal "Selasa, 07 Juli 2026")
     * - travel_time: pukul (string bebas, misal "08.30 WIB s.d selesai")
     * - travel_place: tempat kegiatan
     * - assigned_employees: JSON array pegawai yang ditugaskan [{name, unit_kerja, jabatan, employee_id}]
     */
    public function up(): void
    {
        if (!Schema::hasTable('assignment_letters')) return;

        Schema::table('assignment_letters', function (Blueprint $table) {
            if (!Schema::hasColumn('assignment_letters', 'director_type')) {
                $table->string('director_type', 20)->nullable()->after('source');
            }
            if (!Schema::hasColumn('assignment_letters', 'letter_number_seq')) {
                $table->unsignedSmallInteger('letter_number_seq')->nullable()->after('letter_number');
            }
            if (!Schema::hasColumn('assignment_letters', 'letter_date')) {
                $table->date('letter_date')->nullable()->after('letter_number_seq');
            }
            if (!Schema::hasColumn('assignment_letters', 'travel_purpose')) {
                $table->text('travel_purpose')->nullable()->after('purpose');
            }
            if (!Schema::hasColumn('assignment_letters', 'travel_date')) {
                $table->string('travel_date', 100)->nullable()->after('travel_purpose');
            }
            if (!Schema::hasColumn('assignment_letters', 'travel_time')) {
                $table->string('travel_time', 100)->nullable()->after('travel_date');
            }
            if (!Schema::hasColumn('assignment_letters', 'travel_place')) {
                $table->text('travel_place')->nullable()->after('travel_time');
            }
            if (!Schema::hasColumn('assignment_letters', 'assigned_employees')) {
                $table->json('assigned_employees')->nullable()->after('travel_place');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('assignment_letters')) return;

        Schema::table('assignment_letters', function (Blueprint $table) {
            $cols = ['director_type', 'letter_number_seq', 'letter_date', 'travel_purpose',
                     'travel_date', 'travel_time', 'travel_place', 'assigned_employees'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('assignment_letters', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
