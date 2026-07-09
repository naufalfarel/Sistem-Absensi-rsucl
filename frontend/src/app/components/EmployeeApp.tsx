import { useState, useEffect } from 'react';
import { Home, MapPin, History, Bell, User, LogOut, Menu, X, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { DashboardHome } from './DashboardHome';
import { AttendancePage } from './AttendancePage';
import { HistoryPage } from './HistoryPage';
import { NotificationsPage } from './NotificationsPage';
import { ProfilePage } from './ProfilePage';
import { GuidePage } from './GuidePage';
import { notificationApi } from '../../services/api';

// Tipe union untuk mendefinisikan tab navigasi yang valid pada dashboard karyawan
type Tab = 'dashboard' | 'attendance' | 'history' | 'notifications' | 'profile' | 'guide';

/**
 * Interface properti untuk komponen EmployeeApp.
 */
interface EmployeeAppProps {
  // Callback untuk logout
  onLogout: () => void;
  // Objek data profil karyawan yang sedang login
  employee?: { name: string; pos: string; dept: string; nip: string; username: string } | null;
}

/**
 * Layang Utama Panel Karyawan (EmployeeApp) — Sistem Absensi RSUCL
 * 
 * Mengelola sidebar navigasi desktop, menu hamburger mobile, bottom navbar mobile,
 * polling notifikasi berkala, serta melakukan rendering dinamis halaman/tab yang dipilih.
 */
export function EmployeeApp({ onLogout }: EmployeeAppProps) {
  const { user, logoUrl } = useAuth();
  
  // State untuk melacak tab aktif
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  
  // State drawer sidebar pada tampilan mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // State jam realtime untuk di mobile top-bar
  const [time, setTime] = useState(new Date());
  
  // State jumlah notifikasi belum dibaca (untuk diletakkan di badge)
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  // State pembantu untuk mengarahkan rute profil langsung membuka modal cuti
  const [profileInitialSection, setProfileInitialSection] = useState<'profile' | 'leave' | undefined>(undefined);
  const [profileInitialOpenModal, setProfileInitialOpenModal] = useState<boolean | undefined>(undefined);

  /**
   * Mengubah tab navigasi aktif sekaligus membersihkan state bypass profil jika ada.
   */
  const handleTabChange = (tab: Tab) => {
    setProfileInitialSection(undefined);
    setProfileInitialOpenModal(undefined);
    setActiveTab(tab);
  };

  /**
   * Mengambil jumlah notifikasi yang belum dibaca dari API Laravel.
   */
  const fetchUnreadCount = async () => {
    try {
      const res = await notificationApi.list();
      if (res.success) {
        setUnreadNotifications(res.data.unread_count);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  // Efek polling untuk sinkronisasi notifikasi belum dibaca setiap 20 detik
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(interval);
  }, []);

  // Efek interval penunjuk jam menit di top-bar mobile
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Daftar item navigasi menu sidebar & bottom nav
  const navItems: { id: Tab; icon: typeof Home; label: string; badge?: number }[] = [
    { id: 'dashboard', icon: Home, label: 'Beranda' },
    { id: 'attendance', icon: MapPin, label: 'Absensi' },
    { id: 'history', icon: History, label: 'Riwayat' },
    { id: 'notifications', icon: Bell, label: 'Notifikasi', badge: unreadNotifications },
    { id: 'profile', icon: User, label: 'Profil' },
    { id: 'guide', icon: BookOpen, label: 'Panduan' },
  ];

  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': 
        return (
          <DashboardHome 
            onNavigate={(tab) => {
              if (tab === 'profile-leave') {
                setProfileInitialSection('leave');
                setProfileInitialOpenModal(true);
                setActiveTab('profile');
              } else {
                handleTabChange(tab as Tab);
              }
            }} 
          />
        );
      case 'attendance': return <AttendancePage />;
      case 'history': return <HistoryPage />;
      case 'notifications': return <NotificationsPage onUpdateCount={fetchUnreadCount} />;
      case 'profile': 
        return (
          <ProfilePage 
            onLogout={onLogout} 
            initialSection={profileInitialSection}
            initialOpenModal={profileInitialOpenModal}
            onResetInitials={() => {
              setProfileInitialSection(undefined);
              setProfileInitialOpenModal(undefined);
            }}
          />
        );
      case 'guide': return <GuidePage />;
    }
  };

  const SidebarContent = ({ mobile }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {logoUrl !== 'none' && (
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-gray-100 shadow-sm flex-shrink-0 overflow-hidden">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-9 h-9 object-contain" />
            </div>
          )}
          <div>
            <p className="text-[14px] font-semibold text-gray-900">RSUCL</p>
            <p className="text-[11px] text-gray-400">Sistem Absensi</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-1">Menu</p>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => { handleTabChange(item.id); if (mobile) setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] transition-all ${
              activeTab === item.id
                ? 'bg-[#16A34A] text-white font-medium shadow-sm shadow-green-200'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <item.icon size={16} />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && item.badge > 0 ? (
              <span className={`text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center ${
                activeTab === item.id ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'
              }`}>
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* Clickable Profile Card & Logout */}
      <div className="p-3 border-t border-gray-100 space-y-1.5">
        <button
          onClick={() => { handleTabChange('profile'); if (mobile) setSidebarOpen(false); }}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#16A34A] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-[11px] font-bold">
                {user?.name?.replace(/^(dr\.|Ns\.|Dr\.)\s*/i, '').charAt(0) || 'U'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-[#16A34A] transition-colors">
              {user?.name || 'Karyawan'}
            </p>
            <p className="text-[11px] text-gray-400 truncate">
              {user?.position || 'Staf'} · {user?.department || 'RSUCL'}
            </p>
          </div>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-60 flex-shrink-0 h-full border-r border-gray-100 shadow-sm">
        <div className="w-full">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-[9999] flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 h-full shadow-2xl">
            <SidebarContent mobile />
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X size={14} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
            >
              <Menu size={16} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              {logoUrl !== 'none' && (
                <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                  <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-6 h-6 object-contain" />
                </div>
              )}
              <p className="text-[14px] font-semibold text-gray-900">
                {navItems.find(n => n.id === activeTab)?.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-mono text-gray-500">{timeStr}</p>
            <div className="relative">
              <button
                onClick={() => setActiveTab('notifications')}
                className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center"
              >
                <Bell size={14} className="text-gray-500" />
              </button>
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {renderPage()}
        </div>

        {/* Bottom Nav (mobile) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-[9990]">
          <div className="flex items-center justify-around px-2 py-1.5 pb-safe">
            {navItems.filter(item => item.id !== 'guide').map(item => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative ${
                  activeTab === item.id ? 'text-[#16A34A]' : 'text-gray-400'
                }`}
              >
                {item.badge !== undefined && item.badge > 0 ? (
                  <span className="absolute top-0.5 right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === item.id ? 'bg-green-50' : ''}`}>
                  <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 1.8} />
                </div>
                <span className={`text-[10px] font-medium ${activeTab === item.id ? 'text-[#16A34A]' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
