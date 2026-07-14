<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Holiday extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'name',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    /**
     * Relasi ke penugasan kerja hari libur.
     */
    public function holidayWorkAssignments(): HasMany
    {
        return $this->hasMany(HolidayWorkAssignment::class);
    }

    /**
     * Relasi ke absensi.
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }
}
