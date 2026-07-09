<?php

namespace App\Models;

use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * Model User
 * 
 * Merepresentasikan akun pengguna sistem yang terintegrasi dengan Laravel Sanctum untuk otentikasi API.
 * Akun dapat berstatus role 'admin' atau 'employee'.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    // Kolom-kolom yang dapat diisi secara massal
    protected $fillable = [
        'name', 'email', 'password', 'role', 'nip', 'username', 'profile_picture',
    ];

    // Kolom-kolom yang disembunyikan dalam representasi JSON (misal saat API response)
    protected $hidden = [
        'password', 'remember_token',
    ];

    // Tipe data casting bawaan Laravel
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed', // Meng-hash password secara otomatis saat disimpan
        ];
    }

    /** 
     * Relasi ke model Employee.
     * Pengguna dengan role 'employee' terhubung ke satu profile data karyawan.
     */
    public function employee()
    {
        return $this->hasOne(Employee::class);
    }

    /** 
     * Relasi ke model Notification.
     * Seorang pengguna dapat menerima banyak notifikasi dari sistem.
     */
    public function notifications()
    {
        return $this->hasMany(Notification::class);
    }

    /**
     * Memeriksa apakah pengguna memiliki role admin.
     * 
     * @return bool True jika role adalah 'admin'
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}
