<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

/**
 * Class SettingController
 * 
 * Mengelola konfigurasi dan parameter sistem absensi global.
 * Pengaturan mencakup batas toleransi waktu keterlambatan, geofence rumah sakit (koordinat latitude/longitude),
 * radius toleransi GPS, logo instansi, serta preferensi notifikasi sistem.
 */
class SettingController extends Controller
{
    // Kunci konfigurasi yang diizinkan untuk dibaca dan diperbarui melalui API
    private const ALLOWED_KEYS = [
        'system_active',            // Status keaktifan sistem absensi (1 = aktif, 0 = nonaktif)
        'checkin_open',             // Menit sebelum jadwal shift dimulai untuk pembukaan check-in (misal: 0)
        'late_limit',               // Toleransi menit keterlambatan (misal: 30)
        'close_checkin',            // Menit penutupan check-in setelah shift dimulai (misal: 60)
        'break_start',              // Jam mulai istirahat reguler (default "12:30")
        'break_end',                // Jam selesai istirahat reguler (default "13:30")
        'checkout_open',            // Menit sebelum jadwal shift berakhir untuk pembukaan check-out (misal: 0)
        'checkout_close',           // Menit penutupan check-out setelah shift berakhir (misal: 60)
        'sat_checkout_open',        // Pembukaan check-out hari Sabtu dalam menit
        'sat_checkout_close',       // Penutupan check-out hari Sabtu dalam menit
        'gps_radius',               // Radius geofence toleransi jarak dalam meter (misal: 40)
        'hospital_lat',             // Koordinat lintang (Latitude) Rumah Sakit RSUCL
        'hospital_lng',             // Koordinat bujur (Longitude) Rumah Sakit RSUCL
        'logo_url',                 // URL file gambar logo instansi
        'notif_email',              // Status pengiriman notifikasi email admin (1 = ya, 0 = tidak)
        'notif_late',               // Status notifikasi keterlambatan
        'notif_leave',              // Status notifikasi pengajuan cuti
        'notif_system',             // Status notifikasi aktivitas perubahan konfigurasi sistem
        // ── Kuota Cuti Tahunan ──
        'leave_reset_month',        // Bulan reset kuota cuti tahunan (1-12, default: 4 = April)
        'leave_reset_day',          // Tanggal reset kuota cuti tahunan (1-31, default: 1)
        'annual_leave_quota_days',  // Jumlah hari kuota cuti per tahun (default: 12)
        // ── Toleransi Pulang Cepat & Lembur ──
        'early_checkout_grace_minutes', // Toleransi menit sebelum dianggap pulang cepat (default: 15)
        'overtime_grace_minutes',       // Toleransi menit sebelum dianggap lembur (default: 15)
    ];

    /**
     * GET /api/settings
     * 
     * Mengambil seluruh data pengaturan sistem yang ada di database.
     * Jika konfigurasi belum ada di database, maka nilai default akan digunakan.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        // Ambil data dari tabel settings berdasarkan kunci yang terdaftar
        $all = Setting::whereIn('key', self::ALLOWED_KEYS)->get()->keyBy('key');

        $data = [];
        foreach (self::ALLOWED_KEYS as $key) {
            // Gunakan nilai dari database jika ada, jika tidak, panggil fungsi defaults()
            $data[$key] = $all->get($key)?->value ?? $this->defaults($key);
        }

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * PUT /api/settings
     * 
     * Memperbarui satu atau beberapa nilai konfigurasi sistem absensi.
     * Mendukung pemrosesan upload logo berupa string Base64.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request)
    {
        // Validasi input parameter konfigurasi
        $request->validate([
            'system_active'           => 'sometimes|in:0,1',
            'checkin_open'            => 'sometimes|integer|min:0|max:1440',
            'late_limit'              => 'sometimes|integer|min:0|max:1440',
            'close_checkin'           => 'sometimes|integer|min:0|max:1440',
            'break_start'             => 'sometimes|date_format:H:i',
            'break_end'               => 'sometimes|date_format:H:i',
            'checkout_open'           => 'sometimes|integer|min:0|max:1440',
            'checkout_close'          => 'sometimes|integer|min:0|max:1440',
            'sat_checkout_open'       => 'sometimes|integer|min:0|max:1440',
            'sat_checkout_close'      => 'sometimes|integer|min:0|max:1440',
            'gps_radius'              => 'sometimes|integer|min:10|max:1000',
            'hospital_lat'            => 'sometimes|numeric',
            'hospital_lng'            => 'sometimes|numeric',
            'logo_url'                => 'sometimes|string|nullable',
            'notif_email'             => 'sometimes|in:0,1',
            'notif_late'              => 'sometimes|in:0,1',
            'notif_leave'             => 'sometimes|in:0,1',
            'notif_system'            => 'sometimes|in:0,1',
            // Kuota Cuti Tahunan
            'leave_reset_month'               => 'sometimes|integer|min:1|max:12',
            'leave_reset_day'                 => 'sometimes|integer|min:1|max:31',
            'annual_leave_quota_days'         => 'sometimes|integer|min:1|max:365',
            // Toleransi Pulang Cepat & Lembur
            'early_checkout_grace_minutes'    => 'sometimes|integer|min:0|max:480',
            'overtime_grace_minutes'          => 'sometimes|integer|min:0|max:480',
        ]);

        // Proses khusus untuk upload logo instansi
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
                // Hapus logo lama jika parameter diset kosong/dihapus
                $this->deleteOldLogo();
                Setting::set('logo_url', $logoInput ?? '');
            }
        }

        // Simpan konfigurasi umum lainnya ke database
        foreach (self::ALLOWED_KEYS as $key) {
            if ($key !== 'logo_url' && $request->has($key)) {
                Setting::set($key, (string) $request->input($key));
            }
        }

        // Buat notifikasi sistem untuk seluruh administrator jika opsi notif_system diaktifkan
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

    /**
     * Menghapus file logo lama dari penyimpanan lokal storage public
     * jika ada, guna mencegah sampah file yang menumpuk.
     * 
     * @return void
     */
    private function deleteOldLogo(): void
    {
        $currentLogo = Setting::get('logo_url');
        if ($currentLogo) {
            // Ambil path relatif URL logo saat ini
            $parsed = parse_url($currentLogo, PHP_URL_PATH);
            if ($parsed) {
                // Konversi path URL absolute ke path Storage lokal Laravel
                if (str_starts_with($parsed, '/storage/')) {
                    $relativePath = substr($parsed, 9); // potong string '/storage/'
                    if (\Illuminate\Support\Facades\Storage::disk('public')->exists($relativePath)) {
                        \Illuminate\Support\Facades\Storage::disk('public')->delete($relativePath);
                    }
                }
            }
        }
    }

    /**
     * Menyimpan data Base64 gambar logo ke public storage disk.
     * 
     * @param string $imgData String Base64 gambar
     * @return string|null Path relatif file gambar yang berhasil disimpan
     */
    private function storeBase64Logo(string $imgData): ?string
    {
        // Validasi header format Base64 image
        if (!preg_match('/^data:image\/(\w+);base64,/', $imgData, $type)) {
            return null;
        }
        $imgData = substr($imgData, strpos($imgData, ',') + 1);
        $type    = strtolower($type[1]); // Ekstensi gambar: png, jpg, jpeg, webp

        if (!in_array($type, ['jpg', 'jpeg', 'png', 'webp'])) {
            return null;
        }
        $decoded = base64_decode($imgData);
        if ($decoded === false) {
            return null;
        }

        // Tentukan nama file secara acak/unik dan simpan di folder 'logos/'
        $fileName = 'hospital_logo_' . time() . '.' . $type;
        \Illuminate\Support\Facades\Storage::disk('public')->put('logos/' . $fileName, $decoded);

        return '/storage/logos/' . $fileName;
    }

    /**
     * Mendapatkan nilai konfigurasi default untuk sistem absensi.
     * Digunakan apabila database kosong atau key belum terdaftar.
     * 
     * @param string $key Nama kunci konfigurasi
     * @return string Nilai bawaan sistem
     */
    private function defaults(string $key): string
    {
        return match ($key) {
            'system_active'           => '1',
            'checkin_open'            => '0',
            'late_limit'              => '30',
            'close_checkin'           => '60',
            'break_start'             => '12:30',
            'break_end'               => '13:30',
            'checkout_open'           => '0',
            'checkout_close'          => '60',
            'sat_checkout_open'       => '0',
            'sat_checkout_close'      => '60',
            'gps_radius'              => '40',
            'hospital_lat'            => '5.552740480177099',
            'hospital_lng'            => '95.33486560781716',
            'notif_email'             => '1',
            'notif_late'              => '1',
            'notif_leave'             => '1',
            'notif_system'            => '0',
            // Kuota Cuti Tahunan
            'leave_reset_month'               => '4',
            'leave_reset_day'                 => '1',
            'annual_leave_quota_days'         => '12',
            // Toleransi Pulang Cepat & Lembur
            'early_checkout_grace_minutes'    => '15',
            'overtime_grace_minutes'          => '15',
            default                           => '',
        };
    }
}
