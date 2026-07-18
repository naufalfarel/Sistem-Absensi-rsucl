<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OvertimeRequest extends Model
{
    use HasFactory;

    protected $table = 'overtime_requests';

    protected $fillable = [
        'employee_id',
        'date',
        'reason',
        'photo_url',
        'location_note',
        'status',
        'admin_note',
        'reviewed_by',
        'reviewed_at',
        'pj_status',
        'pj_reviewed_by',
        'pj_reviewed_at',
        'pj_note',
        'unit_kerja',
        'overtime_day_type',
        'start_time',
        'end_time',
        'tasks',
    ];

    protected $casts = [
        'date' => 'date',
        'reviewed_at' => 'datetime',
        'pj_reviewed_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function pjReviewer()
    {
        return $this->belongsTo(User::class, 'pj_reviewed_by');
    }
}
