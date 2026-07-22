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
        if (Schema::hasTable('assignment_letters')) {
            Schema::table('assignment_letters', function (Blueprint $table) {
                if (!Schema::hasColumn('assignment_letters', 'source')) {
                    $table->string('source', 50)->default('employee_request')->after('employee_id');
                }
                if (!Schema::hasColumn('assignment_letters', 'activity_notes')) {
                    $table->text('activity_notes')->nullable()->after('attendance_proof_url');
                }
            });

            // Ubah document_url menjadi nullable jika di MySQL
            try {
                DB::statement("ALTER TABLE assignment_letters MODIFY document_url VARCHAR(255) NULL");
            } catch (\Throwable $e) {
                // Ignore if driver doesn't support raw ALTER
            }

            // Ubah status column menjadi string 50 agar dapat menampung 'completed'
            try {
                DB::statement("ALTER TABLE assignment_letters MODIFY status VARCHAR(50) NOT NULL DEFAULT 'pending'");
            } catch (\Throwable $e) {
                // Ignore if not MySQL
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('assignment_letters')) {
            Schema::table('assignment_letters', function (Blueprint $table) {
                if (Schema::hasColumn('assignment_letters', 'source')) {
                    $table->dropColumn('source');
                }
                if (Schema::hasColumn('assignment_letters', 'activity_notes')) {
                    $table->dropColumn('activity_notes');
                }
            });
        }
    }
};
