<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Migration: Tambahkan schedule_id dan is_emergency_callout ke tabel attendance
     *
     * Mendukung multi-shift dalam 1 hari (cth: Shift Pagi & Shift Malam / Shift Dadakan On-Call)
     * tanpa bentrok record absensi.
     */
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            if (!Schema::hasColumn('attendance', 'schedule_id')) {
                $table->foreignId('schedule_id')->nullable()->after('employee_id')->constrained('schedules')->nullOnDelete();
            }
            if (!Schema::hasColumn('attendance', 'is_emergency_callout')) {
                $table->boolean('is_emergency_callout')->default(false)->after('schedule_id');
            }
            // Add index for fast querying by employee, date, and schedule
            $table->index(['employee_id', 'date', 'schedule_id'], 'emp_date_schedule_idx');
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropIndex('emp_date_schedule_idx');
            if (Schema::hasColumn('attendance', 'schedule_id')) {
                $table->dropForeign(['schedule_id']);
                $table->dropColumn('schedule_id');
            }
            if (Schema::hasColumn('attendance', 'is_emergency_callout')) {
                $table->dropColumn('is_emergency_callout');
            }
        });
    }
};
