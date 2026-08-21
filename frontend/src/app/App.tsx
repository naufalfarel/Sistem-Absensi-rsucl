/**
 * Komponen App Utama — Sistem Absensi RSUCL
 * 
 * Bertindak sebagai router/layang utama yang menentukan tampilan berdasarkan
 * status autentikasi pengguna (sudah masuk atau belum) dan peran (admin vs karyawan).
 */

import { useAuth } from '../context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { EmployeeApp } from './components/EmployeeApp';
import { AdminApp } from './components/AdminApp';
import { PJBagianApp } from './components/PJBagianApp';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import logoImg from '../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

export default function App() {
  // Mengambil state dan fungsi autentikasi dari AuthContext
  const { user, loading, login, logout, logoUrl } = useAuth();

  // 1. Tampilan Loading saat memverifikasi sesi token aktif dari backend
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

  // 2. Alur Routing setelah berhasil masuk (Logged In)
  if (user) {
    let content;
    // Pengguna adalah administrator atau Super Admin (Direktur RSUCL)
    if (user.role === 'admin' || user.role === 'super_admin') {
      content = <AdminApp onLogout={logout} />;
    } else if (user.role === 'pj_bagian') {
      // Pengguna adalah PJ Bagian (Penanggung Jawab Bagian)
      content = <PJBagianApp onLogout={logout} user={user} />;
    } else {
      // Pengguna adalah karyawan (Employee)
      const empProps = {
        id: user.employee_id || 0,
        name: user.name,
        nik_ktp: user.nik_ktp,
        username: user.username,
        dept: typeof user.department === 'object' && user.department !== null ? (user.department as any).name : (user.department || 'Umum'),
        pos: user.position || 'Staf',
        email: user.email,
        phone: user.phone || '',
        gender: user.gender || 'Laki-laki',
        joinDate: user.join_date || '',
        status: 'Hadir',
        checkIn: '',
        shift: 'Reguler',
        statusType: 'hadir',
      };
      content = <EmployeeApp onLogout={logout} employee={empProps} />;
    }

    return <ErrorBoundary>{content}</ErrorBoundary>;
  }

  // 3. Alur jika belum masuk (Unauthenticated) - Menampilkan halaman login
  const handleLogin = async (password: string, username: string): Promise<'ok' | string> => {
    const res = await login(username, password);
    return res.success ? 'ok' : (res.message || 'wrong');
  };

  return (
    <ErrorBoundary>
      <LoginPage onLogin={handleLogin} />
    </ErrorBoundary>
  );
}

