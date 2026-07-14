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
    Accept: 'application/json',
  };
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
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
  vehicles?: {
    motor_plate_1?: string | null;
    motor_plate_2?: string | null;
    car_plate_1?: string | null;
    car_plate_2?: string | null;
  };
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
  // Update data kendaraan milik sendiri oleh karyawan
  updateVehicles: (data: {
    motor_plate_1?: string | null;
    motor_plate_2?: string | null;
    car_plate_1?: string | null;
    car_plate_2?: string | null;
  }) =>
    api.put<{ success: boolean; message: string; data: any }>('/profile/vehicles', data),
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
  vehicles?: {
    motor_plate_1?: string | null;
    motor_plate_2?: string | null;
    car_plate_1?: string | null;
    car_plate_2?: string | null;
  };
  motor_plate_1?: string | null;
  motor_plate_2?: string | null;
  car_plate_1?: string | null;
  car_plate_2?: string | null;
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
  checkin_location_note?: string | null;
  checkout_location_note?: string | null;
  employee?: { id: number; name: string; nip: string; department: string };
  image_check_in?: string | null;
  image_check_out?: string | null;
  
  // New photo and GPS columns
  checkin_photo_url?: string | null;
  checkout_photo_url?: string | null;
  checkin_latitude?: number | null;
  checkin_longitude?: number | null;
  checkout_latitude?: number | null;
  checkout_longitude?: number | null;
  checkin_distance_meters?: number | null;
  checkout_distance_meters?: number | null;

  shift_name?: string | null;
  shift_type?: 'normal' | 'dinas_luar';
  
  // Pulang Cepat (Early Checkout)
  is_early_checkout?: boolean;
  early_checkout_reason?: string | null;
  early_checkout_status?: 'pending' | 'approved' | 'rejected' | null;
  early_checkout_admin_note?: string | null;

  // Lembur (Overtime)
  is_overtime?: boolean;
  overtime_minutes?: number | null;
  overtime_note?: string | null;

  // Holiday Work
  is_holiday_work?: boolean;
  holiday?: string | null;
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
    holiday?: { name: string; is_assigned: boolean } | null;
  }>('/attendance/today'),
  // Ambil semua daftar hadir hari ini (untuk dashboard admin)
  allToday: () => api.get<{ success: boolean; data: AttendanceRecord[] }>('/attendance/all-today'),
  // Ambil riwayat absensi bulanan user aktif
  history:  (month?: number, year?: number) => api.get<{ success: boolean; data: AttendanceRecord[] }>(
    '/attendance/history' + (month && year ? `?month=${month}&year=${year}` : '')
  ),
  // Mengirim absensi masuk beserta parameter geolokasi, foto wajah, waktu simulasi, dan catatan lokasi
  checkIn:  (lat?: number, lng?: number, accuracy?: number, photo?: File | Blob, simulatedTime?: string, locationNote?: string) => {
    const formData = new FormData();
    if (lat !== undefined && lat !== null) formData.append('latitude', String(lat));
    if (lng !== undefined && lng !== null) formData.append('longitude', String(lng));
    if (accuracy !== undefined && accuracy !== null) formData.append('accuracy', String(accuracy));
    if (photo) formData.append('photo', photo);
    if (simulatedTime) formData.append('simulated_time', simulatedTime);
    if (locationNote) formData.append('location_note', locationNote);
    return api.post<{ success: boolean; message: string; data: AttendanceRecord }>('/attendance/check-in', formData);
  },
  // Mengirim absensi pulang beserta parameter geolokasi, foto wajah, waktu simulasi, catatan lokasi, alasan pulang cepat, dan catatan lembur
  checkOut: (lat?: number, lng?: number, accuracy?: number, photo?: File | Blob, simulatedTime?: string, locationNote?: string, earlyCheckoutReason?: string, overtimeNote?: string) => {
    const formData = new FormData();
    if (lat !== undefined && lat !== null) formData.append('latitude', String(lat));
    if (lng !== undefined && lng !== null) formData.append('longitude', String(lng));
    if (accuracy !== undefined && accuracy !== null) formData.append('accuracy', String(accuracy));
    if (photo) formData.append('photo', photo);
    if (simulatedTime) formData.append('simulated_time', simulatedTime);
    if (locationNote) formData.append('location_note', locationNote);
    if (earlyCheckoutReason) formData.append('early_checkout_reason', earlyCheckoutReason);
    if (overtimeNote) formData.append('overtime_note', overtimeNote);
    return api.post<{ success: boolean; message: string; data: AttendanceRecord; is_early_checkout?: boolean; is_overtime?: boolean; overtime_minutes?: number }>('/attendance/check-out', formData);
  },
  // Ambil daftar pulang cepat untuk admin
  earlyCheckouts: (status?: string, month?: number, year?: number) => {
    let query = '';
    const params: string[] = [];
    if (status) params.push(`status=${status}`);
    if (month) params.push(`month=${month}`);
    if (year) params.push(`year=${year}`);
    if (params.length > 0) query = '?' + params.join('&');
    return api.get<{ success: boolean; data: AttendanceRecord[] }>(`/attendance/early-checkouts${query}`);
  },
  // Setujui pulang cepat
  approveEarlyCheckout: (id: number, adminNote?: string) =>
    api.put<{ success: boolean; data: AttendanceRecord }>(`/attendance/${id}/early-checkout/approve`, { admin_note: adminNote }),
  // Tolak pulang cepat
  rejectEarlyCheckout: (id: number, adminNote: string) =>
    api.put<{ success: boolean; data: AttendanceRecord }>(`/attendance/${id}/early-checkout/reject`, { admin_note: adminNote }),
  // Memperbarui catatan lembur setelah check-out berhasil
  updateOvertimeNote: (overtimeNote: string) =>
    api.put<{ success: boolean; message: string; data: AttendanceRecord }>('/attendance/overtime-note', { overtime_note: overtimeNote }),
};

// ─────────────────────────────────────────────────────────────────────
// Pengajuan Cuti/Izin
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface data pengajuan cuti, izin, atau sakit karyawan.
 */
export interface LeaveRequest {
  id: number;
  type: 'cuti' | 'izin' | 'sakit' | 'cuti_khusus';
  special_leave_category_id?: number;
  special_leave_category?: { id: number; name: string } | null;
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
 * Interface data kuota cuti tahunan karyawan.
 */
export interface LeaveQuota {
  employee_id: number;
  employee_name?: string;
  quota: number;        // Total hari kuota per tahun
  used: number;         // Hari cuti yang sudah DISETUJUI (approved)
  pending: number;      // Hari cuti yang masih MENUNGGU persetujuan
  remaining: number;    // Sisa hari yang masih BISA diajukan (quota - committed)
  period_start: string; // Tanggal mulai periode berjalan (YYYY-MM-DD)
  period_label: string; // Label periode (contoh: "1 April 2026 – 31 Maret 2027")
}

/**
 * Layanan pengajuan ketidakhadiran dan peninjauan oleh admin.
 */
export const leaveApi = {
  // Ambil daftar seluruh pengajuan cuti (admin melihat semua, karyawan melihat miliknya)
  list:    () => api.get<{ success: boolean; data: LeaveRequest[] }>('/leave-requests'),
  // Kirim pengajuan cuti/izin/sakit baru beserta lampiran file base64 atau FormData
  create:  (data: FormData | { type: string; start_date: string; end_date: string; reason: string; attachment?: string | null }) =>
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
  // Mengambil info kuota cuti tahunan (karyawan: milik sendiri; admin: semua atau ?employee_id=X)
  quota: (employeeId?: number) =>
    api.get<{ success: boolean; data: LeaveQuota | LeaveQuota[] }>(
      '/leave-requests/quota' + (employeeId ? `?employee_id=${employeeId}` : '')
    ),
  // Karyawan membatalkan pengajuan miliknya sendiri (hanya yang masih pending)
  cancel: (id: number) => api.delete<{ success: boolean; message: string }>(`/leave-requests/${id}/cancel`),
};

export interface SpecialLeaveCategory {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const specialLeaveApi = {
  listActive: () => api.get<{ success: boolean; data: SpecialLeaveCategory[] }>('/special-leave-categories'),
  create: (name: string) => api.post<{ success: boolean; message: string; data: SpecialLeaveCategory }>('/special-leave-categories', { name }),
  update: (id: number, name: string, is_active: boolean) =>
    api.put<{ success: boolean; message: string; data: SpecialLeaveCategory }>(`/special-leave-categories/${id}`, { name, is_active }),
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

  // Pulang Cepat & Lembur
  early_checkout_summary?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  overtime_summary?: {
    total_incidents: number;
    total_minutes: number;
  };
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
  
  // Pulang Cepat & Lembur
  early_checkout_count?: number;
  overtime_minutes?: number;

  // Kerja Hari Libur
  holiday_work_days?: number;
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
  hospital_latitude?: string;
  hospital_longitude?: string;
  attendance_radius_meters?: string;
  logo_url?: string;                 // URL logo kustom rumah sakit
  notif_email?: '0' | '1';           // Kirim notifikasi via email
  notif_late?: '0' | '1';            // Kirim notifikasi jika terlambat
  notif_leave?: '0' | '1';           // Kirim notifikasi pengajuan cuti
  notif_system?: '0' | '1';          // Kirim notifikasi broadcast sistem
  // Kuota Cuti Tahunan
  leave_reset_month?: string;        // Bulan reset kuota (1-12)
  leave_reset_day?: string;          // Tanggal reset kuota (1-31)
  annual_leave_quota_days?: string;  // Jumlah hari kuota per tahun

  // Toleransi Pulang Cepat & Lembur
  early_checkout_grace_minutes?: string;
  overtime_grace_minutes?: string;
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
  shift_type?: 'normal' | 'dinas_luar';
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
  shift_type?: 'normal' | 'dinas_luar';
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

// ─────────────────────────────────────────────────────────────────────
// Kalender Libur & Penugasan Kerja Hari Libur (holidays)
// ─────────────────────────────────────────────────────────────────────

/**
 * Interface data Hari Libur Nasional.
 */
export interface Holiday {
  id: number;
  date: string; // YYYY-MM-DD
  name: string;
  assignments_count?: number;
}

/**
 * Interface data penugasan kerja pada hari libur.
 */
export interface HolidayWorkAssignment {
  id: number;
  employee_id: number;
  employee_name: string;
  nip: string;
  department: string;
  position: string;
  note?: string | null;
  assigned_by_name?: string | null;
  created_at: string;
}

/**
 * Layanan API CRUD Hari Libur dan Penugasan Kerja Hari Libur.
 */
export const holidayApi = {
  // Ambil daftar hari libur (bisa difilter tahun)
  list: (year?: number) =>
    api.get<{ success: boolean; data: Holiday[] }>('/holidays' + (year ? `?year=${year}` : '')),
  // Tambah hari libur baru (admin)
  create: (data: { date: string; name: string }) =>
    api.post<{ success: boolean; message: string; data: Holiday }>('/holidays', data),
  // Sinkronisasi otomatis dari internet (admin)
  sync: (year: number) =>
    api.post<{ success: boolean; message: string }>('/holidays/sync', { year }),
  // Edit hari libur (admin)
  update: (id: number, data: { date: string; name: string }) =>
    api.put<{ success: boolean; message: string; data: Holiday }>(`/holidays/${id}`, data),
  // Hapus hari libur (admin)
  delete: (id: number) =>
    api.delete<{ success: boolean; message: string }>(`/holidays/${id}`),

  // Ambil daftar penugasan kerja hari libur tertentu (admin)
  listAssignments: (holidayId: number) =>
    api.get<{ success: boolean; data: HolidayWorkAssignment[] }>(`/holidays/${holidayId}/work-assignments`),
  // Tambah penugasan kerja hari libur (admin)
  assign: (holidayId: number, employeeIds: number[], note?: string) =>
    api.post<{ success: boolean; message: string; data: any }>(`/holidays/${holidayId}/work-assignments`, {
      employee_ids: employeeIds,
      note,
    }),
  // Hapus penugasan kerja hari libur (admin)
  unassign: (holidayId: number, employeeId: number) =>
    api.delete<{ success: boolean; message: string }>(`/holidays/${holidayId}/work-assignments/${employeeId}`),
};


