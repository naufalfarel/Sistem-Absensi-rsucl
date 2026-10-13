# Daftar Dependensi & Spesifikasi Perangkat Lunak
## Sistem Absensi RS Umum Cempaka Lima (RSUCL)

Dokumen ini memuat seluruh daftar perangkat lunak, *runtime*, *framework*, *library*, dan dependensi yang digunakan dalam pengembangan **Sistem Informasi Manajemen Presensi Pegawai RS Umum Cempaka Lima**. Dokumen ini disusun secara sistematis agar dapat digunakan sebagai acuan penulisan naskah skripsi (khususnya pada **Bab 3: Analisis dan Perancangan Sistem — Kebutuhan Perangkat Lunak** dan **Bab 4: Implementasi dan Pengujian Sistem — Lingkungan Pengembangan**).

---

## 1. Arsitektur Sistem Singkat

Sistem dibangun menggunakan pendekatan arsitektur **Decoupled / Headless Web Application**:
- **Backend**: RESTful API berbasis Laravel yang melayani transaksi data, aturan bisnis, autentikasi berbasis token (*Bearer Token*), serta tugas terjadwal (*scheduler*).
- **Frontend**: Single Page Application (SPA) berbasis React, TypeScript, dan Vite yang menyajikan antarmuka pengguna responsif bagi Admin dan Karyawan.
- **Database**: Relational Database Management System (RDBMS) MySQL / SQLite.

```
┌─────────────────────────────────┐
│        Frontend (Client)        │
│    React + Vite + TypeScript    │
│  Tailwind CSS · shadcn/ui · MUI │
└────────────────┬────────────────┘
                 │ HTTP REST API (JSON)
                 │ Authorization: Bearer <token>
┌────────────────▼────────────────┐
│        Backend (Server)         │
│      Laravel 13.x / 12.x        │
│   Sanctum · Controllers · ORM   │
└────────────────┬────────────────┘
                 │ Eloquent ORM
┌────────────────▼────────────────┐
│      Database (Storage)         │
│        MySQL / SQLite           │
└─────────────────────────────────┘
```

---

## 2. Kebutuhan Perangkat Lunak & Lingkungan Pengembangan (Skripsi Bab 3 & 4)

Tabel berikut menyajikan spesifikasi perangkat lunak yang dibutuhkan untuk membangun dan menjalankan sistem:

| No | Perangkat Lunak / Komponen | Versi / Spesifikasi | Kategori | Fungsi & Peruntukan dalam Sistem |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Sistem Operasi** | Windows 10/11 / Linux (Ubuntu) | Operating System | Lingkungan pengembangan lokal (*development*) dan server produksi. |
| 2 | **Visual Studio Code** | Versi Terbaru | Text Editor / IDE | Perangkat lunak editor kode sumber (*source code*). |
| 3 | **PHP** | $\ge$ 8.3 | Bahasa & Runtime | *Runtime engine* sisi server untuk menjalankan Laravel REST API. |
| 4 | **Node.js** | $\ge$ 18.x (LTS) | JavaScript Runtime | Eksekusi tooling pengembangan frontend, kompilasi aset, dan server lokal Vite. |
| 5 | **Composer** | $\ge$ 2.x | Package Manager | Manajemen dependensi dan pustaka PHP di sisi backend. |
| 6 | **npm / pnpm** | $\ge$ 9.x | Package Manager | Manajemen paket pustaka JavaScript/TypeScript di sisi frontend. |
| 7 | **MySQL** | $\ge$ 8.0 | DBMS Utama | Sistem Manajemen Basis Data Relasional utama yang digunakan aplikasi (nama database: `rsucl_absensi` di port 3306). |
| 8 | **SQLite** | 3.x (Opsional) | DBMS Tambahan / Testing | Basis data berbasis file bawaan template Laravel; biasa digunakan untuk pengujian otomatis (*automated testing*) atau pengujian lokal tanpa server terpisah. |
| 9 | **Web Browser** | Google Chrome / Edge / Firefox | Client Platform | Aplikasi peramban web untuk mengakses sistem presensi. |
| 10 | **Git** | Versi Terbaru | Version Control | Pengelolaan versi kode sumber (*version control system*) dan repositori GitHub. |

---

## 3. Dependensi Sisi Backend (Laravel)

Sumber konfigurasi: [`backend/composer.json`](file:///d:/KULYEAHUSK/magang/SistemAbsensiRSUCL1/sistem-absensi-rsucl/backend/composer.json)

### A. Dependensi Utama (*Production Dependencies*)

| Nama Paket / Library | Versi | Peran / Kegunaan dalam Sistem |
| :--- | :---: | :--- |
| **`php`** | `^8.3` | Versi minimum bahasa pemrograman PHP dengan dukungan fitur modern (typed properties, attributes). |
| **`laravel/framework`** | `^13.8` | Framework MVC utama yang mengelola *routing*, *controller*, *middleware*, *Eloquent ORM*, *database migration*, dan *task scheduler*. |
| **`laravel/sanctum`** | `^4.0` | Sistem autentikasi API berbasis token (*Bearer Token*) yang aman untuk login pengguna (Admin dan Karyawan). |
| **`laravel/tinker`** | `^3.0` | Antarmuka baris perintah (*REPL CLI*) untuk berinteraksi langsung dengan database dan logika aplikasi tanpa web browser. |
| **`maatwebsite/excel`** | `^3.1` | Pustaka untuk mengimpor dan mengekspor data absensi serta data pegawai ke format Microsoft Excel (.xlsx / .csv). |

### B. Dependensi Pengembangan & Pengujian (*Development Dependencies*)

| Nama Paket / Library | Versi | Peran / Kegunaan dalam Sistem |
| :--- | :---: | :--- |
| **`phpunit/phpunit`** | `^12.5` | Framework pengujian otomatis (*automated testing*) untuk pengujian unit (*Unit Testing*) dan fitur endpoint API (*Feature Testing*). |
| **`mockery/mockery`** | `^1.6` | Library pembuatan objek tiruan (*mock objects*) untuk memisahkan dependensi saat pengujian unit. |
| **`fakerphp/faker`** | `^1.23` | Pembangkit data palsu/tiruan yang realistis untuk *database seeders* (nama karyawan, alamat, tanggal, dsb.). |
| **`laravel/pint`** | `^1.27` | Alat pemformatan gaya penulisan kode PHP otomatis (*code style fixer*) berdasarkan standar PSR-12. |
| **`laravel/pail`** | `^1.2.5` | Alat pemantau log aplikasi secara interaktif dan real-time langsung melalui terminal CLI. |
| **`nunomaduro/collision`** | `^8.6` | Penampil pesan kesalahan (*error page handler*) yang detail dan mudah dibaca pada konsol terminal. |

---

## 4. Dependensi Sisi Frontend (React + Vite + TypeScript)

Sumber konfigurasi: [`frontend/package.json`](file:///d:/KULYEAHUSK/magang/SistemAbsensiRSUCL1/sistem-absensi-rsucl/frontend/package.json)

### A. Core Framework & Build Tools

| Nama Paket / Library | Versi | Peran / Kegunaan dalam Sistem |
| :--- | :---: | :--- |
| **`react`** | `18.3.1` | Pustaka inti JavaScript untuk membangun antarmuka pengguna berbasis komponen reaktif. |
| **`react-dom`** | `18.3.1` | Pustaka *renderer* yang menghubungkan komponen React dengan Document Object Model (DOM) browser. |
| **`typescript`** | `^6.0.3` | Superset JavaScript berorientasi tipe data (*static type checking*) untuk menjamin keamanan tipe dan mengurangi bug. |
| **`vite`** | `6.3.5` | Alat *build* generasi baru (*next-generation frontend tooling*) dengan Hot Module Replacement (HMR) cepat. |
| **`react-router`** | `7.13.0` | Pustaka navigasi dan perutean (*routing*) halaman sisi klien tanpa memuat ulang browser (*Single Page Application*). |

### B. UI, Komponen Desain, & Styling

| Nama Paket / Library | Versi | Peran / Kegunaan dalam Sistem |
| :--- | :---: | :--- |
| **`tailwindcss`** | `4.1.12` | Framework CSS utility-first generasi terbaru untuk styling antarmuka responsif dan modern. |
| **`@tailwindcss/vite`** | `4.1.12` | Integrasi resmi Tailwind CSS v4 dengan sistem build Vite. |
| **`@radix-ui/*` (shadcn/ui)** | 1.x / 2.x | Kumpulan komponen UI tanpa gaya (*headless & accessible UI primitives*): Dialog, Dropdown, Tabs, Popover, Select, Accordion, Tooltip, Switch, Slider, Checkbox, Avatar, Scroll Area, dsb. |
| **`@mui/material`** | `7.3.5` | Pustaka komponen antarmuka komprehensif berbasis Google Material Design. |
| **`@mui/icons-material`** | `7.3.5` | Koleksi ikon resmi Material Design. |
| **`@emotion/react` & `@emotion/styled`** | `11.14.x` | Engine CSS-in-JS sebagai dependensi inti untuk merender styling Material UI. |
| **`lucide-react`** | `0.487.0` | Kumpulan ikon vektor modern berbasis SVG yang bersih dan konsisten. |
| **`class-variance-authority` (CVA)** | `0.7.1` | Utilitas deklaratif untuk mengelola variasi komponen UI (misalnya tombol *primary*, *destructive*, *outline*). |
| **`clsx` & `tailwind-merge`** | 2.1 / 3.2 | Utilitas penggabungan kelas-kelas Tailwind secara dinamis tanpa duplikasi atau bentrokan class CSS. |
| **`next-themes`** | `0.4.6` | Manajemen peralihan tema antarmuka (Mode Terang / *Dark Mode*). |
| **`vaul`** | `1.1.2` | Komponen panel laci geser bawah (*drawer / bottom sheet*) yang ramah pengguna perangkat layar sentuh/mobile. |
| **`cmdk`** | `1.1.1` | Komponen *Command Palette* yang dapat diakses dengan pintasan keyboard untuk pencarian menu dan aksi cepat. |

### C. Komunikasi Data, Formulir, & Utilitas Waktu

| Nama Paket / Library | Versi | Peran / Kegunaan dalam Sistem |
| :--- | :---: | :--- |
| **`axios`** | `^1.7.2` | Klien HTTP berbasis *Promise* untuk melakukan komunikasi data (GET, POST, PUT, DELETE) dengan Laravel REST API. |
| **`react-hook-form`** | `7.55.0` | Pustaka manajemen state formulir berkinerja tinggi untuk validasi input (pengajuan cuti, jadwal, profil, setting). |
| **`date-fns`** | `3.6.0` | Pustaka manipulasi, pemformatan, dan kalkulasi tanggal/waktu (penentuan status telat, format jam kerja). |
| **`react-day-picker`** | `8.10.1` | Komponen kalender interaktif untuk memilih rentang tanggal (*date range picker*). |
| **`input-otp`** | `1.4.2` | Komponen masukan kode verifikasi / PIN satu kali pakai (*One-Time Password*). |

### D. Peta Geografis (GPS), Visualisasi Grafik, & Animasi

| Nama Paket / Library | Versi | Peran / Kegunaan dalam Sistem |
| :--- | :---: | :--- |
| **`leaflet`** & **`react-leaflet`** | `^1.9.4` / `^4.2.1` | Peta interaktif berbasis OpenStreetMap untuk memvalidasi dan memvisualisasikan titik koordinat lokasi presensi (geofencing / radius GPS). |
| **`@types/leaflet`** | `^1.9.21` | Deklarasi tipe data TypeScript untuk Leaflet. |
| **`recharts`** | `2.15.2` | Pustaka grafik data reaktif untuk menampilkan diagram statistik kehadiran, perbandingan hadir/telat/alpha pada tab laporan Admin. |
| **`motion`** *(Framer Motion)* | `12.23.24` | Pustaka animasi deklaratif untuk efek transisi antar-halaman, kartu, dan modal. |
| **`react-dnd` & `backend`** | `16.0.1` | Pustaka antarmuka *Drag and Drop* (seret dan lepas) untuk pengaturan dan pertukaran jadwal shift pegawai. |
| **`sonner`** | `2.0.3` | Pustaka notifikasi mengambang (*toast alerts*) yang memberikan umpan balik langsung setelah aksi presensi atau approval. |
| **`canvas-confetti`** | `1.9.4` | Pustaka efek animasi konfeti perayaan visual saat karyawan berhasil melakukan presensi tepat waktu. |
| **`react-resizable-panels`** | `2.1.7` | Komponen tata letak panel yang dapat diatur ukurannya (*resizable layout splitters*). |
| **`embla-carousel-react`** | `8.6.0` | Komponen carousel/slider interaktif. |

### E. Pemrosesan & Ekspor Dokumen Spreadsheet (Klien)

| Nama Paket / Library | Versi | Peran / Kegunaan dalam Sistem |
| :--- | :---: | :--- |
| **`exceljs`** | `^4.4.0` | Pustaka pembangkit (*generator*) berkas Microsoft Excel (.xlsx) langsung pada sisi browser. |
| **`xlsx`** *(SheetJS)* | `^0.18.5` | Pustaka pembacaan dan konversi data tabular ke format buku kerja spreadsheet. |
| **`xlsx-js-style`** | `^1.2.0` | Modul kustomisasi gaya visual sel Excel (pewarnaan cell, font tebal pada header, perataan teks, border tabel). |

---

## 5. Panduan Pengutipan untuk Penulisan Skripsi

### Contoh Narasi pada Bab 3 (Kebutuhan Perangkat Lunak):
> *"Perangkat lunak yang digunakan dalam pembangunan Sistem Informasi Presensi Pegawai RS Umum Cempaka Lima terdiri dari lingkungan pengembangan backend dan frontend. Sisi server dikembangkan menggunakan bahasa pemrograman PHP versi 8.3 dengan framework Laravel versi 13.x/12.x dan modul autentikasi Laravel Sanctum. Pengelolaan basis data relasional menggunakan MySQL. Pada sisi antarmuka klien, sistem dibangun menggunakan pustaka React versi 18.3 berbasis TypeScript dan dibantu oleh Vite sebagai build tool. Desain antarmuka memanfaatkan Tailwind CSS dan komponen shadcn/ui. Untuk memfasilitasi verifikasi lokasi presensi pegawai, sistem mengintegrasikan pustaka peta Leaflet, sedangkan modul visualisasi grafik laporan manajerial memanfaatkan pustaka Recharts."*

### Contoh Narasi pada Bab 4 (Lingkungan Implementasi):
> *"Implementasi sistem dilakukan pada lingkungan komputer dengan spesifikasi perangkat lunak yang mencakup sistem operasi Windows 11 / Linux Ubuntu 22.04 LTS, runtime Node.js v18.x, web server bawaan PHP Artisan dan Vite Development Server, serta DBMS MySQL 8.0. Pengujian unit endpoint API dilakukan menggunakan PHPUnit 12.5."*

---
*Dokumen diperbarui pada: 2026*  
*Sistem Absensi RS Umum Cempaka Lima*
