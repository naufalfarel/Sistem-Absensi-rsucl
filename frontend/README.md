# Frontend Sistem Absensi RSUCL

Frontend Sistem Absensi RS Umum Cempaka Lima. Dibangun dengan React + Vite + TypeScript, Tailwind v4, shadcn/ui (Radix), sebagian MUI, dan Recharts.

Saat ini seluruh data masih hardcoded di `useState` (lihat `src/app/App.tsx`) sebagai hasil export dari Figma Make. Tahap selanjutnya menyambungkannya ke backend Laravel di folder `../backend` lewat REST API (lihat `docs/ARCHITECTURE.md` di root project).

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Build produksi:

```bash
npm run build
```

## Struktur halaman

- `LandingPage`, `LoginPage`
- `EmployeeApp`: `DashboardHome`, `AttendancePage`, `HistoryPage`, `NotificationsPage`, `ProfilePage`
- `AdminApp`: `AttendanceTab`, `HistoryTab`, `LeaveTab`, `NotificationsTab`, `ReportsTab`, `ScheduleTab`, `SettingsTab`

## Status integrasi API

Belum tersambung ke backend. Rencana pengerjaan:

1. `src/services/api.ts` — axios instance terpusat, interceptor token Sanctum
2. Ganti `useState` hardcoded di tiap halaman dengan pemanggilan API
3. Loading & error state di setiap halaman yang mengambil data
4. Penyesuaian tipe data frontend dengan response backend (lihat `../backend/README.md` bagian 5, daftar endpoint)

## Lisensi aset

Lihat `ATTRIBUTIONS.md` untuk atribusi komponen shadcn/ui dan foto Unsplash yang dipakai.
