<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Setting;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Default values for time offsets (in minutes)
        $defaults = [
            'checkin_open'       => '0',
            'late_limit'         => '30',
            'close_checkin'      => '60',
            'checkout_open'      => '0',
            'checkout_close'     => '60',
            'sat_checkout_open'  => '0',
            'sat_checkout_close' => '60',
        ];

        foreach ($defaults as $key => $val) {
            $setting = Setting::where('key', $key)->first();
            if ($setting) {
                // If it contains ":" (legacy absolute time format like "08:30"), convert to correct offset
                if (str_contains($setting->value ?? '', ':')) {
                    $setting->update(['value' => $val]);
                }
            } else {
                Setting::create(['key' => $key, 'value' => $val]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No reverse operation needed for values cleanup
    }
};
