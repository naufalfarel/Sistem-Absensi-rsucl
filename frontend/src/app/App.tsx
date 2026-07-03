import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { EmployeeApp } from './components/EmployeeApp';
import { AdminApp } from './components/AdminApp';
import logoImg from '../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

export default function App() {
  const { user, loading, login, logout, logoUrl } = useAuth();
  const [view, setView] = useState<'landing' | 'login'>('landing');

  // Loading state (sleek, high-end design)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center">
        <div className="relative flex flex-col items-center">
          {/* Pulsing glow ring */}
          <div className="absolute w-24 h-24 rounded-3xl bg-[#16A34A] opacity-10 animate-ping" style={{ animationDuration: '3s' }} />
          <div className="absolute w-20 h-20 rounded-3xl bg-[#16A34A] opacity-20 animate-pulse" />
          {/* Logo container */}
          {logoUrl !== 'none' && (
            <div className="relative w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-lg flex items-center justify-center overflow-hidden mb-4">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-13 h-13 object-contain" />
            </div>
          )}
          <p className="text-[14px] font-semibold text-gray-800 tracking-wide">RSUCL Absensi</p>
          <p className="text-[11px] text-gray-400 mt-1">Menghubungkan ke server...</p>
        </div>
      </div>
    );
  }

  // Routing if logged in
  if (user) {
    if (user.role === 'admin') {
      return <AdminApp onLogout={logout} />;
    }
    // EmployeeApp wants an employee account prop. We can shape the user into it.
    const empProps = {
      id: user.employee_id || 0,
      name: user.name,
      nip: user.nip,
      username: user.username,
      dept: user.department || 'Umum',
      pos: user.position || 'Staf',
      email: user.email,
      phone: user.phone || '',
      gender: user.gender || 'Laki-laki',
      joinDate: user.join_date || '',
      status: 'Hadir', // will be fetched inside EmployeeApp components
      checkIn: '',
      shift: 'Reguler',
      statusType: 'hadir',
    };
    return <EmployeeApp onLogout={logout} employee={empProps} />;
  }

  // Auth pages
  const handleLogin = async (password: string, username: string): Promise<'ok' | 'wrong'> => {
    const success = await login(username, password);
    return success ? 'ok' : 'wrong';
  };

  if (view === 'landing') {
    return <LandingPage onEnter={() => setView('login')} />;
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      onBack={() => setView('landing')}
    />
  );
}
