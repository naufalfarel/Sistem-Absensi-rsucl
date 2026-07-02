<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    protected $fillable = ['name', 'start_time', 'end_time', 'color', 'icon'];

    public function employees()
    {
        return $this->belongsToMany(Employee::class, 'employee_schedule')
                    ->withPivot('day_of_week')
                    ->withTimestamps();
    }
}
