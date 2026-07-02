import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { EmployeeApp } from './components/EmployeeApp';
import { AdminApp } from './components/AdminApp';

// ─────────────────────────────────────────────────────────────
// CATATAN PENGEMBANG
// File ini saat ini menggunakan mode DEMO (offline) karena
// integrasi backend belum selesai. Tidak ada password atau
// kredensial sensitif di sini — autentikasi akan dipindahkan
// ke POST /api/login (Laravel Sanctum) setelah backend siap.
//
// TODO: Ganti seluruh blok ini dengan panggilan ke AuthContext
//       yang memanggil src/services/api.ts → POST /api/login.
// ─────────────────────────────────────────────────────────────

export type EmployeeAccount = {
  id: number;
  name: string;
  nip: string;
  username: string;
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

// Demo accounts — tidak mengandung password.
// NIP dan username dipakai sebagai identitas; autentikasi sesungguhnya
// dilakukan backend (POST /api/login) setelah integrasi selesai.
const DEMO_ACCOUNTS: EmployeeAccount[] = [
  {
    id: 1, name: 'Dr. Rina Kusumawati', nip: '198501012010012001',
    username: 'rina.kusumawati',
    dept: 'Poli Umum', pos: 'Dokter Umum',
    email: 'rina.k@rsucl.id', phone: '081234567890', gender: 'Perempuan',
    joinDate: '2010-03-01', status: 'Hadir', checkIn: '08:28', shift: 'Reguler', statusType: 'hadir',
  },
  {
    id: 2, name: 'Ns. Ahmad Fauzi', nip: '198805122012011002',
    username: 'ahmad.fauzi',
    dept: 'ICU', pos: 'Perawat',
    email: 'ahmad.f@rsucl.id', phone: '082345678901', gender: 'Laki-laki',
    joinDate: '2012-07-15', status: 'Hadir', checkIn: '08:25', shift: 'Reguler', statusType: 'hadir',
  },
  {
    id: 3, name: 'Rini Handayani', nip: '199508152018012007',
    username: 'rini.handayani',
    dept: 'Farmasi', pos: 'Apoteker',
    email: 'rini.h@rsucl.id', phone: '087890123456', gender: 'Perempuan',
    joinDate: '2018-09-01', status: 'Hadir', checkIn: '08:27', shift: 'Reguler', statusType: 'hadir',
  },
];

// Demo login check — hanya untuk mode prototipe UI.
// Username dan NIP dicocokkan; tidak ada password yang disimpan di kode.
// Admin: username=admin, NIP=ADMIN001
// Karyawan: username=<username>, NIP=<nip> (tanpa password, cukup dua field)
function checkDemoLogin(nip: string, username: string): 'admin' | EmployeeAccount | null {
  if (nip.trim() === 'ADMIN001' && username.trim() === 'admin') return 'admin';
  const emp = DEMO_ACCOUNTS.find(
    a => a.nip === nip.trim() && a.username === username.trim()
  );
  return emp ?? null;
}

type AppView = 'landing' | 'login' | 'employee' | 'admin';

export default function App() {
  const [view, setView]                   = useState<AppView>('landing');
  const [accounts, setAccounts]           = useState<EmployeeAccount[]>(DEMO_ACCOUNTS);
  const [loggedEmployee, setLoggedEmployee] = useState<EmployeeAccount | null>(null);

  // TODO: Ganti dengan panggilan ke POST /api/login setelah backend tersambung.
  // Parameter `password` diterima dari LoginPage tapi tidak dipakai di demo —
  // dalam produksi akan dikirim ke API bersama nip+username.
  const handleLogin = (_password: string, nip: string, username: string): 'ok' | 'wrong' => {
    const result = checkDemoLogin(nip, username);
    if (result === 'admin') { setView('admin'); return 'ok'; }
    if (result)             { setLoggedEmployee(result); setView('employee'); return 'ok'; }
    return 'wrong';
  };

  if (view === 'landing') return <LandingPage onEnter={() => setView('login')} />;
  if (view === 'login')   return <LoginPage onLogin={handleLogin} onBack={() => setView('landing')} />;
  if (view === 'admin')   return <AdminApp onLogout={() => setView('landing')} accounts={accounts} setAccounts={setAccounts} />;
  return <EmployeeApp onLogout={() => setView('landing')} employee={loggedEmployee} />;
}
