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
            $table->string('instagram', 100)->nullable()->after('car_plate_2');
            $table->string('facebook', 100)->nullable()->after('instagram');
            $table->string('tiktok', 100)->nullable()->after('facebook');
        });

        Schema::table('employee_registrations', function (Blueprint $table) {
            $table->string('motor_plate_1', 15)->nullable()->after('position_id');
            $table->string('motor_plate_2', 15)->nullable()->after('motor_plate_1');
            $table->string('car_plate_1', 15)->nullable()->after('motor_plate_2');
            $table->string('car_plate_2', 15)->nullable()->after('car_plate_1');
            $table->string('instagram', 100)->nullable()->after('car_plate_2');
            $table->string('facebook', 100)->nullable()->after('instagram');
            $table->string('tiktok', 100)->nullable()->after('facebook');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['instagram', 'facebook', 'tiktok']);
        });

        Schema::table('employee_registrations', function (Blueprint $table) {
            $table->dropColumn([
                'motor_plate_1', 'motor_plate_2', 'car_plate_1', 'car_plate_2',
                'instagram', 'facebook', 'tiktok'
            ]);
        });
    }
};
