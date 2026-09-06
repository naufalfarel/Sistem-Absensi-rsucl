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
        Schema::table('employees', function (Blueprint $table) {
            $table->string('faskes_tk')->nullable()->after('tiktok');
            $table->string('faskes_location')->nullable()->after('faskes_tk');
        });

        Schema::table('employee_registrations', function (Blueprint $table) {
            $table->string('faskes_tk')->nullable()->after('tiktok');
            $table->string('faskes_location')->nullable()->after('faskes_tk');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['faskes_tk', 'faskes_location']);
        });

        Schema::table('employee_registrations', function (Blueprint $table) {
            $table->dropColumn(['faskes_tk', 'faskes_location']);
        });
    }
};
