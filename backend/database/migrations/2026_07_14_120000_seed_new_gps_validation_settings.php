<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $settings = [
            [
                'key'   => 'hospital_latitude',
                'value' => '5.552740480177099',
            ],
            [
                'key'   => 'hospital_longitude',
                'value' => '95.33486560781716',
            ],
            [
                'key'   => 'attendance_radius_meters',
                'value' => '100',
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('settings')->updateOrInsert(
                ['key' => $setting['key']],
                ['value' => $setting['value'], 'updated_at' => now(), 'created_at' => now()]
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('settings')->whereIn('key', [
            'hospital_latitude',
            'hospital_longitude',
            'attendance_radius_meters',
        ])->delete();
    }
};
