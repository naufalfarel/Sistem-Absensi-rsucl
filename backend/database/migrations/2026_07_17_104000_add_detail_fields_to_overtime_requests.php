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
        Schema::table('overtime_requests', function (Blueprint $table) {
            $table->string('unit_kerja')->nullable()->after('location_note');
            $table->enum('overtime_day_type', ['workday', 'holiday'])->default('workday')->after('unit_kerja');
            $table->string('start_time')->nullable()->after('overtime_day_type');
            $table->string('end_time')->nullable()->after('start_time');
            $table->text('tasks')->nullable()->after('end_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('overtime_requests', function (Blueprint $table) {
            $table->dropColumn(['unit_kerja', 'overtime_day_type', 'start_time', 'end_time', 'tasks']);
        });
    }
};
