<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$departments = \App\Models\Department::all();
echo "--- DAFTAR DEPARTEMEN & ATURAN HARI MINGGU ---\n";
foreach ($departments as $d) {
    $status = $d->count_sunday_in_leave ? "🟢 HITUNG MINGGU (Unit Shift 24h)" : "⚪ MINGGU LIBUR (Reguler)";
    echo sprintf("%-35s => %s\n", $d->name, $status);
}
