import { useState, useEffect } from 'react';
import { Home, MapPin, History, Bell, User, LogOut, Menu, X, Clock, CheckSquare, CalendarDays } from 'lucide-react';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { useAuth } from '../../context/AuthContext';
import { AttendancePage } from './AttendancePage';
import { HistoryPage } from './HistoryPage';
import { OvertimeRequestPage } from './OvertimeRequestPage';
import { NotificationsPage } from './NotificationsPage';
import { ProfilePage } from './ProfilePage';
import { LeaveApprovalTab } from './pjbagian/LeaveApprovalTab';
import { OvertimeApprovalTab } from './pjbagian/OvertimeApprovalTab';
import { ShiftProposalTab } from './pjbagian/ShiftProposalTab';
import { notificationApi, leaveApi, overtimeApi } from '../../services/api';

type Tab = 'dashboard' | 'attendance' | 'history' | 'overtime_personal' | 'approvals' | 'shift_proposals' | 'notifications' | 'profile';

interface PJBagianAppProps {
  onLogout: () => void;
  user: { id: number; name: string; username: string; nip: string; pj_bagian_department?: string; pj_bagian_department_id?: number };
}

export function PJBagianApp({ onLogout, user }: PJBagianAppProps) {
  const { logoUrl } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  
  // Counts
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [pendingOvertimeCount, setPendingOvertimeCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await notificationApi.list();
      if (res.success) {
        setUnreadNotifications(res.data.unread_count);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchApprovalCounts = async () => {
    try {
      const leaveRes = await leaveApi.list();
      if (leaveRes.success) {
        setPendingLeaveCount(leaveRes.data.filter(r => r.status === 'pending').length);
      }

      const otRes = await overtimeApi.list({ status: 'pending' });
      if (otRes.success) {
        setPendingOvertimeCount(otRes.data.length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    fetchApprovalCounts();
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchApprovalCounts();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalPendingApprovals = pendingLeaveCount + pendingOvertimeCount;
  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-5">
            {/* Header / Welcome card */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none">
                <img src={logoUrl || logoImg} alt="Logo" className="w-24 h-24 md:w-28 md:h-28 object-contain mix-blend-multiply" />
              </div>
              <p className="text-[12px] uppercase font-bold tracking-wider opacity-75">Panel PJ Bagian</p>
              <h2 className="text-[20px] font-bold mt-1">Selamat datang, {user.name}</h2>
              <p className="text-[13px] opacity-90 mt-1.5">
                Penanggung Jawab Departemen: <span className="font-bold underline">{user.pj_bagian_department || 'Belum Ditugaskan'}</span>
              </p>
            </div>

            {/* Quick Action approval indicators */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setActiveTab('approvals')}
                className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs text-left hover:border-green-200 transition-all">
                <p className="text-[24px] font-bold text-green-600">{pendingLeaveCount}</p>
                <p className="text-[12px] font-bold text-gray-800">Menunggu Persetujuan Cuti</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Kelola pengajuan cuti dan sakit</p>
              </button>

              <button 
                onClick={() => setActiveTab('approvals')}
                className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs text-left hover:border-green-200 transition-all">
                <p className="text-[24px] font-bold text-green-600">{pendingOvertimeCount}</p>
                <p className="text-[12px] font-bold text-gray-800">Menunggu Persetujuan Lembur</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Verifikasi laporan lembur staf</p>
              </button>
            </div>

            {/* Attendance Page Quick view */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-xs">
              <h3 className="text-[13px] font-bold text-gray-900 mb-3">Absensi Mandiri PJ Bagian</h3>
              <AttendancePage />
            </div>
          </div>
        );
      case 'attendance':
        return <AttendancePage />;
      case 'history':
        return <HistoryPage />;
      case 'overtime_personal':
        return <OvertimeRequestPage />;
      case 'approvals':
        return (
          <div className="space-y-6">
            <LeaveApprovalTab user={user} onUpdateCount={fetchApprovalCounts} />
            <hr className="border-gray-100" />
            <OvertimeApprovalTab user={user} onUpdateCount={fetchApprovalCounts} />
          </div>
        );
      case 'shift_proposals':
        return <ShiftProposalTab user={user} />;
      case 'notifications':
        return <NotificationsPage onUpdateCount={fetchUnreadCount} />;
      case 'profile':
        return <ProfilePage onLogout={onLogout} />;
    }
  };

  const navItems: { id: Tab; icon: any; label: string; badge?: number }[] = [
    { id: 'dashboard', icon: Home, label: 'Beranda' },
    { id: 'attendance', icon: MapPin, label: 'Absen Mandiri' },
    { id: 'history', icon: History, label: 'Riwayat Absen' },
    { id: 'overtime_personal', icon: Clock, label: 'Lembur Mandiri' },
    { id: 'approvals', icon: CheckSquare, label: 'Persetujuan Staf', badge: totalPendingApprovals },
    { id: 'shift_proposals', icon: CalendarDays, label: 'Usulan Shift' },
    { id: 'notifications', icon: Bell, label: 'Notifikasi', badge: unreadNotifications },
    { id: 'profile', icon: User, label: 'Profil Saya' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col md:flex-row">
      {/* Drawer Overlay Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar (Desktop & Drawer Mobile) */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-150 w-64 z-50 transition-transform duration-300 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full bg-white">
          {/* Logo */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl !== 'none' && (
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
                  <img src={logoUrl || logoImg} alt="Logo" className="w-9 h-9 object-contain" />
                </div>
              )}
              <div>
                <p className="text-[13px] font-bold text-gray-900">RSUCL Absensi</p>
                <p className="text-[10px] text-gray-400 font-medium">Panel PJ Bagian</p>
              </div>
            </div>
            <button className="md:hidden text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${isActive ? 'bg-[#16A34A] text-white font-bold shadow-sm shadow-green-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span className="text-[12px]">{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white text-green-600' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Logout Footer */}
          <div className="p-3 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all text-left">
              <LogOut size={16} />
              <span className="text-[12px] font-bold">Logout Sesi</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Top-Bar */}
        <header className="bg-white border-b border-gray-150 h-14 flex items-center justify-between px-4 flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <p className="text-[13px] font-bold text-gray-800 truncate hidden md:block">
              Departemen: {user.pj_bagian_department || 'Umum'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime clock */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-1 flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 bg-[#16A34A] rounded-full animate-ping" />
              <span className="text-[11px] font-bold text-gray-700">{timeStr} WIB</span>
            </div>

            {/* Profile Brief */}
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-[12px] font-bold text-gray-900">{user.name}</p>
                <p className="text-[9px] text-gray-400 capitalize">PJ Bagian</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center text-green-600 text-[12px] font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Render */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
