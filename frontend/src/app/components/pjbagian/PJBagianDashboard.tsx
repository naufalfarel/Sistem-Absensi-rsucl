import { useState, useEffect } from 'react';
import {
  CheckCircle2, Clock, Stethoscope, MapPin, Calendar,
  ChevronRight, Bell, TrendingUp, User, Activity, CheckSquare,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  attendanceApi, AttendanceRecord, notificationApi, AppNotification,
  scheduleApi, MyShiftSchedule, settingApi,
} from '../../../services/api';

function fmtTime(t: string | undefined | null): string {
  if (!t) return '--:--';
  return t.substring(0, 5);
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface PJBagianDashboardProps {
  pendingLeaveCount: number;
  pendingOvertimeCount: number;
  onNavigate: (tab: string) => void;
}

export function PJBagianDashboard({ pendingLeaveCount, pendingOvertimeCount, onNavigate }: PJBagianDashboardProps) {
  const { user } = useAuth();

  const [time, setTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [todayHoliday, setTodayHoliday] = useState<{ name: string; is_assigned: boolean } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [todayShift, setTodayShift] = useState<MyShiftSchedule | null | undefined>(undefined);
  const [shiftDay, setShiftDay] = useState<string>('');
  const [hospLat, setHospLat] = useState<number>(5.552740480177099);
  const [hospLng, setHospLng] = useState<number>(95.33486560781716);
  const [hospRadius, setHospRadius] = useState<number>(40);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'in' | 'out' | 'unavailable'>('loading');

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [attendRes, notifRes, shiftRes] = await Promise.allSettled([
          attendanceApi.today(),
          notificationApi.list(),
          scheduleApi.mySchedule(),
        ]);
        if (attendRes.status === 'fulfilled' && attendRes.value.success) {
          setTodayRecord(attendRes.value.data);
          if (attendRes.value.holiday) setTodayHoliday(attendRes.value.holiday);
        }
        if (notifRes.status === 'fulfilled' && notifRes.value.success) {
          setNotifications(notifRes.value.data.notifications.slice(0, 3));
          setUnreadNotifsCount(notifRes.value.data.unread_count);
        }
        if (shiftRes.status === 'fulfilled' && shiftRes.value.success) {
          setTodayShift(shiftRes.value.data);
          setShiftDay(shiftRes.value.day ?? '');
        } else {
          setTodayShift(null);
        }
      } catch {
        setTodayShift(null);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    settingApi.get().then(res => {
      if (res.success && res.data) {
        const lat = parseFloat(res.data.hospital_latitude || res.data.hospital_lat);
        const lng = parseFloat(res.data.hospital_longitude || res.data.hospital_lng);
        const rad = parseFloat(res.data.attendance_radius_meters || res.data.gps_radius);
        if (!isNaN(lat)) setHospLat(lat);
        if (!isNaN(lng)) setHospLng(lng);
        if (!isNaN(rad) && rad > 0) setHospRadius(rad);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('unavailable'); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserCoords({ lat, lng });
        const dist = haversine(lat, lng, hospLat, hospLng);
        setGpsStatus(dist <= hospRadius ? 'in' : 'out');
      },
      () => setGpsStatus('unavailable'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hospLat, hospLng, hospRadius]);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dateStr = `${days[time.getDay()]}, ${time.getDate()} ${months[time.getMonth()]} ${time.getFullYear()}`;
  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const getGreeting = () => {
    const h = time.getHours();
    if (h >= 4 && h < 11) return 'Selamat Pagi';
    if (h >= 11 && h < 15) return 'Selamat Siang';
    if (h >= 15 && h < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const shiftName      = todayShift ? `Shift ${todayShift.name}` : todayShift === null ? 'Tidak Ada Shift' : 'Memuat…';
  const shiftStartTime = fmtTime(todayShift?.start_time);
  const shiftEndTime   = fmtTime(todayShift?.end_time);
  const shiftRange     = todayShift ? `${shiftStartTime} – ${shiftEndTime} WIB` : todayShift === null ? 'Tidak ada jadwal hari ini' : '';

  const isOffDuty = todayShift === null || todayRecord?.status === 'cuti' || todayRecord?.status === 'sakit';
  const leaveType = todayRecord?.status === 'cuti' ? 'Cuti' : todayRecord?.status === 'sakit' ? 'Sakit' : null;

  const getStatusLabel = () => {
    if (isOffDuty) return leaveType ?? 'Libur';
    if (!todayRecord) { if (todayShift === undefined) return 'Memuat…'; return 'Belum Absen'; }
    if (todayRecord.display_status === 'tidak_lengkap') return 'Tidak Lengkap';
    const m: Record<string, string> = { hadir: 'Hadir', telat: 'Terlambat', alpha: 'Alpha' };
    return m[todayRecord.status] ?? 'Sudah Absen';
  };

  const getStatusBadge = () => {
    if (isOffDuty) return 'Bebas Tugas';
    if (!todayRecord) return 'Belum Check-In';
    if (todayRecord.display_status === 'tidak_lengkap') return 'Tidak Lengkap';
    if (todayRecord.status === 'alpha') return 'Tidak Hadir';
    if (todayRecord.check_out) return 'Sudah Pulang';
    if (todayRecord.status === 'telat') return 'Terlambat';
    return 'Tepat Waktu';
  };

  const getStatusColor = () => {
    if (isOffDuty) {
      if (leaveType) return { color: '#7C3AED', bg: '#F5F3FF' };
      return { color: '#4B5563', bg: '#F3F4F6' };
    }
    if (!todayRecord) return { color: '#6B7280', bg: '#F9FAFB' };
    if (todayRecord.display_status === 'tidak_lengkap') return { color: '#4B5563', bg: '#F3F4F6' };
    if (todayRecord.status === 'hadir') return { color: '#16A34A', bg: '#DCFCE7' };
    if (todayRecord.status === 'telat') return { color: '#D97706', bg: '#FEF3C7' };
    return { color: '#DC2626', bg: '#FEE2E2' };
  };

  const sc = getStatusColor();

  const stats = [
    {
      icon: CheckCircle2,
      label: 'Status Kehadiran',
      value: getStatusLabel(),
      sub: todayRecord?.check_out ? 'Absensi Selesai' : 'Hari ini',
      color: sc.color, bg: sc.bg + '30',
      badge: getStatusBadge(), badgeColor: sc.color, badgeBg: sc.bg,
    },
    {
      icon: Clock,
      label: 'Jam Masuk',
      value: todayRecord?.check_in ? todayRecord.check_in.substring(0, 5) : '--:--',
      sub: 'WIB',
      color: '#2563EB', bg: '#EFF6FF',
      badge: todayRecord?.check_in ? (todayRecord.status === 'telat' ? 'Terlambat' : 'Tepat Waktu') : (isOffDuty ? (leaveType ?? 'Libur') : 'Menunggu'),
      badgeColor: todayRecord?.check_in ? (todayRecord.status === 'telat' ? '#D97706' : '#2563EB') : (isOffDuty ? '#7C3AED' : '#9CA3AF'),
      badgeBg: todayRecord?.check_in ? (todayRecord.status === 'telat' ? '#FEF3C7' : '#DBEAFE') : (isOffDuty ? '#F5F3FF' : '#F3F4F6'),
    },
    {
      icon: Clock,
      label: 'Jam Keluar',
      value: todayRecord?.check_out ? todayRecord.check_out.substring(0, 5) : '--:--',
      sub: 'WIB',
      color: '#DC2626', bg: '#FFF1F2',
      badge: todayRecord?.check_out ? 'Selesai' : (todayRecord?.check_in ? 'Belum Pulang' : (isOffDuty ? (leaveType ?? 'Libur') : 'Belum Absen')),
      badgeColor: todayRecord?.check_out ? '#16A34A' : (todayRecord?.check_in ? '#EA580C' : (isOffDuty ? '#7C3AED' : '#9CA3AF')),
      badgeBg: todayRecord?.check_out ? '#DCFCE7' : (todayRecord?.check_in ? '#FFF7ED' : (isOffDuty ? '#F5F3FF' : '#F3F4F6')),
    },
    {
      icon: Stethoscope,
      label: 'Shift Kerja',
      value: todayShift === undefined ? 'Memuat…' : (todayShift ? todayShift.name : 'Tidak Ada'),
      sub: todayShift ? `${shiftStartTime} – ${shiftEndTime}` : 'Hari ini',
      color: '#7C3AED', bg: '#F5F3FF',
      badge: todayShift ? 'Aktif' : (todayShift === null ? 'Libur' : '…'),
      badgeColor: todayShift ? '#7C3AED' : '#9CA3AF',
      badgeBg: todayShift ? '#EDE9FE' : '#F3F4F6',
    },
    {
      icon: MapPin,
      label: 'Status Lokasi',
      value: gpsStatus === 'loading' ? 'Memuat GPS…' : gpsStatus === 'in' ? 'Dalam Area' : gpsStatus === 'out' ? 'Luar Area' : 'GPS Nonaktif',
      sub: 'RSUCL',
      color: gpsStatus === 'in' ? '#16A34A' : gpsStatus === 'out' ? '#DC2626' : '#6B7280',
      bg: gpsStatus === 'in' ? '#DCFCE7' : gpsStatus === 'out' ? '#FEE2E2' : '#F9FAFB',
      badge: gpsStatus === 'loading' ? 'GPS…' : gpsStatus === 'in' ? 'GPS On' : gpsStatus === 'out' ? 'GPS On' : 'GPS Off',
      badgeColor: gpsStatus === 'in' ? '#16A34A' : gpsStatus === 'out' ? '#DC2626' : '#6B7280',
      badgeBg: gpsStatus === 'in' ? '#DCFCE7' : gpsStatus === 'out' ? '#FEE2E2' : '#F3F4F6',
    },
  ];

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[13px] text-gray-500 mb-0.5">{dateStr}</p>
          <h1 className="text-xl font-semibold text-gray-900">
            {getGreeting()}, <span className="text-[#16A34A]">{user?.name}</span> 👋
          </h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Penanggung Jawab Departemen ·{' '}
            <span className="font-semibold text-[#16A34A]">
              {(user as any)?.pj_bagian_department || user?.department || 'RSUCL'}
            </span>
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-2xl font-mono font-semibold text-black tracking-tight">{timeStr}</div>
          <div className="text-[12px] text-gray-400 mt-0.5">Waktu Indonesia Barat</div>
        </div>
      </div>

      {/* Hari Libur Banner */}
      {todayHoliday && (
        <div className={`mb-5 rounded-2xl border p-4 text-[13px] leading-relaxed shadow-sm ${
          todayHoliday.is_assigned ? 'border-purple-200 bg-purple-50 text-purple-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              todayHoliday.is_assigned ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-600'
            }`}>
              <Calendar size={15} />
            </div>
            <div>
              <p className="font-bold text-[14px]">Hari Libur Nasional: {todayHoliday.name}</p>
              <p className="mt-1 text-gray-600">
                {todayHoliday.is_assigned
                  ? <span>Anda <strong className="text-purple-700">DITUGASKAN</strong> untuk piket hari ini.</span>
                  : <span>Anda <strong className="text-red-700">TIDAK DITUGASKAN</strong> masuk hari ini.</span>
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ color: s.badgeColor, background: s.badgeBg }}>
                {s.badge}
              </span>
            </div>
            <div className="text-[15px] font-semibold text-gray-900">{s.value}</div>
            <div className="text-[11px] text-gray-400">{s.label}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shift Info */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#16A34A]" />
              <span className="text-[14px] font-semibold text-gray-800">Info Shift Hari Ini</span>
            </div>
            <span className="text-[12px] text-gray-400">{dateStr}</span>
          </div>
          <div className="p-5 space-y-3">
            {todayShift === undefined ? (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-48" />
                </div>
              </div>
            ) : todayShift === null ? (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-gray-500">Tidak Ada Jadwal Shift</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{shiftDay} · Tidak ada shift yang ditugaskan</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Libur</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3.5 rounded-xl border"
                style={{ background: todayShift.color + '15', borderColor: todayShift.color + '30' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: todayShift.color }}>
                  <Clock size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-gray-800">{shiftName}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">{shiftDay} · {shiftRange}</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ background: todayShift.color }}>Aktif</span>
              </div>
            )}

            {todayShift !== undefined && (
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: 'Jam Masuk', value: todayShift ? shiftStartTime : '--:--', sub: todayShift ? 'WIB' : '—', bg: todayShift ? '#F0FDF4' : '#F9FAFB' },
                  { label: 'Check-In Aktual', value: todayRecord?.check_in ? todayRecord.check_in.substring(0, 5) : '--:--', sub: todayRecord?.check_in ? (todayRecord.status === 'telat' ? 'Terlambat' : 'Tepat Waktu') : (isOffDuty ? (leaveType ?? 'Bebas Tugas') : 'Belum Absen'), bg: todayRecord?.check_in ? (todayRecord.status === 'telat' ? '#FFFBEB' : '#F0FDF4') : '#F9FAFB' },
                  { label: 'Jam Pulang', value: todayShift ? shiftEndTime : '--:--', sub: todayShift ? 'WIB' : '—', bg: todayShift ? '#F0FDF4' : '#F9FAFB' },
                ].map((b, i) => (
                  <div key={i} className="rounded-xl p-3 text-center" style={{ background: b.bg }}>
                    <p className="text-[10px] text-gray-400 mb-1">{b.label}</p>
                    <p className="text-[17px] font-bold font-mono text-gray-900">{b.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{b.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {todayRecord?.check_out && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-base">✅</span>
                <p className="text-[12px] text-green-700">
                  Check-out tercatat pukul <strong>{todayRecord.check_out.substring(0, 5)} WIB</strong>. Absensi hari ini selesai.
                </p>
              </div>
            )}
            {todayShift === null && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                <span className="text-base">📋</span>
                <p className="text-[12px] text-gray-500">Belum ada shift yang ditugaskan untuk hari ini.</p>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-4">
          {/* Persetujuan Staf */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
              <CheckSquare size={16} className="text-[#16A34A]" />
              <span className="text-[14px] font-semibold text-gray-800">Persetujuan Staf</span>
            </div>
            <div className="p-3 space-y-2">
              <button onClick={() => onNavigate('approvals')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors group text-left">
                <div>
                  <p className="text-[20px] font-bold text-amber-700">{pendingLeaveCount}</p>
                  <p className="text-[11px] font-semibold text-amber-800">Persetujuan Cuti</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">Menunggu tindakan</p>
                </div>
                <ChevronRight size={16} className="text-amber-400 group-hover:text-amber-600 transition-colors" />
              </button>
              <button onClick={() => onNavigate('approvals')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors group text-left">
                <div>
                  <p className="text-[20px] font-bold text-blue-700">{pendingOvertimeCount}</p>
                  <p className="text-[11px] font-semibold text-blue-800">Persetujuan Lembur</p>
                  <p className="text-[10px] text-blue-600 mt-0.5">Menunggu verifikasi</p>
                </div>
                <ChevronRight size={16} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
              </button>
            </div>
          </div>

          {/* Aksi Cepat */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
              <Activity size={16} className="text-[#16A34A]" />
              <span className="text-[14px] font-semibold text-gray-800">Aksi Cepat</span>
            </div>
            <div className="p-3 space-y-1">
              {[
                { label: 'Absen Mandiri', icon: MapPin, tab: 'attendance' },
                { label: 'Riwayat Absen', icon: TrendingUp, tab: 'history' },
                { label: 'Profil Saya', icon: User, tab: 'profile' },
                { label: 'Notifikasi', icon: Bell, tab: 'notifications' },
              ].map(({ label, icon: Icon, tab }, i) => (
                <button key={i} onClick={() => onNavigate(tab)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                      <Icon size={14} className="text-[#16A34A]" />
                    </div>
                    <span className="text-[13px] text-gray-700">{label}</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Notifikasi */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#16A34A]" />
                <span className="text-[14px] font-semibold text-gray-800">Notifikasi</span>
              </div>
              {unreadNotifsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {unreadNotifsCount}
                </span>
              )}
            </div>
            <div className="p-3 space-y-1">
              {notifications.map((n, i) => (
                <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl ${!n.is_read ? 'bg-green-50/60' : ''}`}>
                  <span className="text-lg mt-0.5">{n.type === 'leave' ? '📅' : n.type === 'attendance' ? '⏰' : '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] leading-tight ${!n.is_read ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{n.body}</p>
                  </div>
                  {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mt-1.5 flex-shrink-0" />}
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-5 text-gray-300 text-[11px]">Belum ada notifikasi.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
