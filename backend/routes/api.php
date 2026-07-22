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
use App\Http\Controllers\Api\PublicEmployeeRegistrationController;
use App\Http\Controllers\Api\AdminEmployeeRegistrationController;

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

// ── Onboarding / Registrasi Pegawai Baru (Publik) ──
Route::get('/public/employee-registrations/meta', [PublicEmployeeRegistrationController::class, 'meta']);
Route::post('/public/employee-registrations', [PublicEmployeeRegistrationController::class, 'store']);
Route::post('/public/employee-registrations/check-status', [PublicEmployeeRegistrationController::class, 'checkStatus'])->middleware('throttle:5,1');

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
    Route::delete('/overtime-requests/{id}/cancel', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'cancel']);
    
    // ── Fitur Pengajuan Surat Tugas
    Route::get('/assignment-letters', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'index']);
    Route::post('/assignment-letters', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'store']);
    Route::get('/assignment-letters/{id}', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'show']);
    Route::post('/assignment-letters/{id}/report', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'uploadReport']);
    Route::delete('/assignment-letters/{id}/cancel', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'cancel']);
    
    // Endpoint Kategori Cuti Khusus (Umum untuk Karyawan & Admin)
    Route::get('/special-leave-categories', [\App\Http\Controllers\SpecialLeaveCategoryController::class, 'index']);

    // ── Fitur Jadwal Shift
    Route::get('/my-schedule', [ScheduleController::class, 'mySchedule']);

    // Kalender Libur (Bisa dibaca semua karyawan)
    Route::get('/holidays', [\App\Http\Controllers\HolidayController::class, 'index']);

    // ── RUTE BERSAMA ADMINISTRATOR & PJ BAGIAN (Akses dengan role 'admin' atau 'pj_bagian') ──────
    Route::middleware('pj_or_admin')->group(function () {
        // Persetujuan Cuti (Leave Requests)
        Route::put('/leave-requests/{leaveRequest}/approve', [LeaveRequestController::class, 'approve']);
        Route::put('/leave-requests/{leaveRequest}/reject',  [LeaveRequestController::class, 'reject']);

        // Persetujuan Lembur Baru (Overtime Requests)
        Route::put('/overtime-requests/{id}/approve', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'approve']);
        Route::put('/overtime-requests/{id}/reject', [\App\Http\Controllers\Api\OvertimeRequestController::class, 'reject']);

        // Usulan Shift (Shift Assignment Proposals)
        Route::get('/shift-assignment-proposals', [\App\Http\Controllers\ShiftAssignmentProposalController::class, 'index']);
        Route::post('/shift-assignment-proposals', [\App\Http\Controllers\ShiftAssignmentProposalController::class, 'store']);

        // Shared Read-Only Lists
        Route::get('/employees', [EmployeeController::class, 'index']);
        Route::get('/schedules', [ScheduleController::class, 'index']);

        // Shift scheduling and management
        Route::get('/employee-schedules', [ScheduleController::class, 'getEmployeeSchedules']);
        Route::post('/employee-schedules/assign', [ScheduleController::class, 'assignEmployeeSchedule']);
        Route::post('/employee-schedules/assign-department', [ScheduleController::class, 'assignDepartmentSchedule']);

        // Kalender bulanan (jadwal per-tanggal)
        Route::get('/employee-schedules/monthly', [ScheduleController::class, 'getMonthlySchedule']);
        Route::post('/employee-schedules/assign-date', [ScheduleController::class, 'assignEmployeeScheduleByDate']);
        Route::post('/employee-schedules/assign-bulk-date', [ScheduleController::class, 'assignBulkByDate']);

        // Shift (Schedules) CRUD for both Admin and PJ Bagian
        Route::post('/schedules', [ScheduleController::class, 'store']);
        Route::put('/schedules/{schedule}', [ScheduleController::class, 'update']);
        Route::delete('/schedules/{schedule}', [ScheduleController::class, 'destroy']);
    });

    // ── RUTE KHUSUS ADMINISTRATOR (Hanya untuk User dengan Role 'admin') ──────
    Route::middleware('admin')->group(function () {
        
        // Endpoint CRUD Kategori Cuti Khusus (Hanya Admin)
        Route::post('/special-leave-categories', [\App\Http\Controllers\SpecialLeaveCategoryController::class, 'store']);
        Route::put('/special-leave-categories/{id}', [\App\Http\Controllers\SpecialLeaveCategoryController::class, 'update']);

        // Persetujuan & Penerbitan Surat Tugas
        Route::post('/assignment-letters/admin-create', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'adminStore']);
        Route::put('/assignment-letters/{id}/approve', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'approve']);
        Route::post('/assignment-letters/{id}/approve', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'approve']);
        Route::put('/assignment-letters/{id}/reject', [\App\Http\Controllers\Api\AssignmentLetterController::class, 'reject']);

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
        // Tolak laporan lembur (admin_note wajib)
        Route::put('/attendance/{id}/overtime/reject', [AttendanceController::class, 'rejectOvertime']);

        // ── CRUD Karyawan & Onboarding Draf Registrasi (Admin)
        Route::get('/employee-registrations', [AdminEmployeeRegistrationController::class, 'index']);
        Route::get('/employee-registrations/{id}', [AdminEmployeeRegistrationController::class, 'show']);
        Route::put('/employee-registrations/{id}/approve', [AdminEmployeeRegistrationController::class, 'approve']);
        Route::put('/employee-registrations/{id}/reject', [AdminEmployeeRegistrationController::class, 'reject']);
        Route::put('/employee-registrations/{id}/revision', [AdminEmployeeRegistrationController::class, 'requestRevision']);

        // Mendapatkan data meta pendukung (list department/position) untuk registrasi karyawan
        Route::get('/employees/meta',   [EmployeeController::class, 'meta']);
        
        // Pengelolaan PJ Bagian (Admin Only)
        Route::get('/employees/pj-bagian', [EmployeeController::class, 'listPjBagian']);
        Route::put('/employees/{employee}/assign-pj-bagian', [EmployeeController::class, 'assignPjBagian']);
        Route::put('/employees/{employee}/revoke-pj-bagian', [EmployeeController::class, 'revokePjBagian']);

        // API Resource standar untuk CRUD data Karyawan
        Route::apiResource('/employees', EmployeeController::class)->except(['index']);

        // ── CRUD Departemen / Bagian Unit Kerja
        Route::apiResource('/departments', \App\Http\Controllers\DepartmentController::class);

        // ── Verifikasi Pengajuan Izin/Cuti
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

        // Persetujuan Usulan Shift (Shift Assignment Proposals - Admin Only)
        Route::put('/shift-assignment-proposals/{id}/approve', [\App\Http\Controllers\ShiftAssignmentProposalController::class, 'approve']);
        Route::put('/shift-assignment-proposals/{id}/reject', [\App\Http\Controllers\ShiftAssignmentProposalController::class, 'reject']);


        // API Resource standar untuk CRUD data Shift (Schedules) kecuali endpoint Detail (show) - Moved to pj_or_admin group

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

    // ── RUTE KHUSUS SUPER ADMIN (Direktur RSUCL - Hanya untuk role 'super_admin') ──────
    Route::middleware('super_admin')->group(function () {
        Route::get('/super-admin/admins', [\App\Http\Controllers\AdminManagementController::class, 'index']);
        Route::post('/super-admin/admins', [\App\Http\Controllers\AdminManagementController::class, 'store']);
        Route::put('/super-admin/admins/{id}', [\App\Http\Controllers\AdminManagementController::class, 'update']);
        Route::delete('/super-admin/admins/{id}', [\App\Http\Controllers\AdminManagementController::class, 'destroy']);
    });
});
