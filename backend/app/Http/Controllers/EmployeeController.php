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
        $query = Employee::with(['user', 'department', 'position', 'todayAttendance', 'disciplinarySanctions']);
        if ($user && $user->role === 'pj_bagian') {
            $query->whereIn('department_id', $user->getPjDepartmentIds());
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
            'nik_ktp'  => $data['nik_ktp'],
            'username' => $data['username'],
        ]);

        $employee = Employee::create([
            'user_id'       => $user->id,
            'department_id' => $data['department_id'],
            'position_id'   => $data['position_id'],
            'nik_ktp'       => $data['nik_ktp'],
            'phone'         => $data['phone'] ?? null,
            'gender'        => $data['gender'] ?? null,
            'join_date'     => $data['join_date'] ?? null,
            'motor_plate_1' => $data['motor_plate_1'] ?? null,
            'motor_plate_2' => $data['motor_plate_2'] ?? null,
            'car_plate_1'   => $data['car_plate_1'] ?? null,
            'car_plate_2'   => $data['car_plate_2'] ?? null,
            'instagram'     => $data['instagram'] ?? null,
            'facebook'      => $data['facebook'] ?? null,
            'tiktok'        => $data['tiktok'] ?? null,
            'custom_leave_quota' => $data['custom_leave_quota'] ?? null,
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
            'department_id' => array_key_exists('department_id', $data) ? $data['department_id'] : $employee->department_id,
            'position_id'   => $data['position_id'] ?? $employee->position_id,
            'phone'         => array_key_exists('phone', $data) ? $data['phone'] : $employee->phone,
            'gender'        => array_key_exists('gender', $data) ? $data['gender'] : $employee->gender,
            'join_date'     => array_key_exists('join_date', $data) ? $data['join_date'] : $employee->join_date,
            'status'        => $data['status'] ?? $employee->status,
            'motor_plate_1' => array_key_exists('motor_plate_1', $data) ? $data['motor_plate_1'] : $employee->motor_plate_1,
            'motor_plate_2' => array_key_exists('motor_plate_2', $data) ? $data['motor_plate_2'] : $employee->motor_plate_2,
            'car_plate_1'   => array_key_exists('car_plate_1', $data) ? $data['car_plate_1'] : $employee->car_plate_1,
            'car_plate_2'   => array_key_exists('car_plate_2', $data) ? $data['car_plate_2'] : $employee->car_plate_2,
            'instagram'     => array_key_exists('instagram', $data) ? $data['instagram'] : $employee->instagram,
            'facebook'      => array_key_exists('facebook', $data) ? $data['facebook'] : $employee->facebook,
            'tiktok'        => array_key_exists('tiktok', $data) ? $data['tiktok'] : $employee->tiktok,
            'custom_leave_quota' => array_key_exists('custom_leave_quota', $data) ? $data['custom_leave_quota'] : $employee->custom_leave_quota,
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
        $user = $employee->user;
        if ($user) {
            $user->tokens()->delete();
            $user->delete();
        }
        $employee->delete();
        return response()->json(['success' => true, 'message' => 'Karyawan dan akun berhasil dihapus.']);
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
            ->with(['pjDepartments', 'employee.position'])
            ->get()
            ->map(function ($u) {
                return [
                    'user_id'                 => $u->id,
                    'employee_id'             => $u->employee?->id,
                    'name'                    => $u->name,
                    'nik_ktp'                 => $u->nik_ktp,
                    'email'                   => $u->email,
                    'username'                => $u->username,
                    'profile_picture'         => $u->profile_picture ? url($u->profile_picture) : null,
                    'position'                => $u->employee?->position?->name,
                    'pj_bagian_department_id' => $u->pjDepartments->first()?->id,
                    'pj_bagian_department'    => $u->pjDepartments->first()?->name,
                    'pj_departments'          => $u->pjDepartments->map(fn($d) => [
                        'id'   => $d->id,
                        'name' => $d->name
                    ])->toArray(),
                ];
            });

        return response()->json(['success' => true, 'data' => $pjList]);
    }

    /**
     * PUT /api/employees/{id}/assign-pj-bagian
     * 
     * Menugaskan karyawan sebagai PJ Bagian untuk departemen tertentu.
     * Mendukung rangkap beberapa departemen sekaligus.
     */
    public function assignPjBagian(Request $request, Employee $employee)
    {
        $data = $request->validate([
            'department_ids'   => 'nullable|array',
            'department_ids.*' => 'exists:departments,id',
            'department_id'    => 'nullable|exists:departments,id', // Fallback legacy
        ]);

        $departmentIds = [];
        if (isset($data['department_ids']) && is_array($data['department_ids'])) {
            $departmentIds = $data['department_ids'];
        } elseif (isset($data['department_id'])) {
            $departmentIds = [$data['department_id']];
        }

        if (empty($departmentIds)) {
            return response()->json(['success' => false, 'message' => 'Minimal pilih 1 unit kerja / departemen untuk diawasi.'], 422);
        }

        $targetUser = $employee->user;

        if (!$targetUser) {
            return response()->json(['success' => false, 'message' => 'Akun user karyawan tidak ditemukan.'], 404);
        }

        // Cek & sesuaikan PJ Bagian lama pada departemen yang dipilih
        foreach ($departmentIds as $deptId) {
            $otherPjs = User::where('role', 'pj_bagian')
                ->where('id', '!=', $targetUser->id)
                ->whereHas('pjDepartments', function ($q) use ($deptId) {
                    $q->where('departments.id', $deptId);
                })
                ->get();

            foreach ($otherPjs as $pj) {
                $pj->pjDepartments()->detach($deptId);
                
                // Jika tidak memegang departemen apa-apa lagi, turunkan ke employee
                if ($pj->pjDepartments()->count() === 0) {
                    $pj->update([
                        'role'                    => 'employee',
                        'pj_bagian_department_id' => null,
                    ]);
                    \App\Models\Notification::create([
                        'user_id' => $pj->id,
                        'title'   => 'Status PJ Bagian Dicabut',
                        'body'    => 'Peran Penanggung Jawab Bagian Anda telah dicabut sepenuhnya oleh Administrator.',
                        'type'    => 'system',
                        'data'    => [],
                    ]);
                } else {
                    $pj->update([
                        'pj_bagian_department_id' => $pj->pjDepartments->first()?->id,
                    ]);
                }
            }
        }

        // Tugaskan sebagai PJ Bagian untuk departemen-departemen tersebut
        $targetUser->update([
            'role'                    => 'pj_bagian',
            'pj_bagian_department_id' => $departmentIds[0], // simpan departemen pertama di field legacy
        ]);

        $targetUser->pjDepartments()->sync($departmentIds);

        // Ambil nama departemen untuk notifikasi
        $deptNames = Department::whereIn('id', $departmentIds)->pluck('name')->join(', ');

        \App\Models\Notification::create([
            'user_id' => $targetUser->id,
            'title'   => 'Anda Ditugaskan sebagai PJ Bagian 🏥',
            'body'    => 'Anda kini menjadi Penanggung Jawab Bagian untuk unit kerja: ' . $deptNames . '.',
            'type'    => 'system',
            'data' => ['department_ids' => $departmentIds],
        ]);

        $targetUser->load('pjDepartments');

        return response()->json([
            'success' => true,
            'message' => $targetUser->name . ' berhasil ditugaskan sebagai PJ Bagian untuk unit: ' . $deptNames . '.',
            'data'    => [
                'user_id'                 => $targetUser->id,
                'name'                    => $targetUser->name,
                'role'                    => $targetUser->role,
                'pj_bagian_department_id' => $targetUser->pj_bagian_department_id,
                'pj_bagian_department'    => $targetUser->pjDepartments->first()?->name,
                'pj_departments'          => $targetUser->pjDepartments->map(fn($d) => [
                    'id'   => $d->id,
                    'name' => $d->name
                ])->toArray(),
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

        $targetUser->pjDepartments()->detach();

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
            $isOffShift = false;
            if ($schedule) {
                $uName = strtoupper($schedule->name);
                if (str_contains($uName, 'LIBUR') || str_contains($uName, 'LJ') || str_contains($uName, 'OFF')) {
                    $isOffShift = true;
                }
            }

            if (!$schedule || $isOffShift) {
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
            'nik_ktp'          => $e->nik_ktp,
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
            'custom_leave_quota'=> $e->custom_leave_quota,
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
            'social_media' => [
                'instagram' => $e->instagram,
                'facebook'  => $e->facebook,
                'tiktok'    => $e->tiktok,
            ],
            'disciplinary_sanctions' => $e->relationLoaded('disciplinarySanctions') 
                ? $e->disciplinarySanctions->map(fn($s) => [
                    'id'             => $s->id,
                    'type'           => $s->type,
                    'attachment_url' => $s->attachment_url ? url($s->attachment_url) : null,
                    'chronology_url' => $s->chronology_url ? url($s->chronology_url) : null,
                    'admin_note'     => $s->admin_note,
                    'created_at'     => $s->created_at->toIso8601String(),
                ])->toArray()
                : [],
        ];
    }
}
