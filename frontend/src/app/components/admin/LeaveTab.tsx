import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, Trash2, Paperclip, AlertCircle, Calendar, ChevronDown, Search, X, Printer } from 'lucide-react';
import { leaveApi, LeaveRequest, departmentApi, DepartmentModel } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';
import { LeaveFormPrintModal } from '../ui/LeaveFormPrintModal';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

type LeaveType = 'cuti' | 'sakit' | 'cuti_khusus';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'draft';

const typeConfig: Record<LeaveType, { label: string; color: string; bg: string; border: string }> = {
  cuti:        { label: 'Cuti Tahunan', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  sakit:       { label: 'Sakit',        color: '#92400E', bg: '#FEF3C7', border: '#D97706' },
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
 * Komponen Tab Cuti Admin (LeaveTab) — Sistem Absensi RSUCL
 * 
 * Digunakan oleh Administrator untuk meninjau, menyetujui, atau menolak permohonan
 * cuti, izin, dan sakit yang diajukan oleh karyawan. Administrator juga dapat mempersingkat,
 * membatalkan pengajuan yang sudah disetujui, serta mendeteksi pegawai yang kembali masuk lebih awal.
 */
export function LeaveTab({ onUpdateCount }: LeaveTabProps) {
  const getLocalDateString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
  };
  const todayStr = getLocalDateString();

  const getMonthBoundaries = () => {
    const date = new Date();
    const y = date.getFullYear();
    const m = date.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    
    const tzoffset = date.getTimezoneOffset() * 60000;
    const firstStr = new Date(firstDay.getTime() - tzoffset).toISOString().slice(0, 10);
    const lastStr = new Date(lastDay.getTime() - tzoffset).toISOString().slice(0, 10);
    
    return { firstStr, lastStr };
  };

  const { firstStr, lastStr } = getMonthBoundaries();

  // Filters State (default dateFrom/dateTo to empty so future leave requests are not hidden)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);

  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());

  // Daftar lengkap seluruh pengajuan cuti masuk
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  
  // Filter status aktif (default 'Semua' agar admin melihat seluruh data yang baru diisi)
  const [filter, setFilter] = useState('Semua');
  
  // Filter kategori tipe cuti ('all', 'cuti', 'izin', 'sakit')
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Menyimpan data dialog konfirmasi permohonan
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'approve' | 'reject'; name: string } | null>(null);
  
  // Modals untuk pembatalan dan perpendekan masa cuti oleh admin
  const [cancelModal, setCancelModal] = useState<{ id: number; name: string } | null>(null);
  const [shortenModal, setShortenModal] = useState<{ id: number; name: string; startDate: string; endDate: string } | null>(null);

  // Form states untuk input di modal cancel/shorten
  const [cancellationReason, setCancellationReason] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [shortenedReason, setShortenedReason] = useState('');

  // Deteksi kemungkinan kembali lebih awal
  const [possibleReturns, setPossibleReturns] = useState<Array<{ leave_request: LeaveRequest; detected_dates: string[] }>>([]);

  const [selectedLeaveForPrint, setSelectedLeaveForPrint] = useState<LeaveRequest | null>(null);
  const { logoUrl } = useAuth();

  // Catatan persetujuan/penolakan dari administrator
  const [adminNote, setAdminNote] = useState('');
  
  // Indikator loading request
  const [loading, setLoading] = useState(false);

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
    const typeKey = (r.type === 'izin' ? 'cuti' : r.type);
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

  const handleShortenAdmin = async (id: number, actualEnd: string, reason: string) => {
    if (!actualEnd) {
      alert('Tanggal efektif selesai wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      alert('Alasan mempersingkat wajib diisi.');
      return;
    }
    try {
      const res = await leaveApi.shortenAdmin(id, actualEnd, reason);
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? res.data : r));
        loadPossibleReturns();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal mempersingkat pengajuan.');
    } finally {
      setShortenModal(null);
      setActualEndDate('');
      setShortenedReason('');
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
        {pending > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
            <Clock size={14} className="text-amber-600" />
            <span className="text-[12px] font-semibold text-amber-700">{pending} pengajuan menunggu persetujuan</span>
          </div>
        )}
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
              const typeKey = (leave_request.type === 'izin' ? 'cuti' : leave_request.type) as LeaveType;
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
                    onClick={() => setShortenModal({ 
                      id: leave_request.id, 
                      name: leave_request.employee.name, 
                      startDate: leave_request.start_date, 
                      endDate: leave_request.end_date 
                    })}
                    className="px-3.5 py-2 bg-amber-605 hover:bg-amber-700 text-white rounded-xl text-[11px] font-semibold transition-all shadow-sm active:scale-95 border border-amber-600"
                  >
                    Persingkat Cuti Resmi
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
              <option value="sakit">Sakit</option>
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
          const typeKey = (req.type === 'izin' ? 'cuti' : req.type) as LeaveType;
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
                            ? `Cuti Khusus (${req.special_leave_category.name})`
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
                  {req.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {req.pj_status === 'pending' && (
                        <div className="rounded-xl px-3 py-2 border border-amber-200 bg-amber-50 text-[10.5px] text-amber-800 font-semibold max-w-[200px] leading-normal">
                          ⚠️ Belum di-ACC PJ Bagian.
                        </div>
                      )}
                      <button onClick={() => setConfirmModal({ id: req.id, action: 'approve', name: req.employee.name })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm shadow-green-200">
                        <CheckCircle2 size={13} /> Setujui
                      </button>
                      <button onClick={() => setConfirmModal({ id: req.id, action: 'reject', name: req.employee.name })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 border border-red-100 text-red-650 hover:bg-red-100 rounded-xl text-[12px] font-semibold transition-all">
                        <XCircle size={13} /> Tolak
                      </button>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="flex flex-col md:flex-row items-center gap-2 flex-shrink-0">
                      {showShorten && (
                        <button 
                          onClick={() => setShortenModal({ id: req.id, name: req.employee.name, startDate: req.start_date, endDate: req.end_date })}
                          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-semibold transition-all shadow-sm"
                        >
                          Persingkat
                        </button>
                      )}
                      {showCancel && (
                        <button 
                          onClick={() => setCancelModal({ id: req.id, name: req.employee.name })}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 rounded-xl text-[11px] font-semibold transition-all shadow-sm"
                        >
                          Batalkan
                        </button>
                      )}
                      <button onClick={() => handleDeleteIndividual(req.id)}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center border border-gray-100 transition-colors"
                        title="Hapus Pengajuan">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {(req.status === 'rejected' || req.status === 'cancelled') && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                        <XCircle size={16} className="text-red-500" />
                      </div>
                      <button onClick={() => handleDeleteIndividual(req.id)}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center border border-gray-100 transition-colors"
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

      {/* Shorten Modal */}
      {shortenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setShortenModal(null); setActualEndDate(''); setShortenedReason(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Clock size={24} className="text-amber-600" />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 text-center mb-1">
              Persingkat Masa Cuti?
            </h3>
            <p className="text-[12px] text-gray-500 text-center mb-4">
              Persingkat pengajuan dari <strong>{shortenModal.name}</strong>. Tanggal mulai asli: {formatDate(shortenModal.startDate)}.
            </p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Tanggal Efektif Selesai Baru</label>
                <input 
                  type="date"
                  value={actualEndDate}
                  onChange={e => setActualEndDate(e.target.value)}
                  min={shortenModal.startDate}
                  max={shortenModal.endDate}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold text-gray-800"
                />
                <p className="text-[10px] text-gray-400 mt-1">Harus di antara tanggal mulai dan sebelum selesai semula ({formatDate(shortenModal.endDate)}).</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Alasan Mempersingkat (Wajib)</label>
                <textarea 
                  value={shortenedReason} 
                  onChange={e => setShortenedReason(e.target.value)} 
                  rows={2}
                  placeholder="Masukkan alasan memperpendek durasi..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" 
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShortenModal(null); setActualEndDate(''); setShortenedReason(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={() => handleShortenAdmin(shortenModal.id, actualEndDate, shortenedReason)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-all">
                Simpan Penyesuaian
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
    </div>
  );
}
