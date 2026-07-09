<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model Schedule
 * 
 * Merepresentasikan data jadwal shift kerja (misal: Pagi, Siang, Malam, Off).
 * Menyimpan nama shift, jam masuk, jam pulang, serta properti visual (warna dan ikon).
 */
class Schedule extends Model
{
    // Kolom yang dapat diisi secara massal
    protected $fillable = ['name', 'start_time', 'end_time', 'color', 'icon'];

    /**
     * Relasi many-to-many ke model Employee.
     * Jadwal shift ini dapat ditugaskan ke banyak karyawan di hari kerja tertentu ('day_of_week').
     */
    public function employees()
    {
        return $this->belongsToMany(Employee::class, 'employee_schedule')
                    ->withPivot('day_of_week')
                    ->withTimestamps();
    }
}
