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
        'image_check_in', 'image_check_out',
    ];

    // Konversi tipe data otomatis oleh Eloquent
    protected $casts = [
        'date'             => 'date',
        'is_within_geofence' => 'boolean',
        'accuracy'         => 'float',
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
     * Accessor untuk menghitung durasi kerja karyawan dalam menit.
     * Dihitung berdasarkan selisih waktu check-in dan check-out.
     * 
     * @return int|null Durasi dalam menit, atau null jika belum check-out/belum check-in
     */
    public function getDurationMinutesAttribute(): ?int
    {
        if (!$this->check_in || !$this->check_out) return null;
        $in  = strtotime($this->check_in);
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
            ->where(function($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate->toDateString(), $endDate->toDateString()])
                  ->orWhereBetween('end_date', [$startDate->toDateString(), $endDate->toDateString()])
                  ->orWhere(function($q2) use ($startDate, $endDate) {
                      $q2->where('start_date', '<=', $startDate->toDateString())
                         ->where('end_date', '>=', $endDate->toDateString());
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

                $key = $emp->id . '_' . $dateStr;

                // Kasus A: Karyawan melakukan absensi (Check-in/Check-out ada)
                if (isset($attendances[$key])) {
                    $attRecord = $attendances[$key]->first();
                    $reportRecords[] = [
                        'id' => $attRecord->id,
                        'employee_id' => $emp->id,
                        'date' => $dateStr,
                        'check_in' => $attRecord->check_in,
                        'check_out' => $attRecord->check_out,
                        'status' => $attRecord->status,
                        'duration_min' => $attRecord->duration_minutes,
                        'latitude' => $attRecord->latitude,
                        'longitude' => $attRecord->longitude,
                        'accuracy' => $attRecord->accuracy,
                        'is_within_geofence' => (bool)$attRecord->is_within_geofence,
                        'note' => $attRecord->note,
                        'employee' => [
                            'id' => $emp->id,
                            'name' => $emp->user?->name ?? 'Karyawan',
                            'nip' => $emp->nip,
                            'department' => $emp->department?->name ?? 'Umum',
                            'position' => $emp->position?->name ?? 'Staff',
                        ],
                        'image_check_in' => $attRecord->image_check_in,
                        'image_check_out' => $attRecord->image_check_out,
                    ];
                } else {
                    // Kasus B: Karyawan tidak absen. Periksa apakah sedang cuti/izin/sakit
                    $empLeaves = $leaveRequests->get($emp->id, collect());
                    $matchingLeave = $empLeaves->first(function($leave) use ($dateStr) {
                        return $dateStr >= $leave->start_date && $dateStr <= $leave->end_date;
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
                                'nip' => $emp->nip,
                                'department' => $emp->department?->name ?? 'Umum',
                                'position' => $emp->position?->name ?? 'Staff',
                            ],
                            'image_check_in' => null,
                            'image_check_out' => null,
                        ];
                    } else {
                        // Kasus C: Tidak ada absensi dan tidak ada izin.
                        // Karyawan dinyatakan Alpa jika tanggal tersebut adalah hari lalu/hari ini,
                        // dan setelah sistem absensi resmi dimulai.
                        if ($date->lte($limitDate) && $date->gte($systemStartDate)) {
                            $reportRecords[] = [
                                'id' => null,
                                'employee_id' => $emp->id,
                                'date' => $dateStr,
                                'check_in' => null,
                                'check_out' => null,
                                'status' => 'alpha',
                                'duration_min' => null,
                                'latitude' => null,
                                'longitude' => null,
                                'accuracy' => null,
                                'is_within_geofence' => false,
                                'note' => 'Tidak Hadir Tanpa Keterangan',
                                'employee' => [
                                    'id' => $emp->id,
                                    'name' => $emp->user?->name ?? 'Karyawan',
                                    'nip' => $emp->nip,
                                    'department' => $emp->department?->name ?? 'Umum',
                                    'position' => $emp->position?->name ?? 'Staff',
                                ],
                                'image_check_in' => null,
                                'image_check_out' => null,
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
