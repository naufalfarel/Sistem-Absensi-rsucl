<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    // Kunci yang diizinkan untuk di-set via API
    private const ALLOWED_KEYS = [
        'system_active',        // 1 | 0
        'checkin_open',         // buka absen masuk, default "08:00"
        'late_limit',           // jam terlambat, default "08:30"
        'close_checkin',        // tutup absen masuk, default "09:00"
        'break_start',          // mulai istirahat, default "12:30"
        'break_end',            // selesai istirahat, default "13:30"
        'checkout_open',        // buka absen pulang, default "17:00"
        'checkout_close',       // tutup absen pulang, default "18:00"
        'sat_checkout_open',    // buka absen pulang sabtu, default "13:00"
        'sat_checkout_close',   // tutup absen pulang sabtu, default "13:00"
        'gps_radius',           // radius geofence meter, default "40"
        'hospital_lat',         // koordinat RS
        'hospital_lng',
        'logo_url',             // URL logo RS
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
            'system_active'      => 'sometimes|in:0,1',
            'checkin_open'       => 'sometimes|date_format:H:i',
            'late_limit'         => 'sometimes|date_format:H:i',
            'close_checkin'      => 'sometimes|date_format:H:i',
            'break_start'        => 'sometimes|date_format:H:i',
            'break_end'          => 'sometimes|date_format:H:i',
            'checkout_open'      => 'sometimes|date_format:H:i',
            'checkout_close'     => 'sometimes|date_format:H:i',
            'sat_checkout_open'  => 'sometimes|date_format:H:i',
            'sat_checkout_close' => 'sometimes|date_format:H:i',
            'gps_radius'         => 'sometimes|integer|min:10|max:1000',
            'hospital_lat'       => 'sometimes|numeric',
            'hospital_lng'       => 'sometimes|numeric',
            'logo_url'           => 'sometimes|string|nullable',
        ]);

        if ($request->has('logo_url')) {
            $logoInput = $request->input('logo_url');
            if ($logoInput && str_starts_with($logoInput, 'data:image/')) {
                // Hapus logo lama dari server storage sebelum menyimpan yang baru
                $this->deleteOldLogo();
                $logoPath = $this->storeBase64Logo($logoInput);
                if ($logoPath) {
                    Setting::set('logo_url', asset($logoPath));
                }
            } else if ($logoInput === '' || $logoInput === null || $logoInput === 'none') {
                // Hapus logo lama dari server storage jika admin menekan Hapus Logo
                $this->deleteOldLogo();
                Setting::set('logo_url', $logoInput ?? '');
            }
        }

        foreach (self::ALLOWED_KEYS as $key) {
            if ($key !== 'logo_url' && $request->has($key)) {
                Setting::set($key, (string) $request->input($key));
            }
        }

        return response()->json(['success' => true, 'message' => 'Pengaturan berhasil disimpan.']);
    }

    private function deleteOldLogo(): void
    {
        $currentLogo = Setting::get('logo_url');
        if ($currentLogo) {
            // Ambil path URL
            $parsed = parse_url($currentLogo, PHP_URL_PATH);
            if ($parsed) {
                // Hapus awalan "/storage/" untuk mencocokkan dengan Storage disk public
                if (str_starts_with($parsed, '/storage/')) {
                    $relativePath = substr($parsed, 9);
                    if (\Illuminate\Support\Facades\Storage::disk('public')->exists($relativePath)) {
                        \Illuminate\Support\Facades\Storage::disk('public')->delete($relativePath);
                    }
                }
            }
        }
    }

    private function storeBase64Logo(string $imgData): ?string
    {
        if (!preg_match('/^data:image\/(\w+);base64,/', $imgData, $type)) {
            return null;
        }
        $imgData = substr($imgData, strpos($imgData, ',') + 1);
        $type    = strtolower($type[1]); // png, jpg, jpeg, webp

        if (!in_array($type, ['jpg', 'jpeg', 'png', 'webp'])) {
            return null;
        }
        $decoded = base64_decode($imgData);
        if ($decoded === false) {
            return null;
        }

        $fileName = 'hospital_logo_' . time() . '.' . $type;
        \Illuminate\Support\Facades\Storage::disk('public')->put('logos/' . $fileName, $decoded);

        return '/storage/logos/' . $fileName;
    }

    private function defaults(string $key): string
    {
        return match ($key) {
            'system_active'      => '1',
            'checkin_open'       => '08:00',
            'late_limit'         => '08:30',
            'close_checkin'      => '09:00',
            'break_start'        => '12:30',
            'break_end'          => '13:30',
            'checkout_open'      => '17:00',
            'checkout_close'     => '18:00',
            'sat_checkout_open'  => '13:00',
            'sat_checkout_close' => '13:00',
            'gps_radius'         => '40',
            'hospital_lat'       => '5.552740480177099',
            'hospital_lng'       => '95.33486560781716',
            default              => '',
        };
    }
}
