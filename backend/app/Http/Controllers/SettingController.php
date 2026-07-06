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
        'notif_email',          // pengaturan notifikasi admin
        'notif_late',
        'notif_leave',
        'notif_system',
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
            'checkin_open'       => 'sometimes|integer|min:0|max:1440',
            'late_limit'         => 'sometimes|integer|min:0|max:1440',
            'close_checkin'      => 'sometimes|integer|min:0|max:1440',
            'break_start'        => 'sometimes|date_format:H:i',
            'break_end'          => 'sometimes|date_format:H:i',
            'checkout_open'      => 'sometimes|integer|min:0|max:1440',
            'checkout_close'     => 'sometimes|integer|min:0|max:1440',
            'sat_checkout_open'  => 'sometimes|integer|min:0|max:1440',
            'sat_checkout_close' => 'sometimes|integer|min:0|max:1440',
            'gps_radius'         => 'sometimes|integer|min:10|max:1000',
            'hospital_lat'       => 'sometimes|numeric',
            'hospital_lng'       => 'sometimes|numeric',
            'logo_url'           => 'sometimes|string|nullable',
            'notif_email'        => 'sometimes|in:0,1',
            'notif_late'         => 'sometimes|in:0,1',
            'notif_leave'        => 'sometimes|in:0,1',
            'notif_system'       => 'sometimes|in:0,1',
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

        // Buat notifikasi sistem jika diaktifkan
        $notifSystem = Setting::get('notif_system', '0');
        if ($notifSystem !== '0') {
            $admins = \App\Models\User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $admin->id,
                    'title'   => 'Konfigurasi Sistem Diperbarui',
                    'body'    => 'Pengaturan sistem absensi RSUCL telah diperbarui oleh ' . $request->user()->name . '.',
                    'type'    => 'system',
                    'data'    => ['updated_by' => $request->user()->id],
                ]);
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
            'checkin_open'       => '0',
            'late_limit'         => '30',
            'close_checkin'      => '60',
            'break_start'        => '12:30',
            'break_end'          => '13:30',
            'checkout_open'      => '0',
            'checkout_close'     => '60',
            'sat_checkout_open'  => '0',
            'sat_checkout_close' => '60',
            'gps_radius'         => '40',
            'hospital_lat'       => '5.552740480177099',
            'hospital_lng'       => '95.33486560781716',
            'notif_email'        => '1',
            'notif_late'         => '1',
            'notif_leave'        => '1',
            'notif_system'       => '0',
            default              => '',
        };
    }
}
