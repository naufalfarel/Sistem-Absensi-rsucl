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
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->enum('pj_status', ['pending', 'approved', 'rejected'])->default('pending')->after('reason');
            $table->foreignId('pj_reviewed_by')->nullable()->constrained('users')->nullOnDelete()->after('pj_status');
            $table->timestamp('pj_reviewed_at')->nullable()->after('pj_reviewed_by');
            $table->string('pj_note')->nullable()->after('pj_reviewed_at');
        });

        Schema::table('overtime_requests', function (Blueprint $table) {
            $table->enum('pj_status', ['pending', 'approved', 'rejected'])->default('pending')->after('location_note');
            $table->foreignId('pj_reviewed_by')->nullable()->constrained('users')->nullOnDelete()->after('pj_status');
            $table->timestamp('pj_reviewed_at')->nullable()->after('pj_reviewed_by');
            $table->string('pj_note')->nullable()->after('pj_reviewed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropForeign(['pj_reviewed_by']);
            $table->dropColumn(['pj_status', 'pj_reviewed_by', 'pj_reviewed_at', 'pj_note']);
        });

        Schema::table('overtime_requests', function (Blueprint $table) {
            $table->dropForeign(['pj_reviewed_by']);
            $table->dropColumn(['pj_status', 'pj_reviewed_by', 'pj_reviewed_at', 'pj_note']);
        });
    }
};
