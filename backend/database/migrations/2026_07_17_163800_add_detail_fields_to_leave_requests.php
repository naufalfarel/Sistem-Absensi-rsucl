<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('leave_requests', 'posisi')) {
                $table->string('posisi', 100)->nullable()->after('type');
            }
            if (!Schema::hasColumn('leave_requests', 'unit_kerja')) {
                $table->string('unit_kerja', 100)->nullable()->after('posisi');
            }
            if (!Schema::hasColumn('leave_requests', 'substitute_name')) {
                $table->string('substitute_name', 100)->nullable()->after('reason');
            }
            if (!Schema::hasColumn('leave_requests', 'alamat_cuti')) {
                $table->text('alamat_cuti')->nullable()->after('reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table) {
            $columns = [];
            if (Schema::hasColumn('leave_requests', 'posisi')) $columns[] = 'posisi';
            if (Schema::hasColumn('leave_requests', 'unit_kerja')) $columns[] = 'unit_kerja';
            if (Schema::hasColumn('leave_requests', 'substitute_name')) $columns[] = 'substitute_name';
            if (Schema::hasColumn('leave_requests', 'alamat_cuti')) $columns[] = 'alamat_cuti';
            
            if (!empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }
};
