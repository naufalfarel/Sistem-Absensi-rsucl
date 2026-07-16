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
        Schema::table('attendance', function (Blueprint $table) {
            $table->enum('overtime_status', ['pending', 'approved', 'rejected'])->nullable()->after('is_overtime');
            $table->foreignId('overtime_reviewed_by')->nullable()->constrained('users')->onDelete('set null')->after('overtime_status');
            $table->timestamp('overtime_reviewed_at')->nullable()->after('overtime_reviewed_by');
            $table->string('overtime_admin_note', 255)->nullable()->after('overtime_reviewed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            if (DB::getDriverName() !== 'sqlite') {
                $table->dropForeign(['overtime_reviewed_by']);
            }
            $table->dropColumn([
                'overtime_status',
                'overtime_reviewed_by',
                'overtime_reviewed_at',
                'overtime_admin_note'
            ]);
        });
    }
};
