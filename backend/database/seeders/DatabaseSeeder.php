<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Position;
use App\Models\Schedule;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. Departemen ──────────────────────────────────────────────
        $departments = [
            'Poli Umum', 'ICU', 'IGD', 'Farmasi', 'Laboratorium', 'Administrasi', 'Radiologi', 'Bedah',
            'Keuangan', 'IT', 'Pajak', 'HRD', 'Casemix', 'Asuransi', 'Kabag Pelayanan Medik',
            'Kepala Instalasi Rawat Inap', 'Kepala Instalasi Rawat Jalan', 'Penanggung Jawab',
            'Koordinator Resepsionis & RM IGD', 'Kasir', 'Instalasi Gawat Darurat',
            'Jeumpa A', 'Jeumpa B', 'Seulanga', 'Meulu', 'Kupula', 'Transit',
            'Instalasi Kamar Bersalin', 'NICU', 'Instalasi Rawat Jalan', 'Poli Eksekutif',
            'Rekam Medis dan Penyimpanan', 'Bagian Mobile JKN', 'Bagian Pembuatan Akta Kelahiran',
            'Resepsionis Rawat Jalan', 'Rekam Medis IGD', 'Farmasi Poli Rawat Jalan',
            'Depo 1', 'Depo 2', 'Depo 3', 'Depo 4', 'Depo Poli Eksekutif', 'Gudang Farmasi',
            'Instalasi Bedah Sentral', 'Instalasi CSSD', 'Instalasi Gas Medis', 'Instalasi Laundry',
            'IPSRS', 'ATEM', 'Taman', 'Juru Masak', 'Pramusaji', 'Instalasi Ambulance',
            'Transporter', 'IPSL', 'Cleaning Service Kantor', 'RO (Air)',
        ];
        $deptMap = [];
        foreach ($departments as $name) {
            $deptMap[$name] = Department::create(['name' => $name])->id;
        }

        // ── 2. Jabatan ─────────────────────────────────────────────────
        $positions = [
            'Dokter Umum', 'Dokter Spesialis', 'Perawat', 'Apoteker',
            'Analis Lab', 'Staff Admin', 'Radiografer', 'Kepala Bagian',
        ];
        $posMap = [];
        foreach ($positions as $name) {
            $posMap[$name] = Position::create(['name' => $name])->id;
        }

        // ── 3. Admin ───────────────────────────────────────────────────
        User::create([
            'name'     => 'Administrator RSUCL',
            'email'    => 'admin@rsucl.id',
            'password' => Hash::make('123456'),
            'role'     => 'admin',
            'nik_ktp'  => 'ADMIN001',
            'username' => 'admin',
        ]);

        // ── 4. Karyawan ────────────────────────────────────────────────
        $employees = [
            [
                'name'     => 'Dr. Rina Kusumawati',
                'email'    => 'rina.k@rsucl.id',
                'nik_ktp'  => '198501012010012001',
                'username' => 'rina.kusumawati',
                'password' => '123456',
                'dept'     => 'Poli Umum',
                'pos'      => 'Dokter Umum',
                'phone'    => '081234567890',
                'gender'   => 'Perempuan',
                'join'     => '2010-03-01',
            ],
            [
                'name'     => 'Ns. Ahmad Fauzi',
                'email'    => 'ahmad.f@rsucl.id',
                'nik_ktp'  => '198805122012011002',
                'username' => 'ahmad.fauzi',
                'password' => '123456',
                'dept'     => 'ICU',
                'pos'      => 'Perawat',
                'phone'    => '082345678901',
                'gender'   => 'Laki-laki',
                'join'     => '2012-07-15',
            ],
            [
                'name'     => 'Rini Handayani',
                'email'    => 'rini.h@rsucl.id',
                'nik_ktp'  => '199508152018012007',
                'username' => 'rini.handayani',
                'password' => '123456',
                'dept'     => 'Farmasi',
                'pos'      => 'Apoteker',
                'phone'    => '087890123456',
                'gender'   => 'Perempuan',
                'join'     => '2018-09-01',
            ],
        ];

        foreach ($employees as $emp) {
            $user = User::create([
                'name'     => $emp['name'],
                'email'    => $emp['email'],
                'password' => Hash::make($emp['password']),
                'role'     => 'employee',
                'nik_ktp'  => $emp['nik_ktp'],
                'username' => $emp['username'],
            ]);

            Employee::create([
                'user_id'       => $user->id,
                'department_id' => $deptMap[$emp['dept']],
                'position_id'   => $posMap[$emp['pos']],
                'nik_ktp'       => $emp['nik_ktp'],
                'phone'         => $emp['phone'],
                'gender'        => $emp['gender'],
                'join_date'     => $emp['join'],
            ]);
        }

        // ── 5. Jadwal Shift Default (14 Shift Templates & Sub-shifts) ──
        $shiftsData = [
            [
                'parent' => ['name' => 'Reguler Kantor (08:30–17:00)', 'color' => '#16A34A', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Normal (08:30–17:00)', 'start_time' => '08:30:00', 'end_time' => '17:00:00', 'color' => '#16A34A', 'icon' => 'sun'],
                ]
            ],
            [
                'parent' => ['name' => 'Rotasi 3-Waktu Pelayanan 24 Jam', 'color' => '#D97706', 'icon' => 'zap'],
                'children' => [
                    ['name' => 'Pagi (08:00–14:00)', 'start_time' => '08:00:00', 'end_time' => '14:00:00', 'color' => '#D97706', 'icon' => 'sunrise'],
                    ['name' => 'Siang (14:00–20:00)', 'start_time' => '14:00:00', 'end_time' => '20:00:00', 'color' => '#2563EB', 'icon' => 'sunset'],
                    ['name' => 'Malam (20:00–08:00)', 'start_time' => '20:00:00', 'end_time' => '08:00:00', 'color' => '#7C3AED', 'icon' => 'moon'],
                ]
            ],
            [
                'parent' => ['name' => 'Poliklinik Rawat Jalan', 'color' => '#10B981', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Pagi (07:45–15:00)', 'start_time' => '07:45:00', 'end_time' => '15:00:00', 'color' => '#10B981', 'icon' => 'sun'],
                    ['name' => 'Siang (15:00–22:00)', 'start_time' => '15:00:00', 'end_time' => '22:00:00', 'color' => '#0284C7', 'icon' => 'sunset'],
                ]
            ],
            [
                'parent' => ['name' => 'Poli Eksekutif', 'color' => '#10B981', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Pagi (07:30–14:30)', 'start_time' => '07:30:00', 'end_time' => '14:30:00', 'color' => '#10B981', 'icon' => 'sun'],
                    ['name' => 'Siang (14:30–21:30)', 'start_time' => '14:30:00', 'end_time' => '21:30:00', 'color' => '#0284C7', 'icon' => 'sunset'],
                ]
            ],
            [
                'parent' => ['name' => 'Administrasi Senin–Sabtu', 'color' => '#16A34A', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Senin–Jumat (08:00–16:00)', 'start_time' => '08:00:00', 'end_time' => '16:00:00', 'color' => '#16A34A', 'icon' => 'sun'],
                    ['name' => 'Sabtu (08:00–13:00)', 'start_time' => '08:00:00', 'end_time' => '13:00:00', 'color' => '#F59E0B', 'icon' => 'calendar'],
                ]
            ],
            [
                'parent' => ['name' => 'Resepsionis Rawat Jalan', 'color' => '#D97706', 'icon' => 'sunrise'],
                'children' => [
                    ['name' => 'Pagi (07:00–14:00)', 'start_time' => '07:00:00', 'end_time' => '14:00:00', 'color' => '#D97706', 'icon' => 'sunrise'],
                    ['name' => 'Siang (14:00–22:00)', 'start_time' => '14:00:00', 'end_time' => '22:00:00', 'color' => '#2563EB', 'icon' => 'sunset'],
                ]
            ],
            [
                'parent' => ['name' => 'Farmasi Rawat Jalan', 'color' => '#D97706', 'icon' => 'sunrise'],
                'children' => [
                    ['name' => 'Pagi (08:00–15:00)', 'start_time' => '08:00:00', 'end_time' => '15:00:00', 'color' => '#D97706', 'icon' => 'sunrise'],
                    ['name' => 'Siang (15:00–22:00)', 'start_time' => '15:00:00', 'end_time' => '22:00:00', 'color' => '#2563EB', 'icon' => 'sunset'],
                ]
            ],
            [
                'parent' => ['name' => 'Depo Poli Eksekutif', 'color' => '#7C3AED', 'icon' => 'moon'],
                'children' => [
                    ['name' => 'Pagi (08:00–15:00)', 'start_time' => '08:00:00', 'end_time' => '15:00:00', 'color' => '#D97706', 'icon' => 'sunrise'],
                    ['name' => 'Siang (15:00–22:00)', 'start_time' => '15:00:00', 'end_time' => '22:00:00', 'color' => '#2563EB', 'icon' => 'sunset'],
                    ['name' => 'Malam (20:00–08:00)', 'start_time' => '20:00:00', 'end_time' => '08:00:00', 'color' => '#7C3AED', 'icon' => 'moon'],
                ]
            ],
            [
                'parent' => ['name' => 'Laundry', 'color' => '#16A34A', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Laundry Pagi Sen-Jum (07:00–17:00)', 'start_time' => '07:00:00', 'end_time' => '17:00:00', 'color' => '#16A34A', 'icon' => 'sun'],
                    ['name' => 'Laundry Siang Sen-Jum (14:30–22:00)', 'start_time' => '14:30:00', 'end_time' => '22:00:00', 'color' => '#2563EB', 'icon' => 'sunset'],
                    ['name' => 'Laundry Sabtu (07:00–22:00)', 'start_time' => '07:00:00', 'end_time' => '22:00:00', 'color' => '#F59E0B', 'icon' => 'calendar'],
                ]
            ],
            [
                'parent' => ['name' => 'Reguler Kantor (08:00–17:00)', 'color' => '#16A34A', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Normal (08:00–17:00)', 'start_time' => '08:00:00', 'end_time' => '17:00:00', 'color' => '#16A34A', 'icon' => 'sun'],
                ]
            ],
            [
                'parent' => ['name' => 'Dapur Gizi', 'color' => '#D97706', 'icon' => 'sunrise'],
                'children' => [
                    ['name' => 'Pagi (06:00–13:00)', 'start_time' => '06:00:00', 'end_time' => '13:00:00', 'color' => '#D97706', 'icon' => 'sunrise'],
                    ['name' => 'Siang (12:00–19:00)', 'start_time' => '12:00:00', 'end_time' => '19:00:00', 'color' => '#2563EB', 'icon' => 'sunset'],
                    ['name' => 'Malam (22:00–07:00)', 'start_time' => '22:00:00', 'end_time' => '07:00:00', 'color' => '#7C3AED', 'icon' => 'moon'],
                ]
            ],
            [
                'parent' => ['name' => 'Shift 24 Jam', 'color' => '#EF4444', 'icon' => 'clock'],
                'children' => [
                    ['name' => '24 Jam (08:00–08:00)', 'start_time' => '08:00:00', 'end_time' => '08:00:00', 'color' => '#EF4444', 'icon' => 'clock'],
                ]
            ],
            [
                'parent' => ['name' => 'Transporter', 'color' => '#D97706', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Pagi 12J (08:00–20:00)', 'start_time' => '08:00:00', 'end_time' => '20:00:00', 'color' => '#D97706', 'icon' => 'sun'],
                    ['name' => 'Siang 11J (13:00–00:00)', 'start_time' => '13:00:00', 'end_time' => '00:00:00', 'color' => '#2563EB', 'icon' => 'sunset'],
                    ['name' => 'Pagi 9J (08:00–17:00)', 'start_time' => '08:00:00', 'end_time' => '17:00:00', 'color' => '#10B981', 'icon' => 'sun'],
                    ['name' => 'Siang 9J (15:00–00:00)', 'start_time' => '15:00:00', 'end_time' => '00:00:00', 'color' => '#0284C7', 'icon' => 'sunset'],
                ]
            ],
            [
                'parent' => ['name' => 'Cleaning Service Kantor', 'color' => '#16A34A', 'icon' => 'sun'],
                'children' => [
                    ['name' => 'Normal (07:00–17:00)', 'start_time' => '07:00:00', 'end_time' => '17:00:00', 'color' => '#16A34A', 'icon' => 'sun'],
                ]
            ],
            [
                'parent' => ['name' => 'Libur Jaga (LJ)', 'color' => '#475569', 'icon' => 'moon'],
                'children' => [
                    ['name' => 'Libur Jaga (00:00–00:00)', 'start_time' => '00:00:00', 'end_time' => '00:00:00', 'color' => '#475569', 'icon' => 'moon'],
                ]
            ],
        ];

        foreach ($shiftsData as $data) {
            // Cek apakah shift dengan kemiripan nama reguler sudah ada (untuk gabung & hindari duplikat)
            $existing = null;
            if ($data['parent']['name'] === 'Reguler Kantor (08:30–17:00)') {
                $existing = Schedule::where('name', 'like', '%Reguler pagi%')->first();
            }

            if ($existing) {
                $existing->update([
                    'parent_id'  => null,
                    'name'       => $data['parent']['name'],
                    'color'      => $data['parent']['color'],
                    'icon'       => $data['parent']['icon'],
                    'shift_type' => 'normal',
                ]);
                $parent = $existing;
            } else {
                $parent = Schedule::create([
                    'parent_id'  => null,
                    'name'       => $data['parent']['name'],
                    'color'      => $data['parent']['color'],
                    'icon'       => $data['parent']['icon'],
                    'shift_type' => 'normal',
                ]);
            }

            foreach ($data['children'] as $childData) {
                // Hindari duplikat anak jika seeder dipanggil berulang kali
                Schedule::updateOrCreate(
                    ['parent_id' => $parent->id, 'name' => $childData['name']],
                    [
                        'start_time' => $childData['start_time'],
                        'end_time'   => $childData['end_time'],
                        'color'      => $childData['color'],
                        'icon'       => $childData['icon'],
                        'shift_type' => 'normal',
                    ]
                );
            }
        }

        // ── 6. Pengaturan Default ──────────────────────────────────────
        $defaults = [
            'system_active'      => '1',
            'checkin_open'       => '0',
            'late_limit'         => '30',
            'close_checkin'      => '60',
            'checkout_open'      => '0',
            'checkout_close'     => '60',
            'sat_checkout_open'  => '0',
            'sat_checkout_close' => '60',
            'gps_radius'         => '10',
            'hospital_lat'       => '5.552740480177099',
            'hospital_lng'       => '95.33486560781716',
        ];
        foreach ($defaults as $key => $value) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value]);
        }

        // Seeder Kategori Cuti Khusus
        $this->call(SpecialLeaveCategorySeeder::class);
        $this->call(HolidaySeeder::class);
    }
}
