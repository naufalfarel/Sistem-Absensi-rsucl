# Sistem Absensi RS Umum Cempaka Lima

Sistem absensi pegawai untuk RS Umum Cempaka Lima: check-in/check-out, pengajuan cuti/izin/sakit, jadwal shift, notifikasi, dan laporan rekap kehadiran untuk admin.

## Struktur proyek

```
sistem-absensi-rsucl/
├── docs/
│   └── ARCHITECTURE.md   arsitektur, skema database, status pengerjaan
├── backend/               Laravel REST API + Sanctum + MySQL
└── frontend/              React + Vite + TypeScript + Tailwind + shadcn/ui
```

Backend dan frontend adalah dua project independen (dependency, instalasi, dan cara jalannya terpisah), dihubungkan lewat REST API. Masing-masing punya `README.md` sendiri dengan langkah instalasi detail:

- [`backend/README.md`](./backend/README.md) — instalasi Laravel, migration, seeder, daftar endpoint, kredensial akun awal
- [`frontend/README.md`](./frontend/README.md) — instalasi React, struktur halaman, status integrasi API

## Menjalankan proyek secara lokal

Backend dan frontend dijalankan terpisah, di dua terminal:

```bash
# Terminal 1 — backend
cd backend
php artisan serve

# Terminal 2 — frontend
cd frontend
npm run dev
```

Detail lengkap tiap langkah (termasuk migration, seeding, konfigurasi `.env`) ada di README masing-masing folder.

## Status pengerjaan

Backend sudah lengkap (migration, model, controller, validasi, autentikasi). Integrasi frontend ke API (axios, penyimpanan token, loading/error state) adalah tahap berikutnya — lihat `docs/ARCHITECTURE.md` bagian 5.

## Dokumentasi lebih lanjut

Lihat [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) untuk penjelasan arsitektur, skema database, dan alasan di balik beberapa keputusan desain.
