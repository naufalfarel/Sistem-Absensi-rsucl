<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeRegistration extends Model
{
    use HasFactory;

    protected $fillable = [
        'registration_number',
        'name',
        'nik_ktp',
        'email',
        'phone',
        'gender',
        'department_id',
        'position_id',
        'status',
        'admin_note',
        'temp_password_encrypted',
        'user_id',
        'employee_id',
        'motor_plate_1',
        'motor_plate_2',
        'car_plate_1',
        'car_plate_2',
        'instagram',
        'facebook',
        'tiktok',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
