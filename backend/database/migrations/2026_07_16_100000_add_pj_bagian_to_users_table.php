<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Tambah kolom pj_bagian_department_id ke tabel users.
 * 
 * Kolom ini hanya terisi jika role user adalah 'pj_bagian'.
 * Constraint UNIQUE memastikan satu departemen hanya bisa punya SATU PJ Bagian aktif.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // FK ke departments — nullable karena hanya diisi untuk role pj_bagian
            $table->unsignedBigInteger('pj_bagian_department_id')
                  ->nullable()
                  ->after('role');

            $table->foreign('pj_bagian_department_id')
                  ->references('id')
                  ->on('departments')
                  ->onDelete('set null');

            // UNIQUE: satu departemen = satu PJ Bagian aktif
            // Partial unique (hanya baris yang tidak null) secara konvensi di MySQL
            // sudah otomatis mengabaikan NULL, jadi NULL bisa banyak.
            $table->unique('pj_bagian_department_id', 'users_pj_dept_unique');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['pj_bagian_department_id']);
            $table->dropUnique('users_pj_dept_unique');
            $table->dropColumn('pj_bagian_department_id');
        });
    }
};
