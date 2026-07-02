import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, LogIn, CheckCircle2, RefreshCw, Bell, Check, Calendar } from 'lucide-react';
import { notificationApi, AppNotification } from '../../../services/api';

const catFilters = [
  { key: 'all', label: 'Semua' },
  { key: 'attendance', label: '⚠ Keterlambatan' },
  { key: 'leave', label: '📋 Cuti & Izin' },
  { key: 'system', label: '⚙ Sistem' },
];

export function NotificationsTab() {
  const [filter, setFilter] = useState('all');
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      if (res.success) {
        setNotifs(res.data.notifications);
        setUnread(res.data.unread_count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAll = async () => {
    try {
      const res = await notificationApi.markAllRead();
      if (res.success) {
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnread(0);
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
        }
      }
    } catch (err) {
      console.error(err);
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
            {f.key === 'attendance' && notifs.filter(n => n.type === 'attendance' && !n.is_read).length > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-white/25' : 'bg-amber-100 text-amber-600'}`}>
                {notifs.filter(n => n.type === 'attendance' && !n.is_read).length}
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
            <div key={n.id} onClick={() => markOne(n.id)}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${!n.is_read ? 'border-[#16A34A]/20 bg-green-50/5' : 'border-gray-100'}`}>
              <div className="flex gap-3.5 p-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: ip.bg }}>
                  <Icon size={17} style={{ color: ip.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`text-[13px] leading-tight ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTime(n.created_at)}</span>
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-[#16A34A]" />}
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{n.body}</p>
                </div>
              </div>
              {!n.is_read && <div className="h-0.5 bg-gradient-to-r from-[#16A34A] to-transparent" />}
            </div>
          );
        })}
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Bell size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[13px] text-gray-400">Tidak ada notifikasi di kategori ini</p>
          </div>
        )}
      </div>
    </div>
  );
}
