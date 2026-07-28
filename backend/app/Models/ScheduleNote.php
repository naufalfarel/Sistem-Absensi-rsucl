<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleNote extends Model
{
    protected $fillable = [
        'department_id', 'year', 'month', 'note', 'created_by', 'updated_by'
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
