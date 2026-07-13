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
    ];

    // Cast tipe data otomatis
    protected $casts = [
        'start_date'  => 'date',
        'end_date'    => 'date',
        'reviewed_at' => 'datetime',
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
     * Accessor untuk menghitung jumlah hari pengajuan cuti/izin secara inklusif.
     * 
     * @return int Jumlah total hari
     */
    public function getDaysCountAttribute(): int
    {
        return $this->start_date->diffInDays($this->end_date) + 1;
    }
}
