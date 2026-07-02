<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->time('start_time');
            $table->time('end_time');
            $table->string('color', 10)->default('#16A34A');  // hex warna
            $table->string('icon', 20)->default('sun');       // sun|sunset|moon|star|zap
            $table->timestamps();
        });

        // Pivot: penugasan shift ke karyawan (untuk jadwal mingguan)
        Schema::create('employee_schedule', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('schedule_id')->constrained()->cascadeOnDelete();
            $table->string('day_of_week')->nullable(); // Mon,Tue,... atau null = semua hari
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_schedule');
        Schema::dropIfExists('schedules');
    }
};
