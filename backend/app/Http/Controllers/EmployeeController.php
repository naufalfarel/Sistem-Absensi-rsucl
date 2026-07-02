<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\User;
use App\Models\Department;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class EmployeeController extends Controller
{
    /**
     * GET /api/employees
     * Daftar seluruh karyawan (admin only)
     */
    public function index(Request $request)
    {
        $employees = Employee::with(['user', 'department', 'position', 'todayAttendance'])
            ->get()
            ->map(fn($e) => $this->formatEmployee($e));

        return response()->json(['success' => true, 'data' => $employees]);
    }

    /**
     * POST /api/employees
     * Tambah karyawan baru (admin only)
     */
    public function store(Request $request)
    {
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

        // Buat akun User
        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => 'employee',
            'nip'      => $data['nip'],
            'username' => $data['username'],
        ]);

        // Buat data karyawan
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
     */
    public function show(Employee $employee)
    {
        $employee->load(['user', 'department', 'position', 'todayAttendance']);
        return response()->json(['success' => true, 'data' => $this->formatEmployee($employee)]);
    }

    /**
     * PUT /api/employees/{id}
     */
    public function update(Request $request, Employee $employee)
    {
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

        // Update user
        $userFields = array_filter([
            'name'     => $data['name'] ?? null,
            'email'    => $data['email'] ?? null,
            'password' => isset($data['password']) ? Hash::make($data['password']) : null,
        ]);
        if ($userFields) $employee->user->update($userFields);

        // Update employee
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
     */
    public function destroy(Employee $employee)
    {
        $employee->delete();
        return response()->json(['success' => true, 'message' => 'Karyawan berhasil dihapus.']);
    }

    /** Daftar departemen & jabatan untuk form */
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

    // ── Helper ────────────────────────────────────────────────────────
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
