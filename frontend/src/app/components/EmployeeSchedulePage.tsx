import { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, Loader2, FileText, Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { scheduleApi, EmployeeMonthlySchedule } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { MonthYearDeptFilter } from './ui/MonthYearDeptFilter';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import rsLogoImg from '../../imports/rsucl_wide_logo.png';
import logoRsucl2019 from '../../imports/logo_rsucl_2019.png';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_ABBR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getDayHeaderStyle(dayOfWeek: number) {
  if (dayOfWeek === 0) return { color: '#E11D48', fontWeight: 700 }; // Minggu - merah
  return { color: '#374151', fontWeight: 500 };
}

export function EmployeeSchedulePage() {
  const { user, logoUrl } = useAuth();
  const today = new Date();
  
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [daysInMonth, setDaysInMonth] = useState(0);
  const [monthlyData, setMonthlyData] = useState<EmployeeMonthlySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadMonthlySchedule = useCallback(async () => {
    setLoading(true);
    try {
      // Normal employee only gets their own department automatically from backend scope
      const res = await scheduleApi.getMonthlySchedule(viewYear, viewMonth);
      if (res.success) {
        setMonthlyData(res.data);
        setDaysInMonth(res.days);
      }
    } catch (err) {
      console.error('Error fetching monthly schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => {
    loadMonthlySchedule();
  }, [loadMonthlySchedule]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(y => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(y => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const getShiftBadge = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.includes('LIBUR JAGA') || upper === 'LJ') return 'LJ';
    if (upper.includes('CUTI')) return 'C';
    if (upper.includes('SAKIT')) return 'SK';
    if (upper.includes('DINAS') || upper.includes('TUGAS')) return 'DL';
    if (upper.includes('IZIN')) return 'IZ';
    if (upper.includes('PAGI') || upper === 'P') return 'P';
    if (upper.includes('SIANG') || upper === 'S') return 'S';
    if (upper.includes('MALAM') || upper === 'M') return 'M';
    if (upper.includes('LIBUR') || upper.includes('OFF')) return '-';
    return name.trim().charAt(0).toUpperCase();
  };

  const getBase64Image = async (imgUrl: string): Promise<string> => {
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error(err);
      return "";
    }
  };

  const handlePrintPDF = async () => {
    if (filteredData.length === 0) {
      alert("Tidak ada data jadwal untuk dicetak.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Mohon izinkan popup blocker untuk mencetak laporan.");
      return;
    }

    try {
      const logoPath = logoRsucl2019;
      let base64Logo = "";
      if (logoPath) {
        try {
          base64Logo = await getBase64Image(logoPath);
        } catch (e) {
          console.error("Failed to load base64 logo", e);
        }
      }

      const shortDays = ['MG', 'SN', 'SL', 'RB', 'KM', 'JM', 'SB'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const monthLabel = months[viewMonth - 1];
      const deptName = user?.department || 'Bagian';

      // Generate table header columns
      let dateColsHtml = "";
      let dayColsHtml = "";
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(viewYear, viewMonth - 1, d);
        const dayName = shortDays[dateObj.getDay()];
        const isSunday = dateObj.getDay() === 0;
        
        const colStyle = isSunday 
          ? 'color: #DC2626; font-weight: bold; background-color: #FEF2F2;' 
          : '';

        dateColsHtml += `<th style="text-align: center; font-size: 9px; padding: 4px 2px; border: 1px solid #000; min-width: 22px; ${colStyle}">${d}</th>`;
        dayColsHtml += `<th style="text-align: center; font-size: 8px; padding: 4px 2px; border: 1px solid #000; min-width: 22px; ${colStyle}">${dayName}</th>`;
      }

      // Generate table rows
      let rowsHtml = "";
      filteredData.forEach((row, idx) => {
        let cellsHtml = "";
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const assign = row.dates[dateStr];
          
          const dateObj = new Date(viewYear, viewMonth - 1, d);
          const isSunday = dateObj.getDay() === 0;
          
          let code = "–";
          let cellBg = isSunday ? "#FEF2F2" : "#FFFFFF";
          let cellColor = isSunday ? "#DC2626" : "#000000";
          let isBold = false;

          if (assign) {
            const nameLower = assign.name.toLowerCase();
            isBold = true;
            if (nameLower.includes("pagi")) {
              code = "P";
              cellBg = "#E6F4EA";
              cellColor = "#137333";
            } else if (nameLower.includes("siang")) {
              code = "S";
              cellBg = "#E8F0FE";
              cellColor = "#1A73E8";
            } else if (nameLower.includes("malam")) {
              code = "M";
              cellBg = "#F3E8FF";
              cellColor = "#681DA8";
            } else if (nameLower.includes("normal") || nameLower.includes("reguler")) {
              code = "N";
              cellBg = "#FFFFFF";
              cellColor = "#374151";
            } else if (nameLower.includes("cuti")) {
              code = "C";
              cellBg = "#FCE8E6";
              cellColor = "#C5221F";
            } else if (nameLower.includes("sakit")) {
              code = "Skt";
              cellBg = "#FEF7E0";
              cellColor = "#B06000";
            } else if (nameLower.includes("libur")) {
              code = "L";
              cellBg = "#F1F3F4";
              cellColor = "#5F6368";
            } else {
              code = assign.name.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 3);
              cellBg = assign.color || "#F1F3F4";
              cellColor = "#000000";
            }
          }

          cellsHtml += `
            <td style="text-align: center; font-size: 9px; font-weight: ${isBold ? 'bold' : 'normal'}; padding: 4px 2px; border: 1px solid #000000; background-color: ${cellBg}; color: ${cellColor};">
              ${code}
            </td>
          `;
        }

        const isSelf =
          row.employee_id && user?.employee_id
            ? Number(row.employee_id) === Number(user.employee_id)
            : false;

        const roleBadge = row.role === 'pj_bagian' 
          ? `<span style="font-size: 7px; font-weight: bold; background-color: #FEF3C7; color: #D97706; padding: 1px 3px; border-radius: 3px; margin-left: 4px; border: 1px solid #FDE68A;">PJ</span>` 
          : '';

        rowsHtml += `
          <tr style="border: 1px solid #000000;">
            <td style="font-size: 9px; font-weight: bold; padding: 5px 8px; border: 1px solid #000000; color: #000000; white-space: nowrap; ${isSelf ? 'background-color: #E6F4EA;' : ''}">
              ${idx + 1}. ${row.name} ${isSelf ? '<b>(Anda)</b>' : ''} ${roleBadge}
            </td>
            ${cellsHtml}
          </tr>
        `;
      });

      const titleLabel = `JADWAL JAGA ${deptName.toUpperCase()} RUMAH SAKIT UMUM CEMPAKA LIMA`;

      const content = `
        <html>
        <head>
          <title>${titleLabel}</title>
          <style>
            body { font-family: 'Arial', sans-serif; color: #000000; padding: 20px; margin: 0; }
            .header-table { width: 100%; border-bottom: 2px solid #000000; padding-bottom: 6px; margin-bottom: 15px; }
            .company-name { font-size: 11px; font-weight: bold; color: #15803D; margin: 0 0 1px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .hospital-name { font-size: 16px; font-weight: bold; color: #DC2626; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .hospital-sub { font-size: 9px; color: #15803D; margin: 2px 0 0 0; font-weight: 500; line-height: 1.3; }
            .company-city { font-size: 10px; font-weight: bold; color: #15803D; margin: 2px 0 0 0; text-transform: uppercase; }
            .title { font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 15px 0 15px 0; text-align: center; letter-spacing: 0.5px; text-decoration: underline; }
            .data-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; }
            .data-table th { background-color: #F1F3F4; color: #000000; font-weight: bold; padding: 4px; border: 1px solid #000000; font-size: 9px; text-transform: uppercase; }
            @media print {
              @page { size: landscape; margin: 0.4cm; }
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body>
          <table class="header-table" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 160px; text-align: left; vertical-align: middle; padding: 0;">
                <img src="${base64Logo || logoPath}" style="height: 42px; width: auto; object-fit: contain; display: block;" />
              </td>
              <td style="text-align: center; vertical-align: middle; padding: 0;">
                <p class="company-name" style="margin: 0; font-size: 11px; font-weight: bold; color: #15803D; text-transform: uppercase; letter-spacing: 0.5px;">PT. CEMPAKA LIMA UTAMA</p>
                <h1 class="hospital-name" style="margin: 2px 0; font-size: 15px; font-weight: bold; color: #DC2626; text-transform: uppercase; letter-spacing: 0.5px;">RUMAH SAKIT UMUM CEMPAKA LIMA</h1>
                <p class="hospital-sub" style="margin: 1px 0; font-size: 8.5px; color: #15803D; font-weight: 550; line-height: 1.3;">Jln. Politeknik, Gp. Beurawe, Kecamatan Kuta Alam, Kode Pos 23124, Telp. (0651)3619999,</p>
                <p class="hospital-sub" style="margin: 1px 0; font-size: 8.5px; color: #15803D; font-weight: 550; line-height: 1.3;">Fax. (0651)3619999, email: rsu@cempakalima.co.id</p>
                <p class="company-city" style="margin: 2px 0 0 0; font-size: 9.5px; font-weight: bold; color: #15803D; text-transform: uppercase; letter-spacing: 0.5px;">BANDA ACEH</p>
              </td>
              <td style="width: 160px; padding: 0;"></td>
            </tr>
          </table>
          
          <h2 class="title">${titleLabel} <br/> PERIODE ${monthLabel.toUpperCase()} ${viewYear}</h2>

          <table class="data-table">
            <thead>
              <tr>
                <th rowspan="2" style="text-align: left; padding-left: 8px; border: 1px solid #000000; font-size: 9px;">NAMA PEGAWAI</th>
                <th colspan="${daysInMonth}" style="border: 1px solid #000000; font-size: 9px; letter-spacing: 1px;">TANGGAL</th>
              </tr>
              <tr>
                ${dateColsHtml}
              </tr>
              <tr>
                <th style="text-align: left; padding-left: 8px; border: 1px solid #000000; font-size: 9px;">HARI</th>
                ${dayColsHtml}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <div style="font-size: 9px; color: #000000; margin-top: 15px; display: flex; gap: 15px; font-weight: bold; border-top: 1px solid #E5E7EB; padding-top: 8px;">
            <span>Keterangan Shift:</span>
            <span>[P] Pagi</span>
            <span>[S] Siang</span>
            <span>[M] Malam</span>
            <span>[N] Normal / Kantor</span>
            <span>[C] Cuti</span>
            <span>[Skt] Sakit</span>
            <span>[–] Libur / OFF</span>
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
      printWindow.close();
    }
  };

  const filteredData = monthlyData.filter(row =>
    !searchQuery.trim() || row.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const days: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const today_str = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-3 md:px-0 py-4 md:py-6 font-sans">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>

      {/* Modern Title Banner */}
      <div className="bg-gradient-to-r from-[#16A34A] to-[#0D9240] rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-xl translate-y-6 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Unit Kerja</span>
            <h2 className="text-xl md:text-2xl font-bold mt-2">Jadwal Shift Bulanan</h2>
            <p className="text-[12.5px] text-white/80 mt-1">
              Memonitor jadwal dinas unit kerja <span className="font-bold underline text-white">{user?.department || 'RSU Cempaka Lima'}</span> secara transparan.
            </p>
          </div>
          <button
            onClick={handlePrintPDF}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-[#16A34A] hover:bg-slate-50 font-bold rounded-2xl text-[13px] transition-all shadow-md active:scale-95 flex-shrink-0 cursor-pointer self-start md:self-auto"
          >
            <FileText size={16} /> Cetak Jadwal
          </button>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Filter Controls */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-3.5">Periode Dinas</p>
            <MonthYearDeptFilter
              month={viewMonth}
              year={viewYear}
              showAllMonthsOption={false}
              embedded={true}
              onMonthChange={setViewMonth}
              onYearChange={setViewYear}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Bulan terpilih: <b className="text-slate-700">{MONTH_NAMES[viewMonth - 1]}</b></span>
            <span>Tahun: <b className="text-slate-700">{viewYear}</b></span>
          </div>
        </div>

        {/* Right: Search & Live Info Card */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Pencarian Karyawan</p>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-450" />
                <input
                  type="text"
                  placeholder="Cari nama rekan..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-2xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all font-medium"
                />
              </div>
            </div>
            
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-green-50 text-[#16A34A] text-[11px] font-bold rounded-full border border-green-100">
                <span className="w-1.5 h-1.5 bg-[#16A34A] rounded-full animate-pulse" />
                {daysInMonth} Hari Aktif
              </span>
            </div>
          </div>

          {/* Keterangan Shift Legend (Modern pills layout inside search card) */}
          <div className="pt-3.5 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Legenda Shift:</p>
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              <div className="flex items-center gap-1 bg-green-50 text-[#16A34A] px-2 py-1 rounded-lg border border-green-100 font-bold">
                <span>P</span> <span className="text-[9px] text-slate-400 font-normal">Pagi</span>
              </div>
              <div className="flex items-center gap-1 bg-blue-50 text-[#2563EB] px-2 py-1 rounded-lg border border-blue-100 font-bold">
                <span>S</span> <span className="text-[9px] text-slate-400 font-normal">Siang</span>
              </div>
              <div className="flex items-center gap-1 bg-purple-50 text-[#7C3AED] px-2 py-1 rounded-lg border border-purple-100 font-bold">
                <span>M</span> <span className="text-[9px] text-slate-400 font-normal">Malam</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 text-slate-800 px-2 py-1 rounded-lg border border-slate-200 font-bold">
                <span>N</span> <span className="text-[9px] text-slate-400 font-normal">Normal</span>
              </div>
              <div className="flex items-center gap-1 bg-orange-50 text-[#EA580C] px-2 py-1 rounded-lg border border-orange-100 font-bold">
                <span>C</span> <span className="text-[9px] text-slate-400 font-normal">Cuti</span>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 text-[#D97706] px-2 py-1 rounded-lg border border-amber-100 font-bold">
                <span>Skt</span> <span className="text-[9px] text-slate-400 font-normal">Sakit</span>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 text-gray-500 px-2 py-1 rounded-lg border border-gray-200 font-bold">
                <span>–</span> <span className="text-[9px] text-slate-350 font-normal">Libur</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container Box */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#16A34A]" />
            <span className="text-[13px] font-medium">Sinkronisasi jadwal dinas...</span>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar pb-1">
            <table className="text-[11px] border-collapse" style={{ minWidth: `${Math.max(800, 150 + daysInMonth * 44)}px` }}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="sticky left-0 z-20 bg-[#F8FAFC] text-left px-5 py-4 min-w-[150px] font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-r border-slate-200/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-slate-400" />
                      Karyawan
                    </div>
                  </th>
                  {days.map(day => {
                    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dow = new Date(viewYear, viewMonth - 1, day).getDay();
                    const isToday = dateStr === today_str;
                    return (
                      <th key={day}
                        className={`text-center py-2 px-1 font-semibold text-[10px] ${isToday ? 'bg-green-50/50' : ''}`}
                        style={{ minWidth: '42px', ...getDayHeaderStyle(dow) }}>
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75">{DAY_ABBR[dow]}</span>
                          <span className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-extrabold ${
                            isToday ? 'bg-[#16A34A] text-white shadow-xs shadow-green-150' : 'text-slate-700'
                          }`}>{day}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="text-center py-14 text-slate-400 text-[12px] italic">
                      {searchQuery ? 'Karyawan tidak ditemukan.' : 'Tidak ada data jadwal untuk unit kerja Anda.'}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, ri) => {
                    const isSelf =
                      row.employee_id && user?.employee_id
                        ? Number(row.employee_id) === Number(user.employee_id)
                        : false;

                    return (
                      <tr key={row.employee_id}
                        className={`border-b border-slate-50 group hover:bg-slate-50/30 transition-colors ${
                          isSelf ? 'bg-green-50/10' : ''
                        }`}>
                        <td className={`sticky left-0 z-20 ${
                          isSelf 
                            ? 'bg-[#F2FBF4]' 
                            : ri % 2 === 0 
                              ? 'bg-white' 
                              : 'bg-[#F8FAFC]/60'
                        } group-hover:bg-[#F0FDF4] px-5 py-3 border-r border-slate-200/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.04)] transition-colors`}>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 whitespace-nowrap text-[12.5px] tracking-wide">{row.name}</p>
                            {isSelf && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200/50 uppercase tracking-wider">
                                Anda
                              </span>
                            )}
                            {row.role === 'pj_bagian' && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-250/50 uppercase tracking-wider">
                                PJ
                              </span>
                            )}
                          </div>
                        </td>
                        {days.map(day => {
                          const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const assigned = row.dates[dateStr];
                          const dow = new Date(viewYear, viewMonth - 1, day).getDay();
                          const isToday = dateStr === today_str;
                          
                          let bg = 'transparent';
                          let text = '#64748B';
                          let label = '–';
                          let borderClass = 'border-transparent';

                          if (assigned) {
                            label = getShiftBadge(assigned.name);
                            const nameLower = assigned.name.toLowerCase();
                            if (nameLower.includes("pagi")) {
                              bg = "#F0FDF4"; text = "#16A34A"; borderClass = "border-[#BBF7D0]";
                            } else if (nameLower.includes("siang")) {
                              bg = "#EFF6FF"; text = "#2563EB"; borderClass = "border-[#BFDBFE]";
                            } else if (nameLower.includes("malam")) {
                              bg = "#F5F3FF"; text = "#7C3AED"; borderClass = "border-[#DDD6FE]";
                            } else if (nameLower.includes("normal") || nameLower.includes("reguler")) {
                              bg = "#F8FAFC"; text = "#0F172A"; borderClass = "border-slate-200";
                            } else if (nameLower.includes("cuti")) {
                              bg = "#FFF7ED"; text = "#EA580C"; borderClass = "border-orange-200";
                            } else if (nameLower.includes("sakit")) {
                              bg = "#FFFBEB"; text = "#D97706"; borderClass = "border-amber-200";
                            } else {
                              bg = `${assigned.color}10`; text = assigned.color || "#1F2937"; borderClass = "border-gray-200";
                            }
                          }
                          const isSunday = dow === 0;

                          return (
                            <td key={day}
                              className={`text-center py-2 px-0.5 border-r border-slate-100 relative ${
                                isToday ? 'bg-green-50/20' : ''
                              } ${isSunday ? 'bg-red-50/10' : ''}`}
                            >
                              <div className="flex items-center justify-center">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-extrabold border ${borderClass} transition-all hover:scale-105`}
                                  style={{ background: bg, color: text }}>
                                  {label}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
