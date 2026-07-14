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
            $table->string('checkin_photo_url')->nullable()->after('image_check_in');
            $table->string('checkout_photo_url')->nullable()->after('image_check_out');

            $table->decimal('checkin_latitude', 10, 7)->nullable()->after('latitude');
            $table->decimal('checkin_longitude', 10, 7)->nullable()->after('longitude');
            $table->decimal('checkout_latitude', 10, 7)->nullable()->after('checkin_longitude');
            $table->decimal('checkout_longitude', 10, 7)->nullable()->after('checkout_latitude');

            $table->integer('checkin_distance_meters')->nullable()->after('is_within_geofence');
            $table->integer('checkout_distance_meters')->nullable()->after('checkin_distance_meters');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn([
                'checkin_photo_url',
                'checkout_photo_url',
                'checkin_latitude',
                'checkin_longitude',
                'checkout_latitude',
                'checkout_longitude',
                'checkin_distance_meters',
                'checkout_distance_meters',
            ]);
        });
    }
};
