<div align="center">

# 🏥 Sistem Absensi RS Umum Cempaka Lima

**Aplikasi manajemen kehadiran pegawai rumah sakit berbasis web — full-stack, real-time, dan siap produksi.**

[![Laravel](https://img.shields.io/badge/Laravel-13.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white)](https://laravel.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

## 📋 Daftar Isi

- [Tentang Proyek](#-tentang-proyek)
- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Tech Stack](#-tech-stack)
- [Struktur Proyek](#-struktur-proyek)
- [Persyaratan Sistem](#-persyaratan-sistem)
- [Instalasi & Menjalankan Lokal](#-instalasi--menjalankan-lokal)
  - [Backend (Laravel)](#1-backend-laravel)
  - [Frontend (React)](#2-frontend-react)
- [Konfigurasi Environment](#-konfigurasi-environment)
- [API Endpoints](#-api-endpoints)
- [Default Akun](#-default-akun)
- [Paket & Dependensi](#-paket--dependensi)
- [Kontribusi](#-kontribusi)

---

## 🔍 Tentang Proyek

**Sistem Absensi RSUCL** adalah aplikasi web manajemen kehadiran pegawai yang dirancang khusus untuk RS Umum Cempaka Lima. Sistem ini menggantikan proses absensi manual dengan solusi digital yang efisien, akurat, dan mudah digunakan oleh seluruh staf rumah sakit.

Sistem ini mendukung dua peran utama:

- **👔 Admin** — Mengelola data karyawan, menyetujui pengajuan cuti/izin, memantau kehadiran seluruh pegawai, dan mengakses laporan rekap.
- **👤 Karyawan** — Melakukan check-in/check-out harian, mengajukan cuti/izin/sakit, melihat riwayat kehadiran, dan menerima notifikasi.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 🔐 **Autentikasi** | Login aman dengan Laravel Sanctum (Bearer Token) |
| 📍 **Check-in / Check-out** | Presensi harian dengan dukungan GPS opsional |
| 📝 **Pengajuan Cuti & Izin** | Pengajuan cuti, izin, dan sakit dengan alur persetujuan admin |
| 📅 **Manajemen Jadwal Shift** | CRUD jadwal shift per pegawai |
| 🔔 **Notifikasi Real-time** | Notifikasi sistem untuk pegawai dan admin |
| 📊 **Laporan Rekap** | Rekap kehadiran dengan visualisasi grafik (Recharts) |
| 👥 **Manajemen Karyawan** | CRUD data karyawan, departemen, dan jabatan |
| ⚙️ **Pengaturan Sistem** | Konfigurasi jam kerja, radius GPS, dan parameter sistem |
| 📤 **Export Data** | Export laporan ke format Excel (ExcelJS / XLSX) |
| 🗺️ **Peta Lokasi** | Visualisasi lokasi check-in dengan Leaflet Maps |

---

## 🏗️ Arsitektur Sistem

Sistem menggunakan arsitektur **Decoupled / Headless** — backend dan frontend adalah dua aplikasi independen yang berkomunikasi melalui REST API.

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER / CLIENT                      │
│                                                             │
│   ┌──────────────────────────────────────────────────┐     │
│   │         React + Vite + TypeScript (Port 5173)    │     │
│   │         Tailwind v4 · shadcn/ui · MUI · Recharts │     │
│   └──────────────────┬───────────────────────────────┘     │
│                       │  HTTP REST API                       │
│                       │  Authorization: Bearer <token>       │
│                       │  Content-Type: application/json      │
└───────────────────────┼─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    BACKEND SERVER (Port 8000)                 │
│                                                             │
│   ┌──────────────────────────────────────────────────┐     │
│   │           Laravel 13.x REST API                  │     │
│   │   Controllers · Middleware · Sanctum Auth         │     │
│   └──────────────────┬───────────────────────────────┘     │
│                       │  Eloquent ORM                        │
│   ┌──────────────────▼───────────────────────────────┐     │
│   │         MySQL / SQLite Database                   │     │
│   │   users · employees · attendance · schedules      │     │
│   │   leave_requests · notifications · settings       │     │
│   └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Pola Komunikasi

- **Format data**: JSON (`Content-Type: application/json`)
- **Autentikasi**: Token-based via Laravel Sanctum (`Authorization: Bearer <token>`)
- **Format respons konsisten**: `{ success, message, data }` atau `{ success, message, errors }`
- **Role-based access**: Middleware `EnsureIsAdmin` mengamankan endpoint admin

---

## 🛠️ Tech Stack

### Backend

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| PHP | ≥ 8.3 | Runtime bahasa |
| Laravel | 13.x | Framework utama (MVC, routing, ORM) |
| Laravel Sanctum | 4.x | Autentikasi API via Bearer Token |
| MySQL / SQLite | — | Database relasional |
| Laravel Tinker | 3.x | REPL interaktif untuk debugging |
| PHPUnit | 12.x | Unit & Feature testing |
| Laravel Pint | 1.x | Code style fixer (PSR-12) |

### Frontend

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| React | 18.3 | UI library utama |
| TypeScript | 6.x | Type safety |
| Vite | 6.x | Build tool & dev server |
| Tailwind CSS | v4 | Utility-first styling |
| shadcn/ui | — | Komponen UI berbasis Radix UI |
| Material UI (MUI) | 7.x | Komponen UI tambahan |
| Radix UI | — | Primitive komponen (accessible) |
| React Router | 7.x | Client-side routing |
| Axios | 1.7 | HTTP client untuk REST API |
| Recharts | 2.x | Grafik & visualisasi data |
| React Hook Form | 7.x | Manajemen form & validasi |
| Leaflet + React Leaflet | 1.9 | Peta interaktif (lokasi GPS) |
| date-fns | 3.x | Manipulasi tanggal |
| ExcelJS / XLSX | — | Export laporan ke Excel |
| Motion | 12.x | Animasi UI |
| Lucide React | 0.487 | Icon library |
| Sonner | 2.x | Toast notification |

---

## 📁 Struktur Proyek

```
sistem-absensi-rsucl/
│
├── 📄 README.md                    # Dokumen ini
│
├── 📂 docs/
│   └── ARCHITECTURE.md             # Dokumentasi arsitektur & skema database
│
├── 📂 backend/                     # Laravel REST API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/        # AuthController, EmployeeController, dll.
│   │   │   └── Middleware/         # EnsureIsAdmin.php
│   │   └── Models/                 # User, Employee, Attendance, dll.
│   ├── database/
│   │   ├── migrations/             # Skema tabel database
│   │   └── seeders/                # Data awal (admin, karyawan, departemen)
│   ├── routes/
│   │   └── api.php                 # Definisi semua endpoint API
│   ├── .env.example                # Template konfigurasi environment
│   └── README.md                   # Panduan instalasi backend
│
└── 📂 frontend/                    # React + Vite SPA
    ├── src/
    │   ├── app/
    │   │   ├── App.tsx             # Root component & routing
    │   │   └── components/         # Komponen halaman (Admin & Employee)
    │   ├── services/
    │   │   └── api.ts              # Axios instance & API service layer
    │   ├── context/                # React context (auth, state global)
    │   └── styles/                 # CSS global
    ├── index.html
    ├── vite.config.ts
    └── README.md                   # Panduan instalasi frontend
```

---

## ⚙️ Persyaratan Sistem

Pastikan perangkat Anda telah menginstal:

| Kebutuhan | Versi Minimum | Cek Versi |
|-----------|--------------|-----------|
| PHP | 8.3+ | `php -v` |
| Composer | 2.x | `composer -V` |
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| MySQL | 8.0+ | `mysql --version` |
| Git | — | `git --version` |

> **SQLite** (default untuk development) sudah bundled dengan PHP — tidak perlu instalasi terpisah.

---

## 🚀 Instalasi & Menjalankan Lokal

Clone repository terlebih dahulu:

```bash
git clone https://github.com/naufalfarel/Sistem-Absensi-rsucl.git
cd sistem-absensi-rsucl
```

Backend dan frontend dijalankan **secara terpisah** di dua terminal berbeda.

---

### 1. Backend (Laravel)

```bash
# Masuk ke folder backend
cd backend

# Install dependensi PHP
composer install

# Salin file konfigurasi environment
copy .env.example .env         # Windows
# cp .env.example .env         # Linux/macOS

# Generate application key
php artisan key:generate

# Jalankan migrasi database + seeder (data awal)
php artisan migrate:fresh --seed

# Jalankan server lokal
php artisan serve
# ✅ Backend berjalan di → http://localhost:8000
```

> **💡 Tip:** Secara default, database menggunakan **SQLite** (file lokal, tidak perlu setup MySQL). Untuk menggunakan MySQL, ubah konfigurasi `DB_*` di file `.env` — lihat bagian [Konfigurasi Environment](#-konfigurasi-environment).

---

### 2. Frontend (React)

Buka **terminal baru** (jangan tutup terminal backend):

```bash
# Masuk ke folder frontend
cd frontend

# Install dependensi Node.js
npm install

# Jalankan dev server
npm run dev
# ✅ Frontend berjalan di → http://localhost:5173
```

---

### ✅ Verifikasi

Setelah keduanya berjalan, buka browser dan akses:

```
http://localhost:5173
```

Gunakan akun default berikut untuk masuk:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@rsucl.com` | `password` |
| Karyawan | `karyawan@rsucl.com` | `password` |

---

## 🔧 Konfigurasi Environment

### Backend — `backend/.env`

Salin dari `.env.example`, lalu sesuaikan:

```env
APP_NAME="Sistem Absensi RSUCL"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database — pilih salah satu:

# Opsi 1: SQLite (default, cocok untuk development)
DB_CONNECTION=sqlite

# Opsi 2: MySQL (untuk production)
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=rsucl_db
# DB_USERNAME=root
# DB_PASSWORD=your_password
```

### Frontend — `frontend/.env.local`

```env
VITE_API_URL=http://localhost:8000/api
```

---

## 📡 API Endpoints

**Base URL:** `http://localhost:8000/api`

**Format Respons:**
```json
{ "success": true, "message": "...", "data": { ... } }
```

### 🔓 Public (Tanpa Token)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/login` | Login & mendapatkan Bearer Token |

### 🔐 Authenticated (Semua Role)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/me` | Data profil user yang sedang login |
| `POST` | `/logout` | Logout & invalidasi token |
| `GET` | `/attendance/today` | Absensi hari ini (milik sendiri) |
| `GET` | `/attendance/history` | Riwayat 100 data absensi terakhir |
| `POST` | `/attendance/check-in` | Check-in (dengan GPS opsional) |
| `POST` | `/attendance/check-out` | Check-out |
| `GET` | `/leave-requests` | Daftar pengajuan cuti/izin milik sendiri |
| `POST` | `/leave-requests` | Buat pengajuan cuti / izin / sakit |
| `GET` | `/notifications` | Daftar notifikasi + jumlah belum dibaca |
| `PUT` | `/notifications/{id}/read` | Tandai 1 notifikasi sebagai dibaca |
| `PUT` | `/notifications/read-all` | Tandai semua notifikasi sebagai dibaca |

### 🛡️ Admin Only

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/attendance/all-today` | Kehadiran semua karyawan hari ini |
| `GET/POST/PUT/DELETE` | `/employees` | CRUD data karyawan |
| `GET` | `/employees/meta` | Data master departemen & jabatan |
| `PUT` | `/leave-requests/{id}/approve` | Setujui pengajuan |
| `PUT` | `/leave-requests/{id}/reject` | Tolak pengajuan |
| `GET` | `/leave-requests` | Daftar semua pengajuan (seluruh karyawan) |
| `GET/POST/PUT/DELETE` | `/schedules` | CRUD jadwal shift |
| `GET` | `/reports/summary` | Ringkasan laporan kehadiran |
| `GET` | `/settings` | Baca pengaturan sistem |
| `PUT` | `/settings` | Perbarui pengaturan sistem |

> Endpoint admin dilindungi middleware `EnsureIsAdmin` — akses tanpa role admin akan mengembalikan `403 Forbidden`.

---

## 👤 Default Akun

Setelah menjalankan `php artisan migrate:fresh --seed`, akun berikut tersedia:

| Role | Email | Password | Keterangan |
|------|-------|----------|------------|
| **Admin** | `admin@rsucl.com` | `password` | Akses penuh ke semua fitur |
| **Karyawan** | `karyawan@rsucl.com` | `password` | Akses terbatas (self-service) |

> ⚠️ **Penting:** Ganti password default sebelum deploy ke production!

---

## 📦 Paket & Dependensi

### Backend (`composer.json`)

#### Production Dependencies

| Package | Versi | Fungsi |
|---------|-------|--------|
| `laravel/framework` | ^13.8 | Core framework (routing, ORM, middleware) |
| `laravel/sanctum` | ^4.0 | API token authentication |
| `laravel/tinker` | ^3.0 | Interactive REPL untuk debugging |

#### Development Dependencies

| Package | Versi | Fungsi |
|---------|-------|--------|
| `fakerphp/faker` | ^1.23 | Generate data palsu untuk seeder |
| `laravel/pail` | ^1.2 | Log viewer interaktif di terminal |
| `laravel/pint` | ^1.27 | Auto-formatter kode (PSR-12) |
| `mockery/mockery` | ^1.6 | Mocking library untuk unit test |
| `nunomaduro/collision` | ^8.6 | Error reporting yang cantik di CLI |
| `phpunit/phpunit` | ^12.5 | Testing framework |

---

### Frontend (`package.json`)

#### Core

| Package | Versi | Fungsi |
|---------|-------|--------|
| `react` | 18.3.1 | UI library |
| `react-dom` | 18.3.1 | React DOM renderer |
| `react-router` | 7.13.0 | Client-side routing |
| `typescript` | ^6.0 | Static type checking |
| `vite` | 6.3.5 | Build tool & dev server cepat |

#### UI & Styling

| Package | Versi | Fungsi |
|---------|-------|--------|
| `tailwindcss` | 4.1.12 | Utility-first CSS framework |
| `@mui/material` | 7.3.5 | Material UI components |
| `@mui/icons-material` | 7.3.5 | MUI icon set |
| `@emotion/react` | 11.14.0 | CSS-in-JS (dependency MUI) |
| `@emotion/styled` | 11.14.1 | Styled components (dependency MUI) |
| `lucide-react` | 0.487.0 | Icon library modern |
| `next-themes` | 0.4.6 | Dark/light mode toggle |
| `tw-animate-css` | 1.3.8 | Animasi Tailwind tambahan |
| `motion` | 12.23.24 | Animasi komponen (Framer Motion) |
| `canvas-confetti` | 1.9.4 | Efek confetti |

#### Radix UI Primitives (shadcn/ui)

| Package | Fungsi |
|---------|--------|
| `@radix-ui/react-accordion` | Accordion |
| `@radix-ui/react-alert-dialog` | Alert dialog |
| `@radix-ui/react-avatar` | Avatar |
| `@radix-ui/react-checkbox` | Checkbox |
| `@radix-ui/react-dialog` | Modal/Dialog |
| `@radix-ui/react-dropdown-menu` | Dropdown menu |
| `@radix-ui/react-select` | Select input |
| `@radix-ui/react-tabs` | Tab navigation |
| `@radix-ui/react-tooltip` | Tooltip |
| `@radix-ui/react-popover` | Popover |
| `@radix-ui/react-switch` | Toggle switch |
| `@radix-ui/react-slider` | Slider input |
| `@radix-ui/react-progress` | Progress bar |
| `@radix-ui/react-label` | Form label |
| `@radix-ui/react-slot` | Slot (polymorphic) |
| `class-variance-authority` | CVA untuk variant komponen |
| `clsx` | Conditional class names |
| `tailwind-merge` | Merge class Tailwind |
| `cmdk` | Command palette |
| `vaul` | Drawer/bottom sheet |

#### Data, Form & HTTP

| Package | Versi | Fungsi |
|---------|-------|--------|
| `axios` | ^1.7.2 | HTTP client untuk REST API |
| `react-hook-form` | 7.55.0 | Form management & validasi |
| `date-fns` | 3.6.0 | Utilitas manipulasi tanggal |

#### Grafik & Visualisasi

| Package | Versi | Fungsi |
|---------|-------|--------|
| `recharts` | 2.15.2 | Grafik kehadiran & laporan |
| `react-day-picker` | 8.10.1 | Calendar date picker |
| `embla-carousel-react` | 8.6.0 | Carousel/slider |
| `react-resizable-panels` | 2.1.7 | Panel layout yang bisa diubah ukurannya |

#### Peta & Lokasi

| Package | Versi | Fungsi |
|---------|-------|--------|
| `leaflet` | ^1.9.4 | Library peta interaktif |
| `react-leaflet` | ^4.2.1 | Integrasi Leaflet ke React |
| `@types/leaflet` | ^1.9.21 | TypeScript types untuk Leaflet |

#### Export Data

| Package | Versi | Fungsi |
|---------|-------|--------|
| `exceljs` | ^4.4.0 | Generate file Excel (.xlsx) |
| `xlsx` | ^0.18.5 | Baca/tulis file Excel |
| `xlsx-js-style` | ^1.2.0 | Excel dengan kustomisasi style |

#### Drag & Drop

| Package | Versi | Fungsi |
|---------|-------|--------|
| `react-dnd` | 16.0.1 | Drag and drop (jadwal shift) |
| `react-dnd-html5-backend` | 16.0.1 | HTML5 backend untuk react-dnd |

#### Notifikasi

| Package | Versi | Fungsi |
|---------|-------|--------|
| `sonner` | 2.0.3 | Toast notification yang elegan |

---

## 🤝 Kontribusi

Proyek ini dikembangkan sebagai bagian dari program magang di RS Umum Cempaka Lima.

1. Fork repository ini
2. Buat branch fitur: `git checkout -b feature/nama-fitur`
3. Commit perubahan: `git commit -m 'feat: tambah fitur X'`
4. Push ke branch: `git push origin feature/nama-fitur`
5. Buat Pull Request

---

## 📄 Dokumentasi Lanjutan

| Dokumen | Deskripsi |
|---------|-----------|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Arsitektur sistem & skema database lengkap |
| [`backend/README.md`](./backend/README.md) | Setup detail backend, endpoint, keamanan |
| [`frontend/README.md`](./frontend/README.md) | Setup detail frontend, struktur halaman |

---

<div align="center">

**Dibuat dengan ❤️ untuk RS Umum Cempaka Lima**

*Sistem Absensi RSUCL © 2025 — MIT License*

</div>
