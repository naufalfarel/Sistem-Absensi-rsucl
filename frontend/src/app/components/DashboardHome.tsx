import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Stethoscope, MapPin, Calendar, ChevronRight, Bell, TrendingUp, Users, Activity } from 'lucide-react';

export function DashboardHome({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const dateStr = `${days[time.getDay()]}, ${time.getDate()} ${months[time.getMonth()]} ${time.getFullYear()}`;
  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const stats = [
    {
      icon: CheckCircle2,
      label: 'Status Kehadiran',
      value: 'Hadir',
      sub: 'Hari ini',
      color: '#16A34A',
      bg: '#F0FDF4',
      badge: 'Tepat Waktu',
      badgeColor: '#16A34A',
      badgeBg: '#DCFCE7',
    },
    {
      icon: Clock,
      label: 'Jam Masuk',
      value: '08:28',
      sub: 'WIB',
      color: '#2563EB',
      bg: '#EFF6FF',
      badge: 'Tepat Waktu',
      badgeColor: '#2563EB',
      badgeBg: '#DBEAFE',
    },
    {
      icon: Stethoscope,
      label: 'Shift Kerja',
      value: 'Reguler',
      sub: '08:30 – 17:00',
      color: '#7C3AED',
      bg: '#F5F3FF',
      badge: 'Aktif',
      badgeColor: '#7C3AED',
      badgeBg: '#EDE9FE',
    },
    {
      icon: MapPin,
      label: 'Status Lokasi',
      value: 'Dalam Area',
      sub: 'RSUCL',
      color: '#EA580C',
      bg: '#FFF7ED',
      badge: 'GPS On',
      badgeColor: '#EA580C',
      badgeBg: '#FFEDD5',
    },
  ];


  const notifications = [
    { icon: '📅', title: 'Jadwal shift besok berubah', time: '10 menit lalu', unread: true },
    { icon: '✅', title: 'Pengajuan cuti disetujui', time: '2 jam lalu', unread: true },
    { icon: '⏰', title: 'Pengingat: Check-out pukul 15:00', time: '3 jam lalu', unread: false },
  ];

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[13px] text-gray-500 mb-0.5">{dateStr}</p>
          <h1 className="text-xl font-semibold text-gray-900">Selamat Pagi, <span className="text-[#16A34A]">Dr. Rina</span> 👋</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Dokter Umum · Poli Umum & UGD</p>
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
                <p className="text-[12px] text-gray-500 mt-0.5">Senin – Jumat · 08:30 – 17:00 WIB</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#16A34A] text-white">Aktif</span>
            </div>

            {/* Time blocks */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Jam Masuk',    value: '08:30', sub: 'WIB', color: '#16A34A', bg: '#F0FDF4' },
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
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
            </div>
            <div className="p-3 space-y-1">
              {notifications.map((n, i) => (
                <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl ${n.unread ? 'bg-green-50/60' : ''}`}>
                  <span className="text-lg mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] leading-tight ${n.unread ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{n.time}</p>
                  </div>
                  {n.unread && <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mt-1.5 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
