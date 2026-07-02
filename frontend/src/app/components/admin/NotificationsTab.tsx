import { useState } from 'react';
import { AlertTriangle, FileText, Shield, LogIn, CheckCircle2, RefreshCw, Bell, Check } from 'lucide-react';

interface AdminNotif {
  id: number;
  icon: typeof Bell;
  iconColor: string;
  iconBg: string;
  category: 'terlambat' | 'cuti' | 'system' | 'login';
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

const notifications: AdminNotif[] = [
  { id: 1, icon: AlertTriangle, iconColor: '#D97706', iconBg: '#FFFBEB', category: 'terlambat', title: 'Karyawan Terlambat', desc: 'dr. Siti Rahma (Poli Anak) baru melakukan check-in pukul 09:15 WIB. Terlambat 45 menit dari jadwal reguler.', time: 'Hari ini, 09:16', unread: true },
  { id: 2, icon: FileText, iconColor: '#2563EB', iconBg: '#EFF6FF', category: 'cuti', title: 'Pengajuan Cuti Baru', desc: 'Dr. Rina Kusumawati mengajukan cuti tahunan untuk tanggal 10–11 Juli 2025. Menunggu persetujuan Anda.', time: 'Hari ini, 09:05', unread: true },
  { id: 3, icon: AlertTriangle, iconColor: '#D97706', iconBg: '#FFFBEB', category: 'terlambat', title: 'Karyawan Terlambat', desc: 'Fajar Nugroho (Laboratorium) check-in pukul 07:45 WIB, terlambat 45 menit dari Shift Pagi (07:00).', time: 'Hari ini, 07:46', unread: true },
  { id: 4, icon: FileText, iconColor: '#0891B2', iconBg: '#ECFEFF', category: 'cuti', title: 'Pengajuan Sakit', desc: 'Ns. Ahmad Fauzi mengajukan izin sakit untuk tanggal 2–3 Juli 2025 disertai surat keterangan dokter.', time: 'Hari ini, 07:32', unread: true },
  { id: 5, icon: LogIn, iconColor: '#7C3AED', iconBg: '#F5F3FF', category: 'login', title: 'Login Admin Terdeteksi', desc: 'Login administrator berhasil dari perangkat baru pada pukul 07:00 WIB. Jika bukan Anda, segera ganti password.', time: 'Hari ini, 07:00', unread: false },
  { id: 6, icon: CheckCircle2, iconColor: '#16A34A', iconBg: '#F0FDF4', category: 'system', title: 'Backup Data Berhasil', desc: 'Backup otomatis data absensi berhasil dilakukan. Total 1.247 record tersimpan dengan aman.', time: 'Kemarin, 23:00', unread: false },
  { id: 7, icon: AlertTriangle, iconColor: '#DC2626', iconBg: '#FEF2F2', category: 'terlambat', title: '6 Karyawan Belum Absen', desc: 'Pukul 09:30: Masih ada 6 karyawan yang belum melakukan check-in meski jadwal sudah dimulai pukul 08:30.', time: 'Kemarin, 09:30', unread: false },
  { id: 8, icon: RefreshCw, iconColor: '#0891B2', iconBg: '#ECFEFF', category: 'system', title: 'Pembaruan Sistem Tersedia', desc: 'Versi 2.0.2 tersedia dengan perbaikan akurasi GPS dan peningkatan performa. Jadwalkan update di luar jam kerja.', time: '29 Jun 2025', unread: false },
  { id: 9, icon: FileText, iconColor: '#2563EB', iconBg: '#EFF6FF', category: 'cuti', title: 'Cuti Budi Santoso Aktif', desc: 'Pengajuan izin Budi Santoso (Administrasi) untuk hari ini telah disetujui dan sedang berjalan.', time: '30 Jun 2025, 08:00', unread: false },
];

const catFilters = [
  { key: 'all', label: 'Semua' },
  { key: 'terlambat', label: '⚠ Keterlambatan' },
  { key: 'cuti', label: '📋 Cuti & Izin' },
  { key: 'system', label: '⚙ Sistem' },
  { key: 'login', label: '🔐 Login Admin' },
];

export function NotificationsTab() {
  const [filter, setFilter] = useState('all');
  const [notifs, setNotifs] = useState(notifications);

  const markAll = () => setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
  const markOne = (id: number) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));

  const filtered = notifs.filter(n => filter === 'all' || n.category === filter);
  const unread = notifs.filter(n => n.unread).length;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Notifikasi Admin</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {unread > 0 ? `${unread} notifikasi belum dibaca` : 'Semua sudah dibaca'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="flex items-center gap-1.5 text-[12px] text-[#16A34A] font-medium hover:underline mt-1">
            <Check size={13} /> Tandai semua dibaca
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {catFilters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all border ${
              filter === f.key
                ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-sm'
                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-200 shadow-sm'
            }`}>
            {f.label}
            {f.key === 'terlambat' && notifs.filter(n => n.category === 'terlambat' && n.unread).length > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-white/25' : 'bg-amber-100 text-amber-600'}`}>
                {notifs.filter(n => n.category === 'terlambat' && n.unread).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications */}
      <div className="space-y-2">
        {filtered.map(n => (
          <div key={n.id} onClick={() => markOne(n.id)}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${n.unread ? 'border-[#16A34A]/20' : 'border-gray-100'}`}>
            <div className="flex gap-3.5 p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: n.iconBg }}>
                <n.icon size={17} style={{ color: n.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`text-[13px] leading-tight ${n.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{n.time}</span>
                    {n.unread && <div className="w-2 h-2 rounded-full bg-[#16A34A]" />}
                  </div>
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed">{n.desc}</p>
              </div>
            </div>
            {n.unread && <div className="h-0.5 bg-gradient-to-r from-[#16A34A] to-transparent" />}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Bell size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[13px] text-gray-400">Tidak ada notifikasi di kategori ini</p>
          </div>
        )}
      </div>
    </div>
  );
}
