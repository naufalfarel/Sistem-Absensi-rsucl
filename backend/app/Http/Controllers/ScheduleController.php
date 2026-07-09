<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    /**
     * GET /api/schedules
     * 
     * Mengambil daftar seluruh master jadwal shift kerja,
     * lengkap dengan data karyawan yang ditugaskan beserta jumlah totalnya.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        $schedules = Schedule::with(['employees.user', 'employees.department'])->get();
        
        // Tambahkan atribut custom 'employees_count' untuk menghitung pegawai unik
        $schedules->each(function ($schedule) {
            $uniqueCount = $schedule->employees->unique('id')->count();
            $schedule->setAttribute('employees_count', $uniqueCount);
        });

        return response()->json(['success' => true, 'data' => $schedules]);
    }

    /**
     * POST /api/schedules
     * 
     * Membuat master jadwal shift baru (misal: Shift Sore, Jam masuk 14:00 s.d 21:00).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        // Validasi input data shift baru
        $data = $request->validate([
            'name'       => 'required|string|max:50',
            'start_time' => 'required|date_format:H:i',
            'end_time'   => 'required|date_format:H:i',
            'color'      => 'required|string|max:10',
            'icon'       => 'required|string|max:20',
        ]);

        // Buat jadwal shift di database
        $schedule = Schedule::create($data);
        $schedule->setAttribute('employees_count', 0);
        $schedule->setAttribute('employees', []);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal shift berhasil dibuat.',
            'data'    => $schedule,
        ], 201);
    }

    /**
     * PUT /api/schedules/{id}
     * 
     * Memperbarui data detail master jadwal shift yang sudah ada.
     * 
     * @param Request $request
     * @param Schedule $schedule
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, Schedule $schedule)
    {
        // Validasi payload perubahan data shift
        $data = $request->validate([
            'name'       => 'sometimes|string|max:50',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time'   => 'sometimes|date_format:H:i',
            'color'      => 'sometimes|string|max:10',
            'icon'       => 'sometimes|string|max:20',
        ]);

        $schedule->update($data);

        // Load relasi terbaru dan hitung ulang jumlah karyawan terkait
        $schedule->load(['employees.user', 'employees.department']);
        $uniqueCount = $schedule->employees->unique('id')->count();
        $schedule->setAttribute('employees_count', $uniqueCount);

        return response()->json(['success' => true, 'message' => 'Jadwal shift berhasil diperbarui.', 'data' => $schedule]);
    }

    /**
     * DELETE /api/schedules/{id}
     * 
     * Menghapus master jadwal shift dari database.
     * 
     * @param Schedule $schedule
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Schedule $schedule)
    {
        $schedule->delete();
        return response()->json(['success' => true, 'message' => 'Jadwal shift berhasil dihapus.']);
    }

    /**
     * GET /api/employee-schedules
     * 
     * Mengambil matriks pemetaan jadwal shift kerja mingguan (Senin-Minggu) untuk seluruh karyawan yang aktif.
     * Digunakan oleh Admin untuk memetakan atau melihat sebaran shift karyawan.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getEmployeeSchedules()
    {
        // Ambil data seluruh karyawan aktif beserta jadwal pivotnya
        $employees = \App\Models\Employee::with(['user', 'schedules'])->where('status', 'active')->get();
        
        // Format pemetaan hari kerja per karyawan
        $data = $employees->map(function ($emp) {
            $scheduleMap = [];
            foreach ($emp->schedules as $sched) {
                if ($sched->pivot->day_of_week) {
                    $scheduleMap[$sched->pivot->day_of_week] = [
                        'id' => $sched->id,
                        'name' => $sched->name,
                        'color' => $sched->color,
                        'icon' => $sched->icon,
                    ];
                }
            }
            return [
                'employee_id' => $emp->id,
                'name' => $emp->user->name,
                'schedules' => (object)$scheduleMap
            ];
        });

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * GET /api/my-schedule
     * 
     * Mengambil jadwal shift kerja karyawan yang saat ini sedang login untuk hari ini,
     * serta informasi khusus untuk shift hari Sabtu (jika ada) guna keperluan kalkulasi checkout awal.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function mySchedule(\Illuminate\Http\Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Mapping index hari PHP ke penulisan hari Indonesia pada tabel pivot database
        $dayMap = [
            0 => 'Minggu',
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
        ];
        $todayName = $dayMap[now('Asia/Jakarta')->dayOfWeek];

        // Ambil semua jadwal shift yang ditugaskan ke karyawan
        $schedules = $employee->schedules()->get();

        // Cari shift untuk hari ini
        $todaySchedule = $schedules->first(function ($s) use ($todayName) {
            return $s->pivot->day_of_week === $todayName;
        });

        // Cari shift untuk hari Sabtu (digunakan frontend/backend untuk pengaturan kepulangan lebih cepat)
        $saturdaySchedule = $schedules->first(function ($s) {
            return $s->pivot->day_of_week === 'Sabtu';
        });

        $todayData = null;
        if ($todaySchedule) {
            $todayData = [
                'id'         => $todaySchedule->id,
                'name'       => $todaySchedule->name,
                'start_time' => $todaySchedule->start_time,
                'end_time'   => $todaySchedule->end_time,
                'color'      => $todaySchedule->color,
                'icon'       => $todaySchedule->icon,
            ];
        }

        $saturdayData = null;
        if ($saturdaySchedule) {
            $saturdayData = [
                'id'         => $saturdaySchedule->id,
                'name'       => $saturdaySchedule->name,
                'start_time' => $saturdaySchedule->start_time,
                'end_time'   => $saturdaySchedule->end_time,
                'color'      => $saturdaySchedule->color,
                'icon'       => $saturdaySchedule->icon,
            ];
        }

        return response()->json([
            'success' => true,
            'day'     => $todayName,
            'data'    => $todayData,
            'saturday_shift' => $saturdayData,
        ]);
    }

    /**
     * POST /api/employee-schedules/assign
     * 
     * Menugaskan atau memperbarui jadwal shift pegawai berdasarkan hari kerja (day_of_week).
     * Jika schedule_id dikirimkan null, maka pegawai diatur libur pada hari tersebut.
     * Mengirimkan notifikasi pembaruan jadwal secara real-time ke akun pegawai bersangkutan.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function assignEmployeeSchedule(Request $request)
    {
        // Validasi input pegawai, nama hari, dan ID jadwal shift
        $data = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'day_of_week' => 'required|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
            'schedule_id' => 'nullable|exists:schedules,id',
        ]);

        $emp = \App\Models\Employee::findOrFail($data['employee_id']);

        // Hapus penugasan shift lama pegawai pada hari kerja yang sama (jika ada)
        \Illuminate\Support\Facades\DB::table('employee_schedule')
            ->where('employee_id', $emp->id)
            ->where('day_of_week', $data['day_of_week'])
            ->delete();

        // Jika schedule_id dikirim (bukan null), pasang penugasan shift baru ke tabel pivot
        $scheduleName = 'Libur (Tidak Ada Shift)';
        if ($data['schedule_id']) {
            $emp->schedules()->attach($data['schedule_id'], ['day_of_week' => $data['day_of_week']]);
            $scheduleObj = \App\Models\Schedule::find($data['schedule_id']);
            if ($scheduleObj) {
                $scheduleName = $scheduleObj->name;
            }
        }

        // Kirim notifikasi sistem secara langsung ke user pegawai yang bersangkutan
        // untuk menginformasikan perubahan/penugasan shift barunya.
        \App\Models\Notification::create([
            'user_id' => $emp->user_id,
            'title'   => 'Jadwal Shift Diperbarui',
            'body'    => 'Jadwal dinas Anda untuk hari ' . $data['day_of_week'] . ' telah diperbarui menjadi "' . $scheduleName . '" oleh Administrator.',
            'type'    => 'system',
            'data'    => ['employee_id' => $emp->id, 'day_of_week' => $data['day_of_week']],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal karyawan berhasil diperbarui.'
        ]);
    }
}
