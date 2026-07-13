<?php
// backend/database/migrations/2026_07_13_121000_add_special_leave_to_leave_requests_table.php

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
        Schema::table('leave_requests', function (Blueprint $table) {
            // Mengubah tipe kolom type menjadi string agar mendukung tipe cuti_khusus
            $table->string('type', 50)->change();
            
            // Menambahkan foreign key untuk kategori cuti khusus
            $table->foreignId('special_leave_category_id')
                  ->nullable()
                  ->after('type')
                  ->constrained('special_leave_categories')
                  ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropForeign(['special_leave_category_id']);
            $table->dropColumn('special_leave_category_id');
            // Catatan: mengembalikan type ke enum aslinya tidak selalu didukung di beberapa database (misal SQLite)
            // Namun, membiarkannya bertipe string adalah aman.
        });
    }
};
