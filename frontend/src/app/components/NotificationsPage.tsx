import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, MapPin, Clock, Calendar, AlertTriangle, RefreshCw, XCircle, Megaphone, Check, Trash2 } from 'lucide-react';
import { notificationApi, AppNotification } from '../../services/api';

const filterOptions = ['Semua', 'Belum Dibaca'];

interface NotificationsPageProps {
  onUpdateCount?: () => void;
}

export function NotificationsPage({ onUpdateCount }: NotificationsPageProps) {
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

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
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifikasi</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} pesan belum dibaca` : 'Semua pesan telah dibaca'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-[12px] text-[#16A34A] font-medium hover:underline"
            >
              <Check size={13} />
              Tandai semua dibaca
            </button>
          )}
          {notifications.some(n => n.is_read) && (
            <button
              onClick={handleDeleteAllRead}
              className="flex items-center gap-1.5 text-[12px] text-red-500 font-medium hover:underline"
            >
              <Trash2 size={13} />
              Hapus semua dibaca
            </button>
          )}
        </div>
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
        {loading && (
          <div className="text-center py-5 text-gray-400 text-[12px]">Memuat notifikasi...</div>
        )}
        {filtered.map(n => {
          const ip = getIconProps(n.type);
          const Icon = ip.icon;
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                !n.is_read ? 'border-[#16A34A]/20 bg-green-50/5' : 'border-gray-100'
              }`}
            >
              <div className="flex gap-3.5 p-4">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: ip.bg }}
                >
                  <Icon size={18} style={{ color: ip.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-[13px] leading-tight ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">{formatTime(n.created_at)}</span>
                      {!n.is_read ? (
                        <div className="w-2 h-2 rounded-full bg-[#16A34A] flex-shrink-0" />
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Stop click from triggering markRead again
                            handleDelete(n.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Hapus notifikasi"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{n.body}</p>
                </div>
              </div>

              {/* Unread indicator bar */}
              {!n.is_read && (
                <div className="h-0.5 bg-gradient-to-r from-[#16A34A] to-transparent" />
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
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
