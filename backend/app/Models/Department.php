<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model Department
 * 
 * Merepresentasikan Unit kerja unit kerja di rumah sakit (misal: Keperawatan, IGD, Keuangan, dll).
 */
class Department extends Model
{
    // Kolom yang dapat diisi secara massal
    protected $fillable = ['name', 'count_sunday_in_leave'];

    protected $casts = [
        'count_sunday_in_leave' => 'boolean',
    ];

    /**
     * Relasi ke model Employee.
     * Satu departemen memiliki banyak karyawan.
     */
    public function employees()
    {
        return $this->hasMany(Employee::class);
    }
}
