<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model LeaveRequest
 * 
 * Merepresentasikan data pengajuan izin, cuti, atau sakit oleh karyawan.
 * Menyimpan detail tanggal mulai/selesai, alasan pengajuan, file lampiran pendukung,
 * serta status verifikasi persetujuan oleh administrator.
 */
class LeaveRequest extends Model
{
    // Kolom yang dapat diisi secara massal
    protected $fillable = [
        'employee_id', 'type', 'special_leave_category_id', 'start_date', 'end_date',
        'reason', 'attachment_url', 'status', 'reviewed_by', 'reviewed_at', 'admin_note',
        'actual_end_date', 'shortened_by', 'shortened_at', 'shortened_reason',
        'cancelled_by', 'cancelled_at', 'cancellation_reason',
    ];

    // Cast tipe data otomatis
    protected $casts = [
        'start_date'      => 'date',
        'end_date'        => 'date',
        'actual_end_date' => 'date',
        'reviewed_at'     => 'datetime',
        'shortened_at'    => 'datetime',
        'cancelled_at'    => 'datetime',
    ];

    /**
     * Relasi ke model SpecialLeaveCategory.
     * Pengajuan cuti khusus dikaitkan dengan satu kategori tertentu.
     */
    public function specialLeaveCategory()
    {
        return $this->belongsTo(SpecialLeaveCategory::class, 'special_leave_category_id');
    }

    /**
     * Relasi ke model Employee.
     * Pengajuan cuti ini diajukan oleh satu karyawan tertentu.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Relasi ke model User (sebagai Reviewer/Admin).
     * Pengajuan cuti ini ditinjau/diverifikasi oleh satu user (admin).
     */
    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Accessor untuk tanggal selesai cuti aktual/efektif.
     */
    public function getEffectiveEndDateAttribute()
    {
        return $this->actual_end_date ?? $this->end_date;
    }

    /**
     * Accessor untuk menghitung jumlah hari pengajuan cuti/izin berdasarkan tanggal efektif.
     */
    public function getDaysAttribute(): int
    {
        if (!$this->start_date || !$this->effective_end_date) return 0;
        return $this->start_date->diffInDays($this->effective_end_date) + 1;
    }

    /** 
     * Accessor untuk menghitung jumlah hari pengajuan cuti/izin secara inklusif.
     * 
     * @return int Jumlah total hari
     */
    public function getDaysCountAttribute(): int
    {
        return $this->days;
    }
}
