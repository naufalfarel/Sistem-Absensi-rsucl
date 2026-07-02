import { useState, useEffect } from 'react';
import { FileText, Download, TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
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

  const getAttendanceRate = () => {
    if (totalEmp === 0) return 0;
    return Math.round((todayHadir / totalEmp) * 100);
  };

  const chartData = summary?.daily_chart.map(c => ({
    label: c.label,
    hadir: c.count,
    alpha: c.total - c.count,
  })) ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Laporan Kehadiran</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Analitik dan statistik absensi RSUCL · Real-time</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Kehadiran Hari Ini', value: `${getAttendanceRate()}%`, sub: `${todayHadir} dari ${totalEmp} Karyawan`, icon: Users, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Keterlambatan Hari Ini', value: `${todayTelat}`, sub: 'Karyawan masuk lambat', icon: Clock, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Alpha Hari Ini', value: `${todayAlpha}`, sub: 'Karyawan absen tanpa kabar', icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Cuti & Izin Hari Ini', value: `${todayCuti}`, sub: 'Karyawan cuti/sakit/izin', icon: Calendar, color: '#7C3AED', bg: '#F5F3FF' },
        ].map((k, i) => {
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
                  <k.icon size={15} style={{ color: k.color }} />
                </div>
              </div>
              <p className="text-[22px] font-bold text-gray-900">{k.value}</p>
              <p className="text-[11px] font-medium text-gray-800 mt-0.5">{k.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[14px] font-semibold text-gray-800">Tren Absensi 7 Hari Terakhir</p>
          </div>
          <div className="flex gap-3">
            {[['#16A34A','Hadir'],['#F87171','Alpha']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background:c}}/><span className="text-[10px] text-gray-400">{l}</span></div>
            ))}
          </div>
        </div>
        {loading && (
          <div className="text-center py-5 text-gray-400 text-[12px]">Memuat tren laporan...</div>
        )}
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart id="rep-monthly-bar" data={chartData} barGap={1} barCategoryGap="30%">
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              <Bar dataKey="hadir" name="Hadir" fill="#16A34A" radius={[3,3,0,0]} isAnimationActive={false} />
              <Bar dataKey="alpha" name="Alpha" fill="#F87171" radius={[3,3,0,0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-5 text-gray-300 text-[11px]">Belum ada data tren absensi.</div>
        )}
      </div>

      {/* Monthly summary statistics */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-[14px] font-semibold text-gray-800 mb-3">Ringkasan Bulan Berjalan</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[11px] text-gray-400">Total Check-In Sukses</p>
            <p className="text-[20px] font-bold text-[#16A34A] mt-1">{summary?.this_month.hadir ?? 0} kali</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[11px] text-gray-400">Total Hari Tanpa Check-In (Alpha)</p>
            <p className="text-[20px] font-bold text-red-500 mt-1">{summary?.this_month.alpha ?? 0} kali</p>
          </div>
        </div>
      </div>
    </div>
  );
}
