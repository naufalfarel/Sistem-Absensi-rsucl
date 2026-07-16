<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration: Buat tabel shift_assignment_proposals.
 * 
 * Menyimpan usulan penugasan shift yang dibuat PJ Bagian.
 * Usulan bersifat proposal — belum aktif sampai disetujui admin.
 * Saat admin setujui, penugasan sungguhan baru dieksekusi ke tabel pivot employee_schedule.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shift_assignment_proposals', function (Blueprint $table) {
            $table->id();

            // Karyawan yang akan ditugaskan shift
            $table->foreignId('employee_id')
                  ->constrained('employees')
                  ->onDelete('cascade');

            // Shift yang diusulkan
            $table->foreignId('schedule_id')
                  ->constrained('schedules')
                  ->onDelete('cascade');

            // Hari kerja yang diusulkan (format: Senin, Selasa, dst.)
            $table->string('day_of_week');

            // PJ Bagian yang mengajukan usulan
            $table->foreignId('proposed_by')
                  ->constrained('users')
                  ->onDelete('cascade');

            // Status usulan: pending → admin belum review; approved/rejected → sudah diproses
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');

            // Catatan dari admin saat menolak (wajib saat reject)
            $table->text('admin_note')->nullable();

            // Admin yang memproses usulan
            $table->foreignId('reviewed_by')
                  ->nullable()
                  ->constrained('users')
                  ->onDelete('set null');

            $table->timestamp('reviewed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shift_assignment_proposals');
    }
};
