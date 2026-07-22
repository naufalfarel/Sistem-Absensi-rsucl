<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

return new class extends Migration
{
    public function up(): void
    {
        // Buat akun Super Admin bawaan (Direktur RSUCL) jika belum ada
        if (!User::where('role', 'super_admin')->exists()) {
            User::create([
                'name'     => 'Direktur Utama RSUCL',
                'username' => 'superadmin',
                'email'    => 'direktur@rsucl.id',
                'password' => Hash::make('123456'),
                'role'     => 'super_admin',
                'nik_ktp'  => 'SUPERADMIN001',
            ]);
        }
    }

    public function down(): void
    {
        User::where('username', 'superadmin')->where('role', 'super_admin')->delete();
    }
};
