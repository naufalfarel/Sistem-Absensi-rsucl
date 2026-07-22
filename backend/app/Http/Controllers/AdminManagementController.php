<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Controller AdminManagementController (Khusus Super Admin / Direktur RSUCL)
 * 
 * Mengelola pembuatan, pengeditan, peninjauan, dan penghapusan akun Administrator sistem.
 */
class AdminManagementController extends Controller
{
    /**
     * GET /api/super-admin/admins
     * Menampilkan daftar seluruh akun Admin & Super Admin.
     */
    public function index(Request $request)
    {
        $admins = User::whereIn('role', ['admin', 'super_admin'])
            ->orderBy('role', 'desc') // super_admin pertama
            ->orderBy('id', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $admins,
        ]);
    }

    /**
     * POST /api/super-admin/admins
     * Membuat akun Admin baru.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username',
            'email'    => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|regex:/^[0-9]{6,}$/',
            'nik_ktp'  => 'nullable|string|max:50',
            'role'     => 'nullable|string|in:admin,super_admin',
        ], [
            'password.regex' => 'Password hanya boleh berisi angka saja (minimal 6 angka).',
        ]);

        $user = User::create([
            'name'     => $request->name,
            'username' => strtolower(trim($request->username)),
            'email'    => strtolower(trim($request->email)),
            'password' => Hash::make($request->password),
            'nik_ktp'  => $request->nik_ktp ?: 'ADMIN' . rand(100, 999),
            'role'     => $request->role ?: 'admin',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Akun Admin berhasil dibuat.',
            'data'    => $user,
        ], 201);
    }

    /**
     * PUT /api/super-admin/admins/{id}
     * Mengubah data akun Admin.
     */
    public function update(Request $request, $id)
    {
        $adminUser = User::whereIn('role', ['admin', 'super_admin'])->findOrFail($id);

        $request->validate([
            'name'     => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username,' . $id,
            'email'    => 'required|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|regex:/^[0-9]{6,}$/',
            'nik_ktp'  => 'nullable|string|max:50',
            'role'     => 'nullable|string|in:admin,super_admin',
        ], [
            'password.regex' => 'Password hanya boleh berisi angka saja (minimal 6 angka).',
        ]);

        $updateData = [
            'name'     => $request->name,
            'username' => strtolower(trim($request->username)),
            'email'    => strtolower(trim($request->email)),
            'nik_ktp'  => $request->nik_ktp,
        ];

        if ($adminUser->role === 'super_admin' && $request->filled('role') && $request->role !== 'super_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Role Super Admin (Direktur RSUCL) terkunci dan tidak dapat diturunkan ke Admin biasa.',
            ], 422);
        }

        if ($request->filled('role')) {
            $updateData['role'] = $request->role;
        }

        if ($request->filled('password')) {
            $updateData['password'] = Hash::make($request->password);
        }

        $adminUser->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'Data akun Admin berhasil diperbarui.',
            'data'    => $adminUser->fresh(),
        ]);
    }

    /**
     * DELETE /api/super-admin/admins/{id}
     * Menghapus akun Admin.
     */
    public function destroy(Request $request, $id)
    {
        $currentUser = $request->user();
        if ($currentUser->id == $id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri.',
            ], 422);
        }

        $adminUser = User::whereIn('role', ['admin', 'super_admin'])->findOrFail($id);

        if ($adminUser->role === 'super_admin') {
            $superAdminCount = User::where('role', 'super_admin')->count();
            if ($superAdminCount <= 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tidak dapat menghapus akun Super Admin terakhir.',
                ], 422);
            }
        }

        $adminUser->delete();

        return response()->json([
            'success' => true,
            'message' => 'Akun Admin berhasil dihapus.',
        ]);
    }
}
