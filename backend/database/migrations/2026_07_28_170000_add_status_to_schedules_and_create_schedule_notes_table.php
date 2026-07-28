<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->string('status', 20)->default('approved'); // approved, pending, rejected
            $table->string('admin_note', 255)->nullable();
            $table->foreignId('proposed_by')->nullable()->constrained('users')->onDelete('set null');
        });

        Schema::create('schedule_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained()->onDelete('cascade');
            $table->integer('year');
            $table->integer('month');
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();

            $table->unique(['department_id', 'year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedule_notes');
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropForeign(['proposed_by']);
            $table->dropColumn(['status', 'admin_note', 'proposed_by']);
        });
    }
};
