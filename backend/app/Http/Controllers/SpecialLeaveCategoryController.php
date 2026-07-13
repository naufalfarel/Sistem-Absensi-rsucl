<?php
// backend/app/Http/Controllers/SpecialLeaveCategoryController.php

namespace App\Http\Controllers;

use App\Models\SpecialLeaveCategory;
use Illuminate\Http\Request;

class SpecialLeaveCategoryController extends Controller
{
    /**
     * GET /api/special-leave-categories
     * 
     * Mengambil daftar kategori cuti khusus yang aktif.
     * Dapat diakses oleh semua pegawai terautentikasi.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user && $user->isAdmin()) {
            $categories = SpecialLeaveCategory::orderBy('name', 'asc')->get();
        } else {
            $categories = SpecialLeaveCategory::where('is_active', true)->orderBy('name', 'asc')->get();
        }
        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }

    /**
     * POST /api/special-leave-categories
     * 
     * Membuat kategori cuti khusus baru.
     * Hanya dapat diakses oleh administrator (terproteksi middleware).
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:special_leave_categories,name',
        ], [
            'name.required' => 'Nama kategori wajib diisi.',
            'name.unique' => 'Nama kategori sudah digunakan.',
        ]);

        $category = SpecialLeaveCategory::create([
            'name' => $data['name'],
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kategori cuti khusus berhasil ditambahkan.',
            'data' => $category
        ], 201);
    }

    /**
     * PUT /api/special-leave-categories/{id}
     * 
     * Mengubah kategori cuti khusus yang ada (nama atau status keaktifan).
     * Hanya dapat diakses oleh administrator.
     */
    public function update(Request $request, $id)
    {
        $category = SpecialLeaveCategory::find($id);
        if (!$category) {
            return response()->json([
                'success' => false,
                'message' => 'Kategori cuti khusus tidak ditemukan.'
            ], 404);
        }

        $data = $request->validate([
            'name' => 'required|string|max:100|unique:special_leave_categories,name,' . $id,
            'is_active' => 'required|boolean',
        ], [
            'name.required' => 'Nama kategori wajib diisi.',
            'name.unique' => 'Nama kategori sudah digunakan.',
            'is_active.required' => 'Status keaktifan wajib diisi.',
        ]);

        $category->update([
            'name' => $data['name'],
            'is_active' => $data['is_active'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kategori cuti khusus berhasil diperbarui.',
            'data' => $category
        ]);
    }
}
