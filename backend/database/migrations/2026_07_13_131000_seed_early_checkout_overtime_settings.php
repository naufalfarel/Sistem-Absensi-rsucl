<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Migration: Seed pengaturan toleransi Pulang Cepat dan Lembur ke tabel settings.
 * 
 * - early_checkout_grace_minutes: menit toleransi sebelum dianggap pulang cepat (default 15)
 * - overtime_grace_minutes: menit toleransi sebelum dianggap lembur (default 15)
 */
return new class extends Migration
{
    public function up(): void
    {
        $settings = [
            [
                'key'   => 'early_checkout_grace_minutes',
                'value' => '15',
            ],
            [
                'key'   => 'overtime_grace_minutes',
                'value' => '15',
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('settings')->updateOrInsert(
                ['key' => $setting['key']],
                ['value' => $setting['value'], 'updated_at' => now(), 'created_at' => now()]
            );
        }
    }

    public function down(): void
    {
        DB::table('settings')->whereIn('key', [
            'early_checkout_grace_minutes',
            'overtime_grace_minutes',
        ])->delete();
    }
};
