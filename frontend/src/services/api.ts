/**
 * API Client — Sistem Absensi RSUCL
 *
 * Lapisan akses ke backend Laravel (http://localhost:8000/api)
 * Autentikasi: Bearer Token (Laravel Sanctum)
 * Token disimpan di localStorage dengan key "rsucl_token"
 */

/**
 * Mendapatkan URL dasar API dari environment variables.
 * Jika VITE_API_URL dikonfigurasi kosong, akan mengembalikan path relatif.
 */
const getApiUrl = () => {
  const envVal = import.meta.env.VITE_API_URL;
  if (envVal === '') return ''; // Path relatif untuk dukungan proxy
  return envVal ?? 'http://localhost:8000';
};
const BASE_URL = getApiUrl() + '/api';
const TOKEN_KEY = 'rsucl_token';

// ── Helper Token ─────────────────────────────────────────────────────

/**
 * Mengambil token autentikasi yang tersimpan di localStorage.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Menyimpan token autentikasi baru ke localStorage.
 * 
 * @param token JWT/Sanctum Token dari backend
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Menghapus token autentikasi dari localStorage (misal saat logout).
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Wrapper Fetch Utama ───────────────────────────────────────────────

/**
 * Fungsi pembungkus (wrapper) fetch API global untuk melakukan request HTTP.
 * Secara otomatis menambahkan header Content-Type, Accept, dan token Authorization Bearer.
 * 
 * @param method HTTP Method (GET, POST, PUT, DELETE)
 * @param path Endpoint API (dimulai dengan '/')
 * @param body Data yang akan dikirim dalam request body
 * @returns Response JSON bertipe T
 */
async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const json = await res.json().catch(() => ({ success: false, message: 'Respons tidak valid.' }));

  if (!res.ok) {
    const message = (json as { message?: string }).message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, json);
  }

  return json as T;
}

/**
 * Objek shortcut untuk memanggil fungsi request berdasarkan method HTTP.
 */
export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
};

/**
 * Custom Exception untuk menampung error respon dari Laravel API.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,   // Kode status HTTP (misal: 401, 422, 500)
    message: string,                  // Pesan error
    public readonly data?: unknown,   // Detail payload response error
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Auth (Autentikasi)
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface data profil pengguna yang terautentikasi (Admin/Karyawan).
 */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  nip: string;
  username: string;
  employee_id?: number;
  department?: string;
  position?: string;
  phone?: string;
  gender?: string;
  join_date?: string;
  profile_picture?: string | null;
}

/**
 * Layanan API terkait Autentikasi.
 */
export const authApi = {
  // Melakukan login
  login: (username: string, password: string) =>
    api.post<{ success: boolean; data: { token: string; user: AuthUser } }>(
      '/login', { username, password }
    ),
  // Mengambil informasi sesi aktif
  me: () => api.get<{ success: boolean; data: AuthUser }>('/me'),
  // Melakukan keluar sistem
  logout: () => api.post<{ success: boolean; message: string }>('/logout', {}),
  // Mengajukan reset password mandiri
  forgotPassword: (data: { username: string; nip: string; email: string; password?: string }) =>
    api.post<{ success: boolean; message: string }>('/forgot-password', data),
};

/**
 * Layanan API terkait Pembaruan Profil Mandiri.
 */
export const profileApi = {
  // Update data diri oleh user aktif
  update: (data: {
    name?: string;
    email?: string;
    username?: string;
    phone?: string;
    gender?: string;
    password?: string;
    old_password?: string;
    profile_picture?: string | null;
  }) =>
    api.put<{ success: boolean; message: string; data: AuthUser }>('/profile', data),
};

// ─────────────────────────────────────────────────────────────────────
// Karyawan (khusus admin)
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface data kepegawaian Karyawan.
 */
export interface Employee {
  id: number;
  user_id: number;
  name: string;
  email: string;
  nip: string;
  username: string;
  department: string;
  department_id: number;
  position: string;
  position_id: number;
  phone?: string;
  gender?: string;
  join_date?: string;
  status: 'active' | 'inactive';
  today_attendance?: { check_in: string; check_out: string; status: string } | null;
}

/**
 * Layanan CRUD data karyawan oleh admin.
 */
export const employeeApi = {
  list:   ()                    => api.get<{ success: boolean; data: Employee[] }>('/employees'),
  show:   (id: number)          => api.get<{ success: boolean; data: Employee }>(`/employees/${id}`),
  create: (data: Partial<Employee> & { password: string }) =>
    api.post<{ success: boolean; data: Employee }>('/employees', data),
  update: (id: number, data: Partial<Employee> & { password?: string }) =>
    api.put<{ success: boolean; data: Employee }>(`/employees/${id}`, data),
  delete: (id: number)          => api.delete<{ success: boolean; message: string }>(`/employees/${id}`),
  // Mengambil data penunjang form (departemen dan jabatan)
  meta:   ()                    => api.get<{ success: boolean; data: { departments: { id: number; name: string }[]; positions: { id: number; name: string }[] } }>('/employees/meta'),
};

// ─────────────────────────────────────────────────────────────────────
// Departemen (khusus admin)
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface data departemen/bagian rumah sakit.
 */
export interface DepartmentModel {
  id: number;
  name: string;
  employees_count?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Layanan CRUD departemen oleh admin.
 */
export const departmentApi = {
  list:   ()                    => api.get<{ success: boolean; data: DepartmentModel[] }>('/departments'),
  show:   (id: number)          => api.get<{ success: boolean; data: DepartmentModel }>(`/departments/${id}`),
  create: (data: { name: string }) =>
    api.post<{ success: boolean; data: DepartmentModel }>('/departments', data),
  update: (id: number, data: { name: string }) =>
    api.put<{ success: boolean; data: DepartmentModel }>(`/departments/${id}`, data),
  delete: (id: number)          => api.delete<{ success: boolean; message: string }>(`/departments/${id}`),
};

// ─────────────────────────────────────────────────────────────────────
// Absensi
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface rekaman absensi harian karyawan.
 */
export interface AttendanceRecord {
  id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'hadir' | 'telat' | 'izin' | 'sakit' | 'cuti' | 'alpha';
  duration_min: number | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  is_within_geofence: boolean;
  note: string | null;
  employee?: { id: number; name: string; nip: string; department: string };
  image_check_in?: string | null;
  image_check_out?: string | null;
  shift_name?: string | null;
}

/**
 * Layanan absensi masuk & pulang serta riwayat absensi.
 */
export const attendanceApi = {
  // Cek absensi hari ini milik user aktif
  today:    () => api.get<{
    success: boolean;
    data: AttendanceRecord | null;
    active_leave?: { type: 'cuti' | 'izin' | 'sakit'; reason: string } | null;
  }>('/attendance/today'),
  // Ambil semua daftar hadir hari ini (untuk dashboard admin)
  allToday: () => api.get<{ success: boolean; data: AttendanceRecord[] }>('/attendance/all-today'),
  // Ambil riwayat absensi bulanan user aktif
  history:  (month?: number, year?: number) => api.get<{ success: boolean; data: AttendanceRecord[] }>(
    '/attendance/history' + (month && year ? `?month=${month}&year=${year}` : '')
  ),
  // Mengirim absensi masuk beserta parameter geolokasi, foto wajah, dan waktu simulasi
  checkIn:  (lat?: number, lng?: number, accuracy?: number, image?: string, simulatedTime?: string) =>
    api.post<{ success: boolean; message: string; data: AttendanceRecord }>(
      '/attendance/check-in', { latitude: lat, longitude: lng, accuracy, image, simulated_time: simulatedTime }
    ),
  // Mengirim absensi pulang beserta parameter geolokasi, foto wajah, dan waktu simulasi
  checkOut: (lat?: number, lng?: number, accuracy?: number, image?: string, simulatedTime?: string) =>
    api.post<{ success: boolean; message: string; data: AttendanceRecord }>(
      '/attendance/check-out', { latitude: lat, longitude: lng, accuracy, image, simulated_time: simulatedTime }
    ),
};

// ─────────────────────────────────────────────────────────────────────
// Pengajuan Cuti/Izin
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface data pengajuan cuti, izin, atau sakit karyawan.
 */
export interface LeaveRequest {
  id: number;
  type: 'cuti' | 'izin' | 'sakit';
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  attachment_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  reviewed_at?: string;
  created_at: string;
  employee: { id: number; name: string; nip: string; department: string };
  reviewer?: { name: string } | null;
}

/**
 * Layanan pengajuan ketidakhadiran dan peninjauan oleh admin.
 */
export const leaveApi = {
  // Ambil daftar seluruh pengajuan cuti (admin melihat semua, karyawan melihat miliknya)
  list:    () => api.get<{ success: boolean; data: LeaveRequest[] }>('/leave-requests'),
  // Kirim pengajuan cuti/izin/sakit baru beserta lampiran file base64
  create:  (data: { type: string; start_date: string; end_date: string; reason: string; attachment?: string | null }) =>
    api.post<{ success: boolean; message: string; data: LeaveRequest }>('/leave-requests', data),
  // Admin menyetujui pengajuan cuti
  approve: (id: number, admin_note?: string) =>
    api.put<{ success: boolean; data: LeaveRequest }>(`/leave-requests/${id}/approve`, { admin_note }),
  // Admin menolak pengajuan cuti
  reject:  (id: number, admin_note?: string) =>
    api.put<{ success: boolean; data: LeaveRequest }>(`/leave-requests/${id}/reject`, { admin_note }),
  // Menghapus pengajuan cuti
  delete:  (id: number) => api.delete<{ success: boolean }>(`/leave-requests/${id}`),
  // Menghapus semua pengajuan cuti yang sudah ditinjau (approved/rejected)
  deleteAllProcessed: () => api.delete<{ success: boolean }>('/leave-requests/all-processed'),
};

// ─────────────────────────────────────────────────────────────────────
// Notifikasi
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface notifikasi sistem absensi.
 */
export interface AppNotification {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  read_at: string | null;
  data?: Record<string, unknown>;
  created_at: string;
}

/**
 * Layanan notifikasi aplikasi.
 */
export const notificationApi = {
  // List notifikasi milik user aktif
  list:       () => api.get<{ success: boolean; data: { notifications: AppNotification[]; unread_count: number } }>('/notifications'),
  // Tandai satu notifikasi sudah dibaca
  markRead:   (id: number)  => api.put<{ success: boolean }>(`/notifications/${id}/read`, {}),
  // Tandai seluruh notifikasi sudah dibaca
  markAllRead: ()           => api.put<{ success: boolean }>('/notifications/read-all', {}),
  // Hapus satu notifikasi
  delete:     (id: number)  => api.delete<{ success: boolean }>(`/notifications/${id}`),
  // Hapus semua notifikasi yang sudah dibaca
  deleteAllRead: ()         => api.delete<{ success: boolean }>('/notifications/delete-read'),
};

// ─────────────────────────────────────────────────────────────────────
// Laporan (admin)
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface ringkasan data statistik/laporan absensi (dashboard admin).
 */
export interface ReportSummary {
  total_employees: number;
  today: { hadir: number; telat: number; alpha: number; cuti: number; belum: number };
  this_month: { hadir: number; telat: number; alpha: number; cuti: number };
  trends: { presence: number; late: number; alpha: number; cuti: number };
  pending_leave: number;
  daily_chart: { date: string; label: string; hadir: number; alpha: number }[];
  monthly_trend: { bulan: string; hadir: number; terlambat: number; alpha: number; cuti: number }[];
  composition: { name: string; value: number; color: string }[];
  weekly_late: { hari: string; count: number }[];
  dept_attendance: { dept: string; persen: number }[];
}

/**
 * Interface rekaman rekap bulanan per karyawan untuk diekspor ke Excel.
 */
export interface MonthlyRekapRecord {
  nip: string;
  name: string;
  department: string;
  hadir: number;
  telat: number;
  izin: number;
  sakit: number;
  cuti: number;
  alpha: number;
  duration_min: number;
}

/**
 * Layanan penarikan laporan absensi dan rekapitulasi ekspor.
 */
export const reportApi = {
  // Ringkasan data untuk grafik dashboard admin
  summary: () => api.get<{ success: boolean; data: ReportSummary }>('/reports/summary'),
  // Rekapitulasi bulanan absensi seluruh karyawan
  monthlyRekap: (month: number, year: number) =>
    api.get<{ success: boolean; data: MonthlyRekapRecord[] }>(`/reports/monthly-rekap?month=${month}&year=${year}`),
};

// ─────────────────────────────────────────────────────────────────────
// Pengaturan (admin)
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface konfigurasi parameter absensi (geofence, jam kerja, dsb).
 */
export interface AppSettings {
  system_active: '0' | '1';           // Status aktifasi sistem absensi
  checkin_open: string;              // Jam mulai absen masuk
  late_limit: string;                // Jam batas terlambat
  close_checkin: string;             // Durasi toleransi check-in ditutup (menit)
  break_start: string;               // Mulai istirahat
  break_end: string;                 // Selesai istirahat
  checkout_open: string;             // Jam mulai absen pulang (Hari Kerja)
  checkout_close: string;            // Jam akhir absen pulang (Hari Kerja)
  sat_checkout_open: string;         // Jam mulai absen pulang (Sabtu)
  sat_checkout_close: string;        // Jam akhir absen pulang (Sabtu)
  gps_radius: string;                // Radius geofence (meter)
  hospital_lat: string;              // Koordinat latitude RSUCL
  hospital_lng: string;              // Koordinat longitude RSUCL
  logo_url?: string;                 // URL logo kustom rumah sakit
  notif_email?: '0' | '1';           // Kirim notifikasi via email
  notif_late?: '0' | '1';            // Kirim notifikasi jika terlambat
  notif_leave?: '0' | '1';           // Kirim notifikasi pengajuan cuti
  notif_system?: '0' | '1';          // Kirim notifikasi broadcast sistem
}

/**
 * Layanan membaca dan memperbarui konfigurasi sistem absensi.
 */
export const settingApi = {
  // Mengambil konfigurasi aktif
  get:    ()                        => api.get<{ success: boolean; data: AppSettings }>('/settings'),
  // Memperbarui pengaturan
  update: (data: Partial<AppSettings>) => api.put<{ success: boolean; message: string }>('/settings', data),
};

// ─────────────────────────────────────────────────────────────────────
// Jadwal (admin)
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface jadwal shift kerja.
 */
export interface ShiftSchedule {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
  icon: string;
  employees_count?: number;
  employees?: Array<{
    id: number;
    nip: string;
    phone: string;
    gender: string;
    department?: { name: string };
    user?: { name: string; email: string; username: string };
    pivot?: { day_of_week?: string };
  }>;
}

/**
 * Interface pemetaan jadwal mingguan per karyawan.
 */
export interface EmployeeWeeklySchedule {
  employee_id: number;
  name: string;
  schedules: Record<string, {
    id: number;
    name: string;
    color: string;
    icon: string;
  }>;
}

/**
 * Interface detail shift kerja yang berlaku untuk user aktif hari ini.
 */
export interface MyShiftSchedule {
  id: number;
  name: string;
  start_time: string; // "HH:mm:ss" atau "HH:mm"
  end_time: string;
  color: string;
  icon: string;
}

/**
 * Layanan CRUD shift kerja dan pengaturan plot jadwal mingguan karyawan.
 */
export const scheduleApi = {
  // Ambil daftar semua master shift
  list:   ()                               => api.get<{ success: boolean; data: ShiftSchedule[] }>('/schedules'),
  // Buat shift kerja baru
  create: (data: Omit<ShiftSchedule, 'id' | 'employees_count'>) =>
    api.post<{ success: boolean; data: ShiftSchedule }>('/schedules', data),
  // Edit shift kerja
  update: (id: number, data: Partial<Omit<ShiftSchedule, 'id' | 'employees_count'>>) =>
    api.put<{ success: boolean; data: ShiftSchedule }>(`/schedules/${id}`, data),
  // Hapus shift kerja
  delete: (id: number)                     => api.delete<{ success: boolean; message: string }>(`/schedules/${id}`),
  // Ambil tabel penugasan jadwal mingguan semua karyawan
  getEmployeeSchedules: () => api.get<{ success: boolean; data: EmployeeWeeklySchedule[] }>('/employee-schedules'),
  // Tugaskan shift tertentu ke karyawan untuk hari tertentu
  assignEmployeeSchedule: (employee_id: number, day_of_week: string, schedule_id: number | null) =>
    api.post<{ success: boolean; message: string }>('/employee-schedules/assign', { employee_id, day_of_week, schedule_id }),
  // Ambil info shift kerja yang berlaku untuk diri sendiri hari ini
  mySchedule: () => api.get<{ success: boolean; data: MyShiftSchedule | null; saturday_shift?: MyShiftSchedule | null; day: string }>('/my-schedule'),
};


