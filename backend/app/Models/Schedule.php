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
    protected $fillable = [
        'parent_id', 'name', 'start_time', 'end_time', 'color', 'icon', 'shift_type',
        'owner_department_id', 'created_by', 'updated_by'
    ];

    /**
     * Relasi ke model parent Schedule.
     */
    public function parent()
    {
        return $this->belongsTo(Schedule::class, 'parent_id');
    }

    /**
     * Relasi ke model child Schedule.
     */
    public function children()
    {
        return $this->hasMany(Schedule::class, 'parent_id');
    }

    /**
     * Relasi many-to-many ke model Employee.
     * Jadwal shift ini dapat ditugaskan ke banyak karyawan di hari kerja tertentu ('day_of_week').
     */
    public function employees()
    {
        return $this->belongsToMany(Employee::class, 'employee_schedule')
                    ->withPivot('day_of_week', 'work_date')
                    ->withTimestamps();
    }

    /**
     * Relasi ke model Department pemilik shift ini.
     */
    public function ownerDepartment()
    {
        return $this->belongsTo(Department::class, 'owner_department_id');
    }

    /**
     * Relasi ke pembuat shift.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relasi ke pengubah shift terakhir.
     */
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
