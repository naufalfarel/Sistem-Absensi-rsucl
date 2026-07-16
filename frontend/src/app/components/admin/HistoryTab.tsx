import { useState, useEffect } from 'react';
import { Search, Calendar, ChevronDown, Eye, X, Filter, Clock } from 'lucide-react';
import { attendanceApi, departmentApi, AttendanceRecord, DepartmentModel } from '../../../services/api';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  hadir:         { label: 'Hadir',         color: '#16A34A', bg: '#DCFCE7' },
  telat:         { label: 'Terlambat',     color: '#D97706', bg: '#FEF3C7' },
  alpha:         { label: 'Alpha',         color: '#DC2626', bg: '#FEE2E2' },
  belum_hadir:   { label: 'Belum Hadir',   color: '#6B7280', bg: '#F3F4F6' },
  izin:          { label: 'Izin',          color: '#2563EB', bg: '#DBEAFE' },
  sakit:         { label: 'Sakit',         color: '#EA580C', bg: '#FFF7ED' },
  cuti:          { label: 'Cuti',          color: '#7C3AED', bg: '#F5F3FF' },
  cuti_khusus:   { label: 'Cuti Khusus',   color: '#7C3AED', bg: '#F5F3FF' },
  tidak_lengkap: { label: 'Tidak Lengkap', color: '#4B5563', bg: '#F3F4F6' },
};

/**
 * Komponen Tab Riwayat Admin (HistoryTab) — Sistem Absensi RSUCL
 * 
 * Halaman khusus admin untuk meninjau rekaman data kehadiran historis seluruh karyawan RSUCL.
 * Dilengkapi filter pencarian berdasarkan nama/departemen/NIP, filter kategori status absensi,
 * filter dropdown departemen, toggle harian/rentang tanggal fleksibel,
 * serta detail modal pratinjau selfie masuk/pulang.
 */
export function HistoryTab() {
  const getLocalDateString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
  };
  const todayStr = getLocalDateString();

  // State daftar objek rekaman riwayat absensi yang ditarik dari API
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);

  // State untuk preview pas foto besar
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);

  // Filters State
  const [viewMode, setViewMode] = useState<'daily' | 'range'>('daily');
  const [date, setDate] = useState(todayStr);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Summary counts
  const [summary, setSummary] = useState({
    hadir: 0,
    terlambat: 0,
    alpha: 0,
    cuti: 0,
    tidak_lengkap: 0
  });

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

    return () => {
      clearTimeout(handler);
    };
  }, [searchVal]);

  // Reset page when other filters change
  useEffect(() => {
    setPage(1);
  }, [viewMode, date, dateFrom, dateTo, departmentId, statusFilter]);

  // Fetch data
  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        search: search || undefined,
        department_id: departmentId || undefined,
        status: statusFilter.length > 0 ? statusFilter : undefined,
        page,
        per_page: 20,
      } as any;

      if (viewMode === 'daily') {
        params.date = date;
      } else {
        params.date_from = dateFrom;
        params.date_to = dateTo;
      }

      const [summaryRes, recordsRes] = await Promise.all([
        attendanceApi.statusSummary({
          search: params.search,
          department_id: params.department_id,
          date: params.date,
          date_from: params.date_from,
          date_to: params.date_to
        }),
        attendanceApi.historyAdmin(params)
      ]);

      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }
      if (recordsRes.success) {
        setRecords(recordsRes.data);
        if (recordsRes.meta) {
          setTotalPages(recordsRes.meta.last_page);
          setTotalRecords(recordsRes.meta.total);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewMode, date, dateFrom, dateTo, search, departmentId, statusFilter, page]);

  const getDurationStr = (mins: number | null) => {
    if (!mins) return '--';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}j ${m}m`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatDateRange = (startStr?: string, endStr?: string, daysCount?: number) => {
    if (!startStr || !endStr) return '';
    const start = new Date(startStr);
    const end = new Date(endStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()} · ${daysCount || 0} hari`;
  };

  const handleCardClick = (cardIndex: number) => {
    let nextFilter: string[] = [];
    switch (cardIndex) {
      case 0:
        nextFilter = ['hadir'];
        break;
      case 1:
        nextFilter = ['telat'];
        break;
      case 2:
        nextFilter = ['tidak_lengkap'];
        break;
      case 3:
        nextFilter = ['alpha', 'belum_hadir'];
        break;
      case 4:
        nextFilter = ['izin', 'sakit', 'cuti', 'cuti_khusus'];
        break;
    }

    const isSame = JSON.stringify(statusFilter) === JSON.stringify(nextFilter);
    if (isSame) {
      setStatusFilter([]);
    } else {
      setStatusFilter(nextFilter);
    }
  };

  const isCardActive = (cardIndex: number) => {
    if (statusFilter.length === 0) return false;
    switch (cardIndex) {
      case 0:
        return statusFilter.includes('hadir') && statusFilter.length === 1;
      case 1:
        return statusFilter.includes('telat') && statusFilter.length === 1;
      case 2:
        return statusFilter.includes('tidak_lengkap') && statusFilter.length === 1;
      case 3:
        return statusFilter.includes('alpha') && statusFilter.includes('belum_hadir') && statusFilter.length === 2;
      case 4:
        return statusFilter.includes('cuti') && statusFilter.includes('izin') && statusFilter.length === 4;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Riwayat Absensi</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Rekap lengkap kehadiran seluruh karyawan</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Hadir', value: summary.hadir, color: '#16A34A' },
          { label: 'Terlambat', value: summary.terlambat, color: '#D97706' },
          { label: 'Tidak Lengkap', value: (summary as any).tidak_lengkap || 0, color: '#4B5563' },
          { label: 'Alpha', value: summary.alpha, color: '#DC2626' },
          { label: 'Cuti/Izin/Sakit', value: summary.cuti, color: '#7C3AED' },
        ].map((s, i) => {
          const active = isCardActive(i);
          return (
            <div 
              key={i} 
              onClick={() => handleCardClick(i)}
              className={`bg-white rounded-2xl border p-4 text-center cursor-pointer transition-all hover:shadow-md ${
                active 
                  ? 'border-[#16A34A] shadow-md ring-2 ring-[#16A34A]/10 scale-[1.02]' 
                  : 'border-gray-100 shadow-sm'
              }`}
              style={{ borderLeft: `4px solid ${s.color}` }}
            >
              <p className="text-[22px] font-bold text-black">{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Date Toggle and Picker */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 p-1 bg-white border border-gray-100 rounded-xl shadow-sm">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${viewMode === 'daily' ? 'bg-[#16A34A] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Harian
          </button>
          <button
            onClick={() => setViewMode('range')}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${viewMode === 'range' ? 'bg-[#16A34A] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Rentang Tanggal
          </button>
        </div>

        {viewMode === 'daily' ? (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
            <Calendar size={13} className="text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-[12px] font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
            <Calendar size={13} className="text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-[12px] font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            />
            <span className="text-[12px] text-gray-400 font-semibold">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-[12px] font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Department Dropdown */}
        <div className="relative">
          <select
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-100 rounded-xl text-[12px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all text-gray-600 font-semibold cursor-pointer"
          >
            <option value="">Semua Departemen</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <select
            value={statusFilter.length === 0 ? 'all' : statusFilter.join(',')}
            onChange={e => {
              const val = e.target.value;
              if (val === 'all') {
                setStatusFilter([]);
              } else {
                setStatusFilter(val.split(','));
              }
            }}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-100 rounded-xl text-[12px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all text-gray-600 font-semibold cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="hadir">Hadir</option>
            <option value="telat">Terlambat</option>
            <option value="tidak_lengkap">Tidak Lengkap</option>
            <option value="alpha,belum_hadir">Alpha / Belum Hadir</option>
            <option value="izin,sakit,cuti,cuti_khusus">Cuti / Izin / Sakit</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama atau NIP..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300 font-medium"
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {['Nama', 'Departemen/Bagian', 'Tanggal', 'Shift', 'Jam Masuk', 'Jam Keluar', 'Durasi', 'Status', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && records.length === 0 && (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse border-b border-gray-50">
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-28"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td>
                    <td className="px-4 py-4"><div className="h-7 bg-gray-200 rounded w-7"></div></td>
                  </tr>
                ))
              )}
              {!loading && records.map((r, i) => {
                let sc = statusConfig[r.display_status || r.status] || statusConfig[r.status] || { label: r.status, color: '#6B7280', bg: '#F3F4F6' };
                if (r.display_status !== 'tidak_lengkap' && (r.status === 'hadir' || r.status === 'telat')) {
                  if (r.checkin_punctuality === 'tepat_waktu') {
                    sc = { label: 'Tepat Waktu', color: '#16A34A', bg: '#DCFCE7' };
                  } else if (r.checkin_punctuality === 'toleransi') {
                    sc = { label: 'Toleransi', color: '#D97706', bg: '#FEF3C7' };
                  } else if (r.checkin_punctuality === 'terlambat') {
                    sc = { label: 'Terlambat', color: '#DC2626', bg: '#FEE2E2' };
                  }
                }
                const isLeavePeriod = r.row_type === 'leave_period';
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-gray-800">{r.employee?.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{r.employee?.nip}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500">{r.employee?.department || 'Umum'}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-gray-300" />
                        {isLeavePeriod ? formatDateRange(r.start_date, r.end_date, r.days) : formatDate(r.date)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isLeavePeriod ? (
                        <span className="text-gray-300">--</span>
                      ) : (
                        <>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">{r.shift_name || 'Reguler'}</span>
                          {r.shift_type === 'dinas_luar' && (
                            <span className="block mt-1 text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-100 rounded-md px-1.5 py-0.5 w-max">Dinas Luar</span>
                          )}
                          {r.is_holiday_work && (
                            <span className="block mt-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-md px-1.5 py-0.5 w-max" title={r.holiday || 'Hari Libur'}>Kerja Libur</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-700">
                      {isLeavePeriod ? <span className="text-gray-300">--</span> : (r.check_in ? r.check_in.substring(0, 5) : '--')}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-700">
                      {isLeavePeriod ? <span className="text-gray-300">--</span> : (r.check_out ? r.check_out.substring(0, 5) : '--')}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-600">
                      {isLeavePeriod ? <span className="text-gray-300">--</span> : getDurationStr(r.duration_min)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase" style={{ color: sc.color, background: sc.bg }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isLeavePeriod ? (
                        <button onClick={() => setSelected(r)} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors">
                          <Eye size={13} className="text-gray-400" />
                        </button>
                      ) : (
                        <div className="w-7 h-7" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {records.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-300 text-[12px]">
            <Filter className="mx-auto mb-2 opacity-35" size={24} />
            Tidak ada data riwayat absensi untuk filter yang dipilih.
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-50 flex flex-wrap items-center justify-between gap-3 bg-gray-50/30">
          <p className="text-[12px] text-gray-400">Total: {totalRecords} data</p>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Sebelumnya
              </button>
              <span className="text-[12px] text-gray-500 font-medium">
                Halaman {page} dari {totalPages}
              </span>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-white border border-gray-100 rounded-lg text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Berikutnya
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal with selfie */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div 
                onClick={() => {
                  if (selected.employee?.profile_picture) {
                    setPreviewPhoto({ url: selected.employee.profile_picture, name: selected.employee.name });
                  }
                }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 ${selected.employee?.profile_picture ? 'cursor-zoom-in hover:scale-105 active:scale-95 transition-all' : ''}`}
                style={{ background: (statusConfig[selected.status] || { bg: '#F9FAFB' }).bg }}
              >
                {selected.employee?.profile_picture ? (
                  <img src={selected.employee.profile_picture} alt={selected.employee.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold" style={{ color: (statusConfig[selected.display_status || selected.status] || { color: '#6B7280' }).color }}>
                    {(selected.employee?.name ?? 'K').replace(/^(dr\.|Ns\.|Dr\.)\s*/i, '').charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">{selected.employee?.name}</p>
                <p className="text-[12px] text-gray-500">{selected.employee?.department || 'Umum'}</p>
              </div>
            </div>

            <div className="space-y-2.5 bg-gray-50 rounded-xl p-4 mb-5">
              {[
                { l: 'Tanggal', v: formatDate(selected.date) },
                { l: 'Shift', v: (selected.shift_name || 'Reguler') + (selected.shift_type === 'dinas_luar' ? ' (Dinas Luar)' : ' (Normal)') },
                { l: 'Jam Masuk', v: (selected.check_in ? selected.check_in.substring(0, 5) : '--') + (selected.checkin_distance_meters !== undefined && selected.checkin_distance_meters !== null ? ` (${selected.checkin_distance_meters}m dari RSUCL)` : '') },
                { l: 'Jam Keluar', v: (selected.check_out ? selected.check_out.substring(0, 5) : '--') + (selected.checkout_distance_meters !== undefined && selected.checkout_distance_meters !== null ? ` (${selected.checkout_distance_meters}m dari RSUCL)` : '') },
                { l: 'Status', v: selected.display_status === 'tidak_lengkap'
                    ? 'Tidak Lengkap'
                    : ((selected.status === 'hadir' || selected.status === 'telat') && selected.checkin_punctuality
                        ? (selected.checkin_punctuality === 'tepat_waktu' ? 'Tepat Waktu' : (selected.checkin_punctuality === 'toleransi' ? 'Toleransi' : 'Terlambat'))
                        : (statusConfig[selected.status] || { label: selected.status }).label) },
                ...(selected.checkin_location_note ? [{ l: 'Posisi', v: selected.checkin_location_note }] : []),
                ...(selected.checkout_location_note ? [{ l: 'Lokasi Pulang', v: selected.checkout_location_note }] : []),
              ].map(({ l, v }, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[12px] text-gray-500">{l}</span>
                  <span className="text-[12px] font-medium text-gray-800 text-right max-w-[180px] break-words">{v}</span>
                </div>
              ))}
            </div>

            {/* Selfie Photo display if available */}
            {(selected.checkin_photo_url || selected.image_check_in || selected.checkout_photo_url || selected.image_check_out) && (
              <div className="mb-5 space-y-2.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Foto Selfie Absensi</p>
                <div className="flex gap-2">
                  {(selected.checkin_photo_url || selected.image_check_in) && (
                    <div className="flex-1 text-center bg-gray-50 rounded-xl p-2 border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase">Selfie Masuk</p>
                      <img src={selected.checkin_photo_url || selected.image_check_in || undefined} alt="Check In Selfie" className="w-full aspect-square object-cover rounded-lg border animate-fade-in" />
                    </div>
                  )}
                  {(selected.checkout_photo_url || selected.image_check_out) && (
                    <div className="flex-1 text-center bg-gray-50 rounded-xl p-2 border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase">Selfie Pulang</p>
                      <img src={selected.checkout_photo_url || selected.image_check_out || undefined} alt="Check Out Selfie" className="w-full aspect-square object-cover rounded-lg border animate-fade-in" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Overtime Info & Action Panel */}
            {selected.is_lembur && (
              <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-[12px]">
                    <Clock size={13} className="text-blue-500" />
                    <span>Lembur (+{selected.durasi_lembur_menit} mnt)</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selected.status_approval_lembur === 'disetujui' ? 'bg-green-100 text-green-700' :
                    selected.status_approval_lembur === 'ditolak' ? 'bg-red-100 text-red-650' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {selected.status_approval_lembur === 'disetujui' ? 'Disetujui' :
                     selected.status_approval_lembur === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                  </span>
                </div>
                <p className="text-[11.5px] text-gray-600">
                  <span className="font-semibold">Pekerjaan Lembur:</span> {selected.keterangan_lembur || '-'}
                </p>
                {selected.status_approval_lembur === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-blue-200/50 mt-1">
                    <button
                      onClick={async () => {
                        if (!selected.id) return;
                        try {
                          await attendanceApi.approveOvertime(selected.id);
                          alert('Lembur berhasil disetujui.');
                          setSelected(null);
                          loadData();
                        } catch (err: any) {
                          alert(err?.message ?? 'Gagal menyetujui lembur.');
                        }
                      }}
                      className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={async () => {
                        if (!selected.id) return;
                        const reason = window.prompt('Masukkan alasan penolakan lembur:');
                        if (reason === null) return;
                        if (!reason.trim()) {
                          alert('Alasan penolakan wajib diisi.');
                          return;
                        }
                        try {
                          await attendanceApi.rejectOvertime(selected.id, reason);
                          alert('Lembur ditolak.');
                          setSelected(null);
                          loadData();
                        } catch (err: any) {
                          alert(err?.message ?? 'Gagal menolak lembur.');
                        }
                      }}
                      className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setSelected(null)} className="w-full py-2.5 bg-gray-100 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-200 transition-colors">Tutup</button>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX PHOTO PREVIEW MODAL ── */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setPreviewPhoto(null)} />
          <div className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-fade-in flex flex-col items-center">
            {/* Header/Close button */}
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={() => setPreviewPhoto(null)} 
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all focus:outline-none"
              >
                <X size={18} />
              </button>
            </div>
            {/* Image Wrapper */}
            <div className="p-3 w-full bg-gray-50 flex justify-center items-center">
              <img 
                src={previewPhoto.url} 
                alt={previewPhoto.name} 
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-sm border border-gray-100" 
              />
            </div>
            {/* Caption */}
            <div className="px-6 py-4.5 bg-white w-full text-center border-t border-gray-50">
              <p className="text-[14px] font-bold text-gray-900 leading-tight">{previewPhoto.name}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">Foto Profil Karyawan RSUCL</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
