<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE attendance MODIFY COLUMN status ENUM('hadir', 'telat', 'izin', 'sakit', 'cuti', 'alpha') NOT NULL DEFAULT 'alpha'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE attendance MODIFY COLUMN status ENUM('hadir', 'telat', 'izin', 'sakit', 'alpha') NOT NULL DEFAULT 'alpha'");
    }
};
