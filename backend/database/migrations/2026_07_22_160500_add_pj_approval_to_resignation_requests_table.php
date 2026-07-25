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
        Schema::table('resignation_requests', function (Blueprint $table) {
            $table->enum('pj_status', ['pending', 'approved', 'rejected'])->default('pending')->after('status');
            $table->foreignId('pj_reviewed_by')->nullable()->constrained('users')->onDelete('set null')->after('reviewed_by');
            $table->timestamp('pj_reviewed_at')->nullable()->after('reviewed_at');
            $table->text('pj_note')->nullable()->after('admin_note');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('resignation_requests', function (Blueprint $table) {
            $table->dropForeign(['pj_reviewed_by']);
            $table->dropColumn(['pj_status', 'pj_reviewed_by', 'pj_reviewed_at', 'pj_note']);
        });
    }
};
