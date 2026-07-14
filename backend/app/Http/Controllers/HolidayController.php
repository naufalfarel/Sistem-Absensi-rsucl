<?php

namespace App\Http\Controllers;

use App\Models\Holiday;
use App\Http\Requests\StoreHolidayRequest;
use App\Http\Requests\UpdateHolidayRequest;
use App\Http\Resources\HolidayResource;
use Illuminate\Http\Request;

class HolidayController extends Controller
{
    /**
     * GET /api/holidays
     * Semua role login boleh membaca.
     */
    public function index(Request $request)
    {
        $year = $request->query('year');
        $query = Holiday::withCount('holidayWorkAssignments')->orderBy('date', 'asc');

        if ($year) {
            $query->whereYear('date', $year);
        }

        $holidays = $query->get();

        return response()->json([
            'success' => true,
            'data' => HolidayResource::collection($holidays),
        ]);
    }

    /**
     * POST /api/holidays
     * Khusus admin.
     */
    public function store(StoreHolidayRequest $request)
    {
        $data = $request->validated();
        $holiday = Holiday::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Hari libur berhasil ditambahkan.',
            'data' => new HolidayResource($holiday),
        ], 201);
    }

    /**
     * PUT /api/holidays/{id}
     * Khusus admin.
     */
    public function update(UpdateHolidayRequest $request, $id)
    {
        $holiday = Holiday::findOrFail($id);
        $holiday->update($request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Hari libur berhasil diperbarui.',
            'data' => new HolidayResource($holiday),
        ]);
    }

    /**
     * DELETE /api/holidays/{id}
     * Khusus admin.
     */
    public function destroy($id)
    {
        $holiday = Holiday::findOrFail($id);
        $holiday->delete();

        return response()->json([
            'success' => true,
            'message' => 'Hari libur berhasil dihapus.',
        ]);
    }

    /**
     * POST /api/holidays/sync
     * Khusus admin.
     */
    public function sync(Request $request)
    {
        $year = $request->input('year') ?: now()->year;
        
        try {
            $count = \App\Support\HolidaySyncer::sync((int)$year);
            $message = "Berhasil menyinkronkan {$count} hari libur nasional untuk tahun {$year} dari internet.";
            if ($count === 0) {
                $message .= "\n\nCatatan: Kalender libur resmi pemerintah (SKB 3 Menteri) untuk tahun {$year} kemungkinan belum dirilis atau belum diperbarui di internet. Anda tetap dapat menambahkan hari libur secara manual menggunakan tombol 'Tambah Hari Libur'.";
            }
            return response()->json([
                'success' => true,
                'message' => $message,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => "Gagal menyinkronkan data hari libur: " . $e->getMessage(),
            ], 500);
        }
    }
}
