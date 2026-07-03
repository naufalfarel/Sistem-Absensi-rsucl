import { useState, useEffect } from 'react';
import { Search, Calendar, MapPin, Clock, TrendingUp } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { attendanceApi, AttendanceRecord } from '../../services/api';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  hadir: { label: 'Hadir', color: '#16A34A', bg: '#DCFCE7' },
  telat: { label: 'Terlambat', color: '#D97706', bg: '#FEF3C7' },
  alpha: { label: 'Alpha', color: '#DC2626', bg: '#FEE2E2' },
  izin: { label: 'Izin', color: '#2563EB', bg: '#DBEAFE' },
  sakit: { label: 'Sakit', color: '#EA580C', bg: '#FFF7ED' },
};

const filters = ['Semua', 'Hadir', 'Terlambat', 'Izin/Sakit'];

export function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.history();
      if (res.success) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const getDurationStr = (mins: number | null) => {
    if (!mins) return '--';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}j ${m}m`;
  };

  const mappedRecords = records.map(r => ({
    date: formatDate(r.date),
    checkIn: r.check_in ? r.check_in.substring(0, 5) : '--',
    checkOut: r.check_out ? r.check_out.substring(0, 5) : '--',
    duration: getDurationStr(r.duration_min),
    location: r.latitude ? 'RSUCL – Terverifikasi' : '--',
    status: r.status,
    shift: 'Reguler',
  }));

  const filtered = mappedRecords.filter(r => {
    const matchesSearch = r.date.toLowerCase().includes(searchQuery.toLowerCase()) || r.status.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeFilter === 'Semua') return matchesSearch;
    if (activeFilter === 'Hadir') return matchesSearch && r.status === 'hadir';
    if (activeFilter === 'Terlambat') return matchesSearch && r.status === 'telat';
    if (activeFilter === 'Izin/Sakit') return matchesSearch && (r.status === 'izin' || r.status === 'sakit');
    return matchesSearch;
  });

  // Calculate live statistics
  const totalDays = records.length;
  const hadirCount = records.filter(r => r.status === 'hadir' || r.status === 'telat').length;
  const telatCount = records.filter(r => r.status === 'telat').length;
  const alphaCount = records.filter(r => r.status === 'alpha').length;
  const attendanceRate = totalDays > 0 ? Math.round((hadirCount / totalDays) * 100) : 0;

  // Render simple weekly charts from records
  const monthlyData = [
    { week: 'Hadir', count: hadirCount, fill: '#16A34A' },
    { week: 'Terlambat', count: telatCount, fill: '#FBBF24' },
    { week: 'Alpha', count: alphaCount, fill: '#F87171' },
  ];

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Riwayat Absensi</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Rekap kehadiran Anda</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Hari Hadir', value: String(hadirCount), total: `/${totalDays || 0}`, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Terlambat', value: String(telatCount), total: ' hari', color: '#D97706', bg: '#FFFBEB' },
          { label: 'Alpha', value: String(alphaCount), total: ' hari', color: '#DC2626', bg: '#FFF5F5' },
          { label: 'Kehadiran', value: `${attendanceRate}%`, total: '', color: '#7C3AED', bg: '#F5F3FF' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="w-8 h-8 rounded-xl mb-3 flex items-center justify-center" style={{ background: s.bg }}>
              <TrendingUp size={15} style={{ color: s.color }} />
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[22px] font-bold text-black">{s.value}</span>
              <span className="text-[12px] text-gray-400">{s.total}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <p className="text-[14px] font-semibold text-gray-800 mb-4">Grafik Sebaran Kehadiran</p>
        {totalDays > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barCategoryGap="40%">
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={20} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#16A34A" name="Total Hari" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {monthlyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[160px] flex items-center justify-center text-gray-300 text-[12px]">Belum ada data chart.</div>
        )}
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
        {loading && (
          <div className="text-center py-8 text-gray-400 text-[12px]">Memuat data riwayat...</div>
        )}
        {filtered.map((record, i) => {
          const sc = statusConfig[record.status] || { label: record.status.toUpperCase(), color: '#6B7280', bg: '#F3F4F6' };
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
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase"
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
                    <p className="text-[13px] font-medium text-black truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12">
          <Search size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] text-gray-400">Tidak ada data yang ditemukan</p>
        </div>
      )}
    </div>
  );
}
