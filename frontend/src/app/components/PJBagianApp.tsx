import { useState, useEffect } from 'react';
import { Home, MapPin, History, Bell, User, LogOut, Menu, X, Clock, CheckSquare, CalendarDays, FileText } from 'lucide-react';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { useAuth } from '../../context/AuthContext';
import { AttendancePage } from './AttendancePage';
import { HistoryPage } from './HistoryPage';
import { OvertimeRequestPage } from './OvertimeRequestPage';
import { NotificationsPage } from './NotificationsPage';
import { ProfilePage } from './ProfilePage';
import { LeaveRequestPage } from './LeaveRequestPage';
import { LeaveApprovalTab } from './pjbagian/LeaveApprovalTab';
import { OvertimeApprovalTab } from './pjbagian/OvertimeApprovalTab';
import { JadwalShiftTab } from './pjbagian/JadwalShiftTab';
import { PJBagianDashboard } from './pjbagian/PJBagianDashboard';
import { notificationApi, leaveApi, overtimeApi } from '../../services/api';

type Tab = 'dashboard' | 'attendance' | 'history' | 'overtime_personal' | 'approvals' | 'shift_proposals' | 'notifications' | 'profile' | 'leave';

interface PJBagianAppProps {
  onLogout: () => void;
  user: { id: number; name: string; username: string; nik_ktp: string; pj_bagian_department?: string; pj_bagian_department_id?: number; profile_picture?: string | null };
}

export function PJBagianApp({ onLogout, user: propUser }: PJBagianAppProps) {
  const { user: authUser, logoUrl } = useAuth();
  const user = authUser || propUser;
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
        setPendingLeaveCount(leaveRes.data.filter(r => r.pj_status === 'pending' && r.status === 'pending').length);
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
          <PJBagianDashboard
            pendingLeaveCount={pendingLeaveCount}
            pendingOvertimeCount={pendingOvertimeCount}
            onNavigate={(tab) => setActiveTab(tab as Tab)}
          />
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
        return <JadwalShiftTab user={user} />;
      case 'notifications':
        return <NotificationsPage onUpdateCount={fetchUnreadCount} />;
      case 'profile':
        return (
          <ProfilePage
            onLogout={onLogout}
            onNavigateToLeave={() => setActiveTab('leave')}
          />
        );
      case 'leave':
        return <LeaveRequestPage onBack={() => setActiveTab('dashboard')} />;
    }
  };

  const personalItems: { id: Tab; icon: any; label: string; badge?: number }[] = [
    { id: 'dashboard', icon: Home, label: 'Beranda' },
    { id: 'attendance', icon: MapPin, label: 'Absen Mandiri' },
    { id: 'history', icon: History, label: 'Riwayat Absen' },
    { id: 'leave', icon: FileText, label: 'Cuti & Sakit' },
    { id: 'overtime_personal', icon: Clock, label: 'Ajukan Lembur' },
    { id: 'notifications', icon: Bell, label: 'Notifikasi', badge: unreadNotifications },
  ];

  const managementItems: { id: Tab; icon: any; label: string; badge?: number }[] = [
    { id: 'approvals', icon: CheckSquare, label: 'Persetujuan Staf', badge: totalPendingApprovals },
    { id: 'shift_proposals', icon: CalendarDays, label: 'Jadwal Shift' },
  ];

  return (
    <div className="h-screen bg-[#F5F7FA] flex overflow-hidden">
      {/* Drawer Overlay Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar (Desktop & Drawer Mobile) */}
      <aside className={`fixed inset-y-0 left-0 bg-white border-r border-gray-150 w-64 z-50 transition-transform duration-300 md:relative md:translate-x-0 md:h-full md:flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
          <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
            {/* Aktivitas Mandiri */}
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-1">Aktivitas Personal</p>
              {personalItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#16A34A] text-white font-medium shadow-sm shadow-green-200'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} />
                      <span className="text-[13px]">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center ${
                        isActive ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Manajemen Staf & Bagian */}
            <div className="space-y-0.5 pt-3 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Manajemen Staf & Bagian</p>
              {managementItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#16A34A] text-white font-medium shadow-sm shadow-green-200'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} />
                      <span className="text-[13px]">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center ${
                        isActive ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Profile Card & Logout (Tetap di bawah sidebar) */}
          <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <button
                onClick={() => {
                  setActiveTab('profile');
                  setSidebarOpen(false);
                }}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left focus:outline-none"
              >
                <div className="w-8 h-8 rounded-xl bg-[#16A34A] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-[11px] font-bold">
                      {user?.name?.replace(/^(dr\.|Ns\.|Dr\.)\s*/i, '').charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-gray-850 truncate">{user?.name || 'PJ Bagian'}</p>
                  <p className="text-[10px] text-gray-400 truncate">PJ Bagian · {user?.pj_bagian_department || 'RSUCL'}</p>
                </div>
              </button>
              <button onClick={onLogout} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0" title="Keluar">
                <LogOut size={15} />
              </button>
            </div>
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
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 hover:opacity-85 transition-all text-left focus:outline-none"
            >
              <div className="text-right hidden sm:block">
                <p className="text-[12px] font-bold text-gray-900 leading-tight">{user.name}</p>
                <p className="text-[9px] text-gray-400 capitalize">PJ Bagian</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center text-green-600 text-[12px] font-bold overflow-hidden shadow-sm">
                {user?.profile_picture ? (
                  <img src={user.profile_picture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  (user?.name || 'U').charAt(0).toUpperCase()
                )}
              </div>
            </button>
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
