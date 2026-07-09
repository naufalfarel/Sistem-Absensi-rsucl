<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model Notification
 * 
 * Merepresentasikan data notifikasi sistem yang ditujukan untuk user (admin maupun karyawan).
 * Menyimpan judul, isi notifikasi, tipe, data tambahan berformat json, dan waktu dibaca.
 */
class Notification extends Model
{
    // Kolom yang dapat diisi secara massal
    protected $fillable = ['user_id', 'title', 'body', 'type', 'read_at', 'data'];

    // Cast tipe data otomatis
    protected $casts = [
        'read_at' => 'datetime',
        'data'    => 'array', // Menyimpan payload data kustom/json
    ];

    /**
     * Relasi ke model User.
     * Setiap notifikasi ditujukan ke satu pengguna tertentu.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Accessor untuk mengecek status keterbacaan notifikasi.
     * 
     * @return bool True jika sudah dibaca (read_at tidak null)
     */
    public function getIsReadAttribute(): bool
    {
        return $this->read_at !== null;
    }
}
