import { useState, useEffect } from 'react';
import { FileText, Download, Users, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { reportApi, ReportSummary } from '../../../services/api';

export function ReportsTab() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await reportApi.summary();
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const totalEmp = summary?.total_employees ?? 0;
  const todayHadir = summary?.today.hadir ?? 0;
  const todayTelat = summary?.today.telat ?? 0;
  const todayAlpha = summary?.today.alpha ?? 0;
  const todayCuti = summary?.today.cuti ?? 0;

  // Real database rate
  const getMonthlyAttendanceRate = () => {
    const monthH = summary?.this_month.hadir ?? 0;
    const monthT = summary?.this_month.telat ?? 0;
    const monthA = summary?.this_month.alpha ?? 0;
    const monthC = summary?.this_month.cuti ?? 0;
    const total = monthH + monthT + monthA + monthC;
    if (total === 0) return 0;
    return Math.round(((monthH + monthT) / total) * 100);
  };

  const formatTrend = (val: number, unit: string = 'org') => {
    if (val > 0) return `+ ${val} ${unit}`;
    if (val < 0) return `- ${Math.abs(val)} ${unit}`;
    return `0 ${unit}`;
  };

  const getTrendColor = (val: number) => {
    if (val > 0) return 'bg-green-50 text-green-600';
    if (val < 0) return 'bg-red-50 text-red-600';
    return 'bg-gray-50 text-gray-500';
  };

  // Strictly use API data or empty defaults while loading
  const pieData = summary?.composition ?? [];
  const monthlyTrendData = summary?.monthly_trend ?? [];
  const weeklyLateData = summary?.weekly_late ?? [];
  const deptData = summary?.dept_attendance ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Laporan Kehadiran</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Analitik dan statistik absensi RSUCL · Real-time</p>
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
          {
            label: 'Kehadiran Bulan Ini',
            value: `${getMonthlyAttendanceRate()}%`,
            trend: `${summary ? (summary.trends.presence >= 0 ? '+' : '') + summary.trends.presence : 0}%`,
            trendColor: getTrendColor(summary?.trends.presence ?? 0),
            icon: Users,
            color: '#16A34A',
            bg: '#F0FDF4',
          },
          {
            label: 'Keterlambatan',
            value: `${summary?.this_month.telat ?? 0} org`,
            trend: formatTrend(summary?.trends.late ?? 0, 'org'),
            trendColor: getTrendColor(summary?.trends.late ?? 0),
            icon: Clock,
            color: '#D97706',
            bg: '#FFFBEB',
          },
          {
            label: 'Alpha',
            value: `${summary?.this_month.alpha ?? 0} org`,
            trend: formatTrend(summary?.trends.alpha ?? 0, 'org'),
            trendColor: getTrendColor(summary?.trends.alpha ?? 0),
            icon: AlertTriangle,
            color: '#DC2626',
            bg: '#FEF2F2',
          },
          {
            label: 'Cuti & Izin',
            value: `${summary?.this_month.cuti ?? 0} org`,
            trend: formatTrend(summary?.trends.cuti ?? 0, 'org'),
            trendColor: getTrendColor(summary?.trends.cuti ?? 0),
            icon: Calendar,
            color: '#7C3AED',
            bg: '#F5F3FF',
          },
        ].map((k, i) => {
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
                  <k.icon size={15} style={{ color: k.color }} />
                </div>
                <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${k.trendColor}`}>
                  {k.trend}
                </div>
              </div>
              <p className="text-[22px] font-bold text-gray-900">{k.value}</p>
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
              <p className="text-[11px] text-gray-400">7 Bulan Terakhir</p>
            </div>
            <div className="flex gap-3">
              {[['#16A34A','Hadir'],['#FBBF24','Terlambat'],['#F87171','Alpha'],['#A78BFA','Cuti']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{background:c}}/>
                  <span className="text-[10px] text-gray-400">{l}</span>
                </div>
              ))}
            </div>
          </div>
          {loading && (
            <div className="text-center py-5 text-gray-400 text-[12px]">Memuat data tren...</div>
          )}
          {monthlyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart id="rep-monthly-bar" data={monthlyTrendData} barGap={1} barCategoryGap="30%">
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar dataKey="hadir" name="Hadir" fill="#16A34A" radius={[3,3,0,0]} isAnimationActive={false} />
                <Bar dataKey="terlambat" name="Terlambat" fill="#FBBF24" radius={[3,3,0,0]} isAnimationActive={false} />
                <Bar dataKey="alpha" name="Alpha" fill="#F87171" radius={[3,3,0,0]} isAnimationActive={false} />
                <Bar dataKey="cuti" name="Cuti" fill="#A78BFA" radius={[3,3,0,0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-[12px] text-gray-400">Tidak ada data tren bulanan di database</div>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-1">Komposisi Kehadiran</p>
          <p className="text-[11px] text-gray-400 mb-4">Bulan Ini</p>
          {pieData.some(d => d.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart id="rep-pie">
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value" nameKey="name" isAnimationActive={false}>
                    {pieData.map((entry, idx) => (
                      <Cell key={`rep-pie-${idx}`} fill={entry.color} />
                    ))}
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
            </>
          ) : (
            <div className="text-center py-12 text-[12px] text-gray-400">Belum ada data komposisi</div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly late */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-1">Keterlambatan Mingguan</p>
          <p className="text-[11px] text-gray-400 mb-4">Jumlah karyawan terlambat per hari (minggu ini)</p>
          {weeklyLateData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart id="rep-late-bar" data={weeklyLateData} barCategoryGap="40%">
                <XAxis dataKey="hari" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={20} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar dataKey="count" name="Terlambat" fill="#FBBF24" radius={[4,4,0,0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-[12px] text-gray-400">Belum ada karyawan terlambat minggu ini</div>
          )}
        </div>

        {/* Dept breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-4">Kehadiran per Departemen</p>
          {deptData.length > 0 ? (
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
          ) : (
            <div className="text-center py-10 text-[12px] text-gray-400">Tidak ada data departemen</div>
          )}
        </div>
      </div>
    </div>
  );
}
