import { useState, useEffect } from 'react';
import { 
  Bell, Check, Calendar, Trash2, Clock, AlertTriangle, Layers, Settings, ChevronRight, FileText, UserCheck, ArrowRight
} from 'lucide-react';
import { notificationApi, AppNotification } from '../../services/api';
import { MonthYearDeptFilter } from './ui/MonthYearDeptFilter';

const filterOptions = ['Semua', 'Belum Dibaca'];

interface NotificationsPageProps {
  onUpdateCount?: () => void;
  onNavigate?: (tab: string) => void;
  userRole?: 'employee' | 'pj_bagian' | 'admin' | 'super_admin';
}

/**
 * Halaman Notifikasi Staf & PJ Bagian (NotificationsPage) — Sistem Absensi RSUCL
 */
export function NotificationsPage({ onUpdateCount, onNavigate, userRole = 'employee' }: NotificationsPageProps) {
  // Filter aktif ('Semua' vs 'Belum Dibaca')
  const [activeFilter, setActiveFilter] = useState('Semua');
  
  // State menyimpan daftar objek notifikasi hasil fetch
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  // Jumlah notifikasi belum dibaca
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Indikator memuat request
  const [loading, setLoading] = useState(false);

  // Filter Bulan & Tahun (0 = Semua)
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear] = useState<number>(0);

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

  /**
   * Menangani klik pada notifikasi:
   * 1. Tandai sebagai sudah dibaca
   * 2. Arahkan pengguna ke tab terkait sesuai jenis notifikasi
   */
  const handleItemClick = (n: AppNotification) => {
    markRead(n.id);

    if (!onNavigate) return;

    const type = (n.type || '').toLowerCase();
    const title = (n.title || '').toLowerCase();
    const body = (n.body || '').toLowerCase();
    const text = `${type} ${title} ${body}`;

    if (userRole === 'pj_bagian') {
      // Jika notifikasi staf yang membutuhkan persetujuan PJ
      if (text.includes('staf') || text.includes('mengajukan') || text.includes('persetujuan') || text.includes('permohonan staf')) {
        if (text.includes('cuti') || text.includes('lembur')) {
          onNavigate('approvals');
          return;
        }
      }

      if (text.includes('cuti') || text.includes('sakit') || type === 'leave') {
        onNavigate('leave');
      } else if (text.includes('lembur') || type === 'overtime') {
        onNavigate('overtime_personal');
      } else if (text.includes('tugas') || type.includes('assignment')) {
        onNavigate('leave');
      } else if (text.includes('shift') || text.includes('jadwal') || type === 'schedule') {
        onNavigate('shift_proposals');
      } else if (text.includes('absen') || type === 'attendance') {
        onNavigate('history');
      } else if (text.includes('resign') || text.includes('pengunduran') || type === 'resignation') {
        onNavigate('resignation');
      } else if (text.includes('sanksi') || text.includes('teguran') || text.includes('peringatan') || text.includes('phk') || type === 'disciplinary' || type === 'sanction') {
        onNavigate('disciplinary');
      }
    } else {
      // Pegawai biasa
      if (text.includes('cuti') || text.includes('sakit') || type === 'leave') {
        onNavigate('leave');
      } else if (text.includes('lembur') || type === 'overtime') {
        onNavigate('overtime');
      } else if (text.includes('tugas') || type.includes('assignment')) {
        onNavigate('assignment');
      } else if (text.includes('absen') || type === 'attendance') {
        onNavigate('history');
      } else if (text.includes('shift') || text.includes('jadwal') || type === 'schedule') {
        onNavigate('history');
      } else if (text.includes('resign') || text.includes('pengunduran') || type === 'resignation') {
        onNavigate('resignation');
      } else if (text.includes('sanksi') || text.includes('teguran') || text.includes('peringatan') || text.includes('phk') || type === 'disciplinary' || type === 'sanction') {
        onNavigate('disciplinary');
      }
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
    if (activeFilter === 'Belum Dibaca' && n.is_read) return false;
    if (n.created_at) {
      const d = new Date(n.created_at);
      if (filterMonth > 0 && d.getMonth() + 1 !== filterMonth) return false;
      if (filterYear > 0 && d.getFullYear() !== filterYear) return false;
    }
    return true;
  });

  const getIconProps = (type: string, text: string) => {
    if (text.includes('cuti') || type === 'leave') {
      return { icon: Calendar, color: '#7C3AED', bg: '#F5F3FF', label: 'Cuti & Sakit' };
    }
    if (text.includes('lembur') || type === 'overtime') {
      return { icon: Clock, color: '#EA580C', bg: '#FFF7ED', label: 'Lembur' };
    }
    if (text.includes('tugas') || type.includes('assignment')) {
      return { icon: FileText, color: '#16A34A', bg: '#F0FDF4', label: 'Surat Tugas' };
    }
    if (text.includes('absen') || type === 'attendance') {
      return { icon: Clock, color: '#2563EB', bg: '#EFF6FF', label: 'Absensi' };
    }
    if (text.includes('resign') || text.includes('pengunduran') || type === 'resignation') {
      return { icon: FileText, color: '#DC2626', bg: '#FEE2E2', label: 'Pengunduran Diri' };
    }
    if (text.includes('sanksi') || text.includes('teguran') || text.includes('peringatan') || text.includes('phk') || type === 'disciplinary') {
      return { icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2', label: 'Sanksi Disiplin' };
    }
    return { icon: Bell, color: '#6B7280', bg: '#F3F4F6', label: 'Info' };
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

      {/* Filter Bulan & Tahun */}
      <MonthYearDeptFilter
        month={filterMonth}
        year={filterYear}
        showAllMonthsOption={true}
        showAllYearsOption={true}
        onMonthChange={setFilterMonth}
        onYearChange={setFilterYear}
        className="w-full mb-2"
      />

      {/* Notifications list */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-8 text-gray-400 text-[12px] animate-pulse">Memuat notifikasi...</div>
        )}
        
        {filtered.map(n => {
          const text = `${n.type} ${n.title} ${n.body}`.toLowerCase();
          const ip = getIconProps(n.type, text);
          const Icon = ip.icon;
          
          let borderTheme = 'border-l-gray-250';
          let bgTheme = 'bg-white';
          
          if (!n.is_read) {
            if (text.includes('cuti') || n.type === 'leave') {
              borderTheme = 'border-l-purple-500';
              bgTheme = 'bg-purple-50/15 hover:bg-purple-50/25';
            } else if (text.includes('lembur') || n.type === 'overtime') {
              borderTheme = 'border-l-orange-500';
              bgTheme = 'bg-orange-50/15 hover:bg-orange-50/25';
            } else if (text.includes('tugas') || n.type.includes('assignment')) {
              borderTheme = 'border-l-green-500';
              bgTheme = 'bg-green-50/15 hover:bg-green-50/25';
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
              onClick={() => handleItemClick(n)}
              className={`group bg-white rounded-2xl border-y border-r border-l-4 ${borderTheme} ${bgTheme} border-gray-100 shadow-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] flex items-start gap-4 p-4.5`}
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
                  <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                    <span className={`text-[13px] leading-snug break-words ${!n.is_read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                      {n.title}
                    </span>
                    {!n.is_read && (
                      <span className="inline-block w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap mt-0.5">
                    {formatTime(n.created_at)}
                  </span>
                </div>
                <p className="text-[12px] text-gray-500 leading-relaxed font-normal">{n.body}</p>
                
                {/* Action hint badge */}
                <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-[#16A34A] group-hover:underline">
                  <span>Buka Halaman {ip.label}</span>
                  <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Hover actions */}
              <div className="flex items-center gap-1 self-start flex-shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
