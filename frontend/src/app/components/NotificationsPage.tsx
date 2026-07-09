import { useState, useEffect } from 'react';
import { 
  Bell, Check, Calendar, Trash2, Clock, AlertTriangle, Layers, Settings, MessageSquare
} from 'lucide-react';
import { notificationApi, AppNotification } from '../../services/api';

const filterOptions = ['Semua', 'Belum Dibaca'];

interface NotificationsPageProps {
  onUpdateCount?: () => void;
}

/**
 * Halaman Notifikasi Staf (NotificationsPage) — Sistem Absensi RSUCL
 * 
 * Menampilkan seluruh pemberitahuan yang relevan dengan absensi, penugasan shift,
 * maupun persetujuan izin/cuti oleh administrator. Menyediakan filter status baca,
 * penandaan pesan dibaca, serta penghapusan log notifikasi.
 * 
 * @param onUpdateCount Callback opsional untuk sinkronisasi ulang lencana angka notifikasi di parent/sidebar
 */
export function NotificationsPage({ onUpdateCount }: NotificationsPageProps) {
  // Filter aktif ('Semua' vs 'Belum Dibaca')
  const [activeFilter, setActiveFilter] = useState('Semua');
  
  // State menyimpan daftar objek notifikasi hasil fetch
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Jumlah notifikasi belum dibaca
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Indikator memuat request
  const [loading, setLoading] = useState(false);

  /**
   * Menarik daftar notifikasi terbaru dari API backend.
   */
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      if (res.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unread_count);
        onUpdateCount?.();
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Muat notifikasi saat halaman terpasang di DOM
  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      const res = await notificationApi.markAllRead();
      if (res.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        onUpdateCount?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markRead = async (id: number) => {
    try {
      const target = notifications.find(n => n.id === id);
      if (target && !target.is_read) {
        const res = await notificationApi.markRead(id);
        if (res.success) {
          setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
          setUnreadCount(c => Math.max(0, c - 1));
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
        setNotifications(prev => prev.filter(n => n.id !== id));
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
        setNotifications(prev => prev.filter(n => !n.is_read));
        onUpdateCount?.();
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Gagal menghapus semua notifikasi.');
    }
  };

  const filtered = notifications.filter(n => {
    if (activeFilter === 'Belum Dibaca') return !n.is_read;
    return true;
  });

  const getIconProps = (type: string) => {
    switch (type) {
      case 'leave':
        return { icon: Calendar, color: '#7C3AED', bg: '#F5F3FF' };
      case 'attendance':
        return { icon: Clock, color: '#16A34A', bg: '#F0FDF4' };
      case 'system':
        return { icon: Settings, color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { icon: Bell, color: '#EA580C', bg: '#FFF7ED' };
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifikasi</h1>
          <p className="text-[12px] text-gray-500 mt-0.5 font-medium">
            {unreadCount > 0 ? `${unreadCount} pesan belum dibaca` : 'Semua pesan telah dibaca'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-[11.5px] text-[#16A34A] bg-green-50/70 hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-150 font-semibold transition-all duration-200"
            >
              <Check size={12.5} className="stroke-[2.5]" />
              Tandai Semua Dibaca
            </button>
          )}
          {notifications.some(n => n.is_read) && (
            <button
              onClick={handleDeleteAllRead}
              className="flex items-center gap-1.5 text-[11.5px] text-red-600 bg-red-50/70 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-100 font-semibold transition-all duration-200"
            >
              <Trash2 size={12.5} />
              Hapus Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-2 bg-gray-100/60 p-1 rounded-2xl w-fit border border-gray-100/50">
        {filterOptions.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-[12px] font-semibold transition-all flex items-center gap-1.5 duration-200 ${
              activeFilter === f 
                ? 'bg-white text-gray-800 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>{f}</span>
            {f === 'Belum Dibaca' && unreadCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeFilter === f 
                  ? 'bg-green-50 text-[#16A34A] border border-green-100' 
                  : 'bg-green-100/80 text-green-700'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-8 text-gray-400 text-[12px] animate-pulse">Memuat notifikasi...</div>
        )}
        
        {filtered.map(n => {
          const ip = getIconProps(n.type);
          const Icon = ip.icon;
          
          let borderTheme = 'border-l-gray-250';
          let bgTheme = 'bg-white';
          
          if (!n.is_read) {
            if (n.type === 'leave') {
              borderTheme = 'border-l-purple-500';
              bgTheme = 'bg-purple-50/15 hover:bg-purple-50/25';
            } else if (n.type === 'attendance') {
              borderTheme = 'border-l-green-500';
              bgTheme = 'bg-green-50/15 hover:bg-green-50/25';
            } else if (n.type === 'system') {
              borderTheme = 'border-l-blue-500';
              bgTheme = 'bg-blue-50/15 hover:bg-blue-50/25';
            } else {
              borderTheme = 'border-l-amber-500';
              bgTheme = 'bg-amber-50/15 hover:bg-amber-50/25';
            }
          } else {
            bgTheme = 'bg-white hover:bg-gray-50/60';
            borderTheme = 'border-l-gray-300';
          }

          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`group bg-white rounded-2xl border-y border-r border-l-4 ${borderTheme} ${bgTheme} border-gray-100 shadow-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] flex gap-4 p-4.5`}
            >
              {/* Icon Container */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-300"
                style={{ background: ip.bg }}
              >
                <Icon size={18} style={{ color: ip.color }} />
              </div>

              {/* Text Body */}
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

              {/* Hover actions */}
              <div className="flex items-center gap-1.5 self-center flex-shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {!n.is_read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markRead(n.id);
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
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Bell size={24} className="text-gray-300" />
          </div>
          <p className="text-[13px] font-semibold text-gray-600">Tidak Ada Notifikasi</p>
          <p className="text-[11px] text-gray-400 mt-1">Semua notifikasi di filter ini telah dibaca atau kosong.</p>
        </div>
      )}
    </div>
  );
}
