<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use Illuminate\Support\Facades\Schedule;

// Sinkronisasi Hari Libur Nasional otomatis setiap awal bulan
Schedule::command('attendance:sync-holidays')->monthly();

// Rekonsiliasi Alpha berkala; aman dijalankan berulang karena tidak membuat duplikasi.
Schedule::command('attendance:mark-absent')
    ->everyTenMinutes()
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping();
