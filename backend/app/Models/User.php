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
 * Akun dapat berstatus role: 'admin', 'employee', atau 'pj_bagian'.
 * 
 * PJ Bagian (Penanggung Jawab Bagian) adalah level otoritas di antara employee dan admin,
 * terikat pada satu departemen tertentu via kolom pj_bagian_department_id.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    // Kolom-kolom yang dapat diisi secara massal
    protected $fillable = [
        'name', 'email', 'password', 'role', 'nik_ktp', 'username',
        'profile_picture', 'pj_bagian_department_id',
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
     * Pengguna dengan role 'employee' atau 'pj_bagian' terhubung ke satu profile data karyawan.
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
     * Relasi ke departemen yang diawasi (khusus PJ Bagian).
     */
    public function pjBagianDepartment()
    {
        return $this->belongsTo(Department::class, 'pj_bagian_department_id');
    }

    /**
     * Memeriksa apakah pengguna memiliki role admin atau super admin.
     * 
     * @return bool True jika role adalah 'admin' atau 'super_admin'
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin' || $this->role === 'super_admin';
    }

    /**
     * Memeriksa apakah pengguna adalah Super Admin (Direktur RSUCL).
     * 
     * @return bool True jika role adalah 'super_admin'
     */
    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    /**
     * Memeriksa apakah pengguna adalah PJ Bagian.
     * 
     * @return bool True jika role adalah 'pj_bagian'
     */
    public function isPjBagian(): bool
    {
        return $this->role === 'pj_bagian';
    }

    /**
     * Memeriksa apakah pengguna adalah Admin, Super Admin, ATAU PJ Bagian.
     * Digunakan untuk gate akses endpoint yang boleh diakses ketiganya.
     * 
     * @return bool
     */
    public function isPjOrAdmin(): bool
    {
        return $this->role === 'admin' || $this->role === 'super_admin' || $this->role === 'pj_bagian';
    }
}
