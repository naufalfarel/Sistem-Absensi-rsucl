<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DisciplinarySanction;
use App\Models\Employee;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class DisciplinarySanctionController extends Controller
{
    /**
     * Menampilkan daftar sanksi disiplin (Karyawan melihat miliknya sendiri, Admin melihat semua).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Mode Personal: jika pengguna bukan admin & bukan pj_bagian, ATAU meminta data personal (?personal=1)
        if ((!$user->isAdmin() && !$user->isPjBagian()) || $request->boolean('personal')) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json([
                    'success' => true,
                    'data'    => [],
                    'meta'    => ['current_page' => 1, 'last_page' => 1, 'per_page' => 15, 'total' => 0]
                ]);
            }

            $query = DisciplinarySanction::with(['employee.user', 'employee.department', 'creator'])
                ->where('employee_id', $employee->id)
                ->orderBy('created_at', 'desc');

            $items = $query->get();

            return response()->json([
                'success' => true,
                'data'    => $items,
                'meta'    => [
                    'current_page' => 1,
                    'last_page'    => 1,
                    'per_page'     => count($items),
                    'total'        => count($items),
                ]
            ]);
        }

        // Mode Admin / PJ Bagian
        $query = DisciplinarySanction::with(['employee.user', 'employee.department', 'creator'])
            ->orderBy('created_at', 'desc');

        if ($user->isPjBagian()) {
            if (!$user->pj_bagian_department_id) {
                return response()->json(['success' => false, 'message' => 'PJ Bagian belum ditugaskan ke departemen.'], 422);
            }
            $query->whereHas('employee', function ($q) use ($user) {
                $q->where('department_id', $user->pj_bagian_department_id);
            });
        }

        if ($request->filled('type') && $request->input('type') !== 'all') {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('department_id')) {
            $query->whereHas('employee', function ($q) use ($request) {
                $q->where('department_id', $request->input('department_id'));
            });
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->whereHas('employee', function ($q) use ($search) {
                $q->where('nik_ktp', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($qu) use ($search) {
                      $qu->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $paginated = $query->paginate(15);

        return response()->json([
            'success' => true,
            'data'    => $paginated->items(),
            'meta'    => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ]
        ]);
    }

    /**
     * Menyimpan tindakan sanksi disiplin baru (Hanya Admin).
     */
    public function store(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak. Fitur ini khusus Administrator.'], 403);
        }

        $validated = $request->validate([
            'employee_ids'   => 'required|array|min:1',
            'employee_ids.*' => 'required|exists:employees,id',
            'type'           => 'required|in:teguran,sp1,sp2,phk',
            'attachment'     => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'chronology'     => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'admin_note'     => 'nullable|string|max:2000',
            'created_at'     => 'nullable|date',
        ]);

        $attachmentUrl = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $fileName = 'sanction_' . time() . '_' . rand(1000, 9999) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('sanction-documents', $fileName, 'public');
            $attachmentUrl = '/storage/' . $path;
        }

        $chronologyUrl = null;
        if ($request->hasFile('chronology')) {
            $file = $request->file('chronology');
            $fileName = 'chronology_' . time() . '_' . rand(1000, 9999) . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('sanction-chronologies', $fileName, 'public');
            $chronologyUrl = '/storage/' . $path;
        }

        $createdRecords = [];

        foreach ($validated['employee_ids'] as $empId) {
            $sanction = new DisciplinarySanction([
                'employee_id'    => $empId,
                'type'           => $validated['type'],
                'attachment_url' => $attachmentUrl,
                'chronology_url' => $chronologyUrl,
                'admin_note'     => $validated['admin_note'] ?? null,
                'created_by'     => $request->user()->id,
            ]);

            if (!empty($validated['created_at'])) {
                $customDate = Carbon::parse($validated['created_at']);
                $sanction->created_at = $customDate;
                $sanction->updated_at = $customDate;
            }

            $sanction->save();

            $emp = Employee::with('user')->find($empId);
            if ($emp && $emp->user) {
                $typeLabels = [
                    'teguran' => 'Surat Teguran',
                    'sp1'     => 'Surat Peringatan 1 (SP1)',
                    'sp2'     => 'Surat Peringatan 2 (SP2)',
                    'phk'     => 'Surat Pemutusan Hubungan Kerja (PHK)',
                ];
                $typeLabel = $typeLabels[$validated['type']] ?? ucfirst($validated['type']);
                Notification::create([
                    'user_id' => $emp->user->id,
                    'title'   => 'Tindakan Disiplin Diberikan ⚠️',
                    'body'    => "Anda menerima {$typeLabel} dari Manajemen/Admin. Silakan buka menu Sanksi Disiplin untuk info selengkapnya.",
                    'type'    => 'disciplinary',
                    'data'    => ['disciplinary_sanction_id' => $sanction->id],
                ]);
            }

            $createdRecords[] = $sanction;
        }

        return response()->json([
            'success' => true,
            'message' => 'Sanksi disiplin berhasil diterbitkan untuk ' . count($createdRecords) . ' pegawai.',
            'data'    => $createdRecords,
        ], 201);
    }

    /**
     * Menghapus tindakan sanksi disiplin (Hanya Admin).
     */
    public function destroy(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $sanction = DisciplinarySanction::findOrFail($id);

        if ($sanction->attachment_url) {
            $path = str_replace('/storage/', '', $sanction->attachment_url);
            Storage::disk('public')->delete($path);
        }

        if ($sanction->chronology_url) {
            $path = str_replace('/storage/', '', $sanction->chronology_url);
            Storage::disk('public')->delete($path);
        }

        $sanction->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sanksi disiplin berhasil dihapus.',
        ]);
    }
}
