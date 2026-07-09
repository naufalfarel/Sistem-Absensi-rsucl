<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model Position
 * 
 * Merepresentasikan jabatan struktural atau fungsional karyawan di rumah sakit (misal: Perawat, Dokter, Staff IT, dll).
 */
class Position extends Model
{
    // Kolom yang dapat diisi secara massal
    protected $fillable = ['name'];

    /**
     * Relasi ke model Employee.
     * Satu jabatan dapat dimiliki oleh banyak karyawan.
     */
    public function employees()
    {
        return $this->hasMany(Employee::class);
    }
}
