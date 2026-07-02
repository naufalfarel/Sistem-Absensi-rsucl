import { useState } from 'react';
import { Search, Calendar, MapPin, Clock, TrendingUp, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const attendanceData = [
  { day: 'Sen', hadir: 1, status: 'hadir' },
  { day: 'Sel', hadir: 1, status: 'hadir' },
  { day: 'Rab', hadir: 1, status: 'hadir' },
  { day: 'Kam', hadir: 1, status: 'terlambat' },
  { day: 'Jum', hadir: 0, status: 'alpha' },
  { day: 'Sen', hadir: 1, status: 'hadir' },
  { day: 'Sel', hadir: 1, status: 'izin' },
];

const monthlyData = [
  { week: 'M1', hadir: 5, terlambat: 0, alpha: 0 },
  { week: 'M2', hadir: 4, terlambat: 1, alpha: 0 },
  { week: 'M3', hadir: 5, terlambat: 0, alpha: 0 },
  { week: 'M4', hadir: 3, terlambat: 1, alpha: 1 },
];

const records = [
  {
    date: 'Rabu, 1 Jul 2025',
    checkIn: '07:45',
    checkOut: '15:02',
    duration: '7j 17m',
    location: 'RSUCL – Dalam Area',
    status: 'hadir',
    shift: 'Pagi',
    late: false,
  },
  {
    date: 'Selasa, 30 Jun 2025',
    checkIn: '07:50',
    checkOut: '15:00',
    duration: '7j 10m',
    location: 'RSUCL – Dalam Area',
    status: 'hadir',
    shift: 'Pagi',
    late: false,
  },
  {
    date: 'Senin, 29 Jun 2025',
    checkIn: '08:15',
    checkOut: '15:20',
    duration: '7j 05m',
    location: 'RSUCL – Dalam Area',
    status: 'terlambat',
    shift: 'Pagi',
    late: true,
  },
  {
    date: 'Jumat, 27 Jun 2025',
    checkIn: '--',
    checkOut: '--',
    duration: '--',
    location: '--',
    status: 'alpha',
    shift: 'Pagi',
    late: false,
  },
  {
    date: 'Kamis, 26 Jun 2025',
    checkIn: '--',
    checkOut: '--',
    duration: '-- ',
    location: 'Pengajuan Disetujui',
    status: 'izin',
    shift: 'Pagi',
    late: false,
  },
  {
    date: 'Rabu, 25 Jun 2025',
    checkIn: '07:42',
    checkOut: '15:00',
    duration: '7j 18m',
    location: 'RSUCL – Dalam Area',
    status: 'hadir',
    shift: 'Pagi',
    late: false,
  },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  hadir: { label: 'Hadir', color: '#16A34A', bg: '#DCFCE7' },
  terlambat: { label: 'Terlambat', color: '#D97706', bg: '#FEF3C7' },
  alpha: { label: 'Alpha', color: '#DC2626', bg: '#FEE2E2' },
  izin: { label: 'Izin', color: '#2563EB', bg: '#DBEAFE' },
};

const filters = ['Hari Ini', 'Minggu Ini', 'Bulan Ini', 'Custom'];

export function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState('Bulan Ini');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = records.filter(r =>
    r.date.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Riwayat Absensi</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Rekap kehadiran Anda</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Hari Hadir', value: '24', total: '/26', color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Terlambat', value: '2', total: ' hari', color: '#D97706', bg: '#FFFBEB' },
          { label: 'Alpha', value: '1', total: ' hari', color: '#DC2626', bg: '#FFF5F5' },
          { label: 'Kehadiran', value: '96%', total: '', color: '#7C3AED', bg: '#F5F3FF' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl mb-3 flex items-center justify-center" style={{ background: s.bg }}>
              <TrendingUp size={15} style={{ color: s.color }} />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[12px] text-gray-400">{s.total}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[14px] font-semibold text-gray-800">Grafik Kehadiran Bulanan</p>
            <p className="text-[12px] text-gray-400">Juni – Juli 2025</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#16A34A]" />
              <span className="text-[11px] text-gray-500">Hadir</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#FBBF24]" />
              <span className="text-[11px] text-gray-500">Terlambat</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#F87171]" />
              <span className="text-[11px] text-gray-500">Alpha</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyData} barGap={2} barCategoryGap="30%">
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={20} />
            <Tooltip
              contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
            />
            <Bar key="bar-hadir" dataKey="hadir" name="Hadir" fill="#16A34A" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar key="bar-terlambat" dataKey="terlambat" name="Terlambat" fill="#FBBF24" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar key="bar-alpha" dataKey="alpha" name="Alpha" fill="#F87171" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                activeFilter === f
                  ? 'bg-[#16A34A] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari riwayat absensi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Records */}
      <div className="space-y-2.5">
        {filtered.map((record, i) => {
          const sc = statusConfig[record.status];
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-[13px] font-semibold text-gray-800">{record.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Shift {record.shift}</span>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ color: sc.color, background: sc.bg }}
                  >
                    {sc.label}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-50">
                {[
                  { icon: Clock, label: 'Jam Masuk', value: record.checkIn, color: '#2563EB' },
                  { icon: Clock, label: 'Jam Keluar', value: record.checkOut, color: '#DC2626' },
                  { icon: TrendingUp, label: 'Durasi', value: record.duration, color: '#7C3AED' },
                  { icon: MapPin, label: 'Lokasi', value: record.location, color: '#EA580C' },
                ].map(({ icon: Icon, label, value, color }, j) => (
                  <div key={j} className="px-4 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                    <p className="text-[13px] font-medium text-gray-800 truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Search size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] text-gray-400">Tidak ada data yang ditemukan</p>
        </div>
      )}
    </div>
  );
}
