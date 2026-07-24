<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model ResignationRequest
 * 
 * Merepresentasikan data pengajuan surat pengunduran diri (resignation) oleh karyawan.
 * Menyimpan tanggal pengajuan, tanggal efektif berhenti (wajib minimal 30 hari notice),
 * alasan pengunduran diri, berkas surat pendukung, serta status peninjauan oleh administrator.
 */
class ResignationRequest extends Model
{
    protected $fillable = [
        'employee_id',
        'request_date',
        'effective_date',
        'notice_days',
        'reason',
        'attachment_url',
        'posisi',
        'unit_kerja',
        'status',
        'reviewed_by',
        'reviewed_at',
        'admin_note',
        'pj_status',
        'pj_reviewed_by',
        'pj_reviewed_at',
        'pj_note',
    ];

    protected $casts = [
        'request_date'   => 'date',
        'effective_date' => 'date',
        'reviewed_at'    => 'datetime',
        'pj_reviewed_at' => 'datetime',
    ];

    /**
     * Relasi ke model Employee.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Relasi ke model User (sebagai Reviewer/Admin).
     */
    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Relasi ke model User (sebagai Reviewer/PJ Bagian).
     */
    public function pjReviewer()
    {
        return $this->belongsTo(User::class, 'pj_reviewed_by');
    }

    /**
     * Accessor untuk menghitung sisa hari hingga tanggal efektif berhenti.
     */
    public function getDaysRemainingAttribute(): int
    {
        if (!$this->effective_date) return 0;
        $diff = now()->startOfDay()->diffInDays($this->effective_date->startOfDay(), false);
        return max(0, (int)$diff);
    }
}
