<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('schedules')->update([
            'status' => 'approved',
            'proposed_by' => null,
        ]);
    }

    public function down(): void
    {
    }
};
