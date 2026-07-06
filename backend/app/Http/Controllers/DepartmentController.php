<?php

namespace App\Http\Controllers;

use App\Models\Department;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    /**
     * GET /api/departments
     * List all departments with employee counts
     */
    public function index()
    {
        $departments = Department::withCount('employees')->get();
        return response()->json([
            'success' => true,
            'data'    => $departments,
        ]);
    }

    /**
     * POST /api/departments
     * Create a new department
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:departments,name',
        ], [
            'name.required' => 'Nama departemen/bagian wajib diisi.',
            'name.unique'   => 'Nama departemen/bagian sudah terdaftar.',
            'name.max'      => 'Nama departemen/bagian maksimal 100 karakter.',
        ]);

        $department = Department::create($data);
        $department->employees_count = 0;

        return response()->json([
            'success' => true,
            'message' => 'Departemen/Bagian berhasil ditambahkan.',
            'data'    => $department,
        ], 201);
    }

    /**
     * GET /api/departments/{id}
     */
    public function show(Department $department)
    {
        $department->loadCount('employees');
        return response()->json([
            'success' => true,
            'data'    => $department,
        ]);
    }

    /**
     * PUT /api/departments/{id}
     * Update department
     */
    public function update(Request $request, Department $department)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:departments,name,' . $department->id,
        ], [
            'name.required' => 'Nama departemen/bagian wajib diisi.',
            'name.unique'   => 'Nama departemen/bagian sudah terdaftar.',
            'name.max'      => 'Nama departemen/bagian maksimal 100 karakter.',
        ]);

        $department->update($data);
        $department->loadCount('employees');

        return response()->json([
            'success' => true,
            'message' => 'Departemen/Bagian berhasil diperbarui.',
            'data'    => $department,
        ]);
    }

    /**
     * DELETE /api/departments/{id}
     * Delete department if empty
     */
    public function destroy(Department $department)
    {
        if ($department->employees()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Departemen/Bagian tidak dapat dihapus karena masih memiliki pegawai aktif.',
            ], 422);
        }

        $department->delete();

        return response()->json([
            'success' => true,
            'message' => 'Departemen/Bagian berhasil dihapus.',
        ]);
    }
}
