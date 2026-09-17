<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model AssignmentLetter
 * 
 * Merepresentasikan data surat tugas/undangan dinas luar karyawan.
 */
class AssignmentLetter extends Model
{
    protected $fillable = [
        'employee_id',
        'source',
        'director_type',
        'letter_number',
        'letter_number_seq',
        'letter_date',
        'title',
        'issuing_institution',
        'purpose',
        'travel_purpose',
        'travel_date',
        'travel_time',
        'travel_place',
        'assigned_employees',
        'start_date',
        'end_date',
        'document_url',
        'attendance_proof_url',
        'activity_notes',
        'status',
        'admin_note',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'start_date'         => 'date:Y-m-d',
        'end_date'           => 'date:Y-m-d',
        'letter_date'        => 'date:Y-m-d',
        'reviewed_at'        => 'datetime',
        'assigned_employees' => 'array',
    ];

    /**
     * Relasi ke model Employee.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Relasi ke model User (reviewer).
     */
    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
