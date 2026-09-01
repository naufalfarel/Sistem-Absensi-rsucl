import { useState, useEffect, useRef, useMemo } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, Trash2, Paperclip, AlertCircle, Calendar, ChevronDown, Search, X, Printer, Edit3 } from 'lucide-react';
import { leaveApi, LeaveRequest, departmentApi, DepartmentModel, employeeApi, Employee, specialLeaveApi, SpecialLeaveCategory } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';
import { LeaveFormPrintModal } from '../ui/LeaveFormPrintModal';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

type LeaveType = 'cuti' | 'izin' | 'sakit' | 'cuti_khusus';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'draft';

const typeConfig: Record<LeaveType, { label: string; color: string; bg: string; border: string }> = {
  cuti:        { label: 'Cuti Tahunan', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  izin:        { label: 'Izin',         color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  sakit:       { label: 'Izin Sakit',   color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  cuti_khusus: { label: 'Cuti Khusus / Diluar Tanggungan', color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5' },
};

const statusConfig: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Menunggu',   color: '#D97706', bg: '#FEF3C7' },
  approved:  { label: 'Disetujui',  color: '#16A34A', bg: '#DCFCE7' },
  rejected:  { label: 'Ditolak',    color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: 'Dibatalkan', color: '#6B7280', bg: '#F3F4F6' },
  draft:     { label: 'Draf (Menunggu PJ)', color: '#4F46E5', bg: '#EEF2FF' },
};

const filterTabs = ['Semua', 'Draf', 'Menunggu', 'Disetujui', 'Ditolak', 'Dibatalkan'];

interface LeaveTabProps {
  onUpdateCount?: () => void;
}

/**
 * Component Combobox Cari & Pilih Karyawan (A-Z)
 */
function SearchableEmployeeSelect({
  employees,
  selectedId,
  onSelect,
  loading
}: {
  employees: Employee[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = employees.find(e => e.id.toString() === selectedId);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.nik_ktp && e.nik_ktp.includes(q)) ||
      (e.department && e.department.toLowerCase().includes(q))
    );
  }, [employees, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
        Pilih Karyawan (Cari Nama A–Z)
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-800 flex items-center justify-between cursor-pointer hover:border-[#16A34A] transition-all"
      >
        <span className="truncate">
          {loading ? 'Memuat daftar karyawan...' : selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.nik_ktp || '-'}) — ${selectedEmployee.department || 'Staff'}` : '-- Pilih Karyawan --'}
        </span>
        <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 space-y-1.5 animate-fade-in max-h-[220px] flex flex-col">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Ketik nama / NIK..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[12px] focus:outline-none focus:border-[#16A34A]"
            />
          </div>
          <div className="overflow-y-auto flex-1 space-y-0.5">
            {filteredEmployees.length === 0 ? (
              <p className="text-[11px] text-gray-400 p-2 text-center">Karyawan tidak ditemukan</p>
            ) : (
              filteredEmployees.map(emp => (
                <div
                  key={emp.id}
                  onClick={() => {
                    onSelect(emp.id.toString());
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[12px] cursor-pointer flex items-center justify-between transition-colors ${
                    selectedId === emp.id.toString() ? 'bg-green-50 text-[#16A34A] font-bold' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="truncate">{emp.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono ml-2 flex-shrink-0">{emp.department || 'Staff'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Komponen Tab Cuti Admin (LeaveTab) — Sistem Absensi RSUCL
 * 
 * Digunakan oleh Administrator untuk meninjau, menyetujui, atau menolak permohonan
 * cuti, izin, dan sakit yang diajukan oleh karyawan. Administrator juga dapat mempersingkat,
 * membatalkan pengajuan yang sudah disetujui, serta mendeteksi pegawai yang kembali masuk lebih awal.
 */
export function LeaveTab({ onUpdateCount }: LeaveTabProps) {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const getMonthBoundaries = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      firstStr: `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-01`,
      lastStr: `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`
    };
  };

  const { firstStr, lastStr } = getMonthBoundaries();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);

  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  
  const [filter, setFilter] = useState('Semua');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'approve' | 'reject'; name: string } | null>(null);
  
  const [cancelModal, setCancelModal] = useState<{ id: number; name: string } | null>(null);
  const [editModal, setEditModal] = useState<{ id: number; name: string; startDate: string; endDate: string; adminNote: string } | null>(null);

  const [cancellationReason, setCancellationReason] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editAdminNote, setEditAdminNote] = useState('');

  const [possibleReturns, setPossibleReturns] = useState<Array<{ leave_request: LeaveRequest; detected_dates: string[] }>>([]);

  const [selectedLeaveForPrint, setSelectedLeaveForPrint] = useState<LeaveRequest | null>(null);
  const { logoUrl } = useAuth();

  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);

  const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<'cuti' | 'izin' | 'sakit' | 'cuti_khusus'>('cuti');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [addLeaveError, setAddLeaveError] = useState('');
  const [submittingAddLeave, setSubmittingAddLeave] = useState(false);

  const [specialCategories, setSpecialCategories] = useState<SpecialLeaveCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategoryOther, setCustomCategoryOther] = useState<string>('');

  const loadSpecialCategories = async () => {
    try {
      const res = await specialLeaveApi.listActive();
      if (res.success) {
        const sorted = [...(res.data || [])].sort((a, b) => {
          if ((a.name || '').toLowerCase() === 'lainnya') return 1;
          if ((b.name || '').toLowerCase() === 'lainnya') return -1;
          return (a.name || '').localeCompare(b.name || '', 'id');
        });
        setSpecialCategories(sorted);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await employeeApi.list();
      if (res.success) {
        const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name));
        setEmployeesList(sorted);
        if (sorted.length > 0) {
          setSelectedEmployeeId(sorted[0].id.toString());
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAddLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !leaveStart || !leaveEnd || !leaveReason.trim()) {
      setAddLeaveError('Semua field wajib diisi.');
      return;
    }

    if (leaveType === 'cuti_khusus') {
      if (!selectedCategory) {
        setAddLeaveError('Kategori Cuti Khusus wajib dipilih.');
        return;
      }
      const cat = specialCategories.find(c => String(c.id) === selectedCategory);
      const catName = (cat?.name || '').toLowerCase();
      const needsOther = catName === 'lainnya' || catName.includes('sakit');
      if (needsOther && !customCategoryOther.trim()) {
        setAddLeaveError('Keterangan rincian kategori khusus wajib diisi.');
        return;
      }
    }

    setAddLeaveError('');
    setSubmittingAddLeave(true);
    try {
      const payload: any = {
        employee_id: Number(selectedEmployeeId),
        type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason.trim(),
      };

      if (leaveType === 'cuti_khusus') {
        payload.special_leave_category_id = Number(selectedCategory);
        const cat = specialCategories.find(c => String(c.id) === selectedCategory);
        const catName = (cat?.name || '').toLowerCase();
        const needsOther = catName === 'lainnya' || catName.includes('sakit');
        if (needsOther && customCategoryOther.trim()) {
          payload.special_leave_category_other = customCategoryOther.trim();
        }
      }

      const res = await leaveApi.create(payload);
      if (res.success) {
        setShowAddLeaveModal(false);
        setLeaveStart('');
        setLeaveEnd('');
        setLeaveReason('');
        setSelectedCategory('');
        setCustomCategoryOther('');
        setAddLeaveError('');
        loadRequests();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      setAddLeaveError(err?.message ?? 'Gagal mencatat cuti.');
    } finally {
      setSubmittingAddLeave(false);
    }
  };

  /**
   * Menarik seluruh daftar pengajuan cuti masuk dari API backend.
   */
  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await leaveApi.list();
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mendeteksi pegawai yang check-in saat rentang cuti aktif.
   */
  const loadPossibleReturns = async () => {
    try {
      const res = await leaveApi.possibleEarlyReturns();
      if (res.success) {
        setPossibleReturns(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Debounce search value
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchVal]);

  // Load departments
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await departmentApi.list();
        if (res.success) {
          setDepartments(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchDepts();
  }, []);

  // Panggil load saat tab ini dimuat di layar
  useEffect(() => {
    loadRequests();
    loadPossibleReturns();
  }, []);

  const filtered = requests.filter(r => {
    // 1. Status Filter
    const matchFilter = filter === 'Semua' ||
      (filter === 'Draf' && r.pj_status === 'pending' && r.status === 'pending') ||
      (filter === 'Menunggu' && r.status === 'pending') ||
      (filter === 'Disetujui' && r.status === 'approved') ||
      (filter === 'Ditolak' && r.status === 'rejected') ||
      (filter === 'Dibatalkan' && r.status === 'cancelled');

    // 2. Type Filter
    const typeKey = r.type as LeaveType;
    const matchType = typeFilter === 'all' || typeKey === typeFilter;

    // 3. Department Filter
    const matchDept = !departmentId || r.employee?.department === departmentId;

    // 4. Search Filter
    const matchSearch = !search || 
      r.employee?.name?.toLowerCase().includes(search.toLowerCase()) || 
      r.employee?.nik_ktp?.includes(search);

    // 5. Date Filter
    const reqStart = r.start_date;
    const reqEnd = r.effective_end_date || r.end_date;
    const matchDate = (!dateFrom || reqEnd >= dateFrom) && (!dateTo || reqStart <= dateTo);

    return matchFilter && matchType && matchDept && matchSearch && matchDate;
  });

  const pending = requests.filter(r => r.pj_status === 'approved' && r.status === 'pending').length;
  const drafts = requests.filter(r => r.pj_status === 'pending' && r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;
  const cancelledCount = requests.filter(r => r.status === 'cancelled').length;
  const totalCount = requests.length;

  const handleAction = async (id: number, action: 'approve' | 'reject', note?: string) => {
    try {
      let res;
      if (action === 'approve') {
        res = await leaveApi.approve(id, note);
      } else {
        res = await leaveApi.reject(id, note);
      }
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? res.data : r));
        loadPossibleReturns();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memproses permohonan.');
    } finally {
      setConfirmModal(null);
      setAdminNote('');
    }
  };

  const handleCancelAdmin = async (id: number, reason: string) => {
    if (!reason.trim()) {
      alert('Alasan pembatalan wajib diisi.');
      return;
    }
    try {
      const res = await leaveApi.cancelAdmin(id, reason);
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? res.data : r));
        loadPossibleReturns();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal membatalkan pengajuan.');
    } finally {
      setCancelModal(null);
      setCancellationReason('');
    }
  };

  const handleEditAdmin = async (id: number, startDate: string, endDate: string, note: string) => {
    if (!startDate || !endDate) {
      alert('Tanggal mulai dan tanggal selesai wajib diisi.');
      return;
    }
    if (endDate < startDate) {
      alert('Tanggal selesai harus sama atau setelah tanggal mulai.');
      return;
    }
    try {
      const res = await leaveApi.editAdmin(id, startDate, endDate, note);
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? res.data : r));
        loadPossibleReturns();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memperbarui pengajuan cuti.');
    } finally {
      setEditModal(null);
      setEditStartDate('');
      setEditEndDate('');
      setEditAdminNote('');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const hasProcessed = requests.some(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled');

  const handleDeleteIndividual = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengajuan cuti ini?')) return;
    try {
      const res = await leaveApi.delete(id);
      if (res.success) {
        setRequests(prev => prev.filter(r => r.id !== id));
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus pengajuan.');
    }
  };

  const handleDeleteAllProcessed = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus SEMUA pengajuan cuti lama (yang sudah Disetujui/Ditolak/Dibatalkan)? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      const res = await leaveApi.deleteAllProcessed();
      if (res.success) {
        setRequests(prev => prev.filter(r => r.status === 'pending'));
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus pengajuan lama.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Pengajuan Cuti & Sakit</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Kelola permintaan cuti, sakit, dan cuti khusus karyawan</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowAddLeaveModal(true);
              loadEmployees();
              loadSpecialCategories();
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16A34A] text-white rounded-xl text-[12px] font-semibold hover:bg-[#0d9240] transition-all shadow-sm shadow-green-200"
          >
            + Catat Cuti Pegawai
          </button>
          {pending > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
              <Clock size={14} className="text-amber-600" />
              <span className="text-[12px] font-semibold text-amber-700">{pending} pengajuan</span>
            </div>
          )}
        </div>
      </div>

      {/* Catatan Pengingat Tetap (Banner) */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl">
        <AlertCircle size={18} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-green-800 leading-normal font-medium space-y-1">
          <p className="font-bold">Informasi Alur Persetujuan Cuti & Sakit:</p>
          <ul className="list-disc list-inside space-y-0.5 text-green-755 font-medium">
            <li><strong>Draf (Belum di-ACC PJ):</strong> Cuti/sakit baru diajukan pegawai, menunggu persetujuan PJ Bagian (Kepala Departemen).</li>
            <li><strong>Menunggu (ACC PJ Bagian):</strong> Cuti/sakit telah disetujui PJ Bagian dan menunggu persetujuan final Anda (Admin).</li>
            <li>Admin dapat langsung memproses/menyetujui status <strong>Draf</strong> jika diperlukan (misal untuk departemen tanpa PJ).</li>
          </ul>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'Draf',       label: 'Draf (Belum di-ACC PJ)', value: drafts, color: '#D97706', bg: '#FEF3C7', icon: Clock },
          { key: 'Menunggu',   label: 'Menunggu Persetujuan', value: pending, color: '#16A34A', bg: '#F0FDF4', icon: Clock },
          { key: 'Disetujui',  label: 'Cuti Disetujui',       value: approvedCount, color: '#15803d', bg: '#DCFCE7', icon: CheckCircle2 },
          { key: 'Ditolak',    label: 'Cuti Ditolak',         value: rejectedCount, color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
          { key: 'Semua',      label: 'Total Pengajuan Cuti', value: totalCount,    color: '#2563EB', bg: '#EFF6FF', icon: FileText, isTotal: true },
        ].map((s) => {
          const isActive = filter === s.key;
          return (
            <div 
              key={s.key} 
              onClick={() => setFilter(s.key)}
              className={`bg-white rounded-2xl border p-4 text-left cursor-pointer transition-all hover:shadow-md ${
                isActive 
                  ? 'border-2 shadow-md ring-4 scale-[1.02]' 
                  : 'border-gray-100 shadow-sm'
              }`}
              style={{ 
                borderLeft: `4px solid ${s.color}`,
                borderColor: isActive ? s.color : undefined,
                boxShadow: isActive ? `0 4px 6px -1px ${s.color}15, 0 2px 4px -1px ${s.color}10` : undefined
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[22px] font-bold text-black">{s.value}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-[11px] font-semibold text-gray-500 mt-1.5">{s.label}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Klik untuk memfilter</p>
            </div>
          );
        })}
      </div>

      {/* Panel Kemungkinan Kembali Lebih Awal */}
      {possibleReturns.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600 animate-pulse" />
            <h3 className="text-[13px] font-bold text-amber-800">Deteksi Kemungkinan Kembali Lebih Awal</h3>
          </div>
          <p className="text-[11px] text-amber-700">
            Berikut adalah daftar karyawan dengan status cuti disetujui, namun sistem mendeteksi adanya check-in kehadiran di salah satu hari dalam rentang cuti tersebut.
          </p>
          <div className="grid gap-3">
            {possibleReturns.map(({ leave_request, detected_dates }) => {
              const typeKey = leave_request.type as LeaveType;
              const tc = typeConfig[typeKey] || typeConfig.cuti;
              return (
                <div key={leave_request.id} className="bg-white/80 backdrop-blur-sm border border-amber-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{leave_request.employee.name} ({leave_request.employee.department})</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Jenis: <span className="font-semibold text-gray-755">{tc.label}</span> · Rentang: <span className="font-semibold text-gray-755">{formatDate(leave_request.start_date)} s/d {formatDate(leave_request.end_date)}</span>
                    </p>
                    <p className="text-[10px] text-red-600 font-bold mt-1">
                      Terdeteksi masuk/absen pada tanggal: {detected_dates.map(formatDate).join(', ')}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditModal({ 
                        id: leave_request.id, 
                        name: leave_request.employee.name, 
                        startDate: leave_request.start_date, 
                        endDate: leave_request.effective_end_date || leave_request.end_date,
                        adminNote: leave_request.admin_note || ''
                      });
                      setEditStartDate(leave_request.start_date);
                      setEditEndDate(leave_request.effective_end_date || leave_request.end_date);
                      setEditAdminNote(leave_request.admin_note || '');
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-semibold transition-all shadow-sm active:scale-95 border border-amber-600 cursor-pointer"
                  >
                    Edit / Sesuaikan Cuti
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Wadah Filter Terpadu ──────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm space-y-3">
        <MonthYearDeptFilter
          month={filterMonth}
          year={filterYear}
          deptId={departmentId}
          departments={departments}
          showAllMonthsOption={true}
          embedded={true}
          onMonthChange={(m) => {
            setFilterMonth(m);
            if (m > 0) {
              const mm = String(m).padStart(2, '0');
              const lastDay = new Date(filterYear, m, 0).getDate();
              setDateFrom(`${filterYear}-${mm}-01`);
              setDateTo(`${filterYear}-${mm}-${String(lastDay).padStart(2, '0')}`);
            } else {
              setDateFrom('');
              setDateTo('');
            }
          }}
          onYearChange={(y) => {
            setFilterYear(y);
            if (filterMonth > 0) {
              const mm = String(filterMonth).padStart(2, '0');
              const lastDay = new Date(y, filterMonth, 0).getDate();
              setDateFrom(`${y}-${mm}-01`);
              setDateTo(`${y}-${mm}-${String(lastDay).padStart(2, '0')}`);
            }
          }}
          onDeptChange={setDepartmentId}
        />

        {/* Date & Filter Row */}
        <div className="flex flex-wrap gap-3 items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3 bg-slate-50/70 px-3 py-1.5 rounded-xl border border-gray-100 shadow-2xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-[12px] font-semibold text-gray-770 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
          <span className="text-[11.5px] text-gray-400 font-semibold">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-[12px] font-semibold text-gray-770 bg-transparent focus:outline-none cursor-pointer"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center flex-1 md:flex-initial">
          {/* Tipe Cuti Filter */}
          <div className="relative w-full md:w-auto">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-100 rounded-xl text-[12px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all text-gray-600 font-semibold cursor-pointer"
            >
              <option value="all">Semua Tipe Cuti</option>
              <option value="cuti">Cuti Tahunan</option>
              <option value="sakit">Izin Sakit</option>
              <option value="izin">Izin</option>
              <option value="cuti_khusus">Cuti Khusus</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau NIK KTP..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-100 rounded-xl text-[12px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300 font-medium"
            />
            {searchVal && (
              <button
                onClick={() => setSearchVal('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

      {hasProcessed && (
        <div className="flex justify-end">
          <button onClick={handleDeleteAllProcessed}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-50 border border-red-100 hover:bg-red-100 text-red-650 rounded-xl text-[12px] font-semibold transition-all shadow-sm active:scale-95">
            <Trash2 size={13} className="text-red-500" /> Hapus Semua Cuti Lama
          </button>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-5 text-gray-400 text-[12px]">Memuat pengajuan cuti...</div>
        )}
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <FileText size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[13px] text-gray-400">Tidak ada pengajuan ditemukan</p>
          </div>
        )}
        {filtered.map(req => {
          const typeKey = req.type as LeaveType;
          const tc = typeConfig[typeKey] || typeConfig.cuti;
          const isDraft = req.pj_status === 'pending' && req.status === 'pending';
          const sc = (isDraft 
            ? { label: 'Draf', color: '#D97706', bg: '#FEF3C7' }
            : statusConfig[req.status as LeaveStatus]) || { label: req.status, color: '#6B7280', bg: '#F3F4F6' };
          
          const effectiveEnd = req.effective_end_date || req.end_date;
          const isPast = effectiveEnd < todayStr;
          const showShorten = req.days > 1 && !isPast;
          const showCancel = !isPast;

          return (
            <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${req.status === 'pending' ? 'border-amber-200' : 'border-gray-100'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc.bg, border: `1.5px solid ${tc.border}` }}>
                      <span className="text-[13px] font-bold" style={{ color: tc.color }}>
                        {req.type === 'cuti' ? 'C' : req.type === 'sakit' ? 'S' : 'CK'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-[14px] font-semibold text-gray-900">{req.employee?.name}</p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: tc.color, background: tc.bg }}>
                          {req.type === 'cuti_khusus' && req.special_leave_category
                            ? `Cuti Khusus (${req.special_leave_category.name}${req.special_leave_category_other ? ` - ${req.special_leave_category_other}` : ''})`
                            : tc.label}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                        {req.pj_status === 'pending' && req.status === 'pending' && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            ⚠️ Belum di-ACC PJ Bagian
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-gray-500 mb-1">{req.employee?.department || 'Karyawan'}</p>
                      {req.employee?.quota_info && (
                        <div className="flex items-center gap-2 my-1.5 px-2.5 py-1 bg-emerald-50/90 border border-emerald-200 rounded-xl text-[11px] font-semibold w-fit shadow-2xs">
                          <span className="text-emerald-800">📊 Akumulasi Cuti Disetujui: <strong>{req.employee.quota_info.used}</strong> / {req.employee.quota_info.quota} hari</span>
                          <span className="text-emerald-300">•</span>
                          <span className="text-emerald-700">Sisa Kuota: <strong>{req.employee.quota_info.remaining}</strong> hari</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-[12px] text-gray-600 font-medium">
                            {formatDate(req.start_date)}{req.actual_end_date ? ` – ${formatDate(req.actual_end_date)}` : (req.days > 1 ? ` – ${formatDate(req.end_date)}` : '')} ({req.days} hari efektif)
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400">Diajukan: {formatDate(req.created_at)}</span>
                        {req.actual_end_date && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Dipersingkat: selesai {formatDate(req.actual_end_date)} (semula {formatDate(req.end_date)})
                          </span>
                        )}
                      </div>
                      <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2 space-y-1">
                        <p className="text-[12px] text-gray-600 italic">"{req.reason}"</p>
                        {req.substitute_name && (
                          <p className="text-[11px] text-gray-500 font-medium pt-1 border-t border-gray-100">
                            👥 Rekan Kerja Pengganti: <span className="font-bold text-gray-800">{req.substitute_name}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {req.attachment_url && (
                          <a 
                            href={req.attachment_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] hover:text-[#0d9240] bg-green-50/70 hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-100 transition-all"
                          >
                            <Paperclip size={11} className="flex-shrink-0" />
                            Lihat Dokumen Pendukung
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedLeaveForPrint(req)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50/70 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-100 transition-all cursor-pointer font-medium"
                        >
                          <FileText size={11} className="flex-shrink-0" />
                          {req.status === 'approved' ? 'Lihat Form Cuti & QR Code' : 'Lihat Dokumen Form Cuti'}
                        </button>
                      </div>

                      {/* Info Persetujuan PJ Bagian */}
                      {req.pj_status === 'approved' && (
                        <div className="mt-2 rounded-xl px-3 py-2 border border-green-100 bg-green-50/30 text-[11px]">
                          <p className="font-semibold text-green-800">
                            Disetujui PJ Bagian: <span className="font-normal text-gray-700">{req.pj_reviewer?.name || 'PJ Bagian'}</span>
                          </p>
                          {req.pj_note && <p className="text-gray-500 italic mt-0.5">Catatan PJ: "{req.pj_note}"</p>}
                        </div>
                      )}

                      {req.pj_status === 'rejected' && (
                        <div className="mt-2 rounded-xl px-3 py-2 border border-red-100 bg-red-50/35 text-[11px]">
                          <p className="font-semibold text-red-800">
                            Ditolak PJ Bagian: <span className="font-normal text-gray-700">{req.pj_reviewer?.name || 'PJ Bagian'}</span>
                          </p>
                          {req.pj_note && <p className="text-gray-500 italic mt-0.5">Catatan PJ: "{req.pj_note}"</p>}
                        </div>
                      )}

                      {req.admin_note && (
                        <div className={`mt-2 rounded-xl px-3 py-2 border ${req.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                          <p className="text-[11px] font-medium text-gray-600">Catatan admin: <span className={req.status === 'approved' ? 'text-green-700' : 'text-red-600'}>{req.admin_note}</span></p>
                        </div>
                      )}
                      {req.status === 'cancelled' && req.cancellation_reason && (
                        <div className="mt-2 rounded-xl px-3 py-2 border bg-gray-50 border-gray-200">
                          <p className="text-[11px] font-medium text-gray-655">Alasan pembatalan: <span className="text-gray-800 font-semibold">{req.cancellation_reason}</span></p>
                        </div>
                      )}
                      {req.actual_end_date && req.shortened_reason && (
                        <div className="mt-2 rounded-xl px-3 py-2 border bg-amber-50 border-amber-100">
                          <p className="text-[11px] font-medium text-amber-800">Alasan dipersingkat: <span className="text-amber-900 font-semibold">{req.shortened_reason}</span></p>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      {req.pj_status === 'pending' && (
                        <div className="rounded-xl px-3 py-2 border border-amber-200 bg-amber-50 text-[10.5px] text-amber-800 font-semibold max-w-[200px] leading-normal w-full mb-1">
                          ⚠️ Belum di-ACC PJ Bagian.
                        </div>
                      )}
                      <button onClick={() => setConfirmModal({ id: req.id, action: 'approve', name: req.employee.name })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm shadow-green-200 cursor-pointer">
                        <CheckCircle2 size={13} /> Setujui
                      </button>
                      <button 
                        onClick={() => {
                          setEditModal({
                            id: req.id,
                            name: req.employee.name,
                            startDate: req.start_date,
                            endDate: req.effective_end_date || req.end_date,
                            adminNote: req.admin_note || ''
                          });
                          setEditStartDate(req.start_date);
                          setEditEndDate(req.effective_end_date || req.end_date);
                          setEditAdminNote(req.admin_note || '');
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[12px] font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button onClick={() => setConfirmModal({ id: req.id, action: 'reject', name: req.employee.name })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 border border-red-100 text-red-650 hover:bg-red-100 rounded-xl text-[12px] font-semibold transition-all cursor-pointer">
                        <XCircle size={13} /> Tolak
                      </button>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      <button 
                        onClick={() => {
                          setEditModal({
                            id: req.id,
                            name: req.employee.name,
                            startDate: req.start_date,
                            endDate: req.effective_end_date || req.end_date,
                            adminNote: req.admin_note || ''
                          });
                          setEditStartDate(req.start_date);
                          setEditEndDate(req.effective_end_date || req.end_date);
                          setEditAdminNote(req.admin_note || '');
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button 
                        onClick={() => setCancelModal({ id: req.id, name: req.employee.name })}
                        className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 rounded-xl text-[11px] font-semibold transition-all shadow-sm cursor-pointer font-bold"
                      >
                        Batalkan
                      </button>
                      <button onClick={() => handleDeleteIndividual(req.id)}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center border border-gray-100 transition-colors cursor-pointer"
                        title="Hapus Pengajuan">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {(req.status === 'rejected' || req.status === 'cancelled') && (
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      <button onClick={() => setConfirmModal({ id: req.id, action: 'approve', name: req.employee.name })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[11px] font-semibold transition-all shadow-sm shadow-green-200 cursor-pointer">
                        <CheckCircle2 size={13} /> Setujui Kembali
                      </button>
                      <button 
                        onClick={() => {
                          setEditModal({
                            id: req.id,
                            name: req.employee.name,
                            startDate: req.start_date,
                            endDate: req.effective_end_date || req.end_date,
                            adminNote: req.admin_note || ''
                          });
                          setEditStartDate(req.start_date);
                          setEditEndDate(req.effective_end_date || req.end_date);
                          setEditAdminNote(req.admin_note || '');
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button onClick={() => handleDeleteIndividual(req.id)}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center border border-gray-100 transition-colors cursor-pointer"
                        title="Hapus Pengajuan">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal (Approve/Reject) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setConfirmModal(null); setAdminNote(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${confirmModal.action === 'approve' ? 'bg-green-50' : 'bg-red-50'}`}>
              {confirmModal.action === 'approve'
                ? <CheckCircle2 size={24} className="text-[#16A34A]" />
                : <XCircle size={24} className="text-red-500" />}
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 text-center mb-1">
              {confirmModal.action === 'approve' ? 'Setujui Pengajuan?' : 'Tolak Pengajuan?'}
            </h3>
            <p className="text-[12px] text-gray-500 text-center mb-4">
              Pengajuan dari <strong>{confirmModal.name}</strong> akan {confirmModal.action === 'approve' ? 'disetujui' : 'ditolak'}.
            </p>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Catatan Admin / Keterangan</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                placeholder="Masukkan catatan/alasan..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmModal(null); setAdminNote(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={() => handleAction(confirmModal.id, confirmModal.action, adminNote)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all ${confirmModal.action === 'approve' ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-650'}`}>
                {confirmModal.action === 'approve' ? 'Ya, Setujui' : 'Ya, Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setCancelModal(null); setCancellationReason(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <XCircle size={24} className="text-red-500" />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 text-center mb-1">
              Batalkan Pengajuan Cuti?
            </h3>
            <p className="text-[12px] text-gray-500 text-center mb-4">
              Anda akan membatalkan pengajuan cuti dari <strong>{cancelModal.name}</strong>. Tindakan ini akan mengembalikan kuota cuti karyawan secara otomatis.
            </p>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Alasan Pembatalan (Wajib)</label>
              <textarea 
                value={cancellationReason} 
                onChange={e => setCancellationReason(e.target.value)} 
                rows={2}
                placeholder="Masukkan alasan pembatalan..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" 
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setCancelModal(null); setCancellationReason(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={() => handleCancelAdmin(cancelModal.id, cancellationReason)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-all">
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Penyesuaian Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setEditModal(null); setEditStartDate(''); setEditEndDate(''); setEditAdminNote(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <Edit3 size={22} className="text-amber-600" />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">
              Edit Pengajuan Cuti / Sakit
            </h3>
            <p className="text-[11.5px] text-gray-500 text-center mb-4 leading-relaxed">
              Koreksi kesalahan tanggal atau sesuaikan durasi (persingkat / perpanjang) untuk <strong>{editModal.name}</strong>.
            </p>
            <div className="space-y-3.5 mb-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1">Tanggal Mulai Baru</label>
                <input 
                  type="date"
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold text-gray-800"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1">Tanggal Selesai Baru</label>
                <input 
                  type="date"
                  value={editEndDate}
                  min={editStartDate}
                  onChange={e => setEditEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold text-gray-800"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1">Catatan Admin / Alasan Perubahan</label>
                <textarea 
                  value={editAdminNote} 
                  onChange={e => setEditAdminNote(e.target.value)} 
                  rows={2}
                  placeholder="Misal: Perbaikan kesalahan tanggal, perpanjangan masa cuti, persingkat cuti, dll..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none font-medium text-gray-800" 
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setEditModal(null); setEditStartDate(''); setEditEndDate(''); setEditAdminNote(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                onClick={() => handleEditAdmin(editModal.id, editStartDate, editEndDate, editAdminNote)}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white bg-[#16A34A] hover:bg-[#0d9240] transition-all shadow-sm cursor-pointer"
              >
                Simpan Edit
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── PRINT LEAVE FORM MODAL ───────────────────────────────────────────── */}
      {selectedLeaveForPrint && (
        <LeaveFormPrintModal
          request={selectedLeaveForPrint}
          onClose={() => setSelectedLeaveForPrint(null)}
        />
      )}

      {/* ─── ADD LEAVE ON BEHALF MODAL ─────────────────────────────────────────── */}
      {showAddLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowAddLeaveModal(false); setAddLeaveError(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <h3 className="text-[14px] font-bold text-gray-900">Catat Cuti Historis Pegawai</h3>
              <button onClick={() => { setShowAddLeaveModal(false); setAddLeaveError(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            
            {addLeaveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-[11px]">
                {addLeaveError}
              </div>
            )}
            
            <form onSubmit={handleAddLeaveSubmit} className="space-y-4">
              <SearchableEmployeeSelect
                employees={employeesList}
                selectedId={selectedEmployeeId}
                onSelect={setSelectedEmployeeId}
                loading={loadingEmployees}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Jenis Cuti</label>
                  <select
                    value={leaveType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setLeaveType(val);
                      if (val !== 'cuti_khusus') {
                        setSelectedCategory('');
                        setCustomCategoryOther('');
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all cursor-pointer font-semibold"
                  >
                    <option value="cuti">Cuti Tahunan</option>
                    <option value="sakit">Sakit</option>
                    <option value="cuti_khusus">Cuti Khusus</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Alasan/Keterangan</label>
                  <input
                    type="text"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Sakit, NIKAH, Cuti mudik, dll."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
              </div>

              {/* Input Kategori Cuti Khusus */}
              {leaveType === 'cuti_khusus' && (
                <div className="space-y-3 p-3.5 bg-orange-50/80 border border-orange-200 rounded-xl">
                  <div>
                    <label className="block text-[12px] font-bold text-orange-900 mb-1">
                      Kategori Cuti Khusus <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-orange-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-orange-500 font-semibold text-gray-800 cursor-pointer"
                    >
                      <option value="">-- Pilih Kategori Cuti Khusus --</option>
                      {specialCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCategory && (() => {
                    const cat = specialCategories.find(c => String(c.id) === selectedCategory);
                    const catName = (cat?.name || '').toLowerCase();
                    const needsOther = catName === 'lainnya' || catName.includes('sakit');
                    if (!needsOther) return null;
                    return (
                      <div>
                        <label className="block text-[12px] font-bold text-orange-900 mb-1">
                          Detail / Keterangan Lainnya <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={customCategoryOther}
                          onChange={(e) => setCustomCategoryOther(e.target.value)}
                          placeholder="Masukkan rincian keterangan cuti khusus..."
                          className="w-full px-3 py-2 border border-orange-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    );
                  })()}

                  <p className="text-[11px] text-orange-800 font-semibold">
                    💡 <strong>Info:</strong> Cuti Khusus <u>TIDAK memotong</u> kuota cuti tahunan pegawai.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Tanggal Mulai</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Tanggal Selesai</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowAddLeaveModal(false); setAddLeaveError(''); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAddLeave}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-[#16A34A] hover:bg-[#0d9240] transition-all disabled:opacity-50"
                >
                  {submittingAddLeave 
                    ? 'Menyimpan...' 
                    : (leaveType === 'cuti' ? 'Catat & Kurangi Kuota' : 'Catat (Tanpa Potong Kuota)')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
