<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$users = User::all();
echo "========================================================================\n";
echo "       DAFTAR HAK AKSES & PASSWORD SELURUH AKUN PENGGUNA RSUCL          \n";
echo "========================================================================\n";
printf("%-20s | %-30s | %-15s | %-12s | %-10s\n", "USERNAME", "NAMA LENGKAP", "ROLE", "PASSWORD", "NIK KTP");
echo "------------------------------------------------------------------------\n";

foreach ($users as $u) {
    // Standardize all passwords to 6-digit numeric "123456"
    $u->password = Hash::make('123456');
    $u->save();

    printf("%-20s | %-30s | %-15s | %-12s | %-10s\n", 
        $u->username, 
        mb_strimwidth($u->name, 0, 30, "..."), 
        $u->role, 
        "123456", 
        $u->nik_ktp ?: '-'
    );
}

echo "========================================================================\n";
echo "TOTAL AKUN: " . count($users) . " AKUN DENGAN PASSWORD ANGKA (123456)\n";
