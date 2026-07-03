<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$settings = [
    'checkin_open'       => '08:00',
    'break_start'        => '12:30',
    'break_end'          => '13:30',
    'sat_checkout_open'  => '13:00',
    'sat_checkout_close' => '13:00',
];

foreach ($settings as $key => $value) {
    \App\Models\Setting::set($key, $value);
    echo "Set $key = $value\n";
}
echo "Done.\n";
