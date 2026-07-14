<?php

namespace Database\Seeders;

use App\Models\Holiday;
use Illuminate\Database\Seeder;

class HolidaySeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 
     * Tanggal libur berbasis kalender Hijriah adalah perkiraan, admin WAJIB verifikasi dan perbarui lewat menu Kalender Libur setiap tahun.
     */
    public function run(): void
    {
        // Daftar hari libur nasional Indonesia untuk tahun berjalan (2026)
        $holidays = [
            ['date' => '2026-01-01', 'name' => 'Tahun Baru 2026 Masehi'],
            ['date' => '2026-01-29', 'name' => 'Tahun Baru Imlek 2577 Kongzili'],
            ['date' => '2026-02-15', 'name' => 'Isra Mikraj Nabi Muhammad SAW'],
            ['date' => '2026-03-19', 'name' => 'Hari Suci Nyepi Tahun Baru Saka 1948'],
            ['date' => '2026-03-20', 'name' => 'Hari Raya Idul Fitri 1447 Hijriah (Hari 1)'],
            ['date' => '2026-03-21', 'name' => 'Hari Raya Idul Fitri 1447 Hijriah (Hari 2)'],
            ['date' => '2026-04-03', 'name' => 'Wafat Yesus Kristus'],
            ['date' => '2026-04-05', 'name' => 'Hari Paskah'],
            ['date' => '2026-05-01', 'name' => 'Hari Buruh Internasional'],
            ['date' => '2026-05-13', 'name' => 'Hari Raya Waisak 2570 BE'],
            ['date' => '2026-05-14', 'name' => 'Kenaikan Yesus Kristus'],
            ['date' => '2026-05-27', 'name' => 'Hari Raya Idul Adha 1447 Hijriah'],
            ['date' => '2026-06-01', 'name' => 'Hari Lahir Pancasila'],
            ['date' => '2026-06-16', 'name' => 'Tahun Baru Islam 1448 Hijriah'],
            ['date' => '2026-08-17', 'name' => 'Hari Kemerdekaan Republik Indonesia'],
            ['date' => '2026-08-25', 'name' => 'Maulid Nabi Muhammad SAW'],
            ['date' => '2026-12-25', 'name' => 'Hari Raya Natal'],
        ];

        foreach ($holidays as $h) {
            Holiday::updateOrCreate(
                ['date' => $h['date']],
                ['name' => $h['name']]
            );
        }
    }
}
