import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, ClipboardList, History, CalendarDays, FileText,
  Bell, Settings, LogOut, UserCheck, Clock, AlertCircle,
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
import { employeeApi, Employee, reportApi, ReportSummary } from '../../services/api';

const sidebarItems = [
  { id: 'dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'employees',     icon: Users,            label: 'Data Pegawai' },
  { id: 'attendance',    icon: ClipboardList,    label: 'Absensi' },
  { id: 'history',       icon: History,          label: 'Riwayat' },
  { id: 'schedule',      icon: CalendarDays,     label: 'Jadwal Shift' },
  { id: 'leave',         icon: FileText,         label: 'Pengajuan Cuti', badge: 0 },
  { id: 'reports',       icon: BarChart3,        label: 'Laporan' },
  { id: 'notifications', icon: Bell,             label: 'Notifikasi', badge: 0 },
  { id: 'settings',      icon: Settings,         label: 'Pengaturan' },
];

const statusColors: Record<string, { color: string; bg: string }> = {
  hadir: { color: '#16A34A', bg: '#DCFCE7' },
  telat: { color: '#D97706', bg: '#FEF3C7' },
  alpha: { color: '#DC2626', bg: '#FEE2E2' },
  cuti: { color: '#2563EB', bg: '#DBEAFE' },
  izin: { color: '#7C3AED', bg: '#F5F3FF' },
  sakit: { color: '#EA580C', bg: '#FFF7ED' },
};

const emptyForm = {
  name: '', nip: '', username: '', password: '', department_id: '', position_id: '',
  email: '', phone: '', gender: 'Laki-laki', joinDate: '',
};

interface AdminAppProps {
  onLogout: () => void;
}

export function AdminApp({ onLogout }: AdminAppProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // API States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal States
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [empRes, metaRes, reportRes] = await Promise.all([
        employeeApi.list(),
        employeeApi.meta(),
        reportApi.summary()
      ]);

      if (empRes.success) setEmployees(empRes.data);
      if (metaRes.success) {
        setDepartments(metaRes.data.departments);
        setPositions(metaRes.data.positions);
      }
      if (reportRes.success) setReportSummary(reportRes.data);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setForm({
      ...emptyForm,
      department_id: departments[0]?.id?.toString() ?? '',
      position_id: positions[0]?.id?.toString() ?? '',
    });
    setFormError('');
    setSelectedEmp(null);
    setModalType('add');
  };

  const openEdit = (emp: Employee) => {
    setForm({
      name: emp.name,
      nip: emp.nip,
      username: emp.username,
      password: '', // blank by default on edit
      department_id: emp.department_id?.toString() ?? '',
      position_id: emp.position_id?.toString() ?? '',
      email: emp.email || '',
      phone: emp.phone || '',
      gender: emp.gender || 'Laki-laki',
      joinDate: emp.join_date || '',
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

  const handleSave = async () => {
    if (!form.name.trim() || !form.nip.trim() || !form.username.trim() || (modalType === 'add' && !form.password.trim())) {
      setFormError('Nama, NIP, Username, dan Password wajib diisi.');
      return;
    }
    setFormError('');
    try {
      if (modalType === 'add') {
        const res = await employeeApi.create({
          name: form.name,
          nip: form.nip,
          username: form.username,
          password: form.password,
          department_id: Number(form.department_id),
          position_id: Number(form.position_id),
          email: form.email,
          phone: form.phone,
          gender: form.gender as any,
          join_date: form.joinDate || undefined,
        });
        if (res.success) {
          setEmployees(prev => [res.data, ...prev]);
        }
      } else if (modalType === 'edit' && selectedEmp) {
        const updateData: any = {
          name: form.name,
          email: form.email,
          department_id: Number(form.department_id),
          position_id: Number(form.position_id),
          phone: form.phone,
          gender: form.gender,
          join_date: form.joinDate || undefined,
        };
        if (form.password.trim()) {
          updateData.password = form.password;
        }
        const res = await employeeApi.update(selectedEmp.id, updateData);
        if (res.success) {
          setEmployees(prev => prev.map(e => e.id === selectedEmp.id ? res.data : e));
        }
      }
      closeModal();
      loadData(); // reload charts
    } catch (err: any) {
      setFormError(err?.message ?? 'Gagal menyimpan data.');
    }
  };

  const handleDelete = async () => {
    if (selectedEmp) {
      try {
        const res = await employeeApi.delete(selectedEmp.id);
        if (res.success) {
          setEmployees(prev => prev.filter(e => e.id !== selectedEmp.id));
        }
        closeModal();
        loadData();
      } catch (err: any) {
        alert(err?.message ?? 'Gagal menghapus data.');
      }
    }
  };

  // Re-calculate live stats from API if available, fallback to local lists otherwise
  const stats = [
    {
      icon: Users,
      label: 'Total Pegawai',
      value: reportSummary ? String(reportSummary.total_employees) : String(employees.length),
      sub: `${departments.length} Departemen`,
      color: '#374151',
      bg: '#F9FAFB'
    },
    {
      icon: UserCheck,
      label: 'Hadir Hari Ini',
      value: reportSummary ? String(reportSummary.today.hadir) : String(employees.filter(e => e.today_attendance?.status === 'hadir' || e.today_attendance?.status === 'telat').length),
      sub: 'dari total pegawai',
      color: '#16A34A',
      bg: '#F0FDF4'
    },
    {
      icon: Clock,
      label: 'Terlambat',
      value: reportSummary ? String(reportSummary.today.telat) : String(employees.filter(e => e.today_attendance?.status === 'telat').length),
      sub: 'absen masuk > 08:30',
      color: '#D97706',
      bg: '#FFFBEB'
    },
    {
      icon: FileText,
      label: 'Cuti Aktif',
      value: reportSummary ? String(reportSummary.today.cuti) : '0',
      sub: 'hari ini',
      color: '#2563EB',
      bg: '#EFF6FF'
    },
    {
      icon: AlertCircle,
      label: 'Alpha',
      value: reportSummary ? String(reportSummary.today.alpha) : '0',
      sub: 'tanpa keterangan',
      color: '#DC2626',
      bg: '#FEF2F2'
    },
  ];

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.nip.includes(searchQuery) ||
    e.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Map summary chart structure into recharts
  const weeklyData = reportSummary?.daily_chart.map(c => ({
    day: c.label,
    hadir: c.count,
    alpha: c.total - c.count,
    terlambat: 0 // Simplification since backend reports total checkins count
  })) ?? [];

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
            {item.badge && item.badge > 0 ? <span className={`text-[10px] font-bold min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center px-1 bg-red-100 text-red-600`}>{item.badge}</span> : null}
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
              <p className="text-[11px] text-gray-400">Rabu, 1 Juli 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#16A34A]/15 flex items-center justify-center">
              <span className="text-[#16A34A] text-[10px] font-bold">SA</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {errorMsg && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-[13px] text-red-600 mb-5 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button onClick={loadData} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg font-semibold transition-all">Segarkan</button>
            </div>
          )}

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
                    <div><p className="text-[14px] font-semibold text-gray-800">Absensi Mingguan</p><p className="text-[11px] text-gray-400">7 Hari Terakhir</p></div>
                    <div className="flex gap-3">
                      {[['#16A34A', 'Hadir'], ['#F87171', 'Alpha']].map(([c, l]) => (
                        <div key={l} className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} /><span className="text-[10px] text-gray-400">{l}</span></div>
                      ))}
                    </div>
                  </div>
                  {weeklyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart id="admin-weekly-bar" data={weeklyData} barGap={1} barCategoryGap="35%">
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                        <Bar dataKey="hadir" name="Hadir" fill="#16A34A" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="alpha" name="Alpha" fill="#F87171" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[180px] flex items-center justify-center text-gray-300 text-[12px]">Belum ada data mingguan.</div>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
                  <div className="mb-4"><p className="text-[14px] font-semibold text-gray-800">Status Kehadiran Bulan Ini</p><p className="text-[11px] text-gray-400">Statistik berjalan</p></div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-500">Total Check-In</span>
                      <span className="text-[14px] font-bold text-[#16A34A]">{reportSummary?.this_month.hadir ?? 0} kali</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-500">Total Alpha</span>
                      <span className="text-[14px] font-bold text-red-500">{reportSummary?.this_month.alpha ?? 0} kali</span>
                    </div>
                  </div>
                  <div className="mt-4 text-[10px] text-gray-400 border-t border-gray-50 pt-3">Diperbarui otomatis dari database absensi.</div>
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
                  <button onClick={openAdd} className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16A34A] rounded-xl text-[12px] text-white hover:bg-[#0d9240] transition-colors shadow-sm shadow-green-200">
                    <Plus size={13} /> Tambah Pegawai
                  </button>
                </div>
              </div>

              {/* Stats mini */}
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {[
                  { label: 'Total', value: employees.length, color: '#374151' },
                  { label: 'Hadir', value: employees.filter(e => e.today_attendance?.status === 'hadir' || e.today_attendance?.status === 'telat').length, color: '#16A34A' },
                  { label: 'Terlambat', value: employees.filter(e => e.today_attendance?.status === 'telat').length, color: '#D97706' },
                  { label: 'Alpha', value: employees.filter(e => !e.today_attendance || e.today_attendance.status === 'alpha').length, color: '#DC2626' },
                  { label: 'Cuti', value: employees.filter(e => e.today_attendance?.status === 'izin' || e.today_attendance?.status === 'sakit').length, color: '#2563EB' },
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
                        const todayStatus = emp.today_attendance?.status ?? 'alpha';
                        const sc = statusColors[todayStatus] || { color: '#6B7280', bg: '#F3F4F6' };
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
                            <td className="px-4 py-3.5 text-[13px] text-gray-600">{emp.department}</td>
                            <td className="px-4 py-3.5 text-[13px] text-gray-600">{emp.position}</td>
                            <td className="px-4 py-3.5">
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase" style={{ color: sc.color, background: sc.bg }}>{todayStatus}</span>
                            </td>
                            <td className="px-4 py-3.5 text-[13px] font-mono text-gray-600">{emp.today_attendance?.check_in || '--:--'}</td>
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

          {/* ── DEDICATED TABS ── */}
          {activeTab === 'attendance' && <AttendanceTab />}
          {activeTab === 'history' && <HistoryTab />}
          {activeTab === 'schedule' && <ScheduleTab />}
          {activeTab === 'leave' && <LeaveTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'settings' && <SettingsTab />}
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
                  Isi <strong>Username</strong> dan {modalType === 'add' ? <strong>Password</strong> : <strong>Password (kosongkan jika tidak ingin diubah)</strong>} untuk akses login absensi.
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
                  <input type="text" value={form.nip} disabled={modalType === 'edit'} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} placeholder="198501012010011001"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all font-mono disabled:opacity-50" />
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
                  <input type="text" value={form.username} disabled={modalType === 'edit'} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="nama.pegawai"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all disabled:opacity-50" />
                </div>
                {/* Password */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Password {modalType === 'add' && <span className="text-red-500">*</span>}</label>
                  <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={modalType === 'edit' ? 'Kosongkan jika tidak diubah' : 'Min. 6 karakter'}
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
                    <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all">
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                {/* Position */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Jabatan</label>
                  <div className="relative">
                    <select value={form.position_id} onChange={e => setForm(f => ({ ...f, position_id: e.target.value }))}
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all">
                      {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
