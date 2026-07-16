<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\User;
use App\Models\Department;
use App\Models\Position;
use App\Http\Requests\StoreEmployeeRequest;
use App\Http\Requests\UpdateEmployeeRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/**
 * Class EmployeeController
 * 
 * Mengelola fungsi CRUD data profil kepegawaian (karyawan/employee).
 * Menghubungkan pembuatan/update profile karyawan dengan data akun user (otentikasi).
 * Hanya dapat diakses oleh administrator.
 */
class EmployeeController extends Controller
{
    /**
     * GET /api/employees
     * 
     * Mengambil daftar seluruh karyawan aktif/tidak aktif beserta relasi user, departemen, jabatan,
     * serta status absensi hari ini.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        // Ambil seluruh karyawan beserta relasi terkait
        $employees = Employee::with(['user', 'department', 'position', 'todayAttendance'])
            ->get()
            ->map(fn($e) => $this->formatEmployee($e));

        return response()->json(['success' => true, 'data' => $employees]);
    }

    /**
     * POST /api/employees
     * 
     * Mendaftarkan karyawan baru.
     * Langkah ini sekaligus membuat akun user untuk otentikasi serta data profil karyawan.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(StoreEmployeeRequest $request)
    {
        $data = $request->validated();

        // 1. Buat akun User untuk login karyawan
        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => 'employee',
            'nip'      => $data['nip'],
            'username' => $data['username'],
        ]);

        // 2. Buat profil karyawan yang terelasi ke akun user tersebut
        $employee = Employee::create([
            'user_id'       => $user->id,
            'department_id' => $data['department_id'],
            'position_id'   => $data['position_id'],
            'nip'           => $data['nip'],
            'phone'         => $data['phone'] ?? null,
            'gender'        => $data['gender'] ?? null,
            'join_date'     => $data['join_date'] ?? null,
            'motor_plate_1' => $data['motor_plate_1'] ?? null,
            'motor_plate_2' => $data['motor_plate_2'] ?? null,
            'car_plate_1'   => $data['car_plate_1'] ?? null,
            'car_plate_2'   => $data['car_plate_2'] ?? null,
        ]);

        $employee->load(['user', 'department', 'position']);

        return response()->json([
            'success' => true,
            'message' => 'Karyawan berhasil ditambahkan.',
            'data'    => $this->formatEmployee($employee),
        ], 201);
    }

    /**
     * GET /api/employees/{id}
     * 
     * Mengambil profil lengkap satu karyawan berdasarkan ID.
     * 
     * @param Employee $employee
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Employee $employee)
    {
        $employee->load(['user', 'department', 'position', 'todayAttendance']);
        return response()->json(['success' => true, 'data' => $this->formatEmployee($employee)]);
    }

    /**
     * PUT /api/employees/{id}
     * 
     * Memperbarui informasi profil karyawan serta akun usernya.
     * 
     * @param Request $request
     * @param Employee $employee
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(UpdateEmployeeRequest $request, Employee $employee)
    {
        $data = $request->validated();

        // 1. Perbarui atribut user
        $userFields = array_filter([
            'name'     => $data['name'] ?? null,
            'email'    => $data['email'] ?? null,
            'password' => isset($data['password']) ? Hash::make($data['password']) : null,
        ]);
        if ($userFields) $employee->user->update($userFields);

        // 2. Perbarui data kepegawaian karyawan (termasuk kendaraan)
        $empFields = array_merge([
            'department_id' => $data['department_id'] ?? $employee->department_id,
            'position_id'   => $data['position_id'] ?? $employee->position_id,
            'phone'         => array_key_exists('phone', $data) ? $data['phone'] : $employee->phone,
            'gender'        => array_key_exists('gender', $data) ? $data['gender'] : $employee->gender,
            'join_date'     => array_key_exists('join_date', $data) ? $data['join_date'] : $employee->join_date,
            'status'        => $data['status'] ?? $employee->status,
            'motor_plate_1' => array_key_exists('motor_plate_1', $data) ? $data['motor_plate_1'] : $employee->motor_plate_1,
            'motor_plate_2' => array_key_exists('motor_plate_2', $data) ? $data['motor_plate_2'] : $employee->motor_plate_2,
            'car_plate_1'   => array_key_exists('car_plate_1', $data) ? $data['car_plate_1'] : $employee->car_plate_1,
            'car_plate_2'   => array_key_exists('car_plate_2', $data) ? $data['car_plate_2'] : $employee->car_plate_2,
        ]);
        $employee->update($empFields);

        $employee->load(['user', 'department', 'position']);
        return response()->json([
            'success' => true,
            'message' => 'Data karyawan berhasil diperbarui.',
            'data'    => $this->formatEmployee($employee),
        ]);
    }

    /**
     * DELETE /api/employees/{id}
     * 
     * Menghapus karyawan dari sistem (mendukung soft-delete sesuai trait SoftDeletes di model Employee).
     * 
     * @param Employee $employee
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Employee $employee)
    {
        $employee->delete();
        return response()->json(['success' => true, 'message' => 'Karyawan berhasil dihapus.']);
    }

    /**
     * GET /api/employees/meta
     * 
     * Mengambil list departemen dan jabatan untuk mempermudah pengisian opsi dropdown pada form admin.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function meta()
    {
        return response()->json([
            'success' => true,
            'data'    => [
                'departments' => Department::all(['id', 'name']),
                'positions'   => Position::all(['id', 'name']),
            ],
        ]);
    }

    /**
     * Memformat output JSON karyawan agar konsisten dan mempermudah frontend.
     * 
     * @param Employee $e
     * @return array
     */
    private function formatEmployee(Employee $e): array
    {
        $today = $e->todayAttendance;

        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $todayName = $dayMap[\Carbon\Carbon::today('Asia/Jakarta')->dayOfWeek];

        // Eager loaded schedules check
        if ($e->relationLoaded('schedules')) {
            $schedule = $e->schedules->first(function($s) use ($todayName) {
                return $s->pivot->day_of_week === $todayName;
            });
        } else {
            $schedule = $e->schedules()->wherePivot('day_of_week', $todayName)->first();
        }

        $computedStatus = null;
        if ($today) {
            $isIncomplete = \App\Support\AttendanceRules::isAttendanceIncomplete($today, $e);
            $computedStatus = $isIncomplete ? 'tidak_lengkap' : $today->status;
        } else {
            if (!$schedule) {
                $computedStatus = 'tidak_ada_shift';
            } else {
                $now = \Carbon\Carbon::now('Asia/Jakarta');
                $shiftStart = $schedule->start_time; // "HH:mm:ss"
                $closeCheckinOffset = (int) \App\Models\Setting::get('close_checkin', '60');
                
                $shiftStartCarbon = \Carbon\Carbon::today('Asia/Jakarta')->setTimeFromTimeString($shiftStart);
                $closeLimitCarbon = $shiftStartCarbon->copy()->addMinutes($closeCheckinOffset);
                
                // Cek jika hari libur nasional
                $holiday = \App\Support\AttendanceRules::holidayOn(\Carbon\Carbon::today('Asia/Jakarta'));
                $isAssigned = $holiday ? \App\Support\AttendanceRules::isAssignedToWorkOnHoliday($e, $holiday) : false;

                if ($now->gt($closeLimitCarbon)) {
                    if ($holiday && !$isAssigned) {
                        $computedStatus = 'belum_hadir';
                    } else {
                        $computedStatus = 'alpha';
                    }
                } else {
                    $computedStatus = 'belum_hadir';
                }
            }
        }

        return [
            'id'          => $e->id,
            'user_id'     => $e->user_id,
            'name'        => $e->user?->name,
            'email'       => $e->user?->email,
            'nip'         => $e->nip,
            'username'    => $e->user?->username,
            'profile_picture' => $e->user?->profile_picture ? url($e->user->profile_picture) : null,
            'department'  => $e->department?->name,
            'department_id' => $e->department_id,
            'position'    => $e->position?->name,
            'position_id' => $e->position_id,
            'phone'       => $e->phone,
            'gender'      => $e->gender,
            'join_date'   => $e->join_date?->toDateString(),
            'status'      => $e->status,
            'today_attendance' => [
                'check_in'  => $today?->check_in,
                'check_out' => $today?->check_out,
                'status'    => $computedStatus,
            ],
            'vehicles'    => [
                'motor_plate_1' => $e->motor_plate_1,
                'motor_plate_2' => $e->motor_plate_2,
                'car_plate_1'   => $e->car_plate_1,
                'car_plate_2'   => $e->car_plate_2,
            ],
        ];
    }
}
