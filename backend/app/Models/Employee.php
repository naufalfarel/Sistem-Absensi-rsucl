<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Model Employee
 * 
 * Merepresentasikan entitas data karyawan/pegawai RSUCL.
 * Menyimpan informasi profil kepegawaian, NIP, tanggal masuk, status keaktifan,
 * serta relasi ke user account, departemen, dan jabatan.
 */
class Employee extends Model
{
    use SoftDeletes;

    // Kolom yang dapat diisi secara massal
    protected $fillable = [
        'user_id', 'department_id', 'position_id',
        'nip', 'phone', 'gender', 'join_date', 'status',
        'motor_plate_1', 'motor_plate_2', 'car_plate_1', 'car_plate_2',
    ];

    // Cast tipe data otomatis
    protected $casts = [
        'join_date' => 'date',
    ];

    /**
     * Relasi ke model User.
     * Setiap karyawan terhubung ke satu akun pengguna (user credentials).
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relasi ke model Department.
     * Setiap karyawan ditempatkan pada satu departemen/bagian unit kerja.
     */
    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * Relasi ke model Position.
     * Setiap karyawan memiliki satu jabatan struktural atau fungsional.
     */
    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    /**
     * Relasi ke model Attendance.
     * Seorang karyawan dapat memiliki banyak riwayat kehadiran.
     */
    public function attendances()
    {
        return $this->hasMany(Attendance::class);
    }

    /**
     * Relasi ke model LeaveRequest.
     * Seorang karyawan dapat mengajukan cuti, izin, atau sakit berkali-kali.
     */
    public function leaveRequests()
    {
        return $this->hasMany(LeaveRequest::class);
    }

    /**
     * Relasi many-to-many ke model Schedule (Shift Kerja).
     * Terhubung melalui tabel pivot 'employee_schedule' dengan data hari kerja ('day_of_week').
     */
    public function schedules()
    {
        return $this->belongsToMany(Schedule::class, 'employee_schedule')
                    ->withPivot('day_of_week')
                    ->withTimestamps();
    }

    /** 
     * Relasi has-one untuk mengambil data absensi hari ini.
     * Mempermudah pengecekan status check-in/check-out karyawan untuk hari berjalan.
     */
    public function todayAttendance()
    {
        return $this->hasOne(Attendance::class)
                    ->where('date', today()->toDateString());
    }
}
