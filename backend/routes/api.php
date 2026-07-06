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

// ── Public (tanpa token) ──────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login']);
Route::get('/settings', [SettingController::class, 'index']);

// ── Protected (perlu token) ───────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('/me',     [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    // Notifikasi (semua role)
    Route::get('/notifications',              [NotificationController::class, 'index']);
    Route::put('/notifications/read-all',     [NotificationController::class, 'markAllRead']);
    Route::put('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::delete('/notifications/delete-read', [NotificationController::class, 'deleteAllRead']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'delete']);

    // Absensi (karyawan + admin)
    Route::get('/attendance/today',   [AttendanceController::class, 'today']);
    Route::get('/attendance/history', [AttendanceController::class, 'history']);
    Route::post('/attendance/check-in',  [AttendanceController::class, 'checkIn']);
    Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);

    // Pengajuan Cuti/Izin (karyawan bisa buat & lihat miliknya; admin lihat semua)
    Route::get('/leave-requests',  [LeaveRequestController::class, 'index']);
    Route::post('/leave-requests', [LeaveRequestController::class, 'store']);



    // Jadwal shift karyawan yang sedang login (hari ini)
    Route::get('/my-schedule', [ScheduleController::class, 'mySchedule']);

    // ── Admin only ────────────────────────────────────────────────────
    Route::middleware(\App\Http\Middleware\EnsureIsAdmin::class)->group(function () {

        // Absensi semua karyawan (hari ini)
        Route::get('/attendance/all-today', [AttendanceController::class, 'allToday']);

        // Karyawan CRUD
        Route::get('/employees/meta',   [EmployeeController::class, 'meta']);
        Route::apiResource('/employees', EmployeeController::class);

        // Departemen/Bagian CRUD
        Route::apiResource('/departments', \App\Http\Controllers\DepartmentController::class);

        // Approve / Reject / Hapus pengajuan cuti
        Route::put('/leave-requests/{leaveRequest}/approve', [LeaveRequestController::class, 'approve']);
        Route::put('/leave-requests/{leaveRequest}/reject',  [LeaveRequestController::class, 'reject']);
        Route::delete('/leave-requests/all-processed',       [LeaveRequestController::class, 'destroyAll']);
        Route::delete('/leave-requests/{leaveRequest}',       [LeaveRequestController::class, 'destroy']);

        // Jadwal Shift
        Route::get('/employee-schedules', [ScheduleController::class, 'getEmployeeSchedules']);
        Route::post('/employee-schedules/assign', [ScheduleController::class, 'assignEmployeeSchedule']);
        Route::apiResource('/schedules', ScheduleController::class)->except(['show']);

        // Laporan
        Route::get('/reports/summary', [ReportController::class, 'summary']);
        Route::get('/reports/monthly-rekap', [ReportController::class, 'monthlyRekap']);

        // Pengaturan (PUT hanya admin)
        Route::put('/settings',  [SettingController::class, 'update']);
    });
});
