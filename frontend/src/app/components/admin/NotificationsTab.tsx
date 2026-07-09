import { useState, useEffect } from 'react';
import { 
  AlertTriangle, Bell, Check, Calendar, Trash2, Layers, Settings 
} from 'lucide-react';
import { notificationApi, AppNotification } from '../../../services/api';

const catFilters = [
  { key: 'all', label: 'Semua' },
  { key: 'attendance', label: 'Keterlambatan' },
  { key: 'leave', label: 'Cuti & Izin' },
  { key: 'system', label: 'Sistem' },
];

interface NotificationsTabProps {
  onUpdateCount?: () => void;
}

/**
 * Komponen Tab Notifikasi Admin (NotificationsTab) — Sistem Absensi RSUCL
 * 
 * Halaman pemberitahuan khusus untuk Administrator. Menampilkan laporan keterlambatan karyawan,
 * log pengajuan cuti/izin/sakit baru, penugasan jadwal kerja shift, serta pemberitahuan sistem.
 * 
 * @param onUpdateCount Callback opsional untuk sinkronisasi lencana jumlah notifikasi belum dibaca di sidebar
 */
export function NotificationsTab({ onUpdateCount }: NotificationsTabProps) {
  // Filter kategori aktif ('all', 'attendance', 'leave', 'system')
  const [filter, setFilter] = useState('all');
  
  // Daftar objek notifikasi admin
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  
  // Jumlah notifikasi belum dibaca
  const [unread, setUnread] = useState(0);
  
  // Indikator memproses request ke server
  const [loading, setLoading] = useState(false);

  /**
   * Menarik daftar notifikasi terbaru admin dari API.
   */
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      if (res.success) {
        setNotifs(res.data.notifications);
        setUnread(res.data.unread_count);
        onUpdateCount?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Muat notifikasi saat tab ini dipasang di DOM
  useEffect(() => {
    loadNotifications();
  }, []);

  const markAll = async () => {
    try {
      const res = await notificationApi.markAllRead();
      if (res.success) {
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnread(0);
        onUpdateCount?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markOne = async (id: number) => {
    try {
      const target = notifs.find(n => n.id === id);
      if (target && !target.is_read) {
        const res = await notificationApi.markRead(id);
        if (res.success) {
          setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
          setUnread(c => Math.max(0, c - 1));
          onUpdateCount?.();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus notifikasi ini?')) return;
    try {
      const res = await notificationApi.delete(id);
      if (res.success) {
        setNotifs(prev => prev.filter(n => n.id !== id));
        onUpdateCount?.();
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Gagal menghapus notifikasi.');
    }
  };

  const handleDeleteAllRead = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus semua notifikasi yang telah dibaca?')) return;
    try {
      const res = await notificationApi.deleteAllRead();
      if (res.success) {
        setNotifs(prev => prev.filter(n => !n.is_read));
        onUpdateCount?.();
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Gagal menghapus semua notifikasi.');
    }
  };

  const filtered = notifs.filter(n => filter === 'all' || n.type === filter);

  const getIconProps = (type: string) => {
    switch (type) {
      case 'leave':
        return { icon: Calendar, color: '#7C3AED', bg: '#F5F3FF' };
      case 'attendance':
        return { icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' };
      default:
        return { icon: Bell, color: '#2563EB', bg: '#EFF6FF' };
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-[17px] font-bold text-gray-900">Notifikasi Admin</h2>
          <p className="text-[12px] text-gray-500 mt-0.5 font-medium">
            {unread > 0 ? `${unread} notifikasi belum dibaca` : 'Semua notifikasi sudah dibaca'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {unread > 0 && (
            <button 
              onClick={markAll} 
              className="flex items-center gap-1.5 text-[11.5px] text-[#16A34A] bg-green-50/70 hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-150 font-semibold transition-all duration-200"
            >
              <Check size={12.5} className="stroke-[2.5]" /> Tandai Semua Dibaca
            </button>
          )}
          {notifs.some(n => n.is_read) && (
            <button 
              onClick={handleDeleteAllRead} 
              className="flex items-center gap-1.5 text-[11.5px] text-red-600 bg-red-50/70 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-100 font-semibold transition-all duration-200"
            >
              <Trash2 size={12.5} /> Hapus Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {catFilters.map(f => {
          let IconComp = Layers;
          if (f.key === 'attendance') IconComp = AlertTriangle;
          if (f.key === 'leave') IconComp = Calendar;
          if (f.key === 'system') IconComp = Settings;

          const unreadCount = f.key === 'all' 
            ? notifs.filter(n => !n.is_read).length
            : notifs.filter(n => n.type === f.key && !n.is_read).length;

          return (
            <button 
              key={f.key} 
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all border duration-200 ${
                filter === f.key
                  ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-sm shadow-green-100'
                  : 'bg-white text-gray-600 border-gray-150 hover:bg-gray-50 hover:border-gray-200 shadow-sm'
              }`}
            >
              <IconComp size={13} className={filter === f.key ? 'text-white' : 'text-gray-400'} />
              <span>{f.label}</span>
              {unreadCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filter === f.key 
                    ? 'bg-white/20 text-white' 
                    : 'bg-green-50 text-[#16A34A] border border-green-100'
                }`}>
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-8 text-gray-400 text-[12px] animate-pulse">Memuat notifikasi...</div>
        )}
        
        {filtered.map(n => {
          const ip = getIconProps(n.type);
          const Icon = ip.icon;
          
          let borderTheme = 'border-l-gray-200';
          let bgTheme = 'bg-white';
          
          if (!n.is_read) {
            if (n.type === 'leave') {
              borderTheme = 'border-l-purple-500';
              bgTheme = 'bg-purple-50/15 hover:bg-purple-50/25';
            } else if (n.type === 'attendance') {
              borderTheme = 'border-l-amber-500';
              bgTheme = 'bg-amber-50/15 hover:bg-amber-50/25';
            } else {
              borderTheme = 'border-l-blue-500';
              bgTheme = 'bg-blue-50/15 hover:bg-blue-50/25';
            }
          } else {
            bgTheme = 'bg-white hover:bg-gray-50/60';
            borderTheme = 'border-l-gray-300';
          }

          return (
            <div 
              key={n.id} 
              onClick={() => markOne(n.id)}
              className={`group bg-white rounded-2xl border-y border-r border-l-4 ${borderTheme} ${bgTheme} border-gray-100 shadow-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] flex gap-4 p-4.5`}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-300 style-scope" style={{ background: ip.bg }}>
                <Icon size={17} style={{ color: ip.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0 flex-1">
                    <span className={`text-[13px] leading-snug break-words ${!n.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap mt-0.5">
                    {formatTime(n.created_at)}
                  </span>
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed font-normal">{n.body}</p>
              </div>
              
              {/* Individual quick actions on hover */}
              <div className="flex items-center gap-1.5 self-center flex-shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {!n.is_read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markOne(n.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-[#16A34A] hover:bg-green-50 rounded-xl transition-all"
                    title="Tandai dibaca"
                  >
                    <Check size={13} className="stroke-[2.5]" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(n.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Hapus notifikasi"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-gray-200">
            <Bell size={30} className="text-gray-300 mx-auto mb-2.5" />
            <p className="text-[13px] font-semibold text-gray-600">Tidak Ada Notifikasi</p>
            <p className="text-[11px] text-gray-400 mt-1">Semua notifikasi pada kategori ini telah dibaca atau kosong.</p>
          </div>
        )}
      </div>
    </div>
  );
}
