<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('departments', 'count_sunday_in_leave')) {
            Schema::table('departments', function (Blueprint $table) {
                $table->boolean('count_sunday_in_leave')->default(false)->after('name');
            });
        }

        // Set count_sunday_in_leave = true untuk unit-unit 24 jam / shift yang dikenal
        $keywords = ['igd', 'rawat inap', 'ranap', 'depo', 'icu', 'nicu', 'juru masak', 'cuci piring', 'laundry', 'kasir', 'gizi', 'cssd', 'transporter'];
        $departments = DB::table('departments')->get();
        foreach ($departments as $dept) {
            $nameLower = strtolower($dept->name);
            foreach ($keywords as $kw) {
                if (str_contains($nameLower, $kw)) {
                    DB::table('departments')->where('id', $dept->id)->update(['count_sunday_in_leave' => true]);
                    break;
                }
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('departments', 'count_sunday_in_leave')) {
            Schema::table('departments', function (Blueprint $table) {
                $table->dropColumn('count_sunday_in_leave');
            });
        }
    }
};
