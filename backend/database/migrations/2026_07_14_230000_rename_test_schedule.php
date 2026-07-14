<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('schedules')->where('name', 'tes')->update(['name' => 'Siang']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('schedules')->where('name', 'Siang')->where('start_time', '14:00:00')->update(['name' => 'tes']);
    }
};
