<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\LeaveRequestController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\SettingController;

/*
|--------------------------------------------------------------------------
| API Routes — Sistem Absensi RSUCL
|--------------------------------------------------------------------------
|
| Autentikasi: Laravel Sanctum (Bearer Token)
| Format response: { success, message, data } atau { success, message, errors }
| Role: admin | employee
|
*/

// ── Rute Publik (Akses tanpa token / tanpa login) ───────────────────────
// Endpoint untuk proses login user
Route::post('/login', [AuthController::class, 'login']);
// Endpoint untuk reset password mandiri
Route::post('/forgot-password', [AuthController::class, 'resetPassword']);
// Endpoint untuk mengambil konfigurasi sistem absensi (misal data radius, geofence, nama instansi)
Route::get('/settings', [SettingController::class, 'index']);

// ── Rute Terproteksi (Wajib menggunakan token Laravel Sanctum) ─────────────
Route::middleware('auth:sanctum')->group(function () {

    // ── Manajemen Autentikasi & Akun
    // Mendapatkan data profile user yang sedang login
    Route::get('/me',     [AuthController::class, 'me']);
    // Mengakhiri sesi / menghapus token login saat ini
    Route::post('/logout', [AuthController::class, 'logout']);
    // Mengubah informasi profil (termasuk email, foto profil, dan password)
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    // Mengubah data kendaraan pegawai secara mandiri
    Route::put('/profile/vehicles', [AuthController::class, 'updateVehicles']);

    // ── Fitur Notifikasi (Dapat diakses admin & karyawan)
    // Mendapatkan daftar notifikasi miliknya
    Route::get('/notifications',              [NotificationController::class, 'index']);
    // Menandai seluruh notifikasi miliknya telah dibaca
    Route::put('/notifications/read-all',     [NotificationController::class, 'markAllRead']);
    // Menandai satu notifikasi tertentu sebagai telah dibaca
    Route::put('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    // Menghapus semua notifikasi yang berstatus sudah dibaca
    Route::delete('/notifications/delete-read', [NotificationController::class, 'deleteAllRead']);
    // Menghapus satu notifikasi tertentu
    Route::delete('/notifications/{notification}', [NotificationController::class, 'delete']);

    // ── Fitur Absensi Mandiri (Karyawan & Admin)
    // Mengecek apakah hari ini sudah melakukan absensi (Check-in/Check-out)
    Route::get('/attendance/today',   [AttendanceController::class, 'today']);
    // Mengambil daftar riwayat absensi diri sendiri pada bulan/tahun tertentu
    Route::get('/attendance/history', [AttendanceController::class, 'history']);
    // Melakukan Check-in kehadiran dengan verifikasi koordinat & foto selfie
    Route::post('/attendance/check-in',  [AttendanceController::class, 'checkIn']);
    // Melakukan Check-out kehadiran saat selesai shift
    Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);
    // Memperbarui catatan lembur setelah check-out berhasil
    Route::put('/attendance/overtime-note', [AttendanceController::class, 'updateOvertimeNote']);

    // ── Fitur Pengajuan Izin/Cuti
    Route::get('/leave-requests',       [LeaveRequestController::class, 'index']);
    Route::post('/leave-requests',      [LeaveRequestController::class, 'store']);
    Route::get('/leave-requests/quota', [LeaveRequestController::class, 'quota']);
    Route::delete('/leave-requests/{leaveRequest}/cancel', [LeaveRequestController::class, 'cancel']);
    
    // ── Fitur Pengajuan Lembur
    Route::get('/overtime-requests', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'index']);
    Route::get('/overtime-requests/summary', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'summary']);
    Route::post('/overtime-requests', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'store']);
    Route::get('/overtime-requests/{id}', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'show']);
    
    // Endpoint Kategori Cuti Khusus (Umum untuk Karyawan & Admin)
    Route::get('/special-leave-categories', [\App\Http\Controllers\SpecialLeaveCategoryController::class, 'index']);

    // ── Fitur Jadwal Shift
    Route::get('/my-schedule', [ScheduleController::class, 'mySchedule']);

    // Kalender Libur (Bisa dibaca semua karyawan)
    Route::get('/holidays', [\App\Http\Controllers\HolidayController::class, 'index']);

    // ── RUTE KHUSUS ADMINISTRATOR (Hanya untuk User dengan Role 'admin') ──────
    Route::middleware(\App\Http\Middleware\EnsureIsAdmin::class)->group(function () {
        
        // Endpoint CRUD Kategori Cuti Khusus (Hanya Admin)
        Route::post('/special-leave-categories', [\App\Http\Controllers\SpecialLeaveCategoryController::class, 'store']);
        Route::put('/special-leave-categories/{id}', [\App\Http\Controllers\SpecialLeaveCategoryController::class, 'update']);

        // ── Dashboard / Monitoring Kehadiran
        // Memonitoring status absensi seluruh karyawan hari ini secara real-time
        Route::get('/attendance/all-today', [AttendanceController::class, 'allToday']);

        // ── Riwayat Kehadiran (Admin)
        Route::get('/attendance', [AttendanceController::class, 'adminAttendanceHistory']);
        Route::get('/attendance/status-summary', [AttendanceController::class, 'adminStatusSummary']);

        // ── Fitur Pulang Cepat (Early Checkout) — Admin
        // Daftar absensi pulang cepat (filter: ?status=pending|approved|rejected)
        Route::get('/attendance/early-checkouts', [AttendanceController::class, 'earlyCheckouts']);
        // Setujui laporan pulang cepat
        Route::put('/attendance/{id}/early-checkout/approve', [AttendanceController::class, 'approveEarlyCheckout']);
        // Tolak laporan pulang cepat (admin_note wajib)
        Route::put('/attendance/{id}/early-checkout/reject', [AttendanceController::class, 'rejectEarlyCheckout']);

        // Daftar absensi lembur (admin)
        Route::get('/attendance/overtimes', [AttendanceController::class, 'overtimes']);
        Route::get('/attendance/overtimes/summary', [AttendanceController::class, 'overtimesSummary']);
        // Setujui/tolak laporan lembur
        Route::put('/attendance/{id}/overtime/approve', [AttendanceController::class, 'approveOvertime']);
        Route::put('/attendance/{id}/overtime/reject', [AttendanceController::class, 'rejectOvertime']);

        // Persetujuan Lembur Baru (Overtime Requests)
        Route::put('/overtime-requests/{id}/approve', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'approve']);
        Route::put('/overtime-requests/{id}/reject', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'reject']);

        // ── CRUD Karyawan
        // Mendapatkan data meta pendukung (list department/position) untuk registrasi karyawan
        Route::get('/employees/meta',   [EmployeeController::class, 'meta']);
        // API Resource standar untuk CRUD data Karyawan
        Route::apiResource('/employees', EmployeeController::class);

        // ── CRUD Departemen / Bagian Unit Kerja
        Route::apiResource('/departments', \App\Http\Controllers\DepartmentController::class);

        // ── Verifikasi Pengajuan Izin/Cuti
        // Menyetujui pengajuan cuti/izin karyawan
        Route::put('/leave-requests/{leaveRequest}/approve', [LeaveRequestController::class, 'approve']);
        // Menolak pengajuan cuti/izin karyawan disertai alasan penolakan
        Route::put('/leave-requests/{leaveRequest}/reject',  [LeaveRequestController::class, 'reject']);
        // Batalkan pengajuan cuti yang sudah disetujui atau pending
        Route::put('/leave-requests/{id}/cancel', [LeaveRequestController::class, 'cancelApprovedOrPending']);
        // Persingkat pengajuan cuti yang sudah disetujui
        Route::put('/leave-requests/{id}/shorten', [LeaveRequestController::class, 'shortenApproved']);
        // Deteksi kemungkinan pegawai kembali lebih awal dari cuti
        Route::get('/leave-requests/possible-early-returns', [LeaveRequestController::class, 'possibleEarlyReturns']);
        // Menghapus massal pengajuan cuti yang sudah berstatus 'approved' atau 'rejected'
        Route::delete('/leave-requests/all-processed',       [LeaveRequestController::class, 'destroyAll']);
        // Menghapus satu data pengajuan cuti tertentu
        Route::delete('/leave-requests/{leaveRequest}',       [LeaveRequestController::class, 'destroy']);

        // ── Manajemen Shift Kerja & Penugasan Jadwal
        // Mengambil daftar relasi shift karyawan
        Route::get('/employee-schedules', [ScheduleController::class, 'getEmployeeSchedules']);
        // Menugaskan/memetakan jadwal shift mingguan ke karyawan tertentu
        Route::post('/employee-schedules/assign', [ScheduleController::class, 'assignEmployeeSchedule']);
        // Menugaskan/memetakan jadwal shift mingguan ke seluruh karyawan dalam satu departemen sekaligus
        Route::post('/employee-schedules/assign-department', [ScheduleController::class, 'assignDepartmentSchedule']);
        // API Resource standar untuk CRUD data Shift (Schedules) kecuali endpoint Detail (show)
        Route::apiResource('/schedules', ScheduleController::class)->except(['show']);

        // ── Fitur Pelaporan
        // Mengambil summary data statistik absensi (misal jumlah hadir, sakit, alpa) untuk dashboard admin
        Route::get('/reports/summary', [ReportController::class, 'summary']);
        // Mengambil rekapitulasi data absensi bulanan dalam format tabular untuk pelaporan/ekspor
        Route::get('/reports/monthly-rekap', [ReportController::class, 'monthlyRekap']);
        // Mengekspor data plat nomor kendaraan seluruh pegawai ke file Excel (.xlsx)
        Route::get('/reports/vehicles/export', [ReportController::class, 'exportVehicles']);

        // ── Pengaturan Sistem
        // Mengubah parameter pengaturan global (koordinat geofence, radius, dll)
        Route::put('/settings',  [SettingController::class, 'update']);

        // CRUD Kalender Libur (Admin)
        Route::post('/holidays', [\App\Http\Controllers\HolidayController::class, 'store']);
        Route::post('/holidays/sync', [\App\Http\Controllers\HolidayController::class, 'sync']);
        Route::put('/holidays/{id}', [\App\Http\Controllers\HolidayController::class, 'update']);
        Route::delete('/holidays/{id}', [\App\Http\Controllers\HolidayController::class, 'destroy']);

        // Penugasan Kerja Hari Libur (Admin)
        Route::get('/holidays/{id}/work-assignments', [\App\Http\Controllers\HolidayWorkAssignmentController::class, 'index']);
        Route::post('/holidays/{id}/work-assignments', [\App\Http\Controllers\HolidayWorkAssignmentController::class, 'store']);
        Route::delete('/holidays/{id}/work-assignments/{employeeId}', [\App\Http\Controllers\HolidayWorkAssignmentController::class, 'destroy']);
    });
});
