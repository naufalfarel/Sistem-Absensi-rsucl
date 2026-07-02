# Arsitektur — Sistem Absensi RS Umum Cempaka Lima

## 1. Pola arsitektur

Backend dan frontend dipisah sebagai dua project independen, komunikasi lewat REST API (JSON) dengan autentikasi token Laravel Sanctum. Tidak ada rencana aplikasi mobile — target platform hanya web.

```
React + Vite + TypeScript (frontend/)
              │
              │  REST API, JSON, Authorization: Bearer <token>
              ▼
        Laravel API (backend/)
              │
              ▼
            MySQL
```

Frontend dan backend dijalankan dan di-deploy sebagai dua aplikasi terpisah.

## 2. Stack

| Bagian | Teknologi |
|---|---|
| Backend | Laravel, Laravel Sanctum (autentikasi token) |
| Database | MySQL |
| Frontend | React + Vite + TypeScript, Tailwind v4, shadcn/ui, axios |

## 3. Skema database

Lihat migration di `backend/database/migrations/`. Ringkasan tabel:

- `users` — akun login (admin/employee), `role`, `status`
- `employees` — data pegawai, terhubung ke `users`, `departments`, `positions`; soft delete
- `departments`, `positions` — data master
- `schedules` — jadwal shift per pegawai
- `attendance` — presensi harian (`hadir`/`telat`/`izin`/`sakit`/`alpha`); unique per pegawai per tanggal; soft delete
- `leave_requests` — pengajuan cuti/izin/sakit dan status persetujuannya
- `notifications` — notifikasi per user
- `settings` — konfigurasi sistem (jam kerja, radius, dsb.) sebagai key-value

Penjelasan lengkap penyesuaian kolom dari rancangan awal ada di `backend/README.md` bagian 6.

## 4. Endpoint API

Daftar lengkap endpoint, format response, dan aturan akses per role ada di `backend/README.md` bagian 5, supaya dokumentasi endpoint tidak duplikat di dua tempat.

## 5. Status pengerjaan

| Bagian | Status |
|---|---|
| Migration, model, seeder | Selesai |
| Controller, validasi, format response konsisten | Selesai |
| Middleware role & autentikasi Sanctum | Selesai |
| Command terjadwal (auto-mark alpha) | Selesai |
| Integrasi frontend ke API (axios, `src/services/api.ts`, loading/error state) | Belum dikerjakan — tahap selanjutnya |

## 6. Struktur folder proyek

```
sistem-absensi-rsucl/
├── README.md              ringkasan proyek, cara menjalankan backend + frontend
├── docs/
│   └── ARCHITECTURE.md    dokumen ini
├── backend/                Laravel API — lihat backend/README.md untuk instalasi
└── frontend/                React + Vite — lihat frontend/README.md untuk instalasi
```
