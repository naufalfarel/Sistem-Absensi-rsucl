import { FileText, Download, TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const monthlyData = [
  { bulan: 'Jan', hadir: 94, terlambat: 8, alpha: 3, cuti: 5 },
  { bulan: 'Feb', hadir: 92, terlambat: 10, alpha: 4, cuti: 7 },
  { bulan: 'Mar', hadir: 95, terlambat: 7, alpha: 2, cuti: 6 },
  { bulan: 'Apr', hadir: 91, terlambat: 12, alpha: 5, cuti: 9 },
  { bulan: 'Mei', hadir: 96, terlambat: 6, alpha: 1, cuti: 4 },
  { bulan: 'Jun', hadir: 93, terlambat: 9, alpha: 3, cuti: 8 },
  { bulan: 'Jul', hadir: 97, terlambat: 5, alpha: 1, cuti: 3 },
];

const deptData = [
  { dept: 'Poli Umum', persen: 96 },
  { dept: 'ICU', persen: 92 },
  { dept: 'Poli Anak', persen: 94 },
  { dept: 'IGD', persen: 98 },
  { dept: 'Bedah', persen: 89 },
  { dept: 'Farmasi', persen: 100 },
  { dept: 'Lab', persen: 95 },
  { dept: 'Admin', persen: 97 },
];

const pieData = [
  { name: 'Hadir', value: 87, color: '#16A34A' },
  { name: 'Terlambat', value: 7, color: '#FBBF24' },
  { name: 'Alpha', value: 2, color: '#F87171' },
  { name: 'Cuti/Izin', value: 4, color: '#A78BFA' },
];

const weeklyLate = [
  { hari: 'Sen', count: 5 },
  { hari: 'Sel', count: 3 },
  { hari: 'Rab', count: 7 },
  { hari: 'Kam', count: 4 },
  { hari: 'Jum', count: 6 },
  { hari: 'Sab', count: 2 },
];

export function ReportsTab() {
  const currentMonth = monthlyData[monthlyData.length - 1];
  const prevMonth = monthlyData[monthlyData.length - 2];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Laporan Kehadiran</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Analitik dan statistik absensi RSUCL · Juli 2025</p>
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Kehadiran Bulan Ini', value: `${currentMonth.hadir}%`, prev: prevMonth.hadir, unit: '%', icon: Users, color: '#16A34A', bg: '#F0FDF4', up: true },
          { label: 'Keterlambatan', value: `${currentMonth.terlambat}`, prev: prevMonth.terlambat, unit: ' org', icon: TrendingDown, color: '#D97706', bg: '#FFFBEB', up: false },
          { label: 'Alpha', value: `${currentMonth.alpha}`, prev: prevMonth.alpha, unit: ' org', icon: TrendingDown, color: '#DC2626', bg: '#FEF2F2', up: false },
          { label: 'Cuti & Izin', value: `${currentMonth.cuti}`, prev: prevMonth.cuti, unit: ' org', icon: Calendar, color: '#7C3AED', bg: '#F5F3FF', up: true },
        ].map((k, i) => {
          const diff = typeof k.prev === 'number' ? (parseFloat(k.value) - k.prev) : 0;
          const better = k.up ? diff >= 0 : diff <= 0;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
                  <k.icon size={15} style={{ color: k.color }} />
                </div>
                <div className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${better ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {better ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {Math.abs(diff)}{k.unit}
                </div>
              </div>
              <p className="text-[22px] font-bold text-gray-900">{k.value}{i === 0 ? '' : k.unit}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly trend bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[14px] font-semibold text-gray-800">Tren Kehadiran Bulanan</p>
              <p className="text-[11px] text-gray-400">Jan – Jul 2025</p>
            </div>
            <div className="flex gap-3">
              {[['#16A34A','Hadir'],['#FBBF24','Terlambat'],['#F87171','Alpha'],['#A78BFA','Cuti']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background:c}}/><span className="text-[10px] text-gray-400">{l}</span></div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart id="rep-monthly-bar" data={monthlyData} barGap={1} barCategoryGap="30%">
              <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              <Bar dataKey="hadir" name="Hadir-rep" fill="#16A34A" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="terlambat" name="Terlambat-rep" fill="#FBBF24" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="alpha" name="Alpha-rep" fill="#F87171" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="cuti" name="Cuti-rep" fill="#A78BFA" radius={[3,3,0,0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-1">Komposisi Kehadiran</p>
          <p className="text-[11px] text-gray-400 mb-4">Bulan Juli 2025</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart id="rep-pie">
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value" nameKey="name" isAnimationActive={false}>
                {pieData.map((entry) => <Cell key={`rep-pie-${entry.name}`} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-[11px] text-gray-600">{d.name}</span>
                </div>
                <span className="text-[11px] font-semibold text-gray-700">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly late */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-1">Keterlambatan Mingguan</p>
          <p className="text-[11px] text-gray-400 mb-4">Jumlah karyawan terlambat per hari (minggu ini)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart id="rep-late-bar" data={weeklyLate} barCategoryGap="40%">
              <XAxis dataKey="hari" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={20} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              <Bar dataKey="count" name="Terlambat-late" fill="#FBBF24" radius={[4,4,0,0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Dept breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-4">Kehadiran per Departemen</p>
          <div className="space-y-2.5">
            {deptData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <p className="text-[11px] text-gray-500 w-24 flex-shrink-0">{d.dept}</p>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all" style={{
                    width: `${d.persen}%`,
                    background: d.persen >= 95 ? '#16A34A' : d.persen >= 90 ? '#FBBF24' : '#F87171'
                  }} />
                </div>
                <span className="text-[11px] font-semibold text-gray-700 w-10 text-right">{d.persen}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
