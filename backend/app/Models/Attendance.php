<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Attendance extends Model
{
    use SoftDeletes;

    protected $table = 'attendance';

    protected $fillable = [
        'employee_id', 'date', 'check_in', 'check_out',
        'status', 'latitude', 'longitude', 'accuracy',
        'is_within_geofence', 'note',
        'image_check_in', 'image_check_out',
    ];

    protected $casts = [
        'date'             => 'date',
        'is_within_geofence' => 'boolean',
        'accuracy'         => 'float',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /** Hitung durasi kerja dalam menit */
    public function getDurationMinutesAttribute(): ?int
    {
        if (!$this->check_in || !$this->check_out) return null;
        $in  = strtotime($this->check_in);
        $out = strtotime($this->check_out);
        return (int) round(($out - $in) / 60);
    }
}
