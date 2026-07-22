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
        if (Schema::hasTable('assignment_letters') && !Schema::hasColumn('assignment_letters', 'attendance_proof_url')) {
            Schema::table('assignment_letters', function (Blueprint $table) {
                $table->string('attendance_proof_url')->nullable()->after('document_url');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('assignment_letters') && Schema::hasColumn('assignment_letters', 'attendance_proof_url')) {
            Schema::table('assignment_letters', function (Blueprint $table) {
                $table->dropColumn('attendance_proof_url');
            });
        }
    }
};
