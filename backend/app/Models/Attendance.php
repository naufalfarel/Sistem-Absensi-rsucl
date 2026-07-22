<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

use App\Models\Employee;
use App\Models\LeaveRequest;
use Carbon\Carbon;

/**
 * Model Attendance
 * 
 * Merepresentasikan data kehadiran/absensi karyawan.
 * Menyimpan informasi waktu check-in, check-out, status kehadiran (hadir, terlambat, dll),
 * serta data koordinat geolokasi untuk validasi geofencing.
 */
class Attendance extends Model
{
    use SoftDeletes;

    // Nama tabel di database
    protected $table = 'attendance';

    // Kolom-kolom yang dapat diisi secara massal (mass assignment)
    protected $fillable = [
        'employee_id', 'date', 'check_in', 'check_out',
        'status', 'latitude', 'longitude', 'accuracy',
        'is_within_geofence', 'note',
        'checkin_location_note', 'checkout_location_note',
        'image_check_in', 'image_check_out',
        // Pulang Cepat (Early Checkout)
        'is_early_checkout', 'early_checkout_reason',
        'early_checkout_status', 'early_checkout_admin_note',
        // Lembur (Overtime)
        'is_overtime', 'overtime_minutes', 'overtime_note',
        'overtime_status', 'overtime_reviewed_by', 'overtime_reviewed_at', 'overtime_admin_note',
        // New Overtime System
        'jam_pulang_normal', 'is_lembur', 'durasi_lembur_menit', 'keterangan_lembur', 'status_approval_lembur',
        // Foto, Koordinat, dan Jarak Detail
        'checkin_photo_url', 'checkout_photo_url',
        'checkin_latitude', 'checkin_longitude', 'checkout_latitude', 'checkout_longitude',
        'checkin_distance_meters', 'checkout_distance_meters',
        // Holiday Work
        'is_holiday_work', 'holiday_id',
    ];

    // Konversi tipe data otomatis oleh Eloquent
    protected $casts = [
        'date'                => 'date',
        'is_within_geofence'  => 'boolean',
        'accuracy'            => 'float',
        'is_early_checkout'   => 'boolean',
        'is_overtime'         => 'boolean',
        'overtime_minutes'    => 'integer',
        'is_lembur'           => 'boolean',
        'durasi_lembur_menit' => 'integer',
        'checkin_latitude'    => 'float',
        'checkin_longitude'   => 'float',
        'checkout_latitude'   => 'float',
        'checkout_longitude'  => 'float',
        'checkin_distance_meters'  => 'integer',
        'checkout_distance_meters' => 'integer',
        'is_holiday_work'     => 'boolean',
        'overtime_reviewed_at' => 'datetime',
    ];

    /**
     * Relasi ke model Employee.
     * Setiap data absensi dimiliki oleh satu karyawan.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Relasi ke model Holiday.
     */
    public function holiday()
    {
        return $this->belongsTo(Holiday::class);
    }

    /**
     * Relasi ke model User (Admin yang menyetujui/menolak lembur).
     */
    public function overtimeReviewedBy()
    {
        return $this->belongsTo(User::class, 'overtime_reviewed_by');
    }

    /**
     * Accessor untuk menghitung durasi kerja karyawan dalam menit.
     * Dihitung berdasarkan selisih waktu check-in dan check-out.
     * 
     * @return int|null Durasi dalam menit, atau null jika belum check-out/belum check-in
     */
    public function getDurationMinutesAttribute(): ?int
    {
        $checkInTime = $this->effective_checkin_time ?: $this->check_in;
        if (!$checkInTime || !$this->check_out) return null;
        $in  = strtotime($checkInTime);
        $out = strtotime($this->check_out);
        return (int) round(($out - $in) / 60);
    }

    /**
     * Menghasilkan data laporan bulanan secara real-time untuk bulan dan tahun tertentu.
     * Metode ini mengkalkulasi ketidakhadiran (Alpa), cuti/izin, dan kehadiran reguler
     * berdasarkan jadwal shift yang dimiliki karyawan.
     * 
     * @param int $month Bulan laporan (1-12)
     * @param int $year Tahun laporan (misal: 2026)
     * @param int|null $employeeId ID Karyawan tertentu jika ingin memfilter data per karyawan
     * @return array Daftar record laporan kehadiran karyawan
     */
    public static function getMonthlyReportData(int $month, int $year, ?int $employeeId = null): array
    {
        // 1. Tentukan tanggal awal dan akhir bulan yang dilaporkan
        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = Carbon::createFromDate($year, $month, 1)->endOfMonth();

        // 2. Ambil data karyawan yang aktif beserta relasinya
        $employeesQuery = Employee::with(['user', 'department', 'position', 'schedules'])
            ->where('status', 'active');
        if ($employeeId) {
            $employeesQuery->where('id', $employeeId);
        }
        $employees = $employeesQuery->get();

        // 3. Ambil data kehadiran aktual di bulan tersebut
        $attendancesQuery = self::whereYear('date', $year)
            ->whereMonth('date', $month);
        if ($employeeId) {
            $attendancesQuery->where('employee_id', $employeeId);
        }
        // Kelompokkan data kehadiran berdasarkan format: {employee_id}_{date_string} untuk lookup cepat
        $attendances = $attendancesQuery->get()->groupBy(fn($att) => $att->employee_id . '_' . $att->date->toDateString());

        // 4. Ambil data pengajuan cuti/izin yang disetujui (status: approved) pada rentang bulan tersebut
        $leaveRequestsQuery = LeaveRequest::where('status', 'approved')
            ->whereDate('start_date', '<=', $endDate->toDateString())
            ->where(function($q) use ($startDate) {
                $q->where(function($q2) use ($startDate) {
                    $q2->whereNull('actual_end_date')
                       ->whereDate('end_date', '>=', $startDate->toDateString());
                })->orWhere(function($q2) use ($startDate) {
                    $q2->whereNotNull('actual_end_date')
                       ->whereDate('actual_end_date', '>=', $startDate->toDateString());
                });
            });
        if ($employeeId) {
            $leaveRequestsQuery->where('employee_id', $employeeId);
        }
        $leaveRequests = $leaveRequestsQuery->get()->groupBy('employee_id');

        // Map nama hari lokal untuk mencocokkan jadwal shift
        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];

        // Batasi pengecekan Alpa hingga hari ini (jika memeriksa bulan berjalan, agar hari esok tidak dianggap Alpa)
        $today = Carbon::today('Asia/Jakarta');
        $limitDate = $endDate->gt($today) ? $today : $endDate;

        // Cari tanggal absensi pertama di sistem untuk menghindari pembuatan record Alpa sebelum sistem diimplementasikan
        $firstAttendanceDate = self::orderBy('date', 'asc')->value('date');
        $systemStartDate = $firstAttendanceDate
            ? Carbon::parse($firstAttendanceDate)->startOfDay()
            : $today; // Jika tidak ada data sama sekali, gunakan hari ini sebagai default

        $reportRecords = [];

        // 5. Lakukan looping untuk setiap hari kalender dalam bulan tersebut
        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            $dateStr = $date->toDateString();
            $dayOfWeekName = $dayMap[$date->dayOfWeek];

            foreach ($employees as $emp) {
                // Periksa apakah karyawan memiliki jadwal shift pada hari tersebut
                $hasShift = $emp->schedules->contains(function($schedule) use ($dayOfWeekName) {
                    return $schedule->pivot->day_of_week === $dayOfWeekName;
                });

                // Jika tidak ada shift (hari libur/off), lewati pengecekan
                if (!$hasShift) {
                    continue;
                }

                $matchingShift = $emp->schedules->first(function($schedule) use ($dayOfWeekName) {
                    return $schedule->pivot->day_of_week === $dayOfWeekName;
                });
                $shiftName = $matchingShift ? $matchingShift->name : 'Reguler';

                $key = $emp->id . '_' . $dateStr;

                // Kasus A: Karyawan melakukan absensi (Check-in/Check-out ada)
                // Kasus A: Karyawan melakukan absensi (Check-in/Check-out ada)
                if (isset($attendances[$key])) {
                    $attRecord = $attendances[$key]->first();
                    
                    $checkOut = $attRecord->check_out;
                    $durationMin = $attRecord->duration_minutes;
                    if ($attRecord->overtime_status === 'rejected' && $attRecord->jam_pulang_normal) {
                        $checkOut = $attRecord->jam_pulang_normal;
                        if ($attRecord->check_in) {
                            $inSec = strtotime($attRecord->check_in);
                            $outSec = strtotime($attRecord->jam_pulang_normal);
                            if ($outSec < $inSec) {
                                $outSec += 86400; // overnight shift
                            }
                            $durationMin = (int) round(($outSec - $inSec) / 60);
                            if ($durationMin < 0) $durationMin = 0;
                        }
                    }

                    $isIncomplete = \App\Support\AttendanceRules::isAttendanceIncomplete($attRecord, $emp);
                    $displayStatus = $isIncomplete ? 'tidak_lengkap' : $attRecord->status;

                    // Jika absensi tidak lengkap, sembunyikan checkout dan durasi
                    if ($isIncomplete) {
                        $checkOut    = null;
                        $durationMin = null;
                    }

                    $reportRecords[] = [
                        'id' => $attRecord->id,
                        'employee_id' => $emp->id,
                        'date' => $dateStr,
                        'check_in' => $attRecord->check_in,
                        'check_out' => $checkOut,
                        'status' => $attRecord->status,
                        'display_status' => $displayStatus,
                        'checkin_punctuality' => $attRecord->checkin_punctuality,
                        'effective_checkin_time' => $attRecord->effective_checkin_time,
                        'duration_min' => $durationMin,
                        'latitude' => $attRecord->latitude,
                        'longitude' => $attRecord->longitude,
                        'accuracy' => $attRecord->accuracy,
                        'is_within_geofence' => (bool)$attRecord->is_within_geofence,
                        'note' => $attRecord->note,
                        'checkin_location_note' => $attRecord->checkin_location_note,
                        'checkout_location_note' => $attRecord->checkout_location_note,
                        'employee' => [
                            'id' => $emp->id,
                            'name' => $emp->user?->name ?? 'Karyawan',
                            'nik_ktp' => $emp->nik_ktp,
                            'department' => $emp->department?->name ?? 'Umum',
                            'position' => $emp->position?->name ?? 'Staff',
                        ],
                        'image_check_in' => $attRecord->image_check_in,
                        'image_check_out' => $attRecord->image_check_out,
                        
                        // New fields
                        'checkin_photo_url'        => $attRecord->checkin_photo_url ? url($attRecord->checkin_photo_url) : null,
                        'checkout_photo_url'       => $attRecord->checkout_photo_url ? url($attRecord->checkout_photo_url) : null,
                        'checkin_latitude'         => $attRecord->checkin_latitude,
                        'checkin_longitude'        => $attRecord->checkin_longitude,
                        'checkout_latitude'        => $attRecord->checkout_latitude,
                        'checkout_longitude'       => $attRecord->checkout_longitude,
                        'checkin_distance_meters'  => $attRecord->checkin_distance_meters,
                        'checkout_distance_meters' => $attRecord->checkout_distance_meters,
                        
                        // Overtime fields
                        'jam_pulang_normal'        => $attRecord->jam_pulang_normal,
                        'is_lembur'                => (bool)$attRecord->is_lembur,
                        'durasi_lembur_menit'      => $attRecord->durasi_lembur_menit,
                        'keterangan_lembur'        => $attRecord->keterangan_lembur,
                        'status_approval_lembur'   => $attRecord->status_approval_lembur,
                        'is_overtime'              => (bool)$attRecord->is_overtime,
                        'overtime_minutes'         => $attRecord->overtime_minutes,
                        'overtime_status'          => $attRecord->overtime_status,
                        
                        'shift_name' => $shiftName,
                        'shift_type' => $matchingShift ? ($matchingShift->shift_type ?? 'normal') : 'normal',
                    ];
                } else {
                    // Kasus B: Karyawan tidak absen. Periksa apakah sedang cuti/izin/sakit
                    $empLeaves = $leaveRequests->get($emp->id, collect());
                    $matchingLeave = $empLeaves->first(function($leave) use ($dateStr) {
                        return $dateStr >= $leave->start_date->toDateString() && $dateStr <= $leave->effective_end_date->toDateString();
                    });

                    if ($matchingLeave) {
                        $reportRecords[] = [
                            'id' => null,
                            'employee_id' => $emp->id,
                            'date' => $dateStr,
                            'check_in' => null,
                            'check_out' => null,
                            'status' => $matchingLeave->type, // cuti, izin, sakit
                            'duration_min' => null,
                            'latitude' => null,
                            'longitude' => null,
                            'accuracy' => null,
                            'is_within_geofence' => false,
                            'note' => $matchingLeave->reason,
                            'employee' => [
                                'id' => $emp->id,
                                'name' => $emp->user?->name ?? 'Karyawan',
                                'nik_ktp' => $emp->nik_ktp,
                                'department' => $emp->department?->name ?? 'Umum',
                                'position' => $emp->position?->name ?? 'Staff',
                            ],
                            'image_check_in' => null,
                            'image_check_out' => null,
                            
                            // New fields
                            'checkin_photo_url'        => null,
                            'checkout_photo_url'       => null,
                            'checkin_latitude'         => null,
                            'checkin_longitude'        => null,
                            'checkout_latitude'        => null,
                            'checkout_longitude'       => null,
                            'checkin_distance_meters'  => null,
                            'checkout_distance_meters' => null,

                            'shift_name' => $shiftName,
                            'shift_type' => $matchingShift ? ($matchingShift->shift_type ?? 'normal') : 'normal',
                        ];
                    } else {
                        // Kasus C: Tidak ada absensi dan tidak ada izin.
                        // Karyawan dinyatakan Alpa jika tanggal tersebut adalah hari lalu/hari ini,
                        // dan setelah sistem absensi resmi dimulai.
                        if ($date->lte($limitDate) && $date->gte($systemStartDate)) {
                            // Cek jika hari libur nasional
                            $holiday = \App\Support\AttendanceRules::holidayOn($date);
                            if ($holiday) {
                                // Cek jika tidak ditugaskan kerja pada hari libur ini
                                $isAssigned = \App\Support\AttendanceRules::isAssignedToWorkOnHoliday($emp, $holiday);
                                if (!$isAssigned) {
                                    continue; // Lewati, jangan catat sebagai alpa
                                }
                            }

                            $status = 'alpha';
                            $note = 'Tidak Hadir Tanpa Keterangan';

                            if ($date->isToday()) {
                                if ($matchingShift) {
                                    $now = Carbon::now('Asia/Jakarta');
                                    $shiftStart = $matchingShift->start_time; // "HH:mm:ss"
                                    $resolvedCloseTime = $matchingShift->checkin_window_end_time;
                                    if (empty($resolvedCloseTime)) {
                                        $startCarbon = Carbon::parse($matchingShift->start_time);
                                        $endCarbon = Carbon::parse($matchingShift->end_time);
                                        if ($endCarbon->lt($startCarbon)) {
                                            $endCarbon->addDay();
                                        }
                                        $duration = $startCarbon->diffInMinutes($endCarbon);
                                        $half = (int) ($duration / 2);
                                        $resolvedCloseTime = $startCarbon->copy()->addMinutes($half)->format('H:i:s');
                                    }
                                    $shiftStartCarbon = Carbon::today('Asia/Jakarta')->setTimeFromTimeString($shiftStart);
                                    $closeLimitCarbon = Carbon::today('Asia/Jakarta')->setTimeFromTimeString($resolvedCloseTime);

                                    if ($now->lte($closeLimitCarbon)) {
                                        $status = 'belum_hadir';
                                        $note = 'Belum Absen Masuk';
                                    }
                                }
                            }

                            $reportRecords[] = [
                                'id' => null,
                                'employee_id' => $emp->id,
                                'date' => $dateStr,
                                'check_in' => null,
                                'check_out' => null,
                                'status' => $status,
                                'duration_min' => null,
                                'latitude' => null,
                                'longitude' => null,
                                'accuracy' => null,
                                'is_within_geofence' => false,
                                'note' => $note,
                                'employee' => [
                                    'id' => $emp->id,
                                    'name' => $emp->user?->name ?? 'Karyawan',
                                    'nik_ktp' => $emp->nik_ktp,
                                    'department' => $emp->department?->name ?? 'Umum',
                                    'position' => $emp->position?->name ?? 'Staff',
                                ],
                                'image_check_in' => null,
                                'image_check_out' => null,
                                
                                // New fields
                                'checkin_photo_url'        => null,
                                'checkout_photo_url'       => null,
                                'checkin_latitude'         => null,
                                'checkin_longitude'        => null,
                                'checkout_latitude'        => null,
                                'checkout_longitude'       => null,
                                'checkin_distance_meters'  => null,
                                'checkout_distance_meters' => null,

                                'shift_name' => $shiftName,
                                'shift_type' => $matchingShift ? ($matchingShift->shift_type ?? 'normal') : 'normal',
                            ];
                        }
                    }
                }
            }
        }

        // 6. Urutkan laporan berdasarkan tanggal terbaru (desc), lalu nama departemen (asc), lalu nama karyawan (asc)
        usort($reportRecords, function($a, $b) {
            $dateComp = strcmp($b['date'], $a['date']);
            if ($dateComp !== 0) return $dateComp;

            $deptComp = strcmp($a['employee']['department'], $b['employee']['department']);
            if ($deptComp !== 0) return $deptComp;

            return strcmp($a['employee']['name'], $b['employee']['name']);
        });

        return $reportRecords;
    }
}
