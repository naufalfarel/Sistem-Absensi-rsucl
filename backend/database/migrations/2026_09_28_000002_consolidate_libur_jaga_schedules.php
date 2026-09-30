<?php

use App\Support\LiburJagaSchedule;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        LiburJagaSchedule::consolidate();
    }

    public function down(): void
    {
        // Master LJ per-unit lama tidak dapat direkonstruksi dengan aman.
    }
};
