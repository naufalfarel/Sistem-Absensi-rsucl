import { useState } from 'react';
import {
  LayoutDashboard, Users, ClipboardList, History, CalendarDays, FileText,
  Bell, Settings, LogOut, TrendingUp, UserCheck, Clock, AlertCircle,
  Search, Plus, Upload, Download, MoreHorizontal, Lock,
  Menu, X, CheckCircle2, BarChart3, Edit2, Trash2, ChevronDown
} from 'lucide-react';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts';
import { AttendanceTab } from './admin/AttendanceTab';
import { HistoryTab } from './admin/HistoryTab';
import { ScheduleTab } from './admin/ScheduleTab';
import { LeaveTab } from './admin/LeaveTab';
import { ReportsTab } from './admin/ReportsTab';
import { NotificationsTab } from './admin/NotificationsTab';
import { SettingsTab } from './admin/SettingsTab';

const sidebarItems = [
  { id: 'dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'employees',     icon: Users,            label: 'Data Pegawai' },
  { id: 'attendance',    icon: ClipboardList,    label: 'Absensi' },
  { id: 'history',       icon: History,          label: 'Riwayat' },
  { id: 'schedule',      icon: CalendarDays,     label: 'Jadwal Shift' },
  { id: 'leave',         icon: FileText,         label: 'Pengajuan Cuti', badge: 2 },
  { id: 'reports',       icon: BarChart3,        label: 'Laporan' },
  { id: 'notifications', icon: Bell,             label: 'Notifikasi', badge: 4 },
  { id: 'settings',      icon: Settings,         label: 'Pengaturan' },
];

const weeklyData = [
  { day: 'Sen', hadir: 145, terlambat: 12, alpha: 3 },
  { day: 'Sel', hadir: 148, terlambat: 9, alpha: 3 },
  { day: 'Rab', hadir: 152, terlambat: 7, alpha: 1 },
  { day: 'Kam', hadir: 140, terlambat: 15, alpha: 5 },
  { day: 'Jum', hadir: 138, terlambat: 10, alpha: 12 },
  { day: 'Sab', hadir: 80, terlambat: 5, alpha: 0 },
];

const monthlyTrend = [
  { month: 'Jan', persen: 94 },
  { month: 'Feb', persen: 92 },
  { month: 'Mar', persen: 95 },
  { month: 'Apr', persen: 91 },
  { month: 'Mei', persen: 96 },
  { month: 'Jun', persen: 93 },
  { month: 'Jul', persen: 97 },
];

const depts = ['Poli Umum', 'ICU', 'Poli Anak', 'Administrasi', 'IGD', 'Bedah', 'Farmasi', 'Laboratorium'];
const positions = ['Dokter Umum', 'Dokter Spesialis', 'Perawat', 'Apoteker', 'Staff Admin', 'Analis Lab', 'Radiografer'];

type Employee = {
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
  status: string;
  checkIn: string;
  shift: string;
  statusType: string;
  joinDate: string;
};

const initialEmployees: Employee[] = [
  { id: 1, name: 'Dr. Rina Kusumawati', nip: '198501012010012001', username: 'rina.kusumawati', password: 'Rina@2025', dept: 'Poli Umum', pos: 'Dokter Umum', email: 'rina.k@rsucl.id', phone: '081234567890', gender: 'Perempuan', status: 'Hadir', checkIn: '08:28', shift: 'Reguler', statusType: 'hadir', joinDate: '2010-03-01' },
  { id: 2, name: 'Ns. Ahmad Fauzi', nip: '198805122012011002', username: 'ahmad.fauzi', password: 'Ahmad@2025', dept: 'ICU', pos: 'Perawat', email: 'ahmad.f@rsucl.id', phone: '082345678901', gender: 'Laki-laki', status: 'Hadir', checkIn: '08:25', shift: 'Reguler', statusType: 'hadir', joinDate: '2012-07-15' },
  { id: 3, name: 'dr. Siti Rahma', nip: '199003232015012003', username: 'siti.rahma', password: 'Siti@2025', dept: 'Poli Anak', pos: 'Dokter Spesialis', email: 'siti.r@rsucl.id', phone: '083456789012', gender: 'Perempuan', status: 'Terlambat', checkIn: '09:10', shift: 'Reguler', statusType: 'terlambat', joinDate: '2015-01-20' },
  { id: 4, name: 'Budi Santoso', nip: '198707142009011004', username: 'budi.santoso', password: 'Budi@2025', dept: 'Administrasi', pos: 'Staff Admin', email: 'budi.s@rsucl.id', phone: '084567890123', gender: 'Laki-laki', status: 'Cuti', checkIn: '--', shift: '--', statusType: 'cuti', joinDate: '2009-06-01' },
  { id: 5, name: 'Ns. Dewi Lestari', nip: '199202012016012005', username: 'dewi.lestari', password: 'Dewi@2025', dept: 'IGD', pos: 'Perawat', email: 'dewi.l@rsucl.id', phone: '085678901234', gender: 'Perempuan', status: 'Hadir', checkIn: '08:29', shift: 'Reguler', statusType: 'hadir', joinDate: '2016-08-10' },
  { id: 6, name: 'dr. Hendra Wijaya', nip: '198306192008011006', username: 'hendra.wijaya', password: 'Hendra@2025', dept: 'Bedah', pos: 'Dokter Spesialis', email: 'hendra.w@rsucl.id', phone: '086789012345', gender: 'Laki-laki', status: 'Alpha', checkIn: '--', shift: 'Reguler', statusType: 'alpha', joinDate: '2008-03-05' },
  { id: 7, name: 'Rini Handayani', nip: '199508152018012007', username: 'rini.handayani', password: 'Rini@2025', dept: 'Farmasi', pos: 'Apoteker', email: 'rini.h@rsucl.id', phone: '087890123456', gender: 'Perempuan', status: 'Hadir', checkIn: '08:27', shift: 'Reguler', statusType: 'hadir', joinDate: '2018-09-01' },
];

const statusColors: Record<string, { color: string; bg: string }> = {
  hadir: { color: '#16A34A', bg: '#DCFCE7' },
  terlambat: { color: '#D97706', bg: '#FEF3C7' },
  alpha: { color: '#DC2626', bg: '#FEE2E2' },
  cuti: { color: '#2563EB', bg: '#DBEAFE' },
};

const emptyForm = {
  name: '', nip: '', username: '', password: '', dept: depts[0], pos: positions[0],
  email: '', phone: '', gender: 'Laki-laki', joinDate: '',
};

interface AdminAppProps {
  onLogout: () => void;
  accounts: Employee[];
  setAccounts: React.Dispatch<React.SetStateAction<Employee[]>>;
}

export function AdminApp({ onLogout, accounts, setAccounts }: AdminAppProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const employees = accounts.length > 0 ? accounts : initialEmployees;
  const setEmployees = setAccounts as React.Dispatch<React.SetStateAction<Employee[]>>;
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  const openAdd = () => {
    setForm({ ...emptyForm });
    setFormError('');
    setSelectedEmp(null);
    setModalType('add');
  };

  const openEdit = (emp: Employee) => {
    setForm({
      name: emp.name, nip: emp.nip, username: emp.username, password: emp.password,
      dept: emp.dept, pos: emp.pos, email: emp.email,
      phone: emp.phone, gender: emp.gender, joinDate: emp.joinDate,
    });
    setFormError('');
    setSelectedEmp(emp);
    setOpenMenuId(null);
    setModalType('edit');
  };

  const openDelete = (emp: Employee) => {
    setSelectedEmp(emp);
    setOpenMenuId(null);
    setModalType('delete');
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedEmp(null);
    setFormError('');
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.nip.trim() || !form.username.trim() || !form.password.trim()) {
      setFormError('Nama, NIP, Username, dan Password wajib diisi.');
      return;
    }
    if (modalType === 'add') {
      const newEmp: Employee = {
        id: Date.now(),
        ...form,
        status: 'Belum Absen',
        checkIn: '--',
        shift: 'Reguler',
        statusType: 'alpha',
      };
      setEmployees(prev => [newEmp, ...prev]);
    } else if (modalType === 'edit' && selectedEmp) {
      setEmployees(prev =>
        prev.map(e => e.id === selectedEmp.id ? { ...e, ...form } : e)
      );
    }
    closeModal();
  };

  const handleDelete = () => {
    if (selectedEmp) {
      setEmployees(prev => prev.filter(e => e.id !== selectedEmp.id));
    }
    closeModal();
  };

  const stats = [
    { icon: Users, label: 'Total Pegawai', value: String(employees.length), sub: '8 Departemen', color: '#374151', bg: '#F9FAFB' },
    { icon: UserCheck, label: 'Hadir Hari Ini', value: String(employees.filter(e => e.statusType === 'hadir').length), sub: 'dari total pegawai', color: '#16A34A', bg: '#F0FDF4' },
    { icon: Clock, label: 'Terlambat', value: String(employees.filter(e => e.statusType === 'terlambat').length), sub: 'dari jadwal 08:30', color: '#D97706', bg: '#FFFBEB' },
    { icon: FileText, label: 'Cuti Aktif', value: String(employees.filter(e => e.statusType === 'cuti').length), sub: 'pengajuan disetujui', color: '#2563EB', bg: '#EFF6FF' },
    { icon: AlertCircle, label: 'Alpha', value: String(employees.filter(e => e.statusType === 'alpha').length), sub: 'tanpa keterangan', color: '#DC2626', bg: '#FEF2F2' },
  ];

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.nip.includes(searchQuery) ||
    e.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.pos.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const SidebarContent = ({ mobile }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full bg-white">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={logoImg} alt="Logo RSUCL" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900 leading-tight">RSUCL Admin</p>
            <p className="text-[10px] text-gray-400">Sistem Absensi</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-1">Menu Utama</p>
        {sidebarItems.slice(0, 5).map(item => (
          <button key={item.id} onClick={() => { setActiveTab(item.id); if (mobile) setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] transition-all mb-0.5 ${activeTab === item.id ? 'bg-[#16A34A] text-white font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
            <div className="flex items-center gap-2.5"><item.icon size={16} />{item.label}</div>
          </button>
        ))}
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2 mt-4">Manajemen</p>
        {sidebarItems.slice(5).map(item => (
          <button key={item.id} onClick={() => { setActiveTab(item.id); if (mobile) setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] transition-all mb-0.5 ${activeTab === item.id ? 'bg-[#16A34A] text-white font-medium shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
            <div className="flex items-center gap-2.5"><item.icon size={16} />{item.label}</div>
            {item.badge && <span className={`text-[10px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center px-1 ${activeTab === item.id ? 'bg-white/25 text-white' : item.id === 'leave' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{item.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-xl bg-[#16A34A]/15 flex items-center justify-center flex-shrink-0">
            <span className="text-[#16A34A] text-[11px] font-bold">SA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 truncate">Super Admin</p>
            <p className="text-[10px] text-gray-400">Administrator</p>
          </div>
          <button onClick={onLogout} className="text-gray-400 hover:text-red-500 transition-colors"><LogOut size={15} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}
      onClick={() => openMenuId !== null && setOpenMenuId(null)}>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0 w-64 h-full border-r border-gray-100 shadow-sm"><SidebarContent /></div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 h-full shadow-2xl">
            <SidebarContent mobile />
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={14} className="text-gray-500" /></button>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Menu size={16} className="text-gray-600" /></button>
            <div>
              <h2 className="text-[14px] font-semibold text-gray-900">{sidebarItems.find(s => s.id === activeTab)?.label || 'Dashboard'}</h2>
              <p className="text-[11px] text-gray-400">Rabu, 1 Juli 2025</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
              <Bell size={15} className="text-gray-500" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">3</span>
            </button>
            <div className="w-8 h-8 rounded-xl bg-[#16A34A]/15 flex items-center justify-center">
              <span className="text-[#16A34A] text-[10px] font-bold">SA</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">

          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {stats.map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}><s.icon size={15} style={{ color: s.color }} /></div>
                    <p className="text-[22px] font-bold text-gray-900">{s.value}</p>
                    <p className="text-[11px] font-medium text-gray-600">{s.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div><p className="text-[14px] font-semibold text-gray-800">Absensi Mingguan</p><p className="text-[11px] text-gray-400">25 Jun – 1 Jul 2025</p></div>
                    <div className="flex gap-3">
                      {[['#16A34A', 'Hadir'], ['#FBBF24', 'Terlambat'], ['#F87171', 'Alpha']].map(([c, l]) => (
                        <div key={l} className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} /><span className="text-[10px] text-gray-400">{l}</span></div>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart id="admin-weekly-bar" data={weeklyData} barGap={1} barCategoryGap="35%">
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                      <Bar dataKey="hadir" name="Hadir-dash" fill="#16A34A" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="terlambat" name="Terlambat-dash" fill="#FBBF24" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="alpha" name="Alpha-dash" fill="#F87171" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="mb-4"><p className="text-[14px] font-semibold text-gray-800">Tren Kehadiran</p><p className="text-[11px] text-gray-400">Persentase bulanan 2025</p></div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart id="admin-trend-line" data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[85, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
                      <Line type="monotone" dataKey="persen" name="Persentase-dash" stroke="#16A34A" strokeWidth={2.5} dot={{ fill: '#16A34A', r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[14px] font-semibold text-gray-800 mb-4">Kehadiran per Departemen</p>
                <div className="space-y-3">
                  {[
                    { dept: 'Poli Umum & UGD', hadir: 28, total: 30, pct: 93 },
                    { dept: 'ICU / ICCU', hadir: 18, total: 20, pct: 90 },
                    { dept: 'Poli Spesialis', hadir: 35, total: 36, pct: 97 },
                    { dept: 'IGD', hadir: 22, total: 24, pct: 92 },
                    { dept: 'Administrasi', hadir: 19, total: 20, pct: 95 },
                    { dept: 'Farmasi', hadir: 14, total: 14, pct: 100 },
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <p className="text-[12px] text-gray-600 w-40 flex-shrink-0">{d.dept}</p>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-[#16A34A]" style={{ width: `${d.pct}%` }} />
                      </div>
                      <div className="text-right flex-shrink-0 w-24">
                        <span className="text-[12px] font-semibold text-gray-800">{d.hadir}/{d.total}</span>
                        <span className="text-[11px] text-gray-400 ml-1.5">({d.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DATA PEGAWAI ── */}
          {activeTab === 'employees' && (
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Cari nama, NIP, atau departemen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-[12px] text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
                    <Upload size={13} /> Import Excel
                  </button>
                  <button className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-[12px] text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
                    <Download size={13} /> Export
                  </button>
                  <button onClick={openAdd} className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16A34A] rounded-xl text-[12px] text-white hover:bg-[#0d9240] transition-colors shadow-sm shadow-green-200">
                    <Plus size={13} /> Tambah Pegawai
                  </button>
                </div>
              </div>

              {/* Stats mini */}
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {[
                  { label: 'Total', value: employees.length, color: '#374151' },
                  { label: 'Hadir', value: employees.filter(e => e.statusType === 'hadir').length, color: '#16A34A' },
                  { label: 'Terlambat', value: employees.filter(e => e.statusType === 'terlambat').length, color: '#D97706' },
                  { label: 'Alpha', value: employees.filter(e => e.statusType === 'alpha').length, color: '#DC2626' },
                  { label: 'Cuti', value: employees.filter(e => e.statusType === 'cuti').length, color: '#2563EB' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center shadow-sm">
                    <p className="text-[18px] font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[11px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        {['Nama Pegawai', 'NIP', 'Username', 'Departemen', 'Jabatan', 'Status', 'Check-In', 'Aksi'].map((h, i) => (
                          <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(emp => {
                        const sc = statusColors[emp.statusType] || { color: '#6B7280', bg: '#F3F4F6' };
                        return (
                          <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[#16A34A] text-[11px] font-bold">{emp.name.replace(/^(dr\.|Ns\.|Dr\.)\s*/i, '').charAt(0)}</span>
                                </div>
                                <div>
                                  <p className="text-[13px] font-medium text-gray-800">{emp.name}</p>
                                  <p className="text-[11px] text-gray-400">{emp.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[12px] font-mono text-gray-500">{emp.nip}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5">
                                <Lock size={11} className="text-gray-300 flex-shrink-0" />
                                <span className="text-[12px] text-gray-500">{emp.username || '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[13px] text-gray-600">{emp.dept}</td>
                            <td className="px-4 py-3.5 text-[13px] text-gray-600">{emp.pos}</td>
                            <td className="px-4 py-3.5">
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{emp.status}</span>
                            </td>
                            <td className="px-4 py-3.5 text-[13px] font-mono text-gray-600">{emp.checkIn}</td>
                            <td className="px-4 py-3.5 relative">
                              <button
                                onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === emp.id ? null : emp.id); }}
                                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                              >
                                <MoreHorizontal size={14} className="text-gray-400" />
                              </button>
                              {openMenuId === emp.id && (
                                <div className="absolute right-8 top-2 z-20 bg-white rounded-xl border border-gray-100 shadow-lg py-1 min-w-[130px]" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => openEdit(emp)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors">
                                    <Edit2 size={13} className="text-[#16A34A]" /> Edit Pegawai
                                  </button>
                                  <div className="h-px bg-gray-50 mx-2" />
                                  <button onClick={() => openDelete(emp)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors">
                                    <Trash2 size={13} /> Hapus
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="text-center py-12">
                    <Users size={28} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-[13px] text-gray-400">Tidak ada pegawai ditemukan</p>
                  </div>
                )}
                <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                  <p className="text-[12px] text-gray-400">Menampilkan {filtered.length} dari {employees.length} pegawai</p>
                </div>
              </div>
            </div>
          )}

          {/* ── NEW DEDICATED TABS ── */}
          {activeTab === 'attendance' && <AttendanceTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'schedule' && <ScheduleTab />}
          {activeTab === 'leave' && <LeaveTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'settings' && <SettingsTab />}

          {/* ── OLD JADWAL SHIFT (kept for fallback, now replaced) ── */}
          {activeTab === 'schedule_old' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                  <CalendarDays size={16} className="text-[#16A34A]" />
                  <p className="text-[14px] font-semibold text-gray-800">Jadwal Kerja RSUCL</p>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { days: 'Senin – Jumat', masuk: '08:30', pulang: '17:00', note: 'Termasuk istirahat 12:30 – 13:30', color: '#16A34A', bg: '#F0FDF4' },
                    { days: 'Sabtu', masuk: '08:30', pulang: '13:00', note: 'Tanpa jam istirahat formal', color: '#2563EB', bg: '#EFF6FF' },
                    { days: 'Minggu & Hari Libur', masuk: '--', pulang: '--', note: 'Libur (kecuali jaga darurat)', color: '#6B7280', bg: '#F9FAFB' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: s.bg, borderColor: s.color + '20' }}>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-gray-900">{s.days}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5">{s.note}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="text-[10px] text-gray-400">Masuk</p>
                          <p className="text-[15px] font-bold font-mono" style={{ color: s.color }}>{s.masuk}</p>
                        </div>
                        <div className="text-gray-300">–</div>
                        <div>
                          <p className="text-[10px] text-gray-400">Pulang</p>
                          <p className="text-[15px] font-bold font-mono" style={{ color: s.color }}>{s.pulang}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Istirahat detail */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-[14px] font-semibold text-gray-800">Detail Jam Istirahat</p>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Clock size={18} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">Istirahat Makan Siang</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">Berlaku Senin – Jumat · Durasi 1 jam</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[18px] font-bold font-mono text-amber-600">12:30 – 13:30</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-400 mt-3 px-1">* Absensi check-out istirahat tidak diwajibkan. Sistem hanya merekam jam masuk dan pulang utama.</p>
                </div>
              </div>

              {/* Toleransi */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <p className="text-[14px] font-semibold text-gray-800">Toleransi & Ketentuan</p>
                </div>
                <div className="p-5 space-y-2.5">
                  {[
                    { label: 'Toleransi Keterlambatan', value: 0, note: 'Tidak ada toleransi – tepat 08:30' },
                    { label: 'Batas Check-In Maksimal', value: '09:00', note: 'Setelah pukul 09:00 dianggap Alpha' },
                    { label: 'Radius Geofence Absensi', value: '100m', note: 'Dari titik koordinat RSUCL' },
                    { label: 'Sistem Absensi', value: 'GPS', note: 'Berbasis lokasi GPS real-time' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-[13px] font-medium text-gray-800">{item.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.note}</p>
                      </div>
                      <span className="text-[13px] font-bold text-[#16A34A] bg-green-50 px-3 py-1 rounded-lg">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── MODAL ADD / EDIT ── */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${modalType === 'add' ? 'bg-green-50' : 'bg-blue-50'}`}>
                  {modalType === 'add' ? <Plus size={16} className="text-[#16A34A]" /> : <Edit2 size={16} className="text-blue-600" />}
                </div>
                <p className="text-[15px] font-semibold text-gray-900">{modalType === 'add' ? 'Tambah Pegawai Baru' : 'Edit Data Pegawai'}</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-[13px] px-4 py-2.5 rounded-xl">{formError}</div>
              )}
              {/* Akun Login info */}
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Lock size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-blue-700 leading-snug">
                  Isi <strong>Username</strong> dan <strong>Password</strong> yang akan diberikan kepada karyawan untuk login ke sistem absensi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama */}
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Nama Lengkap <span className="text-red-500">*</span></label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Contoh: Dr. Andi Wijaya"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                </div>
                {/* NIP */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">NIP <span className="text-red-500">*</span></label>
                  <input type="text" value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} placeholder="198501012010011001"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all font-mono" />
                </div>
                {/* Email */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="nama@rsucl.id"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                </div>
                {/* Username */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Username Login <span className="text-red-500">*</span></label>
                  <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="nama.pegawai"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                </div>
                {/* Password */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 karakter"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all font-mono" />
                </div>
                {/* Phone */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Nomor HP</label>
                  <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08xxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                </div>
                {/* Gender */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Jenis Kelamin</label>
                  <div className="relative">
                    <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all">
                      <option>Laki-laki</option>
                      <option>Perempuan</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                {/* Dept */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Departemen</label>
                  <div className="relative">
                    <select value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))}
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all">
                      {depts.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                {/* Position */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Jabatan</label>
                  <div className="relative">
                    <select value={form.pos} onChange={e => setForm(f => ({ ...f, pos: e.target.value }))}
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all">
                      {positions.map(p => <option key={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                {/* Join Date */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Tanggal Bergabung</label>
                  <input type="date" value={form.joinDate} onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 pb-6">
              <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors shadow-sm shadow-green-200">
                {modalType === 'add' ? 'Tambah Pegawai' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DELETE ── */}
      {modalType === 'delete' && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">Hapus Pegawai?</h3>
            <p className="text-[13px] text-gray-500 text-center mb-1">Data pegawai berikut akan dihapus permanen:</p>
            <p className="text-[13px] font-semibold text-gray-800 text-center mb-5">{selectedEmp.name}</p>
            <div className="bg-red-50 rounded-xl p-3 mb-5 text-center">
              <p className="text-[12px] text-red-600">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={closeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
