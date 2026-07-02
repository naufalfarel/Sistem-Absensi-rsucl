<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    // Kunci yang diizinkan untuk di-set via API
    private const ALLOWED_KEYS = [
        'system_active',    // 1 | 0
        'late_limit',       // jam terlambat, default "08:30"
        'close_checkin',    // tutup absen masuk, default "09:00"
        'checkout_open',    // buka absen pulang, default "17:00"
        'checkout_close',   // tutup absen pulang, default "18:00"
        'gps_radius',       // radius geofence meter, default "100"
        'hospital_lat',     // koordinat RS
        'hospital_lng',
        'logo_url',         // URL logo RS
    ];

    /**
     * GET /api/settings
     */
    public function index()
    {
        $all = Setting::whereIn('key', self::ALLOWED_KEYS)->get()->keyBy('key');

        $data = [];
        foreach (self::ALLOWED_KEYS as $key) {
            $data[$key] = $all->get($key)?->value ?? $this->defaults($key);
        }

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * PUT /api/settings
     * Body: { key: value, ... }
     */
    public function update(Request $request)
    {
        $request->validate([
            'system_active' => 'sometimes|in:0,1',
            'late_limit'    => 'sometimes|date_format:H:i',
            'close_checkin' => 'sometimes|date_format:H:i',
            'checkout_open' => 'sometimes|date_format:H:i',
            'checkout_close'=> 'sometimes|date_format:H:i',
            'gps_radius'    => 'sometimes|integer|min:50|max:1000',
            'hospital_lat'  => 'sometimes|numeric',
            'hospital_lng'  => 'sometimes|numeric',
        ]);

        foreach (self::ALLOWED_KEYS as $key) {
            if ($request->has($key)) {
                Setting::set($key, (string) $request->input($key));
            }
        }

        return response()->json(['success' => true, 'message' => 'Pengaturan berhasil disimpan.']);
    }

    private function defaults(string $key): string
    {
        return match ($key) {
            'system_active' => '1',
            'late_limit'    => '08:30',
            'close_checkin' => '09:00',
            'checkout_open' => '17:00',
            'checkout_close'=> '18:00',
            'gps_radius'    => '100',
            'hospital_lat'  => '-5.553',
            'hospital_lng'  => '95.318',
            default         => '',
        };
    }
}
