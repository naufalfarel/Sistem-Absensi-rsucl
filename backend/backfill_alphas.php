<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

for ($i = 1; $i <= 30; $i++) {
    $date = '2026-09-' . str_pad($i, 2, '0', STR_PAD_LEFT);
    \Illuminate\Support\Facades\Artisan::call('attendance:mark-absent', ['date' => $date]);
    echo $date . ": " . \Illuminate\Support\Facades\Artisan::output();
}
echo "Done!\n";
