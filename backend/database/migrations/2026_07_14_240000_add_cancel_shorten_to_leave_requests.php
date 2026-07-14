<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->date('actual_end_date')->nullable()->after('end_date');
            
            $table->foreignId('shortened_by')->nullable()->after('actual_end_date')->constrained('users')->nullOnDelete();
            $table->timestamp('shortened_at')->nullable()->after('shortened_by');
            $table->string('shortened_reason', 255)->nullable()->after('shortened_at');

            $table->foreignId('cancelled_by')->nullable()->after('shortened_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable()->after('cancelled_by');
            $table->string('cancellation_reason', 255)->nullable()->after('cancelled_at');
        });

        // Modify enum status to include 'cancelled'
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE leave_requests MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropForeign(['shortened_by']);
            $table->dropColumn(['actual_end_date', 'shortened_by', 'shortened_at', 'shortened_reason']);

            $table->dropForeign(['cancelled_by']);
            $table->dropColumn(['cancelled_by', 'cancelled_at', 'cancellation_reason']);
        });

        // Revert enum status
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE leave_requests MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'");
        }
    }
};
