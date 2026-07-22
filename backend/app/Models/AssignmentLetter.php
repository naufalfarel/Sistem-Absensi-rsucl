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
        'letter_number',
        'title',
        'issuing_institution',
        'purpose',
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
        'start_date'  => 'date:Y-m-d',
        'end_date'    => 'date:Y-m-d',
        'reviewed_at' => 'datetime',
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
