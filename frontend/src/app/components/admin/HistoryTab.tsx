import { useState, useEffect } from 'react';
import { Search, FileText, Calendar, ChevronDown, Eye, X } from 'lucide-react';
import { attendanceApi, AttendanceRecord } from '../../../services/api';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  hadir:    { label: 'Hadir',    color: '#16A34A', bg: '#DCFCE7' },
  telat:    { label: 'Terlambat',color: '#D97706', bg: '#FEF3C7' },
  alpha:    { label: 'Alpha',    color: '#DC2626', bg: '#FEE2E2' },
  izin:     { label: 'Izin',     color: '#2563EB', bg: '#DBEAFE' },
  sakit:    { label: 'Sakit',    color: '#EA580C', bg: '#FFF7ED' },
  cuti:     { label: 'Cuti',     color: '#7C3AED', bg: '#F5F3FF' },
};

const filterOptions = ['Semua Data'];

/**
 * Komponen Tab Riwayat Admin (HistoryTab) — Sistem Absensi RSUCL
 * 
 * Halaman khusus admin untuk meninjau rekaman data kehadiran historis seluruh karyawan RSUCL.
 * Dilengkapi filter pencarian berdasarkan nama/departemen, filter kategori status absensi,
 * filter dropdown bulan & tahun berjalan, serta detail modal pratinjau selfie masuk/pulang.
 */
export function HistoryTab() {
  const currentDate = new Date();

  // State daftar objek rekaman riwayat absensi yang ditarik dari API
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  
  // Kata kunci pencarian karyawan (Nama / Departemen)
  const [search, setSearch] = useState('');
  
  // Filter status kehadiran aktif ('all' vs status spesifik)
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Indikator memproses/memuat data
  const [loading, setLoading] = useState(false);
  
  // Objek rekaman terpilih untuk pratinjau detail selfie & metadata
  const [selected, setSelected] = useState<AttendanceRecord | null>(null);

  // States penampung bulan dan tahun filter aktif (sinkron dengan data Laporan)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  /**
   * Menarik daftar riwayat absensi karyawan bulanan berdasarkan bulan/tahun aktif dari API.
   */
  const loadHistory = async () => {
    setLoading(true);
    try {
      // Mengirimkan parameter bulan dan tahun agar backend memproses data bulanan lengkap
      const res = await attendanceApi.history(selectedMonth, selectedYear);
      if (res.success) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Muat ulang data riwayat absensi setiap kali bulan atau tahun filter berubah
  useEffect(() => {
    loadHistory();
  }, [selectedMonth, selectedYear]);

  const getDurationStr = (mins: number | null) => {
    if (!mins) return '--';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}j ${m}m`;
  };

  const filtered = records.filter(r => {
    const nameMatch = r.employee?.name.toLowerCase().includes(search.toLowerCase()) || false;
    const deptMatch = r.employee?.department.toLowerCase().includes(search.toLowerCase()) || false;
    const matchSearch = nameMatch || deptMatch;

    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const summary = {
    hadir: filtered.filter(r => r.status === 'hadir').length,
    terlambat: filtered.filter(r => r.status === 'telat').length,
    alpha: filtered.filter(r => r.status === 'alpha').length,
    cuti: filtered.filter(r => r.status === 'izin' || r.status === 'sakit' || r.status === 'cuti').length,
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Riwayat Absensi</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Rekap lengkap kehadiran seluruh karyawan</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Hadir', value: summary.hadir, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Terlambat', value: summary.terlambat, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Alpha', value: summary.alpha, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Cuti/Izin/Sakit', value: summary.cuti, color: '#7C3AED', bg: '#F5F3FF' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-[22px] font-bold text-black">{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Dropdown Filter Bulan & Tahun */}
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
          <div className="relative">
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[12px] bg-white focus:outline-none text-gray-700 font-semibold cursor-pointer border border-transparent hover:border-gray-200 transition-all"
            >
              {[
                { v: 1, l: 'Januari' }, { v: 2, l: 'Februari' }, { v: 3, l: 'Maret' },
                { v: 4, l: 'April' }, { v: 5, l: 'Mei' }, { v: 6, l: 'Juni' },
                { v: 7, l: 'Juli' }, { v: 8, l: 'Agustus' }, { v: 9, l: 'September' },
                { v: 10, l: 'Oktober' }, { v: 11, l: 'November' }, { v: 12, l: 'Desember' }
              ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative border-l border-gray-100 pl-1">
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[12px] bg-white focus:outline-none text-gray-700 font-semibold cursor-pointer border border-transparent hover:border-gray-200 transition-all"
            >
              {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-7 py-2 border border-gray-100 rounded-xl text-[12px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all text-gray-600">
            <option value="all">Semua Status</option>
            {Object.entries(statusConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Cari nama atau departemen/bagian..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300" />
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
              {loading && (
                <tr>
                  <td colSpan={9} className="text-center py-5 text-gray-400 text-[12px]">Memuat riwayat absensi...</td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const sc = statusConfig[r.status] || { label: r.status, color: '#6B7280', bg: '#F3F4F6' };
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-gray-800">{r.employee?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500">{r.employee?.department || 'Umum'}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-gray-300" />
                        {formatDate(r.date)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">{r.shift_name || 'Reguler'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-700">{r.check_in ? r.check_in.substring(0, 5) : '--'}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-700">{r.check_out ? r.check_out.substring(0, 5) : '--'}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-600">{getDurationStr(r.duration_min)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase" style={{ color: sc.color, background: sc.bg }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(r)} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <Eye size={13} className="text-gray-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && !loading && (
          <div className="text-center py-5 text-gray-300 text-[11px]">Tidak ada data riwayat absensi.</div>
        )}
        <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
          <p className="text-[12px] text-gray-400">Menampilkan {filtered.length} dari {records.length} data</p>
        </div>
      </div>

      {/* Detail modal with selfie */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: (statusConfig[selected.status] || { bg: '#F9FAFB' }).bg }}>
                <span className="text-lg font-bold" style={{ color: (statusConfig[selected.status] || { color: '#6B7280' }).color }}>
                  {(selected.employee?.name ?? 'K').replace(/^(dr\.|Ns\.|Dr\.)\s*/i, '').charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">{selected.employee?.name}</p>
                <p className="text-[12px] text-gray-500">{selected.employee?.department || 'Umum'}</p>
              </div>
            </div>

            <div className="space-y-2.5 bg-gray-50 rounded-xl p-4 mb-5">
              {[
                { l: 'Tanggal', v: formatDate(selected.date) },
                { l: 'Shift', v: selected.shift_name || 'Reguler' },
                { l: 'Jam Masuk', v: selected.check_in ? selected.check_in.substring(0, 5) : '--' },
                { l: 'Jam Keluar', v: selected.check_out ? selected.check_out.substring(0, 5) : '--' },
                { l: 'Status', v: (statusConfig[selected.status] || { label: selected.status }).label },
              ].map(({ l, v }, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[12px] text-gray-500">{l}</span>
                  <span className="text-[12px] font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>

            {/* Selfie Photo display if available */}
            {(selected.image_check_in || selected.image_check_out) && (
              <div className="mb-5 space-y-2.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Foto Selfie Absensi</p>
                <div className="flex gap-2">
                  {selected.image_check_in && (
                    <div className="flex-1 text-center bg-gray-50 rounded-xl p-2 border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase">Selfie Masuk</p>
                      <img src={selected.image_check_in} alt="Check In Selfie" className="w-full aspect-square object-cover rounded-lg border" />
                    </div>
                  )}
                  {selected.image_check_out && (
                    <div className="flex-1 text-center bg-gray-50 rounded-xl p-2 border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase">Selfie Pulang</p>
                      <img src={selected.image_check_out} alt="Check Out Selfie" className="w-full aspect-square object-cover rounded-lg border" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <button onClick={() => setSelected(null)} className="w-full py-2.5 bg-gray-100 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-200 transition-colors">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
