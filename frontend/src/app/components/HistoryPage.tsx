import { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, MapPin, Clock, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { attendanceApi, AttendanceRecord } from '../../services/api';

/* ─── Status Config ─────────────────────────────────────────── */
const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  hadir:  { label: 'Hadir',     color: '#16A34A', bg: '#DCFCE7' },
  telat:  { label: 'Terlambat', color: '#D97706', bg: '#FEF3C7' },
  alpha:  { label: 'Alpha',     color: '#DC2626', bg: '#FEE2E2' },
  izin:   { label: 'Izin',      color: '#2563EB', bg: '#DBEAFE' },
  sakit:  { label: 'Sakit',     color: '#EA580C', bg: '#FFF7ED' },
  cuti:   { label: 'Cuti',      color: '#7C3AED', bg: '#F5F3FF' },
};

const statusFilters = ['Semua', 'Hadir', 'Terlambat', 'Izin/Sakit'];

/* ─── Range Filter Types ─────────────────────────────────────── */
type RangeMode = '7d' | '1m' | '3m' | 'custom';

interface RangeOption { id: RangeMode; label: string }

const rangeOptions: RangeOption[] = [
  { id: '7d', label: '7 Hari Terakhir' },
  { id: '1m', label: '1 Bulan Terakhir' },
  { id: '3m', label: '3 Bulan Terakhir' },
  { id: 'custom', label: 'Pilih Bulan' },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days   = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getDurationStr(mins: number | null): string {
  if (!mins) return '--';
  return `${Math.floor(mins / 60)}j ${mins % 60}m`;
}

/** Filter records client-side by date range */
function applyDateRange(records: AttendanceRecord[], mode: RangeMode, customMonth: number, customYear: number): AttendanceRecord[] {
  const now = new Date();
  if (mode === 'custom') {
    return records.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === customMonth && d.getFullYear() === customYear;
    });
  }
  const cutoff = new Date(now);
  if (mode === '7d') cutoff.setDate(now.getDate() - 7);
  else if (mode === '1m') cutoff.setMonth(now.getMonth() - 1);
  else if (mode === '3m') cutoff.setMonth(now.getMonth() - 3);
  return records.filter(r => new Date(r.date) >= cutoff);
}

/* ─── Month Names ────────────────────────────────────────────── */
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

/* ─── Main Component ─────────────────────────────────────────── */
/**
 * Halaman Riwayat Kehadiran Karyawan (HistoryPage) — Sistem Absensi RSUCL
 * 
 * Menampilkan data historis absensi karyawan bersangkutan. Dilengkapi dengan filter
 * rentang waktu cepat (7 hari, 1 bulan, 3 bulan, custom per bulan), grafik distribusi sebaran,
 * pencarian dinamis, dan tabulasi kategori status absensi (Hadir, Terlambat, Izin/Sakit).
 */
export function HistoryPage() {
  const now = new Date();

  // Filter status aktif ('Semua', 'Hadir', 'Terlambat', 'Izin/Sakit')
  const [activeStatus, setActiveStatus] = useState('Semua');
  
  // Kata kunci pencarian untuk menyaring data riwayat
  const [searchQuery,  setSearchQuery]  = useState('');
  
  // State menampung seluruh daftar riwayat absensi yang didapatkan dari API
  const [allRecords,   setAllRecords]   = useState<AttendanceRecord[]>([]);
  
  // Indikator loading data riwayat
  const [loading,      setLoading]      = useState(false);

  // States untuk pengelolaan filter rentang waktu (default: '1m' / 1 bulan terakhir)
  const [rangeMode,    setRangeMode]    = useState<RangeMode>('1m');
  const [customMonth,  setCustomMonth]  = useState(now.getMonth() + 1);
  const [customYear,   setCustomYear]   = useState(now.getFullYear());
  const [showRange,    setShowRange]    = useState(false);

  /**
   * Mengambil data riwayat absensi bulanan user aktif dari API backend.
   */
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.history();
      if (res.success) setAllRecords(res.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Panggil loadHistory saat komponen dimuat pertama kali
  useEffect(() => { loadHistory(); }, [loadHistory]);

  /* ── Derived data ───────────────────────────────────────────── */
  const rangeFiltered = applyDateRange(allRecords, rangeMode, customMonth, customYear);

  const mapped = rangeFiltered.map(r => ({
    rawDate: r.date,
    date:     formatDate(r.date),
    checkIn:  r.check_in  ? r.check_in.substring(0, 5)  : '--',
    checkOut: r.check_out ? r.check_out.substring(0, 5) : '--',
    duration: getDurationStr(r.duration_min),
    location: r.latitude ? 'RSUCL – Terverifikasi' : '--',
    status:   r.status,
    shift:    r.shift_name ?? 'Reguler',
    checkinLocationNote: r.checkin_location_note,
    checkoutLocationNote: r.checkout_location_note,
    isEarlyCheckout: r.is_early_checkout,
    earlyCheckoutReason: r.early_checkout_reason,
    earlyCheckoutStatus: r.early_checkout_status,
    earlyCheckoutAdminNote: r.early_checkout_admin_note,
    isOvertime: r.is_overtime,
    overtimeMinutes: r.overtime_minutes,
    overtimeNote: r.overtime_note,
  }));

  const filtered = mapped.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch = r.date.toLowerCase().includes(q) || r.status.toLowerCase().includes(q);
    if (activeStatus === 'Hadir')     return matchSearch && r.status === 'hadir';
    if (activeStatus === 'Terlambat') return matchSearch && r.status === 'telat';
    if (activeStatus === 'Izin/Sakit') return matchSearch && ['izin','sakit','cuti'].includes(r.status);
    return matchSearch;
  });

  // Stats from range-filtered records
  const totalDays    = rangeFiltered.length;
  const hadirCount   = rangeFiltered.filter(r => r.status === 'hadir' || r.status === 'telat').length;
  const telatCount   = rangeFiltered.filter(r => r.status === 'telat').length;
  const alphaCount   = rangeFiltered.filter(r => r.status === 'alpha').length;
  const izinCount    = rangeFiltered.filter(r => ['izin','sakit','cuti'].includes(r.status)).length;

  // Single-row chart data (grouped bar) for clean proportional rendering
  const chartData = [
    { name: 'Hadir',     value: hadirCount },
    { name: 'Terlambat', value: telatCount },
    { name: 'Alpha',     value: alphaCount },
    { name: 'Izin/Sakit', value: izinCount },
  ];
  const chartMax = Math.max(...chartData.map(d => d.value), 1);
  const yMax     = chartMax + Math.ceil(chartMax * 0.25) || 2; // 25% headroom, min 2

  /* ── Range label ─────────────────────────────────────────────── */
  const currentRangeLabel = rangeMode === 'custom'
    ? `${MONTHS[customMonth - 1]} ${customYear}`
    : rangeOptions.find(r => r.id === rangeMode)?.label ?? '';

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Riwayat Absensi</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Rekap kehadiran Anda</p>
        </div>
      </div>

      {/* ── Range Filter Bar ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-gray-700">Rentang Waktu</p>
          <span className="text-[11px] text-[#16A34A] font-medium bg-green-50 px-2 py-0.5 rounded-full">
            {currentRangeLabel}
          </span>
        </div>

        {/* Quick range chips */}
        <div className="flex flex-wrap gap-2">
          {rangeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                setRangeMode(opt.id);
                if (opt.id === 'custom') setShowRange(true);
                else setShowRange(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                rangeMode === opt.id
                  ? 'bg-[#16A34A] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom month/year picker */}
        {rangeMode === 'custom' && (
          <div className="mt-3 flex gap-2 items-center">
            <select
              value={customMonth}
              onChange={e => setCustomMonth(Number(e.target.value))}
              className="flex-1 text-[12px] border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={customYear}
              onChange={e => setCustomYear(Number(e.target.value))}
              className="w-28 text-[12px] border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all"
            >
              {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Hari Hadir',   value: String(hadirCount), total: ' hari', color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Terlambat',    value: String(telatCount), total: ' hari', color: '#D97706', bg: '#FFFBEB' },
          { label: 'Alpha',        value: String(alphaCount), total: ' hari', color: '#DC2626', bg: '#FFF5F5' },
          { label: 'Izin / Sakit', value: String(izinCount),  total: ' hari', color: '#2563EB', bg: '#DBEAFE' },
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
        <p className="text-[14px] font-semibold text-gray-800 mb-4">
          Grafik Sebaran Kehadiran
          <span className="ml-2 text-[11px] font-normal text-gray-400">({currentRangeLabel})</span>
        </p>
        {totalDays > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="35%"
            >
              <CartesianGrid vertical={false} stroke="#F3F4F6" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, yMax]}
                tickCount={Math.min(yMax + 1, 6)}
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                width={22}
              />
              <Tooltip
                contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                formatter={(value: number) => [`${value} hari`, 'Jumlah']}
                cursor={{ fill: '#F9FAFB' }}
              />
              <Bar
                dataKey="value"
                radius={[5, 5, 0, 0]}
                isAnimationActive
                animationDuration={600}
                label={{ position: 'top', fontSize: 10, fill: '#9CA3AF', formatter: (v: number) => v > 0 ? String(v) : '' }}
              >
                {chartData.map((_entry, i) => {
                  const colors = ['#16A34A', '#FBBF24', '#F87171', '#60A5FA'];
                  return <Cell key={`cell-${i}`} fill={colors[i]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[180px] flex items-center justify-center text-gray-300 text-[12px]">
            Belum ada data pada rentang waktu ini.
          </div>
        )}
      </div>

      {/* Status Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
          {statusFilters.map(f => (
            <button
              key={f}
              onClick={() => setActiveStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                activeStatus === f
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
            placeholder="Cari tanggal atau status..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all placeholder:text-gray-300"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Records count */}
      {!loading && (
        <p className="text-[11px] text-gray-400 mb-3">
          Menampilkan <span className="font-semibold text-gray-600">{filtered.length}</span> dari{' '}
          <span className="font-semibold text-gray-600">{rangeFiltered.length}</span> data pada{' '}
          <span className="font-semibold text-gray-600">{currentRangeLabel}</span>
        </p>
      )}

      {/* Records list */}
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
                  { icon: Clock,      label: 'Jam Masuk', value: record.checkIn,  color: '#2563EB' },
                  { icon: Clock,      label: 'Jam Keluar', value: record.checkOut, color: '#DC2626' },
                  { icon: TrendingUp, label: 'Durasi',    value: record.duration, color: '#7C3AED' },
                  { icon: MapPin,     label: 'Lokasi',    value: record.location, color: '#EA580C' },
                ].map(({ icon: Icon, label, value }, j) => (
                  <div key={j} className="px-4 py-3">
                    <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                    <p className="text-[13px] font-medium text-black truncate">{value}</p>
                  </div>
                ))}
              </div>
              {(record.checkinLocationNote || record.checkoutLocationNote || record.isEarlyCheckout || record.isOvertime) && (
                <div className="px-5 py-2.5 bg-gray-50/70 border-t border-gray-50 text-[11.5px] text-gray-500 space-y-2">
                  {/* Location Notes */}
                  {(record.checkinLocationNote || record.checkoutLocationNote) && (
                    <div className="space-y-1">
                      {record.checkinLocationNote && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11.5} className="text-[#16A34A] flex-shrink-0" />
                          <span><span className="font-semibold text-gray-600">Lokasi Masuk:</span> {record.checkinLocationNote}</span>
                        </div>
                      )}
                      {record.checkoutLocationNote && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11.5} className="text-red-500 flex-shrink-0" />
                          <span><span className="font-semibold text-gray-600">Lokasi Pulang:</span> {record.checkoutLocationNote}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Early Checkout Info */}
                  {record.isEarlyCheckout && (
                    <div className="pt-1.5 border-t border-gray-100/50 flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0">
                        Pulang Cepat
                      </span>
                      <span className="text-[11px] text-gray-600">
                        <span className="font-semibold">Alasan:</span> {record.earlyCheckoutReason || 'Tidak diisi'}
                      </span>
                    </div>
                  )}

                  {/* Overtime Info */}
                  {record.isOvertime && (
                    <div className="pt-1.5 border-t border-gray-100/50 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                          Lembur (+{record.overtimeMinutes} mnt)
                        </span>
                      </div>
                      <div className="flex-1 text-gray-600">
                        <span><span className="font-semibold text-gray-600">Pekerjaan Lembur:</span> {record.overtimeNote || 'Tanpa keterangan'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-center py-12">
          <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-gray-400">Tidak ada data pada rentang waktu ini</p>
          <p className="text-[12px] text-gray-300 mt-1">Coba pilih rentang waktu yang berbeda</p>
        </div>
      )}
    </div>
  );
}
