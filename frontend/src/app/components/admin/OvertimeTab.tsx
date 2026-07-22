import { useState, useEffect } from 'react';
import { Search, Calendar, ChevronDown, CheckCircle2, XCircle, Clock, X, Filter, AlertCircle, Printer } from 'lucide-react';
import { overtimeApi, departmentApi, OvertimeRequest, DepartmentModel } from '../../../services/api';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';
import qrCodeImg from '../../../imports/qr_code_cempaka_lima.png';
import qrHrdImg from '../../../imports/qr_hrd_rsucl.png';

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: 'Menunggu',   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  approved: { label: 'Disetujui',  color: '#15803d', bg: '#DCFCE7', border: '#A7F3D0' },
  rejected: { label: 'Ditolak',    color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
};

interface OvertimeTabProps {
  onUpdateCount?: () => void;
}

export function OvertimeTab({ onUpdateCount }: OvertimeTabProps) {
  // Ambil tanggal awal & akhir bulan ini untuk default filter
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

  // Filters State
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all' | 'draft'>('pending');
  const [dateFrom, setDateFrom] = useState(firstStr);
  const [dateTo, setDateTo] = useState(lastStr);
  const [departmentId, setDepartmentId] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');

  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());

  // Data State
  const [records, setRecords] = useState<OvertimeRequest[]>([]);
  const [summary, setSummary] = useState({
    pending: 0,
    draft: 0,
    approved: 0,
    rejected: 0,
    total_minutes: 0,
    total_hours: 0,
  });
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Rejection Modal State
  const [rejectingRecord, setRejectingRecord] = useState<OvertimeRequest | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);
  const [selectedSplRecord, setSelectedSplRecord] = useState<OvertimeRequest | null>(null);

  // Load departments on mount
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

  // Debounce search value
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchVal]);

  // Reset page when other filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo, departmentId]);

  // Fetch Summary Counts
  const loadSummary = async () => {
    try {
      const res = await overtimeApi.overtimesSummary({
        date_from: dateFrom,
        date_to: dateTo,
        department_id: departmentId || undefined,
        search: search || undefined,
      });
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Overtime Records
  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await overtimeApi.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        date_from: dateFrom,
        date_to: dateTo,
        department_id: departmentId || undefined,
        search: search || undefined,
        page,
        per_page: 20,
      });
      if (res.success) {
        setRecords(res.data);
        if (res.meta) {
          setTotalPages(res.meta.last_page);
          setTotalRecords(res.meta.total);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load summary and records whenever filters / page changes
  useEffect(() => {
    loadSummary();
    loadRecords();
  }, [statusFilter, dateFrom, dateTo, departmentId, search, page]);

  // Handle Approval Action
  const handleApprove = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menyetujui pengajuan lembur ini?')) return;
    setProcessingId(id);
    try {
      const res = await overtimeApi.approve(id);
      if (res.success) {
        if (statusFilter === 'pending' || statusFilter === 'draft') {
          setRecords(prev => prev.filter(r => r.id !== id));
        } else {
          setRecords(prev => prev.map(r => r.id === id ? res.data : r));
        }
        loadSummary();
        onUpdateCount?.();
      }
    } catch (err: any) {
      alert(err?.data?.message ?? err?.message ?? 'Gagal menyetujui lembur.');
    } finally {
      setProcessingId(null);
    }
  };

  // Open Rejection Dialog Modal
  const openRejectionModal = (record: OvertimeRequest) => {
    setRejectingRecord(record);
    setRejectionNote('');
  };

  // Handle Rejection Submit
  const handleRejectSubmit = async () => {
    if (!rejectingRecord?.id) return;
    if (!rejectionNote.trim()) {
      alert('Alasan penolakan wajib diisi.');
      return;
    }
    setSubmittingRejection(true);
    try {
      const res = await overtimeApi.reject(rejectingRecord.id, rejectionNote);
      if (res.success) {
        if (statusFilter === 'pending' || statusFilter === 'draft') {
          setRecords(prev => prev.filter(r => r.id !== rejectingRecord.id));
        } else {
          setRecords(prev => prev.map(r => r.id === rejectingRecord.id ? res.data : r));
        }
        setRejectingRecord(null);
        loadSummary();
        onUpdateCount?.();
      }
    } catch (err: any) {
      alert(err?.data?.message ?? err?.message ?? 'Gagal menolak lembur.');
    } finally {
      setSubmittingRejection(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h2 className="text-[16px] font-bold text-gray-900">Persetujuan & Manajemen Lembur</h2>
        <p className="text-[12px] text-gray-400 mt-0.5">Kelola dan verifikasi pengajuan lembur resmi staf RSUCL</p>
      </div>

      {/* Catatan Pengingat Tetap (Banner) */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-100 rounded-2xl">
        <AlertCircle size={18} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-green-800 leading-normal font-medium">
          Pastikan jam check-in dan check-out pegawai sesuai dengan waktu sebenarnya saat berada di rumah sakit sebelum menyetujui pengajuan lembur.
        </p>
      </div>

      {/* ── Month, Year & Department Filter ──────────────────────── */}
      <MonthYearDeptFilter
        month={filterMonth}
        year={filterYear}
        deptId={departmentId}
        departments={departments}
        showAllMonthsOption={true}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'draft',    label: 'Draf (Belum di-ACC PJ)', value: summary.draft, color: '#D97706', bg: '#FEF3C7', icon: Clock },
          { key: 'pending',  label: 'Menunggu Persetujuan', value: summary.pending, color: '#16A34A', bg: '#F0FDF4', icon: Clock },
          { key: 'approved', label: 'Lembur Disetujui',      value: summary.approved, color: '#15803d', bg: '#DCFCE7', icon: CheckCircle2 },
          { key: 'rejected', label: 'Lembur Ditolak',       value: summary.rejected, color: '#475569', bg: '#F1F5F9', icon: XCircle },
          { key: 'hours',    label: 'Total Jam Lembur Sah',  value: `${summary.total_hours} jam`, color: '#16A34A', bg: '#F0FDF4', icon: Clock, isTotal: true },
        ].map((s) => {
          const isActive = statusFilter === s.key || (s.isTotal && statusFilter === 'all');
          return (
            <div 
              key={s.key} 
              onClick={() => {
                if (s.isTotal) {
                  setStatusFilter('all');
                } else {
                  setStatusFilter(s.key as any);
                }
              }}
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

      {/* Date & Filter Row */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-[12px] font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
          <span className="text-[11.5px] text-gray-400 font-semibold">s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-[12px] font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center flex-1 md:flex-initial">

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

      {/* Main Grid List of Cards */}
      <div className="space-y-4">
        {loading && records.length === 0 && (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="animate-pulse bg-white border border-gray-100 rounded-2xl p-5 h-48"></div>
          ))
        )}

        {!loading && records.map((r, i) => {
          const status = r.status || 'pending';
          const isDraft = r.pj_status === 'pending' && r.status === 'pending';
          const conf = isDraft 
            ? { label: 'Belum di-ACC PJ', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' }
            : statusConfig[status] || { label: status, color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
          const noCheckoutData = !r.system_checkout_data || !r.system_checkout_data.check_out || !r.system_checkout_data.is_overtime;

          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4">
              {/* Card Header: Karyawan, Departemen, Status */}
              <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-3 gap-2">
                <div>
                  <h4 className="text-[13.5px] font-bold text-gray-900">{r.employee?.name}</h4>
                  <p className="text-[10.5px] text-gray-400 font-mono mt-0.5">
                    NIK KTP: {r.employee?.nik_ktp} · {r.employee?.department || 'Umum'}
                  </p>
                </div>
                <div>
                  <span className="inline-flex items-center text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border" style={{ color: conf.color, background: conf.bg, borderColor: conf.border }}>
                    {conf.label}
                  </span>
                </div>
              </div>

              {/* Grid 2 Column: Klaim vs Sistem */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kolom 1: Klaim Karyawan */}
                <div className="space-y-3 border-r border-gray-100 pr-0 md:pr-6 text-left">
                  <h5 className="text-[11px] font-bold text-[#16A34A] uppercase tracking-wider">Klaim Pegawai</h5>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <p className="text-gray-400 text-[10px] font-semibold">Tanggal</p>
                      <p className="font-semibold text-gray-700">{formatDate(r.date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[10px] font-semibold">Unit Kerja</p>
                      <p className="font-semibold text-[#16A34A]">{r.unit_kerja || r.employee?.department || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[10px] font-semibold">Waktu Lembur</p>
                      <p className="font-semibold text-gray-700">{r.start_time || '17:00'} - {r.end_time || '19:00'} ({r.overtime_day_type === 'holiday' ? 'Libur' : 'Kerja'})</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[10px] font-semibold">Keterangan Lokasi</p>
                      <p className="font-semibold text-gray-700">{r.location_note || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] font-semibold">Tugas Lembur</p>
                    <p className="font-semibold text-gray-800 text-[12px] bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg truncate">{r.tasks || r.reason}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] font-semibold">Rincian Kegiatan (Alasan)</p>
                    <p className="text-gray-650 font-medium leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100 mt-1 max-h-24 overflow-y-auto">{r.reason}</p>
                  </div>
                  {r.photo_url && (
                    <div>
                      <p className="text-gray-400 text-[10px] font-semibold mb-1">Foto Bukti Kegiatan</p>
                      <a href={r.photo_url} target="_blank" rel="noreferrer" className="inline-block relative rounded-xl overflow-hidden border border-gray-200 h-24 w-40 shadow-sm group">
                        <img src={r.photo_url} alt="Bukti Kegiatan" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                          Perbesar Foto
                        </div>
                      </a>
                    </div>
                  )}
                </div>

                {/* Kolom 2: Pembanding Sistem */}
                <div className="space-y-3 flex flex-col justify-between text-left">
                  <div className="space-y-3">
                    <h5 className="text-[11px] font-bold text-gray-450 uppercase tracking-wider">Data Sistem (Pembanding)</h5>
                    
                    {/* Warning Indicator */}
                    {noCheckoutData ? (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] font-bold leading-normal">
                        <AlertCircle size={14} className="flex-shrink-0 text-amber-500" />
                        <span>Tidak ada data checkout lembur pada tanggal ini</span>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3 text-[12px] bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                      <div>
                        <p className="text-gray-450 text-[10px] font-semibold">Jam Check-In</p>
                        <p className="font-mono font-bold text-gray-800">{r.system_checkout_data?.check_in?.substring(0, 5) || '--'}</p>
                      </div>
                      <div>
                        <p className="text-gray-450 text-[10px] font-semibold">Jam Check-Out</p>
                        <p className="font-mono font-bold text-gray-800">{r.system_checkout_data?.check_out?.substring(0, 5) || '--'}</p>
                      </div>
                      <div className="col-span-2 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-gray-450 text-[10px] font-semibold">Deteksi Lembur Otomatis</span>
                        <span className="font-bold text-[#16A34A] bg-green-50 px-2.5 py-0.5 rounded-lg border border-green-100">
                          {r.system_checkout_data?.overtime_minutes ? `+${r.system_checkout_data.overtime_minutes} mnt` : '0 mnt'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Admin Notes */}
                  <div className="pt-3 border-t border-gray-100 space-y-3">
                    {/* Info Persetujuan PJ Bagian */}
                    {r.pj_status === 'approved' && (
                      <div className="rounded-xl px-3 py-2 border border-green-100 bg-green-50/30 text-[11px]">
                        <p className="font-semibold text-green-800">
                          Disetujui PJ Bagian: <span className="font-normal text-gray-700">{r.pj_reviewer?.name || 'PJ Bagian'}</span>
                        </p>
                        {r.pj_note && <p className="text-gray-500 italic mt-0.5">Catatan PJ: "{r.pj_note}"</p>}
                      </div>
                    )}

                    {r.pj_status === 'rejected' && (
                      <div className="rounded-xl px-3 py-2 border border-red-100 bg-red-50/35 text-[11px]">
                        <p className="font-semibold text-red-800">
                          Ditolak PJ Bagian: <span className="font-normal text-gray-700">{r.pj_reviewer?.name || 'PJ Bagian'}</span>
                        </p>
                        {r.pj_note && <p className="text-gray-500 italic mt-0.5">Catatan PJ: "{r.pj_note}"</p>}
                      </div>
                    )}

                    {isDraft && (
                      <p className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/50">
                        ⚠️ Pengajuan ini belum disetujui PJ Bagian. Anda dapat memprosesnya langsung.
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      {status === 'pending' ? (
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={() => openRejectionModal(r)}
                            disabled={processingId === r.id}
                            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[12px] transition-colors"
                          >
                            Tolak
                          </button>
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={processingId === r.id}
                            className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#15803d] text-white font-bold rounded-xl text-[12px] shadow-sm transition-all"
                          >
                            Setujui
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11.5px] text-gray-500 w-full space-y-2">
                          <p className="font-medium">
                            Diputuskan oleh Admin {r.reviewed_at ? `pada ${r.reviewed_at.substring(0, 10)}` : ''}
                          </p>
                          {r.admin_note && (
                            <p className="bg-slate-50 p-2.5 rounded-xl border border-gray-100 text-[11px] text-gray-655 font-medium">
                              <strong>Catatan Admin:</strong> {r.admin_note}
                            </p>
                          )}
                          {status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => setSelectedSplRecord(r)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl text-[11px] font-bold mt-2 transition-all w-fit cursor-pointer"
                            >
                              <Printer size={12} /> Lihat SPL & QR Code
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {records.length === 0 && !loading && (
        <div className="text-center py-10 bg-white border border-gray-100 rounded-2xl text-gray-400 text-[12.5px] shadow-sm">
          <Filter className="mx-auto mb-2 opacity-35" size={24} />
          Tidak ada data pengajuan lembur untuk filter yang dipilih.
        </div>
      )}

      {/* Pagination Footer */}
      <div className="bg-white px-5 py-3 border border-gray-100 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <p className="text-[12px] text-gray-400">Total: {totalRecords} data pengajuan lembur</p>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-white border border-gray-150 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Sebelumnya
            </button>
            <span className="text-[12px] text-gray-500 font-medium">
              Halaman {page} dari {totalPages}
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-white border border-gray-150 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>

      {/* Rejection Note Modal */}
      {rejectingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectingRecord(null)} />
          
          <div className="relative bg-white rounded-2xl p-5 shadow-2xl w-full max-w-sm border border-gray-150 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <p className="text-[14px] font-bold text-gray-900">Alasan Penolakan Lembur</p>
              <button onClick={() => setRejectingRecord(null)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={12} className="text-gray-550" />
              </button>
            </div>
            
            <div className="mt-3.5 space-y-3">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 text-[11px] text-slate-700 leading-normal font-semibold">
                Karyawan: <strong>{rejectingRecord.employee?.name}</strong><br/>
                Tanggal: <strong>{formatDate(rejectingRecord.date)}</strong>
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Catatan/Alasan Penolakan <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="Masukkan alasan penolakan..."
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                  rows={3}
                  maxLength={255}
                  className="w-full px-3 py-2 border border-gray-250 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-gray-300 resize-none font-medium text-gray-800"
                />
                <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-medium">
                  <span>Wajib diisi</span>
                  <span>{rejectionNote.length}/255</span>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setRejectingRecord(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-650 rounded-xl text-[12px] font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={submittingRejection || !rejectionNote.trim()}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-xl text-[12px] font-semibold transition-colors disabled:cursor-not-allowed"
                >
                  {submittingRejection ? 'Mengirim...' : 'Kirim & Tolak'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Surat Perintah Lembur (SPL) dengan QR Code */}
      {selectedSplRecord && (() => {
        const reqDateStr = selectedSplRecord.date ? selectedSplRecord.date.substring(0, 10).replace(/-/g, '') : '';
        const splNumber = `SPL-${selectedSplRecord.id}-${reqDateStr}`;
        
        const dateObj = selectedSplRecord.date ? new Date(selectedSplRecord.date) : new Date();
        const monthYears = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const periodLabel = `${monthYears[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        
        // Generate QR code content
        const qrContent = `SURAT PERINTAH LEMBUR RESMI
RSU CEMPAKA LIMA
------------------------------
No. Dokumen: ${splNumber}
Nama Pegawai: ${selectedSplRecord.employee?.name}
NIK KTP: ${selectedSplRecord.employee?.nik_ktp}
Unit Kerja: ${selectedSplRecord.unit_kerja || selectedSplRecord.employee?.department || '-'}
Tanggal Lembur: ${formatDate(selectedSplRecord.date)}
Waktu: ${selectedSplRecord.start_time || '17:00'} s/d ${selectedSplRecord.end_time || '19:00'} (${selectedSplRecord.overtime_day_type === 'holiday' ? 'Hari Libur' : 'Hari Kerja'})
Tugas: ${selectedSplRecord.tasks || selectedSplRecord.reason}
Status Dokumen: SAH / DISETUJUI
Otorisasi Final: Direktur PT Cempaka Lima (Amir Hidayat, ST., MKM)`;

        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrContent)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-xs" onClick={() => setSelectedSplRecord(null)} />
            <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 md:p-8 animate-scale-up max-h-[90vh] overflow-y-auto">
              
              {/* Modal controls */}
              <div className="flex justify-end gap-2 mb-4 border-b border-gray-100 pb-3 no-print">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-[12px] font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Printer size={13} /> Cetak Dokumen
                </button>
                <button
                  onClick={() => setSelectedSplRecord(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* SPL Printable Document Container */}
              <div className="border-[3px] border-double border-gray-800 p-6 md:p-8 bg-white font-serif text-gray-900 leading-normal text-left">
                
                {/* Header */}
                <div className="text-center border-b-[2px] border-gray-800 pb-3 mb-5">
                  <h2 className="text-[20px] font-bold tracking-wide uppercase">Surat Perintah Lembur</h2>
                  <p className="text-[12px] font-bold text-gray-700 tracking-wider mt-0.5">RSU CEMPAKA LIMA</p>
                  <p className="text-[11px] text-gray-500 font-mono mt-1">No. Dokumen: {splNumber}</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 text-[12px] mb-5 border-b border-gray-250 pb-3">
                  <div>
                    <span className="font-bold text-gray-500">Bulan/Tahun :</span>
                    <span className="ml-1.5 font-semibold text-gray-800">{periodLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-500">Lembur Pada Waktu :</span>
                    <span className="ml-2 font-semibold text-gray-800 border border-gray-800 px-2 py-0.5 rounded bg-gray-50">
                      {selectedSplRecord.overtime_day_type === 'holiday' ? '☑ Hari Libur' : '☑ Hari Kerja'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-500">Bagian/Unit :</span>
                    <span className="ml-1.5 font-semibold text-gray-800">{selectedSplRecord.unit_kerja || selectedSplRecord.employee?.department || '-'}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse border border-gray-800 text-[11.5px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-800 text-center font-bold">
                        <th className="border border-gray-800 p-2 w-10">No</th>
                        <th className="border border-gray-800 p-2">Nama Karyawan</th>
                        <th className="border border-gray-800 p-2">Unit Kerja</th>
                        <th className="border border-gray-800 p-2">Tanggal</th>
                        <th className="border border-gray-800 p-2 col-span-2">Jam Lembur</th>
                        <th className="border border-gray-800 p-2">Tugas Saat Lembur</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-center font-semibold text-gray-800">
                        <td className="border border-gray-800 p-2">1</td>
                        <td className="border border-gray-800 p-2 text-left">{selectedSplRecord.employee?.name}</td>
                        <td className="border border-gray-800 p-2">{selectedSplRecord.unit_kerja || selectedSplRecord.employee?.department || '-'}</td>
                        <td className="border border-gray-800 p-2">{formatDate(selectedSplRecord.date)}</td>
                        <td className="border border-gray-800 p-2 font-mono">{selectedSplRecord.start_time || '17:00'} - {selectedSplRecord.end_time || '19:00'}</td>
                        <td className="border border-gray-800 p-2 text-left font-medium">{selectedSplRecord.tasks || selectedSplRecord.reason}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer and Signatures */}
                <div className="grid grid-cols-2 gap-12 pt-6 items-start">
                  
                  {/* Disetujui Oleh - Tim Administrator RSUCL */}
                  <div className="text-center flex flex-col items-center">
                    <p className="text-[12px] font-bold text-gray-800">Disetujui Oleh,</p>
                    
                    <div className="my-2 p-1 border border-gray-200 rounded-lg bg-white shadow-xs">
                      <img src={qrHrdImg} alt="QR HRD RSUCL" className="w-20 h-20 object-contain" />
                    </div>
                    
                    <p className="text-[12px] font-bold text-gray-800 underline">Tim Administrator RSUCL</p>
                  </div>

                  {/* Diketahui Oleh - Direktur PT Cempaka Lima */}
                  <div className="text-center flex flex-col items-center">
                    <p className="text-[12px] font-bold text-gray-800">Diketahui Oleh,</p>
                    
                    <div className="my-2 p-1 border border-gray-200 rounded-lg bg-white shadow-xs">
                      <img src={qrCodeImg} alt="QR Verification" className="w-20 h-20 object-contain" />
                    </div>
                    
                    <p className="text-[12px] font-bold text-gray-800 underline">Amir Hidayat, ST., MKM</p>
                    <p className="text-[10px] text-gray-600 font-semibold">Direktur PT Cempaka Lima</p>
                  </div>

                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
