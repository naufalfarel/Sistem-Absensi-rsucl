import { useState } from 'react';
import { Search, Download, FileText, Calendar, ChevronDown } from 'lucide-react';

const historyData = [
  { id: 1, name: 'Dr. Rina Kusumawati', dept: 'Poli Umum', date: '2025-07-01', checkIn: '08:28', checkOut: '17:05', duration: '8j 37m', shift: 'Reguler', status: 'hadir' },
  { id: 2, name: 'Ns. Ahmad Fauzi', dept: 'ICU', date: '2025-07-01', checkIn: '08:25', checkOut: '17:10', duration: '8j 45m', shift: 'Reguler', status: 'hadir' },
  { id: 3, name: 'dr. Siti Rahma', dept: 'Poli Anak', date: '2025-07-01', checkIn: '09:15', checkOut: '17:00', duration: '7j 45m', shift: 'Reguler', status: 'terlambat' },
  { id: 4, name: 'dr. Hendra Wijaya', dept: 'Bedah', date: '2025-07-01', checkIn: '--', checkOut: '--', duration: '--', shift: 'Reguler', status: 'alpha' },
  { id: 5, name: 'Budi Santoso', dept: 'Administrasi', date: '2025-07-01', checkIn: '--', checkOut: '--', duration: '--', shift: '--', status: 'cuti' },
  { id: 6, name: 'Rini Handayani', dept: 'Farmasi', date: '2025-07-01', checkIn: '08:27', checkOut: '17:00', duration: '8j 33m', shift: 'Reguler', status: 'hadir' },
  { id: 7, name: 'Fajar Nugroho', dept: 'Laboratorium', date: '2025-07-01', checkIn: '07:02', checkOut: '14:05', duration: '7j 03m', shift: 'Pagi', status: 'hadir' },
  { id: 8, name: 'Dr. Rina Kusumawati', dept: 'Poli Umum', date: '2025-06-30', checkIn: '08:30', checkOut: '17:02', duration: '8j 32m', shift: 'Reguler', status: 'hadir' },
  { id: 9, name: 'Ns. Ahmad Fauzi', dept: 'ICU', date: '2025-06-30', checkIn: '08:35', checkOut: '17:00', duration: '8j 25m', shift: 'Reguler', status: 'terlambat' },
  { id: 10, name: 'dr. Siti Rahma', dept: 'Poli Anak', date: '2025-06-30', checkIn: '08:28', checkOut: '17:00', duration: '8j 32m', shift: 'Reguler', status: 'hadir' },
  { id: 11, name: 'Ns. Dewi Lestari', dept: 'IGD', date: '2025-06-30', checkIn: '--', checkOut: '--', duration: '--', shift: 'Reguler', status: 'izin' },
  { id: 12, name: 'Rini Handayani', dept: 'Farmasi', date: '2025-06-29', checkIn: '08:29', checkOut: '17:05', duration: '8j 36m', shift: 'Reguler', status: 'hadir' },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  hadir:    { label: 'Hadir',    color: '#16A34A', bg: '#DCFCE7' },
  terlambat:{ label: 'Terlambat',color: '#D97706', bg: '#FEF3C7' },
  alpha:    { label: 'Alpha',    color: '#DC2626', bg: '#FEE2E2' },
  cuti:     { label: 'Cuti',     color: '#7C3AED', bg: '#EDE9FE' },
  izin:     { label: 'Izin',     color: '#2563EB', bg: '#DBEAFE' },
  sakit:    { label: 'Sakit',    color: '#0891B2', bg: '#CFFAFE' },
};

const filterOptions = ['Hari Ini', 'Minggu Ini', 'Bulan Ini', 'Custom'];

export function HistoryTab() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Bulan Ini');
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = historyData.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.dept.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const summary = {
    hadir: filtered.filter(r => r.status === 'hadir').length,
    terlambat: filtered.filter(r => r.status === 'terlambat').length,
    alpha: filtered.filter(r => r.status === 'alpha').length,
    cuti: filtered.filter(r => r.status === 'cuti' || r.status === 'izin' || r.status === 'sakit').length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Riwayat Absensi</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Rekap lengkap kehadiran seluruh karyawan</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3.5 py-2 bg-red-50 border border-red-100 rounded-xl text-[12px] font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm">
            <FileText size={13} /> Export PDF
          </button>
          <button className="flex items-center gap-2 px-3.5 py-2 bg-green-50 border border-green-100 rounded-xl text-[12px] font-medium text-[#16A34A] hover:bg-green-100 transition-colors shadow-sm">
            <Download size={13} /> Export Excel
          </button>
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
            <p className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
          {filterOptions.map(f => (
            <button
              key={f}
              onClick={() => { setActiveFilter(f); setShowCustom(f === 'Custom'); }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                activeFilter === f ? 'bg-[#16A34A] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {showCustom && (
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] transition-all" />
            <span className="text-gray-400 text-[12px]">s/d</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] transition-all" />
          </div>
        )}
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
          <input type="text" placeholder="Cari nama atau departemen..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {['Nama', 'Departemen', 'Tanggal', 'Shift', 'Jam Masuk', 'Jam Keluar', 'Durasi', 'Status'].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const sc = statusConfig[r.status];
                const d = new Date(r.date);
                const dateStr = `${d.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]} ${d.getFullYear()}`;
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-gray-800">{r.name}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-gray-500">{r.dept}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-gray-300" />
                        {dateStr}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        r.shift === 'Pagi' ? 'bg-amber-50 text-amber-700' :
                        r.shift === 'Siang' ? 'bg-blue-50 text-blue-700' :
                        r.shift === 'Malam' ? 'bg-indigo-50 text-indigo-700' :
                        r.shift === 'Reguler' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{r.shift}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-700">{r.checkIn}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-gray-700">{r.checkOut}</td>
                    <td className="px-4 py-3 text-[12px] text-gray-600">{r.duration}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
          <p className="text-[12px] text-gray-400">Menampilkan {filtered.length} dari {historyData.length} data</p>
        </div>
      </div>
    </div>
  );
}
