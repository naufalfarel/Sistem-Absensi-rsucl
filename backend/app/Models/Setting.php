<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model Setting
 * 
 * Mengelola konfigurasi sistem absensi global berbasis key-value pair.
 * Contoh setting: nama instansi, koordinat geofence rumah sakit (latitude, longitude), radius toleransi jarak, dll.
 */
class Setting extends Model
{
    // Kolom yang dapat diisi secara massal
    protected $fillable = ['key', 'value'];

    /**
     * Mengambil nilai konfigurasi berdasarkan key.
     * Jika key tidak ditemukan, akan mengembalikan nilai default yang ditentukan.
     * 
     * @param string $key Nama kunci konfigurasi
     * @param mixed $default Nilai kembalian default jika key tidak ada
     * @return mixed Nilai setting atau default
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        return static::where('key', $key)->value('value') ?? $default;
    }

    /**
     * Menyimpan baru atau memperbarui konfigurasi sistem absensi.
     * 
     * @param string $key Nama kunci konfigurasi
     * @param mixed $value Nilai baru yang akan disimpan
     * @return void
     */
    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
