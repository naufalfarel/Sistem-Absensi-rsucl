<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use Illuminate\Support\Facades\Schedule;

// Sinkronisasi Hari Libur Nasional otomatis setiap awal bulan
Schedule::command('attendance:sync-holidays')->monthly();

// Tandai karyawan Alpa secara otomatis setiap hari pukul 23:59
Schedule::command('attendance:mark-absent')->dailyAt('23:59');
