<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Support\LeaveQuotaHelper;
use Illuminate\Http\Request;

/**
 * Class LeaveRequestController
 * 
 * Mengelola proses pengajuan cuti, izin, atau sakit oleh karyawan.
 * Mendukung penyimpanan file lampiran (Base64), peninjauan oleh administrator,
 * notifikasi real-time (email & sistem), dan pembuatan otomatis record absensi bagi pengajuan yang disetujui.
 */
class LeaveRequestController extends Controller
{
    /**
     * GET /api/leave-requests/quota
     *
     * Mengambil informasi kuota cuti tahunan.
     * - Karyawan: hanya bisa melihat kuota dirinya sendiri.
     * - Admin: dapat melihat kuota karyawan tertentu via ?employee_id=X,
     *          atau semua karyawan jika tidak ada query param.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function quota(Request $request)
    {
        $user = $request->user();
        $now  = \Carbon\Carbon::now();

        // Karyawan hanya bisa melihat kuota dirinya sendiri
        if (!$user->isAdmin()) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
            }
            return response()->json([
                'success' => true,
                'data'    => [
                    'employee_id'   => $employee->id,
                    'employee_name' => $employee->user?->name,
                    ...LeaveQuotaHelper::quotaInfo($employee, $now),
                ],
            ]);
        }

        // Admin: jika ada query param employee_id, tampilkan kuota 1 karyawan
        if ($request->filled('employee_id')) {
            $employee = \App\Models\Employee::with('user')->find($request->input('employee_id'));
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Karyawan tidak ditemukan.'], 404);
            }
            return response()->json([
                'success' => true,
                'data'    => [
                    'employee_id'   => $employee->id,
                    'employee_name' => $employee->user?->name,
                    ...LeaveQuotaHelper::quotaInfo($employee, $now),
                ],
            ]);
        }

        // Admin tanpa employee_id: kembalikan kuota seluruh karyawan aktif
        $employees = \App\Models\Employee::with('user')
            ->where('status', 'active')
            ->get();

        $result = $employees->map(function ($emp) use ($now) {
            return [
                'employee_id'   => $emp->id,
                'employee_name' => $emp->user?->name,
                ...LeaveQuotaHelper::quotaInfo($emp, $now),
            ];
        });

        return response()->json(['success' => true, 'data' => $result]);
    }

    /**
     * GET /api/leave-requests
     * 
     * Mengambil daftar pengajuan cuti/izin/sakit.
     * Jika role adalah Karyawan: hanya mengambil milik sendiri.
     * Jika role adalah Admin: mengambil seluruh pengajuan yang terdaftar untuk keperluan verifikasi.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // Siapkan query pengambilan data beserta relasi profil karyawan & reviewer (admin)
        $query = LeaveRequest::with(['employee.user', 'employee.department', 'reviewer', 'specialLeaveCategory'])
                             ->orderBy('created_at', 'desc');

        if ($request->query('personal') == '1') {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
            }
            $query->where('employee_id', $employee->id);
        } else {
            if ($user->isAdmin()) {
                // Admin melihat semua pengajuan — tidak ada filter tambahan
            } elseif ($user->isPjBagian()) {
                // PJ Bagian hanya melihat pengajuan dari pegawai di departemennya
                // (termasuk miliknya sendiri — dia boleh lihat, tapi tidak boleh approve miliknya)
                $deptIds = $user->getPjDepartmentIds();
                if (empty($deptIds)) {
                    return response()->json(['success' => false, 'message' => 'PJ Bagian belum ditugaskan ke departemen.'], 422);
                }
                $query->whereHas('employee', function ($q) use ($deptIds) {
                    $q->whereIn('department_id', $deptIds);
                });
            } else {
                // Karyawan biasa: hanya lihat milik sendiri
                $employee = $user->employee;
                if (!$employee) {
                    return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
                }
                $query->where('employee_id', $employee->id);
            }
        }

        $requests = $query->get()->map(fn($lr) => $this->format($lr));

        return response()->json(['success' => true, 'data' => $requests]);
    }

    /**
     * POST /api/leave-requests
     * 
     * Mengajukan izin/cuti/sakit baru beserta dokumen pendukung (Base64).
     * Mengirimkan notifikasi sistem dan email secara real-time ke semua akun admin.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->isAdmin() && $request->filled('employee_id')) {
            $employee = \App\Models\Employee::findOrFail($request->input('employee_id'));
        } else {
            $employee = $user->employee;
        }

        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Cek syarat minimal bekerja untuk mengajukan cuti, izin, sakit, cuti_khusus
        if (!$user->isAdmin()) {
            if (!$employee->join_date) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tanggal masuk pertama Anda belum diatur oleh Admin. Silakan hubungi Admin untuk memperbarui profil Anda.',
                    'errors'  => [
                        'join_date' => ['Tanggal masuk pertama belum diatur.'],
                    ],
                ], 422);
            }

            $joinDate = \Carbon\Carbon::parse($employee->join_date);
            $now = \Carbon\Carbon::now();
            $daysWorked = $joinDate->diffInDays($now, false);

            if ($daysWorked < 365) {
                $daysRemaining = 365 - max(0, $daysWorked);
                return response()->json([
                    'success' => false,
                    'message' => "Anda baru bekerja selama " . max(0, $daysWorked) . " hari. Pengajuan cuti/izin/sakit/cuti khusus hanya dapat dilakukan setelah bekerja minimal 1 tahun (365 hari). Kurang {$daysRemaining} hari lagi.",
                    'errors'  => [
                        'join_date' => ["Syarat pengajuan minimal bekerja 1 tahun (365 hari)."],
                    ],
                ], 422);
            }
        }

        // Validasi input data pengajuan cuti
        $rules = [
            'type'                      => 'required|in:cuti,izin,sakit,cuti_khusus',
            'start_date'                => 'required|date' . ($user->isAdmin() ? '' : '|after_or_equal:today'),
            'end_date'                  => 'required|date|after_or_equal:start_date',
            'reason'                    => 'required|string|max:500',
            'special_leave_category_id' => 'required_if:type,cuti_khusus|exists:special_leave_categories,id',
            'special_leave_category_other' => 'nullable|string|max:255',
            'posisi'                    => 'nullable|string|max:100',
            'unit_kerja'                => 'nullable|string|max:100',
            'substitute_name'           => 'nullable|string|max:500',
            'alamat_cuti'               => 'nullable|string|max:255',
        ];

        // Lampiran wajib untuk seluruh pengajuan cuti, sakit, dan cuti khusus
        if ($request->hasFile('attachment')) {
            $rules['attachment'] = 'required|file|mimes:pdf,jpg,jpeg,png|max:2048';
        } else {
            $rules['attachment'] = 'required|string';
        }

        $messages = [
            'attachment.required' => 'Dokumen pendukung / surat izin wajib diunggah.',
            'attachment.file' => 'Dokumen pendukung harus berupa file.',
            'attachment.mimes' => 'Format file dokumen pendukung harus berupa PDF, PNG, atau JPG/JPEG.',
            'attachment.max' => 'Ukuran file dokumen pendukung maksimal 2MB.',
            'special_leave_category_id.required_if' => 'Kategori cuti khusus wajib dipilih.',
            'special_leave_category_id.exists' => 'Kategori cuti khusus tidak valid.',
        ];

        $data = $request->validate($rules, $messages);

        // ── Validasi Kuota Cuti Tahunan ──────────────────────────────────────
        // Hanya berlaku untuk pengajuan bertipe 'cuti'. Izin, sakit, dan cuti_khusus tidak dibatasi.
        // Jika Admin, validasi ini dilewati agar admin bisa mencatat cuti lama / melakukan penyesuaian historis
        if ($data['type'] === 'cuti' && !$user->isAdmin()) {
            $now           = \Carbon\Carbon::now();
            $remaining     = LeaveQuotaHelper::remainingDays($employee, $now);
            $startDate     = \Carbon\Carbon::parse($data['start_date']);
            $endDate       = \Carbon\Carbon::parse($data['end_date']);
            $daysRequested = $startDate->diffInDays($endDate) + 1;

            // ── Aturan Baru: Diajukan paling lambat 2 minggu (14 hari) sebelum pelaksanaan ──
            $today = \Carbon\Carbon::today();
            $daysDiff = $today->diffInDays($startDate, false);
            if ($daysDiff < 14) {
                return response()->json([
                    'success' => false,
                    'message' => "Pengajuan Cuti Tahunan harus diajukan paling lambat 2 minggu (14 hari) sebelum tanggal pelaksanaan.",
                    'errors'  => [
                        'start_date' => ["Pengajuan Cuti Tahunan minimal diajukan 14 hari sebelum hari pelaksanaan."],
                    ],
                ], 422);
            }

            // ── Aturan 1: Maksimal 4 hari beruntun per pengajuan ─────────────
            if ($daysRequested > 4) {
                return response()->json([
                    'success' => false,
                    'message' => "Pengajuan cuti tahunan maksimal 4 hari beruntun dalam 1 bulan. Anda mengajukan {$daysRequested} hari sekaligus. Silakan bagi menjadi beberapa pengajuan yang lebih pendek.",
                    'errors'  => [
                        'duration' => ["Pengajuan cuti tahunan maksimal 4 hari beruntun."],
                    ],
                ], 422);
            }

            // ── Aturan 2: Kuota Tahunan ──────────────────────────────────────
            if ($daysRequested > $remaining) {
                return response()->json([
                    'success' => false,
                    'message' => "Sisa kuota cuti Anda hanya {$remaining} hari. Anda mengajukan {$daysRequested} hari. Silakan sesuaikan tanggal pengajuan.",
                    'errors'  => [
                        'quota' => ["Sisa kuota cuti Anda hanya {$remaining} hari. Anda mengajukan {$daysRequested} hari."],
                    ],
                ], 422);
            }

            // ── Aturan 3: Maksimal 4 hari cuti per bulan kalender ────────────
            $monthsToCheck = [];
            $cursor = $startDate->copy()->startOfMonth();
            $endMonth = $endDate->copy()->startOfMonth();
            while ($cursor->lte($endMonth)) {
                $monthsToCheck[] = ['year' => $cursor->year, 'month' => $cursor->month];
                $cursor->addMonth();
            }

            $indoMonths = [
                1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
            ];

            foreach ($monthsToCheck as $m) {
                $y = $m['year']; $mo = $m['month'];

                // Hitung hari pengajuan baru yang jatuh di bulan ini
                $monthStart = \Carbon\Carbon::create($y, $mo, 1)->startOfMonth();
                $monthEnd   = \Carbon\Carbon::create($y, $mo, 1)->endOfMonth();
                $overlapStart = $startDate->copy()->max($monthStart);
                $overlapEnd   = $endDate->copy()->min($monthEnd);
                $newDaysThisMonth = $overlapStart->diffInDays($overlapEnd) + 1;

                // Hitung cuti yang sudah committed di bulan ini
                $existingDaysThisMonth = LeaveQuotaHelper::committedDaysInMonth($employee, $y, $mo);

                $totalThisMonth = $existingDaysThisMonth + $newDaysThisMonth;
                $monthLabel = ($indoMonths[$mo] ?? $mo) . ' ' . $y;

                if ($totalThisMonth > 4) {
                    return response()->json([
                        'success' => false,
                        'message' => "Total cuti tahunan pada bulan {$monthLabel} melebihi batas maksimal 4 hari per bulan (sudah ada {$existingDaysThisMonth} hari, pengajuan baru {$newDaysThisMonth} hari di bulan tersebut = total {$totalThisMonth} hari).",
                        'errors'  => [
                            'monthly_limit' => ["Batas cuti tahunan bulan {$monthLabel}: {$existingDaysThisMonth} hari sudah diajukan, maksimal 4 hari/bulan."],
                        ],
                    ], 422);
                }
            }
        }

        // ── Validasi Kuota Sakit Biasa ───────────────────────────────────────
        // Hanya berlaku untuk pengajuan bertipe 'sakit' (regular Sakit).
        // Jika Admin, validasi ini dilewati agar admin bisa mencatat sakit lama / melakukan penyesuaian historis
        if ($data['type'] === 'sakit' && !$user->isAdmin()) {
            $startDate     = \Carbon\Carbon::parse($data['start_date']);
            $endDate       = \Carbon\Carbon::parse($data['end_date']);
            $daysRequested = $startDate->diffInDays($endDate) + 1;

            // ── Aturan 1: Maksimal 3 hari per pengajuan ──────────────────────
            if ($daysRequested > 3) {
                return response()->json([
                    'success' => false,
                    'message' => "Pengajuan sakit biasa maksimal 3 hari per pengajuan. Anda mengajukan {$daysRequested} hari. Silakan sesuaikan tanggal atau ajukan Sakit Kekhususan jika memiliki surat rekomendasi dokter untuk penyakit jangka panjang.",
                    'errors'  => [
                        'duration' => ["Pengajuan sakit biasa maksimal 3 hari."],
                    ],
                ], 422);
            }

            // ── Aturan 2: Kuota Bulanan (Maks. 3 hari/bulan) ─────────────────
            $monthsToCheck = [];
            $cursor = $startDate->copy()->startOfMonth();
            $endMonth = $endDate->copy()->startOfMonth();
            while ($cursor->lte($endMonth)) {
                $monthsToCheck[] = ['year' => $cursor->year, 'month' => $cursor->month];
                $cursor->addMonth();
            }

            $indoMonths = [
                1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
                5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
                9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
            ];

            foreach ($monthsToCheck as $m) {
                $y = $m['year']; $mo = $m['month'];

                // Hitung hari pengajuan baru yang jatuh di bulan ini
                $monthStart = \Carbon\Carbon::create($y, $mo, 1)->startOfMonth();
                $monthEnd   = \Carbon\Carbon::create($y, $mo, 1)->endOfMonth();
                $overlapStart = $startDate->copy()->max($monthStart);
                $overlapEnd   = $endDate->copy()->min($monthEnd);
                $newDaysThisMonth = $overlapStart->diffInDays($overlapEnd) + 1;

                // Hitung sakit yang sudah committed di bulan ini
                $q = $employee->leaveRequests()
                    ->where('type', 'sakit')
                    ->whereIn('status', ['pending', 'approved'])
                    ->where('start_date', '<=', $monthEnd->toDateString())
                    ->where('end_date',   '>=', $monthStart->toDateString());

                $sakitRequests = $q->get();
                $existingDaysThisMonth = 0;
                foreach ($sakitRequests as $sr) {
                    $srStart = \Carbon\Carbon::parse(max($sr->start_date->toDateString(), $monthStart->toDateString()));
                    $srEnd   = \Carbon\Carbon::parse(min($sr->end_date->toDateString(), $monthEnd->toDateString()));
                    $existingDaysThisMonth += $srStart->diffInDays($srEnd) + 1;
                }

                $totalThisMonth = $existingDaysThisMonth + $newDaysThisMonth;
                $monthLabel = ($indoMonths[$mo] ?? $mo) . ' ' . $y;

                if ($totalThisMonth > 3) {
                    return response()->json([
                        'success' => false,
                        'message' => "Total sakit biasa pada bulan {$monthLabel} melebihi batas maksimal 3 hari per bulan (sudah ada {$existingDaysThisMonth} hari, pengajuan baru {$newDaysThisMonth} hari di bulan tersebut = total {$totalThisMonth} hari). Silakan ajukan Sakit Kekhususan jika memiliki surat rekomendasi dokter untuk penyakit jangka panjang.",
                        'errors'  => [
                            'monthly_limit' => ["Batas sakit biasa bulan {$monthLabel}: {$existingDaysThisMonth} hari sudah diajukan, maksimal 3 hari/bulan."],
                        ],
                    ], 422);
                }
            }
        }

        // ── Validasi Batas Pengajuan Cuti Khusus ─────────────────────────────
        // Hanya berlaku jika bukan Admin
        if ($data['type'] === 'cuti_khusus' && !$user->isAdmin()) {
            $category = \App\Models\SpecialLeaveCategory::find($data['special_leave_category_id']);
            if ($category) {
                $categoryName = strtolower($category->name);
                $startDate = \Carbon\Carbon::parse($data['start_date']);
                $endDate = \Carbon\Carbon::parse($data['end_date']);
                $daysRequested = $startDate->diffInDays($endDate) + 1;
                $today = \Carbon\Carbon::today();

                // 1. Validasi Cuti Menikah (Dikunci 3 hari per pengajuan & Maksimal 3 hari dalam 1 TAHUN)
                if (str_contains($categoryName, 'menikah')) {
                    // Batas waktu pengajuan: paling lambat 2 minggu (14 hari) sebelum pelaksanaan
                    $daysDiff = $today->diffInDays($startDate, false);
                    if ($daysDiff < 14) {
                        return response()->json([
                            'success' => false,
                            'message' => "Pengajuan Cuti Menikah harus diajukan paling lambat 2 minggu (14 hari) sebelum tanggal pelaksanaan.",
                            'errors'  => [
                                'start_date' => ["Pengajuan Cuti Menikah minimal diajukan 14 hari sebelum hari pelaksanaan."],
                            ],
                        ], 422);
                    }

                    // Durasi cuti menikah maksimal 3 hari per pengajuan
                    if ($daysRequested > 3) {
                        return response()->json([
                            'success' => false,
                            'message' => "Durasi Cuti Menikah dikunci maksimal 3 hari.",
                            'errors'  => [
                                'duration' => ["Durasi Cuti Menikah dikunci maksimal 3 hari."],
                            ],
                        ], 422);
                    }

                    // Kuota Cuti Menikah: Maksimal 3 hari dalam 1 TAHUN (1 tahun kalender)
                    $year = $startDate->year;
                    $yearStart = \Carbon\Carbon::create($year, 1, 1)->startOfDay();
                    $yearEnd   = \Carbon\Carbon::create($year, 12, 31)->endOfDay();

                    $existingRequests = $employee->leaveRequests()
                        ->where('type', 'cuti_khusus')
                        ->where('special_leave_category_id', $category->id)
                        ->whereIn('status', ['pending', 'approved'])
                        ->where('start_date', '<=', $yearEnd->toDateString())
                        ->where('end_date',   '>=', $yearStart->toDateString())
                        ->get();

                    $existingDaysThisYear = 0;
                    foreach ($existingRequests as $er) {
                        $erStart = \Carbon\Carbon::parse(max($er->start_date->toDateString(), $yearStart->toDateString()));
                        $erEnd   = \Carbon\Carbon::parse(min($er->end_date->toDateString(), $yearEnd->toDateString()));
                        $existingDaysThisYear += $erStart->diffInDays($erEnd) + 1;
                    }

                    if ($existingDaysThisYear + $daysRequested > 3) {
                        return response()->json([
                            'success' => false,
                            'message' => "Cuti Menikah dikunci maksimal 3 hari dalam 1 tahun kalender (tahun {$year} sudah pernah diambil {$existingDaysThisYear} hari, pengajuan baru {$daysRequested} hari = total " . ($existingDaysThisYear + $daysRequested) . " hari).",
                            'errors'  => [
                                'quota' => ["Cuti Menikah dikunci maksimal 3 hari dalam 1 tahun."],
                            ],
                        ], 422);
                    }
                }

                // 2. Validasi Cuti Melahirkan / Keguguran (Dikunci maksimal 90 hari / 3 bulan)
                elseif (str_contains($categoryName, 'melahirkan') || str_contains($categoryName, 'keguguran')) {
                    // Batas waktu pengajuan: paling lambat 2 hari setelah kejadian
                    $daysPast = $startDate->diffInDays($today, false);
                    if ($daysPast > 2) {
                        return response()->json([
                            'success' => false,
                            'message' => "Permohonan Cuti Melahirkan/Keguguran harus diajukan paling lambat 2 hari setelah kejadian.",
                            'errors'  => [
                                'start_date' => ["Cuti Melahirkan/Keguguran paling lambat diajukan 2 hari setelah kejadian."],
                            ],
                        ], 422);
                    }

                    // Durasi cuti melahirkan maksimal 90 hari (3 bulan)
                    if ($daysRequested > 90) {
                        return response()->json([
                            'success' => false,
                            'message' => "Durasi Cuti Melahirkan/Keguguran dikunci maksimal 90 hari (3 bulan). Anda mengajukan {$daysRequested} hari.",
                            'errors'  => [
                                'duration' => ["Durasi Cuti Melahirkan/Keguguran dikunci maksimal 90 hari (3 bulan)."],
                            ],
                        ], 422);
                    }
                }

                // 3. Validasi Duka / Kematian / Meninggal (Dikunci 3 hari per pengajuan & Maksimal 3 hari dalam 1 BULAN)
                elseif (str_contains($categoryName, 'meninggal') || str_contains($categoryName, 'duka') || str_contains($categoryName, 'kepergian')) {
                    // Diajukan paling lambat 2 hari setelah kejadian
                    $daysPast = $startDate->diffInDays($today, false);
                    if ($daysPast > 2) {
                        return response()->json([
                            'success' => false,
                            'message' => "Pengajuan Cuti Duka/Kematian Keluarga harus diajukan paling lambat 2 hari setelah tanggal kejadian.",
                            'errors'  => [
                                'start_date' => ["Cuti duka/kematian keluarga paling lambat diajukan 2 hari setelah kejadian."],
                            ],
                        ], 422);
                    }

                    // Durasi cuti duka maksimal 3 hari per pengajuan
                    if ($daysRequested > 3) {
                        return response()->json([
                            'success' => false,
                            'message' => "Durasi Cuti Duka/Kematian Keluarga dikunci maksimal 3 hari.",
                            'errors'  => [
                                'duration' => ["Durasi Cuti Duka/Kematian dikunci maksimal 3 hari."],
                            ],
                        ], 422);
                    }

                    // Kuota Cuti Duka/Meninggal: Maksimal 3 hari dalam 1 BULAN
                    $year = $startDate->year;
                    $month = $startDate->month;
                    $monthStart = \Carbon\Carbon::create($year, $month, 1)->startOfMonth();
                    $monthEnd   = \Carbon\Carbon::create($year, $month, 1)->endOfMonth();

                    $existingRequests = $employee->leaveRequests()
                        ->where('type', 'cuti_khusus')
                        ->where('special_leave_category_id', $category->id)
                        ->whereIn('status', ['pending', 'approved'])
                        ->where('start_date', '<=', $monthEnd->toDateString())
                        ->where('end_date',   '>=', $monthStart->toDateString())
                        ->get();

                    $existingDaysThisMonth = 0;
                    foreach ($existingRequests as $er) {
                        $erStart = \Carbon\Carbon::parse(max($er->start_date->toDateString(), $monthStart->toDateString()));
                        $erEnd   = \Carbon\Carbon::parse(min($er->end_date->toDateString(), $monthEnd->toDateString()));
                        $existingDaysThisMonth += $erStart->diffInDays($erEnd) + 1;
                    }

                    if ($existingDaysThisMonth + $daysRequested > 3) {
                        return response()->json([
                            'success' => false,
                            'message' => "Cuti Duka / Kematian dikunci maksimal 3 hari dalam 1 bulan kalender (sudah pernah diambil {$existingDaysThisMonth} hari di bulan ini, pengajuan baru {$daysRequested} hari = total " . ($existingDaysThisMonth + $daysRequested) . " hari).",
                            'errors'  => [
                                'quota' => ["Cuti Duka / Kematian dikunci maksimal 3 hari dalam 1 bulan."],
                            ],
                        ], 422);
                    }
                }

                // 4. Validasi Sakit Kekhususan (TIDAK USAH DIKUNCI - Bebas Durasi & Kuota)
                elseif (str_contains($categoryName, 'sakit')) {
                    // Bebas durasi & kuota sesuai instruksi surat dokter
                }
            }
        }

        // Simpan file dokumen pendukung ke server storage
        $attachmentUrl = null;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            $fileName = 'attachment_leave_' . $employee->id . '_' . time() . '.' . $file->getClientOriginalExtension();
            $path = \Illuminate\Support\Facades\Storage::disk('public')->putFileAs('leave-attachments', $file, $fileName);
            $attachmentUrl = '/storage/' . $path;
        } else if ($request->filled('attachment')) {
            $attachmentUrl = $this->storeBase64Attachment(
                $request->input('attachment'),
                'attachment_leave_' . $employee->id . '_' . time()
            );
        }
        // Cari PJ Bagian yang bertanggung jawab atas departemen karyawan ini
        $pjBagian = null;
        if ($employee->department_id) {
            $pjBagian = \App\Models\User::where('role', 'pj_bagian')
                ->whereHas('pjDepartments', function ($q) use ($employee) {
                    $q->where('departments.id', $employee->department_id);
                })
                ->first();
        }

        // Tentukan pj_status secara otomatis
        $pjStatus = 'pending';
        if ($user->isAdmin()) {
            $pjStatus = 'approved';
        } else if (!$pjBagian || $pjBagian->id === $request->user()->id) {
            $pjStatus = 'approved';
        }

        // Buat record pengajuan
        $lr = LeaveRequest::create([
            'employee_id'               => $employee->id,
            'type'                      => $data['type'],
            'special_leave_category_id' => $data['special_leave_category_id'] ?? null,
            'special_leave_category_other' => $data['special_leave_category_other'] ?? null,
            'start_date'                => $data['start_date'],
            'end_date'                  => $data['end_date'],
            'reason'                    => $data['reason'],
            'attachment_url'            => $attachmentUrl,
            'status'                    => $user->isAdmin() ? 'approved' : 'pending',
            'pj_status'                 => $pjStatus,
            'reviewed_by'               => $user->isAdmin() ? $user->id : null,
            'reviewed_at'               => $user->isAdmin() ? now() : null,
            'posisi'                    => $data['posisi'] ?? null,
            'unit_kerja'                => $data['unit_kerja'] ?? null,
            'substitute_name'           => $data['substitute_name'] ?? null,
            'alamat_cuti'               => $data['alamat_cuti'] ?? null,
        ]);

        if ($user->isAdmin()) {
            // Generate attendance records immediately
            $start = \Carbon\Carbon::parse($lr->start_date);
            $end = \Carbon\Carbon::parse($lr->end_date);
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                $dateStr = $date->toDateString();
                \App\Models\Attendance::updateOrCreate(
                    [
                        'employee_id' => $lr->employee_id,
                        'date'        => $dateStr,
                    ],
                    [
                        'status'             => $lr->type === 'cuti_khusus' ? 'cuti' : $lr->type,
                        'check_in'           => null,
                        'check_out'          => null,
                        'note'               => "Masa " . ucfirst($lr->type) . ": " . $lr->reason . " (Diinput Admin)",
                        'latitude'           => null,
                        'longitude'          => null,
                        'accuracy'           => null,
                        'is_within_geofence' => false,
                        'image_check_in'     => null,
                        'image_check_out'    => null,
                    ]
                );
            }
        } else {
            // Kirim notifikasi sistem ke PJ Bagian departemen karyawan (jika ada),
            // atau ke admin jika departemen tidak memiliki PJ Bagian.
            $notifLeave = \App\Models\Setting::get('notif_leave', '1');
            if ($notifLeave !== '0') {
                if ($pjBagian && $pjBagian->id !== $request->user()->id) {
                    Notification::create([
                        'user_id' => $pjBagian->id,
                        'title'   => 'Pengajuan ' . ucfirst($data['type']) . ' Baru',
                        'body'    => ($employee->user?->name ?? 'Karyawan') . ' mengajukan ' . $data['type'] .
                                     ' dari ' . $data['start_date'] . ' s/d ' . $data['end_date'] . '.',
                        'type'    => 'leave',
                        'data'    => ['leave_request_id' => $lr->id],
                    ]);
                } else {
                    $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
                    foreach ($admins as $admin) {
                        Notification::create([
                            'user_id' => $admin->id,
                            'title'   => 'Pengajuan ' . ucfirst($data['type']) . ' Baru',
                            'body'    => ($employee->user?->name ?? 'Karyawan') . ' mengajukan ' . $data['type'] .
                                         ' dari ' . $data['start_date'] . ' s/d ' . $data['end_date'] . '.',
                            'type'    => 'leave',
                            'data'    => ['leave_request_id' => $lr->id],
                        ]);
                    }
                }
            }

            // Kirim email pengajuan baru ke semua admin (jika notif_email diset aktif dan langsung di-approve/tanpa PJ)
            $notifEmail = \App\Models\Setting::get('notif_email', '1');
            if ($notifEmail !== '0' && $pjStatus === 'approved') {
                $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
                foreach ($admins as $admin) {
                    try {
                        \Illuminate\Support\Facades\Mail::raw(
                            "Halo {$admin->name},\n\nAda pengajuan " . $data['type'] . " baru dari " . ($employee->user?->name ?? 'Karyawan') . ".\n\nDetail:\n- Jenis: " . ucfirst($data['type']) . "\n- Tanggal: " . $data['start_date'] . " s/d " . $data['end_date'] . "\n- Alasan: " . $data['reason'] . "\n\nSilakan masuk ke panel admin RSUCL untuk memproses pengajuan ini.",
                            function ($message) use ($admin, $data) {
                                $message->to($admin->email)
                                        ->subject('Pengajuan ' . ucfirst($data['type']) . ' Baru - RSUCL');
                            }
                        );
                    } catch (\Exception $e) {
                        \Illuminate\Support\Facades\Log::error('Gagal mengirim email pengajuan cuti: ' . $e->getMessage());
                    }
                }
            }
        }

        $lr->load(['employee.user', 'employee.department', 'reviewer']);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan ' . $data['type'] . ' berhasil dikirim.',
            'data'    => $this->format($lr),
        ], 201);
    }

    /**
     * PUT /api/leave-requests/{id}/approve
     * 
     * Menyetujui pengajuan izin/cuti/sakit.
     * 
     * @param Request $request
     * @param LeaveRequest $leaveRequest
     * @return \Illuminate\Http\JsonResponse
     */
    public function approve(Request $request, LeaveRequest $leaveRequest)
    {
        return $this->review($request, $leaveRequest, 'approved');
    }

    /**
     * PUT /api/leave-requests/{id}/reject
     * 
     * Menolak pengajuan izin/cuti/sakit.
     * 
     * @param Request $request
     * @param LeaveRequest $leaveRequest
     * @return \Illuminate\Http\JsonResponse
     */
    public function reject(Request $request, LeaveRequest $leaveRequest)
    {
        return $this->review($request, $leaveRequest, 'rejected');
    }

    /**
     * Logika inti pemrosesan persetujuan/penolakan izin/cuti/sakit.
     * Jika disetujui ('approved'), sistem akan meng-generate otomatis record absensi pada tabel attendance
     * sepanjang rentang tanggal tersebut dengan status cuti/izin/sakit untuk mencegah tanda Alpa otomatis.
     * 
     * @param Request $request
     * @param LeaveRequest $lr
     * @param string $newStatus 'approved' atau 'rejected'
     * @return \Illuminate\Http\JsonResponse
     */
    private function review(Request $request, LeaveRequest $lr, string $newStatus)
    {
        $user = $request->user();

        // ── Guard khusus PJ Bagian ──────────────────────────────────────────
        if ($user->isPjBagian()) {
            // PJ Bagian tidak boleh approve/reject pengajuan miliknya sendiri
            if ($lr->employee && $lr->employee->user_id === $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak dapat memproses pengajuan cuti milik sendiri.',
                ], 403);
            }
            // PJ Bagian hanya boleh proses pengajuan dari departemen yang diawasi
            $deptIds = $user->getPjDepartmentIds();
            if (!in_array($lr->employee?->department_id, $deptIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda hanya dapat memproses pengajuan dari departemen yang Anda awasi.',
                ], 403);
            }
        }

        if (!in_array($lr->status, ['pending', 'cancelled', 'rejected']) || (!$user->isAdmin() && $lr->status !== 'pending')) {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan ini sudah diproses secara final sebelumnya.',
            ], 422);
        }

        $data = $request->validate(['admin_note' => 'nullable|string|max:300']);

        // 1. JIKA DI-REVIEW OLEH PJ BAGIAN
        if ($user->isPjBagian()) {
            if ($newStatus === 'approved') {
                $lr->update([
                    'pj_status'      => 'approved',
                    'pj_reviewed_by' => $user->id,
                    'pj_reviewed_at' => now(),
                    'pj_note'        => $data['admin_note'] ?? null,
                ]);

                // Kirim notifikasi sistem ke admin bahwa ada pengajuan yang di-acc PJ Bagian
                $admins = \App\Models\User::whereIn('role', ['admin', 'super_admin'])->get();
                foreach ($admins as $admin) {
                    Notification::create([
                        'user_id' => $admin->id,
                        'title'   => 'Pengajuan ' . ucfirst($lr->type) . ' Di-ACC PJ Bagian',
                        'body'    => ($lr->employee?->user?->name ?? 'Karyawan') . ' mengajukan ' . $lr->type . ' dan telah di-ACC PJ Bagian. Menunggu persetujuan final Anda.',
                        'type'    => 'leave',
                        'data'    => ['leave_request_id' => $lr->id],
                    ]);
                }

                // Kirim email pengajuan baru ke semua admin (jika notif_email diset aktif) setelah di-acc PJ Bagian
                $notifEmail = \App\Models\Setting::get('notif_email', '1');
                if ($notifEmail !== '0') {
                    foreach ($admins as $admin) {
                        try {
                            \Illuminate\Support\Facades\Mail::raw(
                                "Halo {$admin->name},\n\nPengajuan " . $lr->type . " dari " . ($lr->employee?->user?->name ?? 'Karyawan') . " telah DI-ACC PJ Bagian (" . $user->name . ") dan membutuhkan persetujuan final Anda.\n\nDetail:\n- Jenis: " . ucfirst($lr->type) . "\n- Tanggal: " . $lr->start_date->toDateString() . " s/d " . $lr->end_date->toDateString() . "\n- Alasan: " . $lr->reason . "\n\nSilakan masuk ke panel admin RSUCL untuk memproses pengajuan ini.",
                                function ($message) use ($admin, $lr) {
                                    $message->to($admin->email)
                                            ->subject('Pengajuan ' . ucfirst($lr->type) . ' Di-ACC PJ Bagian - RSUCL');
                                }
                            );
                        } catch (\Exception $e) {
                            \Illuminate\Support\Facades\Log::error('Gagal mengirim email pengajuan cuti: ' . $e->getMessage());
                        }
                    }
                }

                $lr->load(['employee.user', 'employee.department', 'reviewer', 'pjReviewer']);
                return response()->json([
                    'success' => true,
                    'message' => 'Pengajuan berhasil disetujui oleh PJ Bagian (menunggu persetujuan Admin).',
                    'data'    => $this->format($lr),
                ]);
            } else {
                // Jika ditolak PJ Bagian, maka otomatis status utama menjadi ditolak secara final
                $lr->update([
                    'pj_status'      => 'rejected',
                    'pj_reviewed_by' => $user->id,
                    'pj_reviewed_at' => now(),
                    'pj_note'        => $data['admin_note'] ?? null,
                    'status'         => 'rejected',
                    'reviewed_by'    => $user->id,
                    'reviewed_at'    => now(),
                    'admin_note'     => $data['admin_note'] ?? 'Ditolak PJ Bagian',
                ]);

                // Kirim notifikasi ke pegawai
                Notification::create([
                    'user_id' => $lr->employee->user_id,
                    'title'   => 'Pengajuan ' . ucfirst($lr->type) . ' Ditolak ❌',
                    'body'    => 'Pengajuan ' . $lr->type . ' Anda telah ditolak oleh PJ Bagian. Catatan: ' . ($data['admin_note'] ?? '-'),
                    'type'    => 'leave',
                    'data'    => ['leave_request_id' => $lr->id],
                ]);

                $lr->load(['employee.user', 'employee.department', 'reviewer', 'pjReviewer']);
                return response()->json([
                    'success' => true,
                    'message' => 'Pengajuan berhasil ditolak oleh PJ Bagian.',
                    'data'    => $this->format($lr),
                ]);
            }
        }

        // 2. JIKA DI-REVIEW OLEH ADMIN
        if ($user->isAdmin()) {
            // Jika admin meng-approve langsung saat pj_status masih pending, setel pj_status ke approved secara otomatis
            if ($lr->pj_status === 'pending') {
                $lr->pj_status = $newStatus === 'approved' ? 'approved' : 'rejected';
                $lr->pj_reviewed_by = $user->id;
                $lr->pj_reviewed_at = now();
                $lr->pj_note = $data['admin_note'] ?? 'Disetujui langsung oleh Admin';
            }

            // ── Cek Kuota Cuti saat Approve oleh Admin (Safety-Net) ──────────────────────────────────
            if ($newStatus === 'approved' && $lr->type === 'cuti') {
                $employee      = $lr->employee;
                $now           = \Carbon\Carbon::now();
                $quota         = LeaveQuotaHelper::quotaDays($employee);
                $alreadyUsed   = LeaveQuotaHelper::usedDays($employee, $now);
                $daysThisReq   = \Carbon\Carbon::parse($lr->start_date)->diffInDays(\Carbon\Carbon::parse($lr->end_date)) + 1;

                if (($alreadyUsed + $daysThisReq) > $quota) {
                    $remaining = max(0, $quota - $alreadyUsed);
                    return response()->json([
                        'success' => false,
                        'message' => "Tidak bisa menyetujui: sisa kuota cuti karyawan ini hanya {$remaining} hari, pengajuan ini membutuhkan {$daysThisReq} hari. Tolak pengajuan ini atau kurangi kuota yang sudah disetujui terlebih dahulu.",
                    ], 422);
                }
            }

            // Update status pengajuan beserta data reviewer (Admin)
            $lr->update([
                'status'          => $newStatus,
                'actual_end_date' => $newStatus === 'approved' ? null : $lr->actual_end_date,
                'reviewed_by'     => $user->id,
                'reviewed_at'     => now(),
                'admin_note'      => $data['admin_note'] ?? null,
                'pj_status'       => $lr->pj_status,
                'pj_reviewed_by'  => $lr->pj_reviewed_by,
                'pj_reviewed_at'  => $lr->pj_reviewed_at,
                'pj_note'         => $lr->pj_note,
            ]);

            // Jika disetujui, buat/perbarui record absensi harian karyawan tersebut
            if ($newStatus === 'approved') {
                $start = \Carbon\Carbon::parse($lr->start_date);
                $end = \Carbon\Carbon::parse($lr->end_date);
                for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                    $dateStr = $date->toDateString();
                    \App\Models\Attendance::updateOrCreate(
                        [
                            'employee_id' => $lr->employee_id,
                            'date'        => $dateStr,
                        ],
                        [
                            'status'             => $lr->type === 'cuti_khusus' ? 'cuti' : $lr->type, // cuti_khusus dipetakan sebagai 'cuti' di record absensi
                            'check_in'           => null,
                            'check_out'          => null,
                            'note'               => "Masa " . ucfirst($lr->type) . ": " . $lr->reason,
                            'latitude'           => null,
                            'longitude'          => null,
                            'accuracy'           => null,
                            'is_within_geofence' => false,
                            'image_check_in'     => null,
                            'image_check_out'    => null,
                        ]
                    );
                }

                // Hapus penugasan shift tanggal-spesifik (work_date) yang konflik dengan masa cuti/sakit ini.
                // Ini memastikan kalender bulanan konsisten: shift manual tidak menimpa status cuti yang sudah disetujui.
                // Logika kalender (Tier 3) dan mySchedule (Prioritas 0) akan secara otomatis
                // menampilkan status cuti/sakit selama rentang ini.
                \Illuminate\Support\Facades\DB::table('employee_schedule')
                    ->where('employee_id', $lr->employee_id)
                    ->whereNotNull('work_date')
                    ->whereBetween('work_date', [$start->toDateString(), $end->toDateString()])
                    ->delete();
            }

            // Kirim notifikasi sistem secara real-time ke akun karyawan bersangkutan
            $statusLabel = $newStatus === 'approved' ? 'Disetujui ✅' : 'Ditolak ❌';
            $typeLabel   = match($lr->type) {
                'cuti'        => 'Cuti Tahunan',
                'cuti_khusus' => 'Cuti Khusus',
                'sakit'       => 'Izin Sakit',
                default       => ucfirst($lr->type),
            };
            $notifBody = $newStatus === 'approved'
                ? "Pengajuan {$typeLabel} Anda untuk " . $lr->start_date->toDateString() . " s/d " . $lr->end_date->toDateString() . " telah disetujui. Jadwal shift Anda pada rentang tanggal tersebut telah otomatis disesuaikan menjadi status {$typeLabel}." . ($data['admin_note'] ? ' Catatan admin: ' . $data['admin_note'] : '')
                : "Pengajuan {$typeLabel} Anda untuk " . $lr->start_date->toDateString() . " s/d " . $lr->end_date->toDateString() . " ditolak." . ($data['admin_note'] ? ' Catatan admin: ' . $data['admin_note'] : '');
            Notification::create([
                'user_id' => $lr->employee->user_id,
                'title'   => 'Pengajuan ' . $typeLabel . ' ' . $statusLabel,
                'body'    => $notifBody,
                'type'    => 'leave',
                'data'    => ['leave_request_id' => $lr->id],
            ]);

            $lr->load(['employee.user', 'employee.department', 'reviewer', 'pjReviewer']);

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan berhasil ' . ($newStatus === 'approved' ? 'disetujui' : 'ditolak') . ' oleh Admin.',
                'data'    => $this->format($lr),
            ]);
        }

        return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
    }

    /**
     * DELETE /api/leave-requests/{id}
     * 
     * Menghapus satu pengajuan cuti tertentu dari database.
     * 
     * @param Request $request
     * @param LeaveRequest $leaveRequest
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, LeaveRequest $leaveRequest)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $leaveRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan cuti berhasil dihapus.'
        ]);
    }

    /**
     * DELETE /api/leave-requests/{id}/cancel
     *
     * Membatalkan pengajuan cuti/izin/sakit oleh karyawan sendiri.
     *
     * Aturan:
     * - Hanya bisa membatalkan pengajuan MILIK SENDIRI.
     * - Hanya bisa membatalkan yang masih berstatus 'pending'.
     * - Pengajuan yang sudah disetujui/ditolak TIDAK bisa dibatalkan.
     *
     * @param Request      $request
     * @param LeaveRequest $leaveRequest
     * @return \Illuminate\Http\JsonResponse
     */
    public function cancel(Request $request, LeaveRequest $leaveRequest)
    {
        $user     = $request->user();
        $employee = $user->employee;

        // Pastikan karyawan hanya bisa membatalkan pengajuan miliknya sendiri
        if (!$employee || $leaveRequest->employee_id !== $employee->id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki akses untuk membatalkan pengajuan ini.',
            ], 403);
        }

        // Pegawai hanya bisa membatalkan jika status utama masih 'pending'.
        if ($leaveRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan yang sudah disetujui atau ditolak oleh Admin tidak dapat dibatalkan.',
            ], 422);
        }

        // Hapus file lampiran dari storage jika ada
        if ($leaveRequest->attachment_url) {
            $path = str_replace('/storage/', '', $leaveRequest->attachment_url);
            \Illuminate\Support\Facades\Storage::disk('public')->delete($path);
        }

        $leaveRequest->delete();

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan berhasil dibatalkan.',
        ]);
    }

    /**
     * DELETE /api/leave-requests/all-processed
     * 
     * Menghapus seluruh data pengajuan cuti yang sudah selesai diproses (status: approved/rejected).
     * Digunakan untuk pembersihan data lama (log cleaning).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroyAll(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        LeaveRequest::whereIn('status', ['approved', 'rejected'])->delete();

        return response()->json([
            'success' => true,
            'message' => 'Semua pengajuan cuti lama berhasil dihapus.'
        ]);
    }


    /**
     * PUT /api/leave-requests/{id}/cancel
     *
     * Cancel an approved or pending leave request (Admin only).
     */
    public function cancelApprovedOrPending(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'cancellation_reason' => 'nullable|string|max:255',
        ]);

        $lr = LeaveRequest::findOrFail($id);

        if (!in_array($lr->status, ['approved', 'pending'])) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pengajuan berstatus pending atau approved yang dapat dibatalkan.',
            ], 422);
        }

        $wasApproved = $lr->status === 'approved';
        $reason = $request->input('cancellation_reason') ?: 'Dibatalkan oleh Admin';

        $lr->update([
            'status'              => 'cancelled',
            'cancelled_by'        => $request->user()->id,
            'cancelled_at'        => now(),
            'cancellation_reason' => $reason,
        ]);

        // If it was approved, delete the generated attendance records
        if ($wasApproved) {
            \App\Models\Attendance::where('employee_id', $lr->employee_id)
                ->whereBetween('date', [$lr->start_date->toDateString(), $lr->end_date->toDateString()])
                ->whereIn('status', ['cuti', 'izin', 'sakit'])
                ->delete();
        }

        // Send notification to employee
        Notification::create([
            'user_id' => $lr->employee->user_id,
            'title'   => 'Pengajuan Cuti Dibatalkan Admin ❌',
            'body'    => 'Pengajuan ' . $lr->type . ' Anda untuk tanggal ' . $lr->start_date->toDateString() . ' s/d ' . $lr->end_date->toDateString() . ' telah dibatalkan oleh admin. Alasan: ' . $reason,
            'type'    => 'leave',
            'data'    => ['leave_request_id' => $lr->id],
        ]);

        $lr->load(['employee.user', 'employee.department', 'reviewer']);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan cuti berhasil dibatalkan.',
            'data'    => $this->format($lr),
        ]);
    }

    /**
     * PUT /api/leave-requests/{id}/shorten
     *
     * Shorten an approved leave request (Admin only).
     */
    public function shortenApproved(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'actual_end_date'  => 'required|date',
            'shortened_reason' => 'required|string|max:255',
        ]);

        $lr = LeaveRequest::findOrFail($id);

        if ($lr->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pengajuan cuti yang telah disetujui (approved) yang dapat dipersingkat.',
            ], 422);
        }

        $actualEnd = \Carbon\Carbon::parse($request->input('actual_end_date'));
        $start = \Carbon\Carbon::parse($lr->start_date);
        $originalEnd = \Carbon\Carbon::parse($lr->end_date);

        if ($actualEnd->lt($start)) {
            return response()->json([
                'success' => false,
                'message' => 'Tanggal efektif selesai harus setelah atau sama dengan tanggal mulai cuti.',
            ], 422);
        }

        if ($actualEnd->gte($originalEnd)) {
            return response()->json([
                'success' => false,
                'message' => 'Tanggal efektif harus lebih awal dari tanggal selesai yang diajukan, gunakan pembatalan kalau memang tidak dipersingkat.',
            ], 422);
        }

        $lr->update([
            'actual_end_date'  => $actualEnd->toDateString(),
            'shortened_by'     => $request->user()->id,
            'shortened_at'     => now(),
            'shortened_reason' => $request->input('shortened_reason'),
        ]);

        // Clean up pseudo attendance records outside the shortened range
        $startToDelete = $actualEnd->copy()->addDay()->toDateString();
        \App\Models\Attendance::where('employee_id', $lr->employee_id)
            ->whereBetween('date', [$startToDelete, $originalEnd->toDateString()])
            ->whereIn('status', ['cuti', 'izin', 'sakit'])
            ->delete();

        // Send notification to employee
        Notification::create([
            'user_id' => $lr->employee->user_id,
            'title'   => 'Pengajuan Cuti Dipersingkat ⏱️',
            'body'    => 'Cuti ' . $lr->type . ' Anda (' . $lr->start_date->toDateString() . ' s/d ' . $lr->end_date->toDateString() . ') telah disesuaikan menjadi selesai pada ' . $actualEnd->toDateString() . ' oleh admin. Alasan: ' . $request->input('shortened_reason') . '. Sisa kuota cuti Anda diperbarui.',
            'type'    => 'leave',
            'data'    => ['leave_request_id' => $lr->id],
        ]);

        $lr->load(['employee.user', 'employee.department', 'reviewer']);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan cuti berhasil dipersingkat.',
            'data'    => $this->format($lr),
        ]);
    }

    /**
     * PUT /api/leave-requests/{id}/edit-admin
     *
     * Edit dates and details of any leave request (Admin/Super Admin only).
     * Supports lengthening, shortening, or correcting input mistakes in start/end dates.
     */
    public function editLeaveAdmin(Request $request, $id)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'admin_note' => 'nullable|string|max:255',
        ]);

        $lr = LeaveRequest::findOrFail($id);

        $newStart = \Carbon\Carbon::parse($request->input('start_date'));
        $newEnd   = \Carbon\Carbon::parse($request->input('end_date'));
        $adminNote = $request->input('admin_note');

        $updateData = [
            'start_date'        => $newStart->toDateString(),
            'end_date'          => $newEnd->toDateString(),
            'actual_end_date'   => null,
            'shortened_by'      => $request->user()->id,
            'shortened_at'      => now(),
        ];

        if ($adminNote !== null && trim($adminNote) !== '') {
            $updateData['admin_note'] = trim($adminNote);
            $updateData['shortened_reason'] = trim($adminNote);
        }

        $lr->update($updateData);

        // Jika permohonan disetujui, bersihkan data kehadiran pseudo di luar rentang baru
        if ($lr->status === 'approved') {
            \App\Models\Attendance::where('employee_id', $lr->employee_id)
                ->whereIn('status', ['cuti', 'izin', 'sakit'])
                ->where(function($q) use ($newStart, $newEnd) {
                    $q->where('date', '<', $newStart->toDateString())
                      ->orWhere('date', '>', $newEnd->toDateString());
                })
                ->delete();
        }

        // Kirim notifikasi ke pegawai
        Notification::create([
            'user_id' => $lr->employee->user_id,
            'title'   => 'Pengajuan Cuti/Sakit Diperbarui ✏️',
            'body'    => 'Pengajuan ' . $lr->type . ' Anda telah disesuaikan oleh Admin menjadi tanggal ' . $newStart->toDateString() . ' s/d ' . $newEnd->toDateString() . ($adminNote ? '. Catatan Admin: ' . $adminNote : ''),
            'type'    => 'leave',
            'data'    => ['leave_request_id' => $lr->id],
        ]);

        $lr->load(['employee.user', 'employee.department', 'reviewer']);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan cuti berhasil diperbarui.',
            'data'    => $this->format($lr),
        ]);
    }

    /**
     * GET /api/leave-requests/possible-early-returns
     *
     * Detect employees who check-in during approved leaves (Admin only).
     */
    public function possibleEarlyReturns(Request $request)
    {
        if (!$request->user()->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized.'], 403);
        }

        $possibleReturns = LeaveRequest::where('status', 'approved')
            ->whereNull('actual_end_date')
            ->whereDate('start_date', '<=', today()->toDateString())
            ->whereHas('employee.attendances', function($q) {
                $q->whereColumn('date', '>=', 'leave_requests.start_date')
                  ->whereColumn('date', '<=', 'leave_requests.end_date')
                  ->whereNotNull('check_in')
                  ->whereNotIn('status', ['cuti', 'izin', 'sakit']);
            })
            ->with(['employee.user', 'employee.department'])
            ->get();

        $result = $possibleReturns->map(function($leave) {
            $checkInDates = \App\Models\Attendance::where('employee_id', $leave->employee_id)
                ->whereDate('date', '>=', $leave->start_date->toDateString())
                ->whereDate('date', '<=', $leave->end_date->toDateString())
                ->whereNotNull('check_in')
                ->whereNotIn('status', ['cuti', 'izin', 'sakit'])
                ->pluck('date')
                ->map(fn($d) => $d->toDateString())
                ->toArray();

            return [
                'leave_request' => $this->format($leave),
                'detected_dates' => $checkInDates,
            ];
        });

        return response()->json([
            'success' => true,
            'data'    => $result,
        ]);
    }


    /**
     * Memformat output data pengajuan cuti/izin/sakit untuk response JSON API.
     * 
     * @param LeaveRequest $lr
     * @return array
     */
    private function format(LeaveRequest $lr): array
    {
        return [
            'id'                        => $lr->id,
            'type'                      => $lr->type,
            'special_leave_category_id' => $lr->special_leave_category_id,
            'special_leave_category'    => $lr->specialLeaveCategory ? [
                'id'   => $lr->specialLeaveCategory->id,
                'name' => $lr->specialLeaveCategory->name,
            ] : null,
            'special_leave_category_other' => $lr->special_leave_category_other,
            'start_date'         => $lr->start_date?->toDateString(),
            'end_date'           => $lr->end_date?->toDateString(),
            'actual_end_date'    => $lr->actual_end_date?->toDateString(),
            'effective_end_date' => $lr->effective_end_date?->toDateString(),
            'shortened_reason'   => $lr->shortened_reason,
            'shortened_at'       => $lr->shortened_at?->toDateTimeString(),
            'cancellation_reason'=> $lr->cancellation_reason,
            'cancelled_at'       => $lr->cancelled_at?->toDateTimeString(),
            'days'               => $lr->days_count,
            'reason'             => $lr->reason,
            'posisi'             => $lr->posisi,
            'unit_kerja'         => $lr->unit_kerja,
            'substitute_name'    => $lr->substitute_name,
            'alamat_cuti'        => $lr->alamat_cuti,
            'attachment_url'     => $lr->attachment_url ? url($lr->attachment_url) : null,
            'status'             => $lr->status,
            'admin_note'         => $lr->admin_note,
            'reviewed_at'        => $lr->reviewed_at?->toDateTimeString(),
            'pj_status'          => $lr->pj_status,
            'pj_note'            => $lr->pj_note,
            'pj_reviewed_at'     => $lr->pj_reviewed_at?->toDateTimeString(),
            'created_at'         => $lr->created_at?->toDateTimeString(),
            'employee'           => [
                'id'         => $lr->employee?->id,
                'name'       => $lr->employee?->user?->name,
                'nik_ktp'    => $lr->employee?->nik_ktp,
                'department' => $lr->employee?->department?->name,
                'phone'      => $lr->employee?->phone,
            ],
            'reviewer'           => $lr->reviewer ? ['name' => $lr->reviewer->name] : null,
            'pj_reviewer'        => $lr->pjReviewer ? ['name' => $lr->pjReviewer->name] : null,
        ];
    }

    /**
     * Memproses file upload berbasis Base64 (diterima dari frontend),
     * melakukan validasi ekstensi berkas, men-decode berkas,
     * lalu menyimpannya ke disk penyimpanan public (storage/app/public/attachments).
     * Mengembalikan URL path file agar dapat disimpan di database dan diakses via web.
     * 
     * @param string|null $base64Data String file Base64
     * @param string $baseName Nama dasar file unik
     * @return string|null Path relatif file yang disimpan
     */
    private function storeBase64Attachment(?string $base64Data, string $baseName): ?string
    {
        if (!$base64Data) {
            return null;
        }

        // Regex untuk mendeteksi tipe mime file (aplikasi pdf atau gambar jpeg/png)
        if (!preg_match('/^data:(image\/|application\/)(\w+);base64,/', $base64Data, $type)) {
            return null;
        }

        // Bersihkan string Base64 dari header metadata (e.g. data:image/png;base64,)
        $decodedData = substr($base64Data, strpos($base64Data, ',') + 1);
        $ext = strtolower($type[2]);

        // Validasi ekstensi berkas yang diizinkan (PDF, PNG, JPEG, JPG)
        if (!in_array($ext, ['pdf', 'png', 'jpeg', 'jpg'])) {
            return null;
        }

        // Decode data base64 menjadi raw binary data
        $decoded = base64_decode($decodedData);
        if ($decoded === false) {
            return null;
        }

        // Tentukan nama file unik dan simpan ke Storage disk public
        $fileName = $baseName . '.' . $ext;
        \Illuminate\Support\Facades\Storage::disk('public')->put('attachments/' . $fileName, $decoded);

        // Kembalikan URL path file yang valid (diarahkan ke /storage/...)
        return '/storage/attachments/' . $fileName;
    }
}
