<?php

namespace App\Http\Controllers;

use App\Models\Department;
use Illuminate\Http\Request;

/**
 * Class DepartmentController
 * 
 * Mengelola operasi CRUD untuk entitas Unit kerja Unit Kerja.
 * Hanya dapat diakses oleh administrator (berdasarkan konfigurasi routing api.php).
 */
class DepartmentController extends Controller
{
    /**
     * GET /api/departments
     * 
     * Mengambil semua daftar departemen beserta jumlah karyawan di masing-masing departemen.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        // Mengambil departemen beserta hitungan relasi karyawan (employees_count)
        $departments = Department::withCount('employees')->get();
        return response()->json([
            'success' => true,
            'data'    => $departments,
        ]);
    }

    /**
     * POST /api/departments
     * 
     * Menambahkan departemen baru ke dalam database setelah melalui validasi keunikan nama.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        // Validasi input nama departemen
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:departments,name',
        ], [
            'name.required' => 'Nama Unit kerja wajib diisi.',
            'name.unique'   => 'Nama Unit kerja sudah terdaftar.',
            'name.max'      => 'Nama Unit kerja maksimal 100 karakter.',
        ]);

        // Simpan ke database
        $department = Department::create($data);
        // Set default count karyawan baru ke 0 untuk output JSON
        $department->employees_count = 0;

        return response()->json([
            'success' => true,
            'message' => 'Unit kerja berhasil ditambahkan.',
            'data'    => $department,
        ], 201);
    }

    /**
     * GET /api/departments/{id}
     * 
     * Mengambil detail satu departemen berdasarkan ID beserta jumlah karyawannya.
     * 
     * @param Department $department
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Department $department)
    {
        // Load hitungan jumlah karyawan untuk departemen bersangkutan
        $department->loadCount('employees');
        return response()->json([
            'success' => true,
            'data'    => $department,
        ]);
    }

    /**
     * PUT /api/departments/{id}
     * 
     * Memperbarui nama departemen yang sudah ada.
     * 
     * @param Request $request
     * @param Department $department
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, Department $department)
    {
        // Validasi nama baru (mengabaikan nama unik untuk ID departemen itu sendiri)
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:departments,name,' . $department->id,
        ], [
            'name.required' => 'Nama Unit kerja wajib diisi.',
            'name.unique'   => 'Nama Unit kerja sudah terdaftar.',
            'name.max'      => 'Nama Unit kerja maksimal 100 karakter.',
        ]);

        // Update data di database
        $department->update($data);
        // Load kembali hitungan jumlah karyawan
        $department->loadCount('employees');

        return response()->json([
            'success' => true,
            'message' => 'Unit kerja berhasil diperbarui.',
            'data'    => $department,
        ]);
    }

    /**
     * DELETE /api/departments/{id}
     * 
     * Menghapus departemen dari sistem.
     * Departemen tidak dapat dihapus jika masih terdapat karyawan yang terdaftar di dalamnya.
     * 
     * @param Department $department
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Department $department)
    {
        // Cegah penghapusan jika masih ada pegawai aktif
        if ($department->employees()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Unit kerja tidak dapat dihapus karena masih memiliki pegawai aktif.',
            ], 422);
        }

        // Lakukan soft-delete / hard-delete sesuai tipe model (Model Department tidak menggunakan SoftDeletes)
        $department->delete();

        return response()->json([
            'success' => true,
            'message' => 'Unit kerja berhasil dihapus.',
        ]);
    }
}
