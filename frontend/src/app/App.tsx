import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { EmployeeApp } from './components/EmployeeApp';
import { AdminApp } from './components/AdminApp';

export type EmployeeAccount = {
  id: number;
  name: string;
  nip: string;
  username: string;
  password: string;
  dept: string;
  pos: string;
  email: string;
  phone: string;
  gender: string;
  joinDate: string;
  status: string;
  checkIn: string;
  shift: string;
  statusType: string;
};

// Kredensial khusus admin — hanya diketahui administrator
const ADMIN_CREDS = { nip: 'ADMIN001', username: 'admin', password: 'RSUCL@2025' };

const initialAccounts: EmployeeAccount[] = [
  {
    id: 1, name: 'Dr. Rina Kusumawati', nip: '198501012010012001',
    username: 'rina.kusumawati', password: 'Rina@2025',
    dept: 'Poli Umum', pos: 'Dokter Umum',
    email: 'rina.k@rsucl.id', phone: '081234567890', gender: 'Perempuan',
    joinDate: '2010-03-01', status: 'Hadir', checkIn: '08:28', shift: 'Reguler', statusType: 'hadir',
  },
  {
    id: 2, name: 'Ns. Ahmad Fauzi', nip: '198805122012011002',
    username: 'ahmad.fauzi', password: 'Ahmad@2025',
    dept: 'ICU', pos: 'Perawat',
    email: 'ahmad.f@rsucl.id', phone: '082345678901', gender: 'Laki-laki',
    joinDate: '2012-07-15', status: 'Hadir', checkIn: '08:25', shift: 'Reguler', statusType: 'hadir',
  },
  {
    id: 3, name: 'Rini Handayani', nip: '199508152018012007',
    username: 'rini.handayani', password: 'Rini@2025',
    dept: 'Farmasi', pos: 'Apoteker',
    email: 'rini.h@rsucl.id', phone: '087890123456', gender: 'Perempuan',
    joinDate: '2018-09-01', status: 'Hadir', checkIn: '08:27', shift: 'Reguler', statusType: 'hadir',
  },
];

type AppView = 'landing' | 'login' | 'employee' | 'admin';

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [accounts, setAccounts] = useState<EmployeeAccount[]>(initialAccounts);
  const [loggedEmployee, setLoggedEmployee] = useState<EmployeeAccount | null>(null);

  const handleLogin = (nip: string, username: string, password: string): 'ok' | 'wrong' => {
    // Cek admin
    if (
      nip.trim() === ADMIN_CREDS.nip &&
      username.trim() === ADMIN_CREDS.username &&
      password === ADMIN_CREDS.password
    ) {
      setView('admin');
      return 'ok';
    }
    // Cek karyawan
    const emp = accounts.find(
      a => a.nip === nip.trim() && a.username === username.trim() && a.password === password
    );
    if (emp) {
      setLoggedEmployee(emp);
      setView('employee');
      return 'ok';
    }
    return 'wrong';
  };

  if (view === 'landing') return <LandingPage onEnter={() => setView('login')} />;
  if (view === 'login')   return <LoginPage onLogin={handleLogin} onBack={() => setView('landing')} />;
  if (view === 'admin')   return <AdminApp onLogout={() => setView('landing')} accounts={accounts} setAccounts={setAccounts} />;
  return <EmployeeApp onLogout={() => setView('landing')} employee={loggedEmployee} />;
}
