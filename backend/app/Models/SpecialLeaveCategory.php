<?php
// backend/app/Models/SpecialLeaveCategory.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SpecialLeaveCategory extends Model
{
    protected $table = 'special_leave_categories';

    protected $fillable = [
        'name',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Relasi ke model LeaveRequest.
     * Kategori ini dapat dikaitkan dengan banyak pengajuan cuti khusus.
     */
    public function leaveRequests()
    {
        return $this->hasMany(LeaveRequest::class, 'special_leave_category_id');
    }
}
