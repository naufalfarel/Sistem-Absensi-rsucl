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
            'Poli Umum', 'ICU', 'IGD', 'Farmasi', 'Laboratorium', 'Administrasi',
            'Radiologi', 'Bedah',
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
            'password' => Hash::make('Admin@RSUCL2025'),
            'role'     => 'admin',
            'nip'      => 'ADMIN001',
            'username' => 'admin',
        ]);

        // ── 4. Karyawan ────────────────────────────────────────────────
        $employees = [
            [
                'name'     => 'Dr. Rina Kusumawati',
                'email'    => 'rina.k@rsucl.id',
                'nip'      => '198501012010012001',
                'username' => 'rina.kusumawati',
                'password' => 'Karyawan@RSUCL1',
                'dept'     => 'Poli Umum',
                'pos'      => 'Dokter Umum',
                'phone'    => '081234567890',
                'gender'   => 'Perempuan',
                'join'     => '2010-03-01',
            ],
            [
                'name'     => 'Ns. Ahmad Fauzi',
                'email'    => 'ahmad.f@rsucl.id',
                'nip'      => '198805122012011002',
                'username' => 'ahmad.fauzi',
                'password' => 'Karyawan@RSUCL2',
                'dept'     => 'ICU',
                'pos'      => 'Perawat',
                'phone'    => '082345678901',
                'gender'   => 'Laki-laki',
                'join'     => '2012-07-15',
            ],
            [
                'name'     => 'Rini Handayani',
                'email'    => 'rini.h@rsucl.id',
                'nip'      => '199508152018012007',
                'username' => 'rini.handayani',
                'password' => 'Karyawan@RSUCL3',
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
                'nip'      => $emp['nip'],
                'username' => $emp['username'],
            ]);

            Employee::create([
                'user_id'       => $user->id,
                'department_id' => $deptMap[$emp['dept']],
                'position_id'   => $posMap[$emp['pos']],
                'nip'           => $emp['nip'],
                'phone'         => $emp['phone'],
                'gender'        => $emp['gender'],
                'join_date'     => $emp['join'],
            ]);
        }

        // ── 5. Jadwal Shift Default ────────────────────────────────────
        Schedule::insert([
            ['name' => 'Reguler',  'start_time' => '08:00:00', 'end_time' => '17:00:00', 'color' => '#16A34A', 'icon' => 'sun',    'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Pagi',     'start_time' => '07:00:00', 'end_time' => '14:00:00', 'color' => '#D97706', 'icon' => 'sunrise','created_at' => now(), 'updated_at' => now()],
            ['name' => 'Siang',    'start_time' => '14:00:00', 'end_time' => '21:00:00', 'color' => '#2563EB', 'icon' => 'sunset', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Malam',    'start_time' => '21:00:00', 'end_time' => '07:00:00', 'color' => '#7C3AED', 'icon' => 'moon',   'created_at' => now(), 'updated_at' => now()],
        ]);

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
            'gps_radius'         => '40',
            'hospital_lat'       => '5.552740480177099',
            'hospital_lng'       => '95.33486560781716',
        ];
        foreach ($defaults as $key => $value) {
            Setting::create(['key' => $key, 'value' => $value]);
        }

        // Seeder Kategori Cuti Khusus
        $this->call(SpecialLeaveCategorySeeder::class);
        $this->call(HolidaySeeder::class);
    }
}
