/**
 * API Client — Sistem Absensi RSUCL
 *
 * Lapisan akses ke backend Laravel (http://localhost:8000/api)
 * Autentikasi: Bearer Token (Laravel Sanctum)
 * Token disimpan di localStorage dengan key "rsucl_token"
 */

const getApiUrl = () => {
  const envVal = import.meta.env.VITE_API_URL;
  if (envVal === '') return ''; // Relative path for proxy support
  return envVal ?? 'http://localhost:8000';
};
const BASE_URL = getApiUrl() + '/api';
const TOKEN_KEY = 'rsucl_token';

// ── Token helpers ─────────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Core fetch wrapper ─────────────────────────────────────────────────
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

// Shorthand methods
export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
};

// Custom error class
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────
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

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ success: boolean; data: { token: string; user: AuthUser } }>(
      '/login', { username, password }
    ),
  me: () => api.get<{ success: boolean; data: AuthUser }>('/me'),
  logout: () => api.post<{ success: boolean; message: string }>('/logout', {}),
  forgotPassword: (data: { username: string; nip: string; email: string; password?: string }) =>
    api.post<{ success: boolean; message: string }>('/forgot-password', data),
};

export const profileApi = {
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
// Employees (admin only)
// ─────────────────────────────────────────────────────────────────────
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

export const employeeApi = {
  list:   ()                    => api.get<{ success: boolean; data: Employee[] }>('/employees'),
  show:   (id: number)          => api.get<{ success: boolean; data: Employee }>(`/employees/${id}`),
  create: (data: Partial<Employee> & { password: string }) =>
    api.post<{ success: boolean; data: Employee }>('/employees', data),
  update: (id: number, data: Partial<Employee> & { password?: string }) =>
    api.put<{ success: boolean; data: Employee }>(`/employees/${id}`, data),
  delete: (id: number)          => api.delete<{ success: boolean; message: string }>(`/employees/${id}`),
  meta:   ()                    => api.get<{ success: boolean; data: { departments: { id: number; name: string }[]; positions: { id: number; name: string }[] } }>('/employees/meta'),
};

// ─────────────────────────────────────────────────────────────────────
// Departments (admin only)
// ─────────────────────────────────────────────────────────────────────
export interface DepartmentModel {
  id: number;
  name: string;
  employees_count?: number;
  created_at?: string;
  updated_at?: string;
}

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
// Attendance
// ─────────────────────────────────────────────────────────────────────
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

export const attendanceApi = {
  today:    () => api.get<{
    success: boolean;
    data: AttendanceRecord | null;
    active_leave?: { type: 'cuti' | 'izin' | 'sakit'; reason: string } | null;
  }>('/attendance/today'),
  allToday: () => api.get<{ success: boolean; data: AttendanceRecord[] }>('/attendance/all-today'),
  history:  (month?: number, year?: number) => api.get<{ success: boolean; data: AttendanceRecord[] }>(
    '/attendance/history' + (month && year ? `?month=${month}&year=${year}` : '')
  ),
  checkIn:  (lat?: number, lng?: number, accuracy?: number, image?: string, simulatedTime?: string) =>
    api.post<{ success: boolean; message: string; data: AttendanceRecord }>(
      '/attendance/check-in', { latitude: lat, longitude: lng, accuracy, image, simulated_time: simulatedTime }
    ),
  checkOut: (lat?: number, lng?: number, accuracy?: number, image?: string, simulatedTime?: string) =>
    api.post<{ success: boolean; message: string; data: AttendanceRecord }>(
      '/attendance/check-out', { latitude: lat, longitude: lng, accuracy, image, simulated_time: simulatedTime }
    ),
};

// ─────────────────────────────────────────────────────────────────────
// Leave Requests
// ─────────────────────────────────────────────────────────────────────
export interface LeaveRequest {
  id: number;
  type: 'cuti' | 'izin' | 'sakit';
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  reviewed_at?: string;
  created_at: string;
  employee: { id: number; name: string; nip: string; department: string };
  reviewer?: { name: string } | null;
}

export const leaveApi = {
  list:    () => api.get<{ success: boolean; data: LeaveRequest[] }>('/leave-requests'),
  create:  (data: { type: string; start_date: string; end_date: string; reason: string }) =>
    api.post<{ success: boolean; message: string; data: LeaveRequest }>('/leave-requests', data),
  approve: (id: number, admin_note?: string) =>
    api.put<{ success: boolean; data: LeaveRequest }>(`/leave-requests/${id}/approve`, { admin_note }),
  reject:  (id: number, admin_note?: string) =>
    api.put<{ success: boolean; data: LeaveRequest }>(`/leave-requests/${id}/reject`, { admin_note }),
  delete:  (id: number) => api.delete<{ success: boolean }>(`/leave-requests/${id}`),
  deleteAllProcessed: () => api.delete<{ success: boolean }>('/leave-requests/all-processed'),
};

// ─────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────
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

export const notificationApi = {
  list:       () => api.get<{ success: boolean; data: { notifications: AppNotification[]; unread_count: number } }>('/notifications'),
  markRead:   (id: number)  => api.put<{ success: boolean }>(`/notifications/${id}/read`, {}),
  markAllRead: ()           => api.put<{ success: boolean }>('/notifications/read-all', {}),
  delete:     (id: number)  => api.delete<{ success: boolean }>(`/notifications/${id}`),
  deleteAllRead: ()         => api.delete<{ success: boolean }>('/notifications/delete-read'),
};

// ─────────────────────────────────────────────────────────────────────
// Reports (admin)
// ─────────────────────────────────────────────────────────────────────
export interface ReportSummary {
  total_employees: number;
  today: { hadir: number; telat: number; alpha: number; cuti: number; belum: number };
  this_month: { hadir: number; telat: number; alpha: number; cuti: number };
  trends: { presence: number; late: number; alpha: number; cuti: number };
  pending_leave: number;
  daily_chart: { date: string; label: string; count: number; total: number }[];
  monthly_trend: { bulan: string; hadir: number; terlambat: number; alpha: number; cuti: number }[];
  composition: { name: string; value: number; color: string }[];
  weekly_late: { hari: string; count: number }[];
  dept_attendance: { dept: string; persen: number }[];
}

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

export const reportApi = {
  summary: () => api.get<{ success: boolean; data: ReportSummary }>('/reports/summary'),
  monthlyRekap: (month: number, year: number) =>
    api.get<{ success: boolean; data: MonthlyRekapRecord[] }>(`/reports/monthly-rekap?month=${month}&year=${year}`),
};

// ─────────────────────────────────────────────────────────────────────
// Settings (admin)
// ─────────────────────────────────────────────────────────────────────
export interface AppSettings {
  system_active: '0' | '1';
  checkin_open: string;
  late_limit: string;
  close_checkin: string;
  break_start: string;
  break_end: string;
  checkout_open: string;
  checkout_close: string;
  sat_checkout_open: string;
  sat_checkout_close: string;
  gps_radius: string;
  hospital_lat: string;
  hospital_lng: string;
  logo_url?: string;
  notif_email?: '0' | '1';
  notif_late?: '0' | '1';
  notif_leave?: '0' | '1';
  notif_system?: '0' | '1';
}

export const settingApi = {
  get:    ()                        => api.get<{ success: boolean; data: AppSettings }>('/settings'),
  update: (data: Partial<AppSettings>) => api.put<{ success: boolean; message: string }>('/settings', data),
};

// ─────────────────────────────────────────────────────────────────────
// Schedules (admin)
// ─────────────────────────────────────────────────────────────────────
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

export interface MyShiftSchedule {
  id: number;
  name: string;
  start_time: string; // "HH:mm:ss" or "HH:mm"
  end_time: string;
  color: string;
  icon: string;
}

export const scheduleApi = {
  list:   ()                               => api.get<{ success: boolean; data: ShiftSchedule[] }>('/schedules'),
  create: (data: Omit<ShiftSchedule, 'id' | 'employees_count'>) =>
    api.post<{ success: boolean; data: ShiftSchedule }>('/schedules', data),
  update: (id: number, data: Partial<Omit<ShiftSchedule, 'id' | 'employees_count'>>) =>
    api.put<{ success: boolean; data: ShiftSchedule }>(`/schedules/${id}`, data),
  delete: (id: number)                     => api.delete<{ success: boolean; message: string }>(`/schedules/${id}`),
  getEmployeeSchedules: () => api.get<{ success: boolean; data: EmployeeWeeklySchedule[] }>('/employee-schedules'),
  assignEmployeeSchedule: (employee_id: number, day_of_week: string, schedule_id: number | null) =>
    api.post<{ success: boolean; message: string }>('/employee-schedules/assign', { employee_id, day_of_week, schedule_id }),
  mySchedule: () => api.get<{ success: boolean; data: MyShiftSchedule | null; saturday_shift?: MyShiftSchedule | null; day: string }>('/my-schedule'),
};

