import { useState } from 'react';
import { Bell, CheckCircle2, MapPin, Clock, Calendar, AlertTriangle, RefreshCw, XCircle, Megaphone, Check } from 'lucide-react';

interface Notification {
  id: number;
  type: string;
  icon: typeof Bell;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  important: boolean;
}

const notifications: Notification[] = [
  {
    id: 1,
    type: 'pengumuman',
    icon: Megaphone,
    iconColor: '#7C3AED',
    iconBg: '#F5F3FF',
    title: 'Pengumuman: Rapat Koordinasi Bulanan',
    description: 'Diberitahukan kepada seluruh karyawan bahwa akan diadakan rapat koordinasi pada Jumat, 4 Juli 2025 pukul 09:00 WIB di Aula Utama.',
    time: '09:30',
    unread: true,
    important: true,
  },
  {
    id: 2,
    type: 'checkin',
    icon: MapPin,
    iconColor: '#16A34A',
    iconBg: '#F0FDF4',
    title: 'Check-In Berhasil',
    description: 'Anda berhasil melakukan check-in pada pukul 07:45 WIB. Status: Tepat Waktu. Lokasi: RSUCL – Dalam Area.',
    time: '07:45',
    unread: true,
    important: false,
  },
  {
    id: 3,
    type: 'checkout',
    icon: CheckCircle2,
    iconColor: '#2563EB',
    iconBg: '#EFF6FF',
    title: 'Pengingat Check-Out',
    description: 'Shift Pagi Anda akan berakhir pukul 15:00 WIB. Jangan lupa melakukan check-out sebelum meninggalkan area rumah sakit.',
    time: '14:00',
    unread: true,
    important: false,
  },
  {
    id: 4,
    type: 'jadwal',
    icon: Calendar,
    iconColor: '#EA580C',
    iconBg: '#FFF7ED',
    title: 'Perubahan Jadwal Shift',
    description: 'Jadwal Anda pada Kamis, 3 Juli 2025 telah diubah dari Shift Pagi (07:00-15:00) menjadi Shift Siang (12:00-20:00). Silakan konfirmasi perubahan ini.',
    time: 'Kemarin 15:22',
    unread: false,
    important: true,
  },
  {
    id: 5,
    type: 'cuti_approved',
    icon: CheckCircle2,
    iconColor: '#16A34A',
    iconBg: '#F0FDF4',
    title: 'Pengajuan Cuti Disetujui',
    description: 'Pengajuan cuti tahunan Anda untuk tanggal 10–11 Juli 2025 telah disetujui oleh Kepala Departemen. Selamat menikmati hari libur!',
    time: 'Kemarin 11:05',
    unread: false,
    important: false,
  },
  {
    id: 6,
    type: 'terlambat',
    icon: AlertTriangle,
    iconColor: '#D97706',
    iconBg: '#FFFBEB',
    title: 'Peringatan: Terlambat Check-In',
    description: 'Catatan kehadiran Anda pada Senin, 29 Juni 2025 menunjukkan keterlambatan 15 menit (08:15 WIB). Total keterlambatan bulan ini: 2 kali.',
    time: 'Sen 08:30',
    unread: false,
    important: true,
  },
  {
    id: 7,
    type: 'cuti_rejected',
    icon: XCircle,
    iconColor: '#DC2626',
    iconBg: '#FEF2F2',
    title: 'Pengajuan Izin Ditolak',
    description: 'Pengajuan izin Anda untuk tanggal 18 Juni 2025 ditolak karena kurangnya informasi keperluan. Silakan ajukan kembali dengan keterangan lengkap.',
    time: '18 Jun',
    unread: false,
    important: false,
  },
  {
    id: 8,
    type: 'update',
    icon: RefreshCw,
    iconColor: '#0891B2',
    iconBg: '#ECFEFF',
    title: 'Pembaruan Sistem v2.0.1',
    description: 'Sistem absensi telah diperbarui ke versi 2.0.1. Terdapat perbaikan akurasi GPS dan peningkatan performa aplikasi. Terima kasih.',
    time: '15 Jun',
    unread: false,
    important: false,
  },
];

const filterOptions = ['Semua', 'Belum Dibaca', 'Penting'];

export function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [localNotifs, setLocalNotifs] = useState(notifications);

  const markAllRead = () => {
    setLocalNotifs(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const markRead = (id: number) => {
    setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  const filtered = localNotifs.filter(n => {
    if (activeFilter === 'Belum Dibaca') return n.unread;
    if (activeFilter === 'Penting') return n.important;
    return true;
  });

  const unreadCount = localNotifs.filter(n => n.unread).length;

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifikasi</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} pesan belum dibaca` : 'Semua pesan telah dibaca'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-[12px] text-[#16A34A] font-medium hover:underline mt-1"
          >
            <Check size={13} />
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 mb-5 bg-white rounded-xl border border-gray-100 p-1 shadow-sm w-fit">
        {filterOptions.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 ${
              activeFilter === f ? 'bg-[#16A34A] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
            {f === 'Belum Dibaca' && unreadCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeFilter === f ? 'bg-white/25' : 'bg-red-100 text-red-600'}`}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications */}
      <div className="space-y-2">
        {filtered.map(n => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
              n.unread ? 'border-[#16A34A]/20' : 'border-gray-100'
            }`}
          >
            <div className="flex gap-3.5 p-4">
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: n.iconBg }}
              >
                <n.icon size={18} style={{ color: n.iconColor }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-[13px] leading-tight ${n.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    {n.important && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">
                        PENTING
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">{n.time}</span>
                    {n.unread && <div className="w-2 h-2 rounded-full bg-[#16A34A] flex-shrink-0" />}
                  </div>
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed">{n.description}</p>
              </div>
            </div>

            {/* Unread indicator bar */}
            {n.unread && (
              <div className="h-0.5 bg-gradient-to-r from-[#16A34A] to-transparent" />
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Bell size={24} className="text-gray-200" />
          </div>
          <p className="text-[14px] text-gray-400 font-medium">Tidak ada notifikasi</p>
          <p className="text-[12px] text-gray-300 mt-1">Semua notifikasi akan muncul di sini</p>
        </div>
      )}
    </div>
  );
}
