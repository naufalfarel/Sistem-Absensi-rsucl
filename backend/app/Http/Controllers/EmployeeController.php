<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\User;
use App\Models\Department;
use App\Models\Position;
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
    public function store(Request $request)
    {
        // Validasi parameter data karyawan baru beserta keunikan email, username, NIP
        $data = $request->validate([
            'name'          => 'required|string|max:100',
            'email'         => 'required|email|unique:users,email',
            'nip'           => 'required|string|unique:users,nip|unique:employees,nip',
            'username'      => 'required|string|unique:users,username',
            'password'      => 'required|string|min:6',
            'department_id' => 'required|exists:departments,id',
            'position_id'   => 'required|exists:positions,id',
            'phone'         => 'nullable|string|max:20',
            'gender'        => 'nullable|in:Laki-laki,Perempuan',
            'join_date'     => 'nullable|date',
        ]);

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
    public function update(Request $request, Employee $employee)
    {
        // Validasi input data update (mengabaikan keunikan untuk data milik sendiri)
        $data = $request->validate([
            'name'          => 'sometimes|string|max:100',
            'email'         => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($employee->user_id)],
            'department_id' => 'sometimes|exists:departments,id',
            'position_id'   => 'sometimes|exists:positions,id',
            'phone'         => 'nullable|string|max:20',
            'gender'        => 'nullable|in:Laki-laki,Perempuan',
            'join_date'     => 'nullable|date',
            'status'        => 'sometimes|in:active,inactive',
            'password'      => 'sometimes|string|min:6',
        ]);

        // 1. Perbarui atribut user
        $userFields = array_filter([
            'name'     => $data['name'] ?? null,
            'email'    => $data['email'] ?? null,
            'password' => isset($data['password']) ? Hash::make($data['password']) : null,
        ]);
        if ($userFields) $employee->user->update($userFields);

        // 2. Perbarui data kepegawaian karyawan
        $empFields = array_filter([
            'department_id' => $data['department_id'] ?? null,
            'position_id'   => $data['position_id'] ?? null,
            'phone'         => $data['phone'] ?? null,
            'gender'        => $data['gender'] ?? null,
            'join_date'     => $data['join_date'] ?? null,
            'status'        => $data['status'] ?? null,
        ], fn($v) => $v !== null);
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
        return [
            'id'          => $e->id,
            'user_id'     => $e->user_id,
            'name'        => $e->user?->name,
            'email'       => $e->user?->email,
            'nip'         => $e->nip,
            'username'    => $e->user?->username,
            'department'  => $e->department?->name,
            'department_id' => $e->department_id,
            'position'    => $e->position?->name,
            'position_id' => $e->position_id,
            'phone'       => $e->phone,
            'gender'      => $e->gender,
            'join_date'   => $e->join_date?->toDateString(),
            'status'      => $e->status,
            'today_attendance' => $today ? [
                'check_in'  => $today->check_in,
                'check_out' => $today->check_out,
                'status'    => $today->status,
            ] : null,
        ];
    }
}
