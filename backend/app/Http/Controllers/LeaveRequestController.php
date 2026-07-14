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

        // Filter data jika user login bukan admin
        if (!$user->isAdmin()) {
            $employee = $user->employee;
            if (!$employee) {
                return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
            }
            $query->where('employee_id', $employee->id);
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
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Validasi input data pengajuan cuti
        $rules = [
            'type'                      => 'required|in:cuti,izin,sakit,cuti_khusus',
            'start_date'                => 'required|date|after_or_equal:today',
            'end_date'                  => 'required|date|after_or_equal:start_date',
            'reason'                    => 'required|string|max:500',
            'special_leave_category_id' => 'required_if:type,cuti_khusus|exists:special_leave_categories,id',
        ];

        // Lampiran wajib untuk cuti_khusus. Untuk tipe lain opsional.
        if ($request->hasFile('attachment')) {
            $rules['attachment'] = 'required_if:type,cuti_khusus|file|mimes:pdf,jpg,jpeg,png|max:2048';
        } else {
            $rules['attachment'] = 'required_if:type,cuti_khusus|string';
        }

        $messages = [
            'attachment.required_if' => 'Dokumen pendukung wajib diupload untuk pengajuan cuti khusus.',
            'attachment.file' => 'Dokumen pendukung harus berupa file.',
            'attachment.mimes' => 'Format file dokumen pendukung harus berupa PDF, PNG, atau JPG/JPEG.',
            'attachment.max' => 'Ukuran file dokumen pendukung maksimal 2MB.',
            'special_leave_category_id.required_if' => 'Kategori cuti khusus wajib dipilih.',
            'special_leave_category_id.exists' => 'Kategori cuti khusus tidak valid.',
        ];

        $data = $request->validate($rules, $messages);

        // ── Validasi Kuota Cuti Tahunan ──────────────────────────────────────
        // Hanya berlaku untuk pengajuan bertipe 'cuti'. Izin, sakit, dan cuti_khusus tidak dibatasi.
        if ($data['type'] === 'cuti') {
            $now           = \Carbon\Carbon::now();
            $remaining     = LeaveQuotaHelper::remainingDays($employee, $now);
            $startDate     = \Carbon\Carbon::parse($data['start_date']);
            $endDate       = \Carbon\Carbon::parse($data['end_date']);
            $daysRequested = $startDate->diffInDays($endDate) + 1;

            if ($daysRequested > $remaining) {
                return response()->json([
                    'success' => false,
                    'message' => "Sisa kuota cuti Anda hanya {$remaining} hari. Anda mengajukan {$daysRequested} hari. Silakan sesuaikan tanggal pengajuan.",
                    'errors'  => [
                        'quota' => ["Sisa kuota cuti Anda hanya {$remaining} hari. Anda mengajukan {$daysRequested} hari."],
                    ],
                ], 422);
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

        // Buat record pengajuan berstatus 'pending'
        $lr = LeaveRequest::create([
            'employee_id'               => $employee->id,
            'type'                      => $data['type'],
            'special_leave_category_id' => $data['special_leave_category_id'] ?? null,
            'start_date'                => $data['start_date'],
            'end_date'                  => $data['end_date'],
            'reason'                    => $data['reason'],
            'attachment_url'            => $attachmentUrl,
            'status'                    => 'pending',
        ]);

        // Kirim notifikasi sistem ke admin jika opsi notif_leave diaktifkan
        $notifLeave = \App\Models\Setting::get('notif_leave', '1');
        if ($notifLeave !== '0') {
            $admins = \App\Models\User::where('role', 'admin')->get();
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

        // Kirim email pengajuan baru ke semua admin (jika notif_email diset aktif)
        $notifEmail = \App\Models\Setting::get('notif_email', '1');
        if ($notifEmail !== '0') {
            $admins = \App\Models\User::where('role', 'admin')->get();
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
        // Cegah pemrosesan ulang data yang sudah disetujui/ditolak
        if ($lr->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan ini sudah diproses sebelumnya.',
            ], 422);
        }

        $data = $request->validate(['admin_note' => 'nullable|string|max:300']);

        // ── Cek Kuota Cuti saat Approve (Safety-Net) ──────────────────────────────────
        // Validasi juga dilakukan saat approve, bukan hanya saat submit.
        // Ini mencegah edge case: karyawan punya 2 pending cuti sekaligus,
        // keduanya lolos submit (karena pending tidak terhitung saat itu),
        // lalu admin approve keduanya sehingga total melebihi kuota.
        if ($newStatus === 'approved' && $lr->type === 'cuti') {
            $employee      = $lr->employee;
            $now           = \Carbon\Carbon::now();
            $quota         = LeaveQuotaHelper::quotaDays();
            // Hitung hanya approved (exclude request ini yang masih pending)
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

        // Update status pengajuan beserta data reviewer
        $lr->update([
            'status'      => $newStatus,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'admin_note'  => $data['admin_note'] ?? null,
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
        }

        // Kirim notifikasi sistem secara real-time ke akun karyawan bersangkutan
        $statusLabel = $newStatus === 'approved' ? 'Disetujui ✅' : 'Ditolak ❌';
        Notification::create([
            'user_id' => $lr->employee->user_id,
            'title'   => 'Pengajuan ' . ucfirst($lr->type) . ' ' . $statusLabel,
            'body'    => 'Pengajuan ' . $lr->type . ' Anda untuk ' . $lr->start_date->toDateString() .
                         ' s/d ' . $lr->end_date->toDateString() . ' telah ' .
                         ($newStatus === 'approved' ? 'disetujui.' : 'ditolak.') .
                         ($data['admin_note'] ? ' Catatan admin: ' . $data['admin_note'] : ''),
            'type'    => 'leave',
            'data'    => ['leave_request_id' => $lr->id],
        ]);

        $lr->load(['employee.user', 'employee.department', 'reviewer']);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan berhasil ' . ($newStatus === 'approved' ? 'disetujui' : 'ditolak') . '.',
            'data'    => $this->format($lr),
        ]);
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

        // Hanya pengajuan berstatus 'pending' yang bisa dibatalkan
        if ($leaveRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pengajuan yang masih menunggu persetujuan yang bisa dibatalkan.',
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
            'cancellation_reason' => 'required|string|max:255',
        ]);

        $lr = LeaveRequest::findOrFail($id);

        if (!in_array($lr->status, ['approved', 'pending'])) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pengajuan berstatus pending atau approved yang dapat dibatalkan.',
            ], 422);
        }

        $wasApproved = $lr->status === 'approved';

        $lr->update([
            'status' => 'cancelled',
            'cancelled_by' => $request->user()->id,
            'cancelled_at' => now(),
            'cancellation_reason' => $request->input('cancellation_reason'),
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
            'body'    => 'Pengajuan ' . $lr->type . ' Anda untuk tanggal ' . $lr->start_date->toDateString() . ' s/d ' . $lr->end_date->toDateString() . ' telah dibatalkan oleh admin. Alasan: ' . $request->input('cancellation_reason'),
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
            'attachment_url'     => $lr->attachment_url ? url($lr->attachment_url) : null,
            'status'             => $lr->status,
            'admin_note'         => $lr->admin_note,
            'reviewed_at'        => $lr->reviewed_at?->toDateTimeString(),
            'created_at'         => $lr->created_at?->toDateTimeString(),
            'employee'           => [
                'id'         => $lr->employee?->id,
                'name'       => $lr->employee?->user?->name,
                'nip'        => $lr->employee?->nip,
                'department' => $lr->employee?->department?->name,
            ],
            'reviewer'           => $lr->reviewer ? ['name' => $lr->reviewer->name] : null,
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
