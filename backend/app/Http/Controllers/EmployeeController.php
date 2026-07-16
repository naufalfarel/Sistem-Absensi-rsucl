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
 * Hanya dapat diakses oleh administrator (kecuali listPjBagian yang bisa dibaca semua).
 */
class EmployeeController extends Controller
{
    /**
     * GET /api/employees
     * 
     * Mengambil daftar seluruh karyawan aktif/tidak aktif beserta relasi user, departemen, jabatan,
     * serta status absensi hari ini.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Employee::with(['user', 'department', 'position', 'todayAttendance']);

        if ($user->role === 'pj_bagian') {
            $query->where('department_id', $user->pj_bagian_department_id);
        }

        $employees = $query->get()->map(fn($e) => $this->formatEmployee($e));

        return response()->json(['success' => true, 'data' => $employees]);
    }

    /**
     * POST /api/employees
     * 
     * Mendaftarkan karyawan baru. Sekaligus membuat akun user untuk otentikasi.
     */
    public function store(StoreEmployeeRequest $request)
    {
        $data = $request->validated();

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => 'employee',
            'nip'      => $data['nip'],
            'username' => $data['username'],
        ]);

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
     */
    public function show(Employee $employee)
    {
        $employee->load(['user', 'department', 'position', 'todayAttendance']);
        return response()->json(['success' => true, 'data' => $this->formatEmployee($employee)]);
    }

    /**
     * PUT /api/employees/{id}
     */
    public function update(UpdateEmployeeRequest $request, Employee $employee)
    {
        $data = $request->validated();

        $userFields = array_filter([
            'name'     => $data['name'] ?? null,
            'email'    => $data['email'] ?? null,
            'password' => isset($data['password']) ? Hash::make($data['password']) : null,
        ]);
        if ($userFields) $employee->user->update($userFields);

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
     */
    public function destroy(Employee $employee)
    {
        $employee->delete();
        return response()->json(['success' => true, 'message' => 'Karyawan berhasil dihapus.']);
    }

    /**
     * GET /api/employees/meta
     * 
     * Mengambil list departemen dan jabatan untuk dropdown form admin.
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

    // ─────────────────────────────────────────────────────────────────────────
    // PJ BAGIAN MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /api/employees/pj-bagian
     * 
     * Mengambil daftar semua user yang berstatus PJ Bagian beserta departemen yang mereka awasi.
     */
    public function listPjBagian()
    {
        $pjList = User::where('role', 'pj_bagian')
            ->with(['pjBagianDepartment', 'employee.position'])
            ->get()
            ->map(function ($u) {
                return [
                    'user_id'                 => $u->id,
                    'employee_id'             => $u->employee?->id,
                    'name'                    => $u->name,
                    'nip'                     => $u->nip,
                    'email'                   => $u->email,
                    'username'                => $u->username,
                    'profile_picture'         => $u->profile_picture ? url($u->profile_picture) : null,
                    'position'                => $u->employee?->position?->name,
                    'pj_bagian_department_id' => $u->pj_bagian_department_id,
                    'pj_bagian_department'    => $u->pjBagianDepartment?->name,
                ];
            });

        return response()->json(['success' => true, 'data' => $pjList]);
    }

    /**
     * PUT /api/employees/{id}/assign-pj-bagian
     * 
     * Menugaskan karyawan sebagai PJ Bagian untuk departemen tertentu.
     * Jika departemen sudah punya PJ Bagian aktif, PJ lama otomatis dinonaktifkan.
     */
    public function assignPjBagian(Request $request, Employee $employee)
    {
        $data = $request->validate([
            'department_id' => 'required|exists:departments,id',
        ]);

        $departmentId = $data['department_id'];
        $targetUser   = $employee->user;

        if (!$targetUser) {
            return response()->json(['success' => false, 'message' => 'Akun user karyawan tidak ditemukan.'], 404);
        }

        // Cek & nonaktifkan PJ Bagian lama pada departemen yang sama
        $existingPj = User::where('role', 'pj_bagian')
            ->where('pj_bagian_department_id', $departmentId)
            ->where('id', '!=', $targetUser->id)
            ->first();

        if ($existingPj) {
            $existingPj->update([
                'role'                    => 'employee',
                'pj_bagian_department_id' => null,
            ]);
            \App\Models\Notification::create([
                'user_id' => $existingPj->id,
                'title'   => 'Status PJ Bagian Dicabut',
                'body'    => 'Peran Penanggung Jawab Bagian Anda telah dialihkan ke pegawai lain oleh Administrator.',
                'type'    => 'system',
                'data'    => [],
            ]);
        }

        // Tugaskan sebagai PJ Bagian
        $targetUser->update([
            'role'                    => 'pj_bagian',
            'pj_bagian_department_id' => $departmentId,
        ]);

        $department = Department::find($departmentId);

        \App\Models\Notification::create([
            'user_id' => $targetUser->id,
            'title'   => 'Anda Ditugaskan sebagai PJ Bagian 🏥',
            'body'    => 'Anda kini menjadi Penanggung Jawab Bagian untuk departemen ' . ($department?->name ?? '') . '.',
            'type'    => 'system',
            'data'    => ['department_id' => $departmentId],
        ]);

        $targetUser->load('pjBagianDepartment');

        return response()->json([
            'success' => true,
            'message' => $targetUser->name . ' berhasil ditugaskan sebagai PJ Bagian untuk departemen ' . ($department?->name ?? '') . '.',
            'data'    => [
                'user_id'                 => $targetUser->id,
                'name'                    => $targetUser->name,
                'role'                    => $targetUser->role,
                'pj_bagian_department_id' => $targetUser->pj_bagian_department_id,
                'pj_bagian_department'    => $targetUser->pjBagianDepartment?->name,
            ],
        ]);
    }

    /**
     * PUT /api/employees/{id}/revoke-pj-bagian
     * 
     * Mencabut status PJ Bagian dari karyawan — role dikembalikan ke 'employee'.
     */
    public function revokePjBagian(Employee $employee)
    {
        $targetUser = $employee->user;

        if (!$targetUser) {
            return response()->json(['success' => false, 'message' => 'Akun user karyawan tidak ditemukan.'], 404);
        }

        if ($targetUser->role !== 'pj_bagian') {
            return response()->json(['success' => false, 'message' => 'Karyawan ini bukan PJ Bagian.'], 422);
        }

        $targetUser->update([
            'role'                    => 'employee',
            'pj_bagian_department_id' => null,
        ]);

        \App\Models\Notification::create([
            'user_id' => $targetUser->id,
            'title'   => 'Status PJ Bagian Dicabut',
            'body'    => 'Peran Penanggung Jawab Bagian Anda telah dicabut oleh Administrator.',
            'type'    => 'system',
            'data'    => [],
        ]);

        return response()->json([
            'success' => true,
            'message' => $targetUser->name . ' berhasil dicabut dari status PJ Bagian.',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Memformat output JSON karyawan agar konsisten.
     */
    private function formatEmployee(Employee $e): array
    {
        $today = $e->todayAttendance;

        $dayMap = [
            0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
            3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
        ];
        $todayName = $dayMap[\Carbon\Carbon::today('Asia/Jakarta')->dayOfWeek];

        if ($e->relationLoaded('schedules')) {
            $schedule = $e->schedules->first(fn($s) => $s->pivot->day_of_week === $todayName);
        } else {
            $schedule = $e->schedules()->wherePivot('day_of_week', $todayName)->first();
        }

        $computedStatus = null;
        if ($today) {
            $isIncomplete   = \App\Support\AttendanceRules::isAttendanceIncomplete($today, $e);
            $computedStatus = $isIncomplete ? 'tidak_lengkap' : $today->status;
        } else {
            if (!$schedule) {
                $computedStatus = 'tidak_ada_shift';
            } else {
                $now                = \Carbon\Carbon::now('Asia/Jakarta');
                $shiftStart         = $schedule->start_time;
                $resolvedCloseTime = $schedule->checkin_window_end_time;
                if (empty($resolvedCloseTime)) {
                    $startCarbon = \Carbon\Carbon::parse($schedule->start_time);
                    $endCarbon = \Carbon\Carbon::parse($schedule->end_time);
                    if ($endCarbon->lt($startCarbon)) {
                        $endCarbon->addDay();
                    }
                    $duration = $startCarbon->diffInMinutes($endCarbon);
                    $half = (int) ($duration / 2);
                    $resolvedCloseTime = $startCarbon->copy()->addMinutes($half)->format('H:i:s');
                }
                $shiftStartCarbon   = \Carbon\Carbon::today('Asia/Jakarta')->setTimeFromTimeString($shiftStart);
                $closeLimitCarbon   = \Carbon\Carbon::today('Asia/Jakarta')->setTimeFromTimeString($resolvedCloseTime);
                $holiday            = \App\Support\AttendanceRules::holidayOn(\Carbon\Carbon::today('Asia/Jakarta'));
                $isAssigned         = $holiday ? \App\Support\AttendanceRules::isAssignedToWorkOnHoliday($e, $holiday) : false;

                if ($now->gt($closeLimitCarbon)) {
                    $computedStatus = ($holiday && !$isAssigned) ? 'belum_hadir' : 'alpha';
                } else {
                    $computedStatus = 'belum_hadir';
                }
            }
        }

        return [
            'id'               => $e->id,
            'user_id'          => $e->user_id,
            'name'             => $e->user?->name,
            'email'            => $e->user?->email,
            'nip'              => $e->nip,
            'username'         => $e->user?->username,
            'role'             => $e->user?->role,
            'profile_picture'  => $e->user?->profile_picture ? url($e->user->profile_picture) : null,
            'department'       => $e->department?->name,
            'department_id'    => $e->department_id,
            'position'         => $e->position?->name,
            'position_id'      => $e->position_id,
            'phone'            => $e->phone,
            'gender'           => $e->gender,
            'join_date'        => $e->join_date?->toDateString(),
            'status'           => $e->status,
            'today_attendance' => [
                'check_in'  => $today?->check_in,
                'check_out' => $today?->check_out,
                'status'    => $computedStatus,
            ],
            'vehicles' => [
                'motor_plate_1' => $e->motor_plate_1,
                'motor_plate_2' => $e->motor_plate_2,
                'car_plate_1'   => $e->car_plate_1,
                'car_plate_2'   => $e->car_plate_2,
            ],
        ];
    }
}
