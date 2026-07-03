import { useState, useEffect } from 'react';
import { FileText, Download, Users, Calendar, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { reportApi, ReportSummary, attendanceApi } from '../../../services/api';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { useAuth } from '../../../context/AuthContext';

export function ReportsTab() {
  const { logoUrl } = useAuth();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reportType, setReportType] = useState<'harian' | 'bulanan'>('harian');

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

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

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      if (reportType === 'harian') {
        const res = await attendanceApi.history(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data absensi.");
          return;
        }

        const headers = [
          "Tanggal",
          "NIP",
          "Nama Karyawan",
          "Departemen",
          "Jam Masuk",
          "Jam Keluar",
          "Durasi Kerja",
          "Status Kehadiran",
          "Lokasi GPS"
        ];

        const csvRows = [
          headers.join(","),
          ...res.data.map(r => [
            r.date,
            r.employee?.nip ?? '--',
            `"${(r.employee?.name ?? 'Karyawan').replace(/"/g, '""')}"`,
            `"${(r.employee?.department ?? 'Umum').replace(/"/g, '""')}"`,
            r.check_in ?? '--',
            r.check_out ?? '--',
            r.duration_min ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m` : '--',
            r.status.toUpperCase(),
            r.is_within_geofence ? "Terverifikasi" : "Tidak Terverifikasi"
          ].join(","))
        ];

        const csvContent = "\uFEFF" + csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Laporan_Detail_Kehadiran_Rumah_Sakit_Umum_Cempaka_Lima_${selectedYear}_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const res = await reportApi.monthlyRekap(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data rekap bulanan.");
          return;
        }

        const headers = [
          "NIP",
          "Nama Karyawan",
          "Departemen",
          "Hadir (Hari)",
          "Terlambat (Hari)",
          "Izin (Hari)",
          "Sakit (Hari)",
          "Cuti (Hari)",
          "Alpha (Hari)",
          "Total Durasi Kerja"
        ];

        const csvRows = [
          headers.join(","),
          ...res.data.map(r => [
            r.nip,
            `"${r.name.replace(/"/g, '""')}"`,
            `"${r.department.replace(/"/g, '""')}"`,
            r.hadir,
            r.telat,
            r.izin,
            r.sakit,
            r.cuti,
            r.alpha,
            r.duration_min ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m` : '0j 0m'
          ].join(","))
        ];

        const csvContent = "\uFEFF" + csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Laporan_Rekap_Bulanan_Rumah_Sakit_Umum_Cempaka_Lima_${selectedYear}_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengekspor Excel.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Mohon izinkan popup blocker untuk mencetak laporan.");
        return;
      }

      let tableHeaders = "";
      let tableRowsHtml = "";
      let reportTitle = "";

      if (reportType === 'harian') {
        const res = await attendanceApi.history(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data absensi.");
          return;
        }

        reportTitle = "Laporan Detail Kehadiran Harian";
        tableHeaders = `
          <tr>
            <th style="text-align: center; width: 40px;">No</th>
            <th>Tanggal</th>
            <th>NIP</th>
            <th>Nama Karyawan</th>
            <th>Departemen</th>
            <th style="text-align: center; width: 80px;">Jam Masuk</th>
            <th style="text-align: center; width: 80px;">Jam Keluar</th>
            <th style="text-align: center; width: 90px;">Durasi Kerja</th>
            <th style="text-align: center; width: 120px;">Lokasi GPS</th>
            <th style="text-align: center; width: 80px;">Status</th>
          </tr>
        `;

        tableRowsHtml = res.data.map((r, i) => `
          <tr style="border-bottom: 1px solid #E5E7EB; font-size: 11px;">
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${i + 1}</td>
            <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.date}</td>
            <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.employee?.nip ?? '--'}</td>
            <td style="padding: 8px; font-weight: bold; border-right: 1px solid #E5E7EB;">${r.employee?.name ?? 'Karyawan'}</td>
            <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.employee?.department ?? 'Umum'}</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB; font-family: monospace;">${r.check_in ?? '--'}</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB; font-family: monospace;">${r.check_out ?? '--'}</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.duration_min ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m` : '--'}</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB; font-size: 10px;">${r.is_within_geofence ? 'Terverifikasi' : 'Tidak Terverifikasi'}</td>
            <td style="padding: 8px; text-align: center; font-weight: bold; color: ${
              r.status === 'hadir' ? '#16A34A' : r.status === 'telat' ? '#D97706' : r.status === 'alpha' ? '#DC2626' : '#7C3AED'
            };">${r.status.toUpperCase()}</td>
          </tr>
        `).join("");
      } else {
        const res = await reportApi.monthlyRekap(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data rekap bulanan.");
          return;
        }

        reportTitle = "Laporan Rekap Bulanan Kehadiran";
        tableHeaders = `
          <tr>
            <th style="text-align: center; width: 40px;">No</th>
            <th>NIP</th>
            <th>Nama Karyawan</th>
            <th>Departemen</th>
            <th style="text-align: center; width: 60px;">Hadir</th>
            <th style="text-align: center; width: 60px;">Telat</th>
            <th style="text-align: center; width: 60px;">Izin</th>
            <th style="text-align: center; width: 60px;">Sakit</th>
            <th style="text-align: center; width: 60px;">Cuti</th>
            <th style="text-align: center; width: 60px;">Alpha</th>
            <th style="text-align: center; width: 100px;">Total Jam</th>
          </tr>
        `;

        tableRowsHtml = res.data.map((r, i) => `
          <tr style="border-bottom: 1px solid #E5E7EB; font-size: 11px;">
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${i + 1}</td>
            <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.nip}</td>
            <td style="padding: 8px; font-weight: bold; border-right: 1px solid #E5E7EB;">${r.name}</td>
            <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.department}</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.hadir} d</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.telat} d</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.izin} d</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.sakit} d</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.cuti} d</td>
            <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.alpha} d</td>
            <td style="padding: 8px; text-align: center; font-weight: bold;">${r.duration_min ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m` : '0j'}</td>
          </tr>
        `).join("");
      }

      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const periodStr = `${months[selectedMonth - 1]} ${selectedYear}`;

      const content = `
        <html>
        <head>
          <title>${reportTitle} - Rumah Sakit Umum Cempaka Lima</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; padding: 30px; margin: 0; }
            .header-table { width: 100%; border-bottom: 3px double #16A34A; padding-bottom: 12px; margin-bottom: 15px; }
            .logo-cell { width: 65px; text-align: left; vertical-align: middle; }
            .company-name { font-size: 15px; font-weight: 800; color: #16A34A; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .hospital-name { font-size: 22px; font-weight: 800; color: #DC2626; margin: 0; text-transform: uppercase; }
            .hospital-sub { font-size: 13px; color: #000000; margin: 3px 0 0 0; font-weight: 500; }
            .title { font-size: 14px; font-weight: 700; text-transform: uppercase; margin: 20px 0 5px 0; text-align: center; letter-spacing: 0.5px; }
            .period { font-size: 12px; font-weight: 600; text-align: center; margin-bottom: 15px; color: #374151; }
            .date-print { font-size: 9px; text-align: right; color: #6B7280; margin-bottom: 10px; }
            .data-table { width: 100%; border-collapse: collapse; border: 1px solid #E5E7EB; }
            .data-table th { background-color: #F9FAFB; color: #374151; font-weight: 600; text-align: left; padding: 10px 8px; border-bottom: 2px solid #E5E7EB; border-right: 1px solid #E5E7EB; font-size: 10px; text-transform: uppercase; }
            .footer-section { margin-top: 40px; display: flex; justify-content: flex-end; }
            .signature-block { width: 220px; text-align: center; font-size: 11px; }
            .signature-space { height: 60px; }
            @media print {
              @page { margin: 0; }
              body { padding: 2cm; margin: 0; }
            }
          </style>
        </head>
        <body>
          <table class="header-table" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 80px; text-align: left; vertical-align: middle; padding: 0;">
                <img src="${logoUrl && logoUrl !== 'none' ? logoUrl : logoImg}" style="width: 60px; height: 60px; object-fit: contain; display: block;" />
              </td>
              <td style="text-align: center; vertical-align: middle; padding: 0;">
                <p class="company-name">PT. CEMPAKA LIMA UTAMA</p>
                <h1 class="hospital-name">RUMAH SAKIT UMUM CEMPAKA LIMA</h1>
                <p class="hospital-sub">Jl. Politeknik Aceh No.23, Beurawe, Kec. Kuta Alam, Banda Aceh</p>
              </td>
              <td style="width: 80px; padding: 0;"></td>
            </tr>
          </table>
          
          <h2 class="title">${reportTitle}</h2>
          <div class="period">Periode: ${periodStr}</div>
          <div class="date-print">Dicetak pada: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'medium' })}</div>

          <table class="data-table">
            <thead>
              ${tableHeaders}
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-section">
            <div class="signature-block">
              <p>Banda Aceh, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p>Kepala Kepegawaian & Administrasi</p>
              <div class="signature-space"></div>
              <p style="text-decoration: underline; font-weight: bold;">( ________________________ )</p>
              <p style="color: #6B7280; font-size: 9px; margin-top: 3px;">NIP. RSUCL.2025.019</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(content);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mencetak PDF.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const totalEmp = summary?.total_employees ?? 0;
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
          <p className="text-[12px] text-gray-400 mt-0.5">Analitik dan statistik absensi Rumah Sakit Umum Cempaka Lima · Real-time</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPDF} 
            disabled={exporting}
            className="flex items-center gap-2 px-3.5 py-2 bg-red-50 border border-red-100 rounded-xl text-[12px] font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50"
          >
            <FileText size={13} /> {exporting ? 'Memproses...' : 'Export PDF'}
          </button>
          <button 
            onClick={handleExportExcel} 
            disabled={exporting}
            className="flex items-center gap-2 px-3.5 py-2 bg-green-50 border border-green-100 rounded-xl text-[12px] font-medium text-[#16A34A] hover:bg-green-100 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download size={13} /> {exporting ? 'Memproses...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipe Laporan</label>
          <div className="relative">
            <select value={reportType} onChange={e => setReportType(e.target.value as any)}
              className="appearance-none pl-3.5 pr-9 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all text-gray-700 font-semibold cursor-pointer">
              <option value="harian">Harian (Detail Kehadiran)</option>
              <option value="bulanan">Rekap Bulanan (Ringkasan)</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bulan</label>
          <div className="relative">
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none pl-3.5 pr-9 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all text-gray-700 font-semibold cursor-pointer">
              {[
                { v: 1, l: 'Januari' }, { v: 2, l: 'Februari' }, { v: 3, l: 'Maret' },
                { v: 4, l: 'April' }, { v: 5, l: 'Mei' }, { v: 6, l: 'Juni' },
                { v: 7, l: 'Juli' }, { v: 8, l: 'Agustus' }, { v: 9, l: 'September' },
                { v: 10, l: 'Oktober' }, { v: 11, l: 'November' }, { v: 12, l: 'Desember' }
              ].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tahun</label>
          <div className="relative">
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none pl-3.5 pr-9 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all text-gray-700 font-semibold cursor-pointer">
              {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
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
              <p className="text-[22px] font-bold text-black">{k.value}</p>
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
                  <Tooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px' }} />
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
