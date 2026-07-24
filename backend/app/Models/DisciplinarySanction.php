<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model DisciplinarySanction
 * 
 * Merepresentasikan data sanksi disiplin (Surat Teguran, SP1, SP2, PHK) yang diberikan kepada karyawan.
 */
class DisciplinarySanction extends Model
{
    protected $fillable = [
        'employee_id',
        'type',
        'attachment_url',
        'chronology_url',
        'admin_note',
        'created_by',
    ];

    /**
     * Relasi ke model Employee.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Relasi ke model User (sebagai Pembuat Sanksi / Admin).
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
