<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model ShiftAssignmentProposal
 * 
 * Menyimpan usulan penugasan shift yang diajukan PJ Bagian.
 * Bersifat PROPOSAL — belum mengubah penugasan shift sungguhan sampai admin setujui.
 * Saat admin approve, sistem baru mengeksekusi penugasan ke tabel pivot employee_schedule.
 */
class ShiftAssignmentProposal extends Model
{
    protected $fillable = [
        'employee_id',
        'schedule_id',
        'day_of_week',
        'proposed_by',
        'status',
        'admin_note',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    /**
     * Karyawan yang diusulkan untuk ditugaskan shift.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Shift (Schedule) yang diusulkan.
     */
    public function schedule()
    {
        return $this->belongsTo(Schedule::class);
    }

    /**
     * PJ Bagian yang mengajukan usulan ini.
     */
    public function proposedBy()
    {
        return $this->belongsTo(User::class, 'proposed_by');
    }

    /**
     * Admin yang memproses (approve/reject) usulan ini.
     */
    public function reviewedBy()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
