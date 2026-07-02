import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Stethoscope, MapPin, Calendar, ChevronRight, Bell, TrendingUp, Users, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi, AttendanceRecord, notificationApi, AppNotification } from '../../services/api';

export function DashboardHome({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth();
  const [time, setTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const attendRes = await attendanceApi.today();
      if (attendRes.success) {
        setTodayRecord(attendRes.data);
      }
      const notifRes = await notificationApi.list();
      if (notifRes.success) {
        setNotifications(notifRes.data.notifications.slice(0, 3));
        setUnreadNotifsCount(notifRes.data.unread_count);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const dateStr = `${days[time.getDay()]}, ${time.getDate()} ${months[time.getMonth()]} ${time.getFullYear()}`;
  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Map today's attendance status
  const getStatusLabel = () => {
    if (!todayRecord) return 'Belum Absen';
    const statusMap: Record<string, string> = {
      hadir: 'Hadir',
      telat: 'Terlambat',
      izin: 'Cuti/Izin',
      sakit: 'Sakit',
      alpha: 'Alpha',
    };
    return statusMap[todayRecord.status] ?? 'Sudah Absen';
  };

  const getStatusBadge = () => {
    if (!todayRecord) return 'Belum Check-In';
    if (todayRecord.check_out) return 'Sudah Pulang';
    if (todayRecord.status === 'telat') return 'Terlambat';
    return 'Tepat Waktu';
  };

  const getStatusColor = () => {
    if (!todayRecord) return { color: '#6B7280', bg: '#F9FAFB' };
    if (todayRecord.status === 'hadir') return { color: '#16A34A', bg: '#DCFCE7' };
    if (todayRecord.status === 'telat') return { color: '#D97706', bg: '#FEF3C7' };
    return { color: '#DC2626', bg: '#FEE2E2' };
  };

  const statusColor = getStatusColor();

  const stats = [
    {
      icon: CheckCircle2,
      label: 'Status Kehadiran',
      value: getStatusLabel(),
      sub: todayRecord?.check_out ? 'Absensi Selesai' : 'Hari ini',
      color: statusColor.color,
      bg: statusColor.bg + '30',
      badge: getStatusBadge(),
      badgeColor: statusColor.color,
      badgeBg: statusColor.bg,
    },
    {
      icon: Clock,
      label: 'Jam Masuk',
      value: todayRecord?.check_in ? todayRecord.check_in.substring(0, 5) : '--:--',
      sub: 'WIB',
      color: '#2563EB',
      bg: '#EFF6FF',
      badge: todayRecord?.check_in ? (todayRecord.status === 'telat' ? 'Terlambat' : 'Tepat Waktu') : 'Menunggu',
      badgeColor: todayRecord?.check_in ? (todayRecord.status === 'telat' ? '#D97706' : '#2563EB') : '#9CA3AF',
      badgeBg: todayRecord?.check_in ? (todayRecord.status === 'telat' ? '#FEF3C7' : '#DBEAFE') : '#F3F4F6',
    },
    {
      icon: Stethoscope,
      label: 'Shift Kerja',
      value: 'Reguler',
      sub: '08:00 – 17:00',
      color: '#7C3AED',
      bg: '#F5F3FF',
      badge: 'Aktif',
      badgeColor: '#7C3AED',
      badgeBg: '#EDE9FE',
    },
    {
      icon: MapPin,
      label: 'Status Lokasi',
      value: todayRecord ? 'Terverifikasi' : 'Dalam Area',
      sub: 'RSUCL',
      color: '#EA580C',
      bg: '#FFF7ED',
      badge: 'GPS On',
      badgeColor: '#EA580C',
      badgeBg: '#FFEDD5',
    },
  ];

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[13px] text-gray-500 mb-0.5">{dateStr}</p>
          <h1 className="text-xl font-semibold text-gray-900">Selamat Pagi, <span className="text-[#16A34A]">{user?.name}</span> 👋</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{user?.position} · {user?.department}</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-2xl font-mono font-semibold text-gray-800 tracking-tight">{timeStr}</div>
          <div className="text-[12px] text-gray-400 mt-0.5">Waktu Indonesia Barat</div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: s.badgeColor, background: s.badgeBg }}>
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
            {/* Shift badge */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-100">
              <div className="w-9 h-9 rounded-xl bg-[#16A34A] flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-gray-800">Shift Reguler</p>
                <p className="text-[12px] text-gray-500 mt-0.5">Senin – Jumat · 08:00 – 17:00 WIB</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#16A34A] text-white">Aktif</span>
            </div>

            {/* Time blocks */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Jam Masuk',    value: '08:00', sub: 'WIB', color: '#16A34A', bg: '#F0FDF4' },
                { label: 'Istirahat',    value: '12:30', sub: '– 13:30', color: '#7C3AED', bg: '#F5F3FF' },
                { label: 'Jam Pulang',   value: '17:00', sub: 'WIB', color: '#EA580C', bg: '#FFF7ED' },
              ].map((b, i) => (
                <div key={i} className="rounded-xl p-3 text-center" style={{ background: b.bg }}>
                  <p className="text-[10px] text-gray-400 mb-1">{b.label}</p>
                  <p className="text-[17px] font-bold font-mono" style={{ color: b.color }}>{b.value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{b.sub}</p>
                </div>
              ))}
            </div>

            {/* Makan siang note */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
              <span className="text-base">🍽️</span>
              <p className="text-[12px] text-amber-700">Makan siang disediakan di kantor · 12:30 – 13:30</p>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
              <Activity size={16} className="text-[#16A34A]" />
              <span className="text-[14px] font-semibold text-gray-800">Aksi Cepat</span>
            </div>
            <div className="p-3 space-y-1">
              {[
                { label: 'Absensi Check-Out', icon: Clock, tab: 'attendance' },
                { label: 'Riwayat Kehadiran', icon: TrendingUp, tab: 'history' },
                { label: 'Ajukan Cuti', icon: Calendar, tab: 'profile' },
                { label: 'Tim Saya', icon: Users, tab: 'profile' },
              ].map(({ label, icon: Icon, tab }, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(tab)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
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

          {/* Notifications preview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#16A34A]" />
                <span className="text-[14px] font-semibold text-gray-800">Notifikasi</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{unreadNotifsCount}</span>
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
