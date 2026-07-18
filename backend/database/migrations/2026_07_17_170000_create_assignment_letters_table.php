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
        if (!Schema::hasTable('assignment_letters')) {
            Schema::create('assignment_letters', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employee_id')->constrained('employees')->onDelete('cascade');
                $table->string('letter_number', 100)->nullable();
                $table->string('title', 200);
                $table->string('issuing_institution', 200);
                $table->text('purpose');
                $table->date('start_date');
                $table->date('end_date');
                $table->string('document_url');
                $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
                $table->string('admin_note', 255)->nullable();
                $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assignment_letters');
    }
};
