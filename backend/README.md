# Backend — Sistem Absensi RSUCL

Backend **Laravel 12** yang menyediakan REST API untuk aplikasi Sistem Absensi RS Umum Cempaka Lima.

---

## Stack

- **PHP** ≥ 8.3
- **Laravel** 12.x
- **Autentikasi**: Laravel Sanctum (Bearer Token)
- **Database**: SQLite (development) / MySQL (production)

---

## Setup Awal

```bash
cd backend

# 1. Install dependensi PHP
composer install

# 2. Salin file konfigurasi
copy .env.example .env

# 3. Generate application key
php artisan key:generate

# 4. Buat database & jalankan migrasi + seeder
php artisan migrate:fresh --seed

# 5. Jalankan server lokal
php artisan serve
# → berjalan di http://localhost:8000
```

---

## Akun Default (Seeder)

| Role | NIP | Username | Password |
|------|-----|----------|----------|
| Admin | `ADMIN001` | `admin` | `Admin@RSUCL2025` |
| Karyawan 1 | `198501012010012001` | `rina.kusumawati` | `Karyawan@RSUCL1` |
| Karyawan 2 | `198805122012011002` | `ahmad.fauzi` | `Karyawan@RSUCL2` |
| Karyawan 3 | `199508152018012007` | `rini.handayani` | `Karyawan@RSUCL3` |

> ⚠️ Ganti semua password sebelum deploy ke production.

---

## Daftar Endpoint API

Base URL: `http://localhost:8000/api`
Format respons: `{ success, message, data }` atau `{ success, message, errors }`

### Auth (Public)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/login` | Login, terima token |

### Auth (Perlu Token)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/me` | Data user yang sedang login |
| `POST` | `/logout` | Logout, hapus token |

### Absensi (Semua role)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/attendance/today` | Absensi hari ini (milik sendiri) |
| `GET` | `/attendance/history` | Riwayat 100 data terakhir |
| `POST` | `/attendance/check-in` | Check-in dengan GPS opsional |
| `POST` | `/attendance/check-out` | Check-out |

### Cuti & Izin (Semua role)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/leave-requests` | Daftar pengajuan (milik sendiri / semua jika admin) |
| `POST` | `/leave-requests` | Ajukan cuti/izin/sakit |

### Notifikasi (Semua role)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/notifications` | Daftar notifikasi + jumlah belum dibaca |
| `PUT` | `/notifications/{id}/read` | Tandai 1 notifikasi dibaca |
| `PUT` | `/notifications/read-all` | Tandai semua dibaca |

### Admin Only
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/attendance/all-today` | Kehadiran semua karyawan hari ini |
| `GET/POST/PUT/DELETE` | `/employees` | CRUD karyawan |
| `GET` | `/employees/meta` | Data departemen & jabatan |
| `PUT` | `/leave-requests/{id}/approve` | Setujui pengajuan |
| `PUT` | `/leave-requests/{id}/reject` | Tolak pengajuan |
| `GET/POST/PUT/DELETE` | `/schedules` | CRUD jadwal shift |
| `GET` | `/reports/summary` | Ringkasan laporan |
| `GET` | `/settings` | Baca pengaturan sistem |
| `PUT` | `/settings` | Simpan pengaturan sistem |

---

## Struktur Folder

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── AuthController.php
│   │   ├── EmployeeController.php
│   │   ├── AttendanceController.php
│   │   ├── LeaveRequestController.php
│   │   ├── NotificationController.php
│   │   ├── ReportController.php
│   │   ├── ScheduleController.php
│   │   └── SettingController.php
│   └── Middleware/
│       └── EnsureIsAdmin.php
└── Models/
    ├── User.php
    ├── Employee.php
    ├── Department.php
    ├── Position.php
    ├── Attendance.php
    ├── LeaveRequest.php
    ├── Schedule.php
    ├── Notification.php
    └── Setting.php
routes/
└── api.php
database/
├── migrations/
└── seeders/
    └── DatabaseSeeder.php
```

---

## Keamanan

- Password di-hash dengan bcrypt via Eloquent cast `hashed`
- Token Sanctum dihapus saat logout
- Endpoint admin dilindungi middleware `EnsureIsAdmin` → mengembalikan `403`
- CORS dikonfigurasi hanya untuk `localhost:5173` (Vite dev server)
- Tidak ada password yang ter-commit di source code
