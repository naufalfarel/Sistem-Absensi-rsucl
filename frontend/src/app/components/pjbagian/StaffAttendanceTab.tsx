import React, { useState, useEffect } from 'react';
import {
  Calendar, Search, RefreshCw, CheckCircle2, Clock, XCircle, FileText,
  Eye, Building2, UserCheck, AlertTriangle, ChevronLeft, ChevronRight, X, Image as ImageIcon,
  FileSpreadsheet, Download
} from 'lucide-react';
import { attendanceApi, AttendanceRecord, departmentApi } from '../../../services/api';
import { MonthYearDeptFilter, INDO_MONTHS } from '../ui/MonthYearDeptFilter';
import * as XLSX from 'xlsx';
// @ts-ignore
import XLSXStyle from 'xlsx-js-style';

interface StaffAttendanceTabProps {
  user: {
    id: number;
    name: string;
    username: string;
    nik_ktp: string;
    pj_bagian_department?: string;
    pj_bagian_department_id?: number;
    pj_departments?: Array<{ id: number; name: string }>;
  };
}

type FilterMode = 'monthly' | 'daily' | 'range';

export function StaffAttendanceTab({ user }: StaffAttendanceTabProps) {
  const currentDate = new Date();
  const todayStr = currentDate.toISOString().split('T')[0];

  // Filter Modes: 'monthly' (Default - Pilihan Bulan & Tahun), 'daily' (Harian), 'range' (Rentang Custom)
  const [filterMode, setFilterMode] = useState<FilterMode>('monthly');

  // Month & Year Filter state
  const [filterMonth, setFilterMonth] = useState<number>(currentDate.getMonth() + 1); // 1..12 (or 0 for all)
  const [filterYear, setFilterYear] = useState<number>(currentDate.getFullYear());

  // Department Filter State (Bisa Pilih Unit Kerja Spesifik)
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');

  // Fetch Available Departments for PJ Bagian
  useEffect(() => {
    const fetchDepts = async () => {
      if (user.pj_departments && user.pj_departments.length > 0) {
        setDepartments(user.pj_departments);
      } else {
        try {
          const res = await departmentApi.index();
          if (res.success && res.data) {
            setDepartments(res.data);
          }
        } catch (err) {
          console.error('Gagal mengambil daftar departemen:', err);
        }
      }
    };
    fetchDepts();
  }, [user]);

  // Single Date Filter
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Custom Date Range Filters
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Tanggal 1 bulan ini
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(todayStr);

  // Search & Status Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; per_page: number }>({
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 20
  });

  // Data & Summary
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<{ hadir: number; terlambat: number; alpha: number; cuti: number; tidak_lengkap: number }>({
    hadir: 0,
    terlambat: 0,
    alpha: 0,
    cuti: 0,
    tidak_lengkap: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  // Detail Modal State
  const [detailModalRecord, setDetailModalRecord] = useState<AttendanceRecord | null>(null);

  // Department label terpilih
  const currentDeptLabel = (() => {
    if (selectedDeptId !== 'all') {
      const found = departments.find(d => String(d.id) === String(selectedDeptId));
      if (found) return found.name;
    }
    if (user.pj_departments && user.pj_departments.length > 0) {
      return user.pj_departments.map(d => d.name).join(', ');
    }
    return user.pj_bagian_department || 'Semua Unit Kerja Bagian';
  })();

  // Hitung jumlah hari dalam 1 bulan
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  // Mendapatkan rentang tanggal & parameter query otomatis berdasarkan Filter Mode & Unit
  const getComputedParams = () => {
    const params: any = {
      page: currentPage,
      per_page: 20
    };

    let periodText = '';

    if (filterMode === 'monthly') {
      if (filterMonth === 0) {
        params.date_from = `${filterYear}-01-01`;
        params.date_to = `${filterYear}-12-31`;
        periodText = `Tahun ${filterYear} (Semua Bulan)`;
      } else {
        const lastDay = getDaysInMonth(filterYear, filterMonth);
        const mStr = String(filterMonth).padStart(2, '0');
        const monthName = INDO_MONTHS[filterMonth - 1];
        params.date_from = `${filterYear}-${mStr}-01`;
        params.date_to = `${filterYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;
        periodText = `${monthName} ${filterYear}`;
      }
    } else if (filterMode === 'daily') {
      params.date = selectedDate;
      const d = new Date(selectedDate);
      periodText = `Harian: ${d.getDate()} ${INDO_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    } else {
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      periodText = `Rentang: ${dateFrom} s/d ${dateTo}`;
    }

    if (selectedDeptId !== 'all') {
      params.department_id = selectedDeptId;
    }

    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    if (statusFilter !== 'all') {
      params.status = [statusFilter];
    }

    return { params, periodText };
  };

  const { params: activeParams, periodText: activePeriodText } = getComputedParams();

  // Fetch Attendance History & Summary from Backend
  const fetchData = async () => {
    setLoading(true);
    try {
      const summaryQueryParams: any = {};
      if (activeParams.date) summaryQueryParams.date = activeParams.date;
      if (activeParams.date_from) summaryQueryParams.date_from = activeParams.date_from;
      if (activeParams.date_to) summaryQueryParams.date_to = activeParams.date_to;
      if (activeParams.department_id) summaryQueryParams.department_id = activeParams.department_id;
      if (activeParams.search) summaryQueryParams.search = activeParams.search;

      const [historyRes, summaryRes] = await Promise.all([
        attendanceApi.historyAdmin(activeParams),
        attendanceApi.statusSummary(summaryQueryParams)
      ]);

      if (historyRes.success) {
        setRecords(historyRes.data || []);
        if (historyRes.meta) {
          setMeta(historyRes.meta);
        }
      }

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data absensi staf:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMode, filterMonth, filterYear, selectedDeptId, selectedDate, dateFrom, dateTo, statusFilter, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchData();
  };

  const formatDateShort = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getStatusBadge = (status?: string | null, displayStatus?: string | null) => {
    const st = displayStatus || status || 'tidak_ada_shift';

    switch (st) {
      case 'hadir':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-[#16A34A] border border-green-200 rounded-full text-[11px] font-bold">
            <CheckCircle2 size={12} /> Hadir Tepat Waktu
          </span>
        );
      case 'telat':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
            <Clock size={12} /> Terlambat
          </span>
        );
      case 'alpha':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-[11px] font-bold">
            <XCircle size={12} /> Alpa / Belum Absen
          </span>
        );
      case 'tidak_lengkap':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-[11px] font-bold">
            <AlertTriangle size={12} /> Tidak Lengkap
          </span>
        );
      case 'cuti':
      case 'sakit':
      case 'izin':
      case 'cuti_khusus':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[11px] font-bold capitalize">
            <FileText size={12} /> {st.replace('_', ' ')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-500 border border-gray-200 rounded-full text-[11px] font-medium">
            Libur / Off
          </span>
        );
    }
  };

  // ── EKSPOR DATA ABSENSI KE EXCEL (FORMAT CLEAN RAPI TANPA NIK & TANPA TTD) ──
  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Ambil seluruh data terfilter (sampai 1000 rekaman) untuk hasil ekspor komprehensif
      const exportParams = { ...activeParams, page: 1, per_page: 1000 };
      const res = await attendanceApi.historyAdmin(exportParams);
      const exportRecords: AttendanceRecord[] = (res.success && res.data && res.data.length > 0) ? res.data : records;

      const sanitizedDeptName = currentDeptLabel.replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedPeriod = activePeriodText.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Laporan_Absensi_Staf_${sanitizedDeptName}_${sanitizedPeriod}.xls`;

      const printDateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      // Generate HTML Data Rows (Tanpa Kolom NIK)
      const bodyRows = exportRecords.map((r, idx) => {
        const statusRaw = r.display_status || r.status || 'tidak_ada_shift';
        const statusText = statusRaw.toUpperCase().replace('_', ' ');
        const rawNote = r.note || '-';
        const noteText = ((statusRaw === 'hadir' || statusRaw === 'telat') && rawNote.startsWith('Masa ')) ? '-' : rawNote;

        return `
          <tr>
            <td style="border:1px solid #000000;text-align:center;padding:5px 8px;">${idx + 1}</td>
            <td style="border:1px solid #000000;text-align:left;padding:5px 8px;font-weight:bold;">${r.employee?.name || 'Karyawan'}</td>
            <td style="border:1px solid #000000;text-align:center;padding:5px 8px;">${formatDateShort(r.date)}</td>
            <td style="border:1px solid #000000;text-align:left;padding:5px 8px;">${r.employee?.department || currentDeptLabel}</td>
            <td style="border:1px solid #000000;text-align:center;padding:5px 8px;">${r.shift_name || 'Reguler'}</td>
            <td style="border:1px solid #000000;text-align:center;padding:5px 8px;">${r.check_in ? r.check_in.substring(0, 5) + ' WIB' : '-'}</td>
            <td style="border:1px solid #000000;text-align:center;padding:5px 8px;">${r.check_out ? r.check_out.substring(0, 5) + ' WIB' : '-'}</td>
            <td style="border:1px solid #000000;text-align:center;padding:5px 8px;font-weight:bold;">${statusText}</td>
            <td style="border:1px solid #000000;text-align:left;padding:5px 8px;font-style:italic;">${noteText}</td>
          </tr>
        `;
      }).join('');

      // Generate Full HTML Excel Document (Tanpa Kolom NIK & Tanpa TTD)
      const excelHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8" />
          <!--[if gte mso 9]><xml>
           <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
            <x:Name>Riwayat Absensi Staf</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
           </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
          </xml><![endif]-->
          <style>
            body { font-family: Calibri, Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            .header-title { font-size: 13pt; font-weight: bold; color: #111827; text-align: center; border: none; padding: 2px 4px; }
            .header-rs    { font-size: 11pt; font-weight: bold; color: #0B7A36; text-align: center; border: none; padding: 2px 4px; }
            .header-period{ font-size: 9.5pt; color: #4B5563; text-align: center; border: none; padding: 2px 4px; }
            .separator    { height: 3px; border: none; border-bottom: 2px solid #000000; padding: 0; }
            th { background-color: #F3F4F6; color: #1F2937; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 8px; }
            td { font-size: 10pt; border: 1px solid #000000; vertical-align: middle; padding: 5px 8px; color: #1F2937; }
            .center { text-align: center; }
            .bold   { font-weight: bold; }
          </style>
        </head>
        <body>
          <table style="border:none;margin-bottom:8px;border-collapse:collapse;">
            <tr style="height:22px;">
              <td colspan="9" class="header-title">DATA ABSENSI STAF BAGIAN</td>
            </tr>
            <tr style="height:18px;">
              <td colspan="9" class="header-rs">RUMAH SAKIT UMUM CEMPAKA LIMA</td>
            </tr>
            <tr style="height:16px;">
              <td colspan="9" class="header-period">
                Periode: ${activePeriodText} &nbsp;|&nbsp; Unit Kerja: ${currentDeptLabel} &nbsp;|&nbsp; PJ Bagian: ${user.name} &nbsp;|&nbsp; Ekspor: ${printDateStr}
              </td>
            </tr>
            <tr style="height:3px;"><td colspan="9" class="separator">&nbsp;</td></tr>
          </table>

          <table border="1">
            <thead>
              <tr>
                <th style="width:40px;">No</th>
                <th style="width:220px;text-align:left;">Nama Staf</th>
                <th style="width:150px;">Tanggal</th>
                <th style="width:160px;text-align:left;">Unit Kerja</th>
                <th style="width:120px;">Jadwal Shift</th>
                <th style="width:100px;">Jam Masuk</th>
                <th style="width:100px;">Jam Pulang</th>
                <th style="width:160px;">Status Kehadiran</th>
                <th style="width:200px;text-align:left;">Catatan</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Trigger instant Blob download
      const blob = new Blob(['\uFEFF' + excelHtml], {
        type: 'application/vnd.ms-excel;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('Gagal mengekspor file Excel:', err);
      alert('Gagal mengekspor data ke Excel. Silakan coba lagi.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* ── HEADER TITLE BANNER ────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#16A34A] to-[#0B7A36] rounded-3xl p-6 text-white shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full border-[20px] border-white/10 translate-x-8 -translate-y-8" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold mb-2 backdrop-blur-xs">
              <Building2 size={13} /> Unit Terpilih: {currentDeptLabel}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Riwayat Absensi Staf Bagian</h1>
            <p className="text-[12.5px] text-white/85 mt-1 leading-relaxed max-w-xl">
              Memantau status kehadiran staf di unit kerja Anda serta mengekspor laporan ke Excel.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            {/* Tombol Export Excel */}
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#16A34A] hover:bg-green-50 rounded-2xl text-[12px] font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={16} />
              {exporting ? 'Mengekspor Excel...' : 'Cetak ke Excel (.xlsx)'}
            </button>

            {/* Tombol Refresh */}
            <button
              onClick={() => { setCurrentPage(1); fetchData(); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-2xl text-[12px] font-bold transition-all border border-white/30 cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── SUMMARY COUNTER CARDS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {/* Total Hadir */}
        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-green-50 text-[#16A34A] border border-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Hadir Tepat Waktu</p>
            <p className="text-xl font-extrabold text-gray-900 mt-0.5">{summary.hadir}</p>
          </div>
        </div>

        {/* Terlambat */}
        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Terlambat</p>
            <p className="text-xl font-extrabold text-amber-600 mt-0.5">{summary.terlambat}</p>
          </div>
        </div>

        {/* Alpa */}
        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center flex-shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Alpa / Belum Absen</p>
            <p className="text-xl font-extrabold text-red-600 mt-0.5">{summary.alpha}</p>
          </div>
        </div>

        {/* Cuti / Sakit */}
        <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Cuti / Sakit / Izin</p>
            <p className="text-xl font-extrabold text-blue-600 mt-0.5">{summary.cuti}</p>
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR UTAMA ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-gray-150 shadow-xs space-y-4">
        {/* Top Row: Mode Selection & Search Form */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          {/* Filter Mode Toggle: Bulanan, Harian, Custom Rentang */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl w-fit">
            <button
              onClick={() => { setFilterMode('monthly'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${
                filterMode === 'monthly' ? 'bg-[#16A34A] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Filter Bulanan
            </button>
            <button
              onClick={() => { setFilterMode('daily'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${
                filterMode === 'daily' ? 'bg-[#16A34A] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => { setFilterMode('range'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${
                filterMode === 'range' ? 'bg-[#16A34A] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rentang Tanggal
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama staf bagian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2 border border-gray-200 rounded-2xl text-[12.5px] bg-gray-50 focus:bg-white focus:outline-none focus:border-[#16A34A] transition-all font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[12px] font-bold rounded-2xl transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Cari
            </button>
          </form>
        </div>

        {/* Bottom Row: Month/Year & Department Picker & Status Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 flex-wrap">
          {/* Date & Department Picker Component */}
          <div className="flex items-end gap-3 flex-wrap">
            {filterMode === 'monthly' && (
              <MonthYearDeptFilter
                month={filterMonth}
                year={filterYear}
                deptId={selectedDeptId}
                departments={departments}
                showAllMonthsOption={true}
                onMonthChange={(m) => { setFilterMonth(m); setCurrentPage(1); }}
                onYearChange={(y) => { setFilterYear(y); setCurrentPage(1); }}
                onDeptChange={(d) => { setSelectedDeptId(d); setCurrentPage(1); }}
                embedded={true}
              />
            )}

            {filterMode === 'daily' && (
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    PILIH TANGGAL
                  </label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 shadow-xs">
                    <Calendar size={15} className="text-[#16A34A]" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
                      className="bg-transparent text-[13px] font-bold text-gray-800 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Dropdown Bagian/Unit untuk Harian */}
                {departments.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      UNIT KERJA / BAGIAN
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => { setSelectedDeptId(e.target.value); setCurrentPage(1); }}
                      className="px-4 py-2 border border-gray-200 rounded-full text-[13px] font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#16A34A] cursor-pointer shadow-xs min-w-[180px]"
                    >
                      <option value="all">Semua Unit Kerja</option>
                      {departments.map((d) => (
                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {filterMode === 'range' && (
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">DARI TANGGAL</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 shadow-xs">
                    <Calendar size={15} className="text-[#16A34A]" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                      className="bg-transparent text-[13px] font-bold text-gray-800 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
                <span className="text-gray-400 font-bold text-xs pb-2">s/d</span>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">SAMPAI TANGGAL</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 shadow-xs">
                    <Calendar size={15} className="text-[#16A34A]" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                      className="bg-transparent text-[13px] font-bold text-gray-800 focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Dropdown Bagian/Unit untuk Rentang Tanggal */}
                {departments.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      UNIT KERJA / BAGIAN
                    </label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => { setSelectedDeptId(e.target.value); setCurrentPage(1); }}
                      className="px-4 py-2 border border-gray-200 rounded-full text-[13px] font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#16A34A] cursor-pointer shadow-xs min-w-[180px]"
                    >
                      <option value="all">Semua Unit Kerja</option>
                      {departments.map((d) => (
                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">STATUS KEHADIRAN</label>
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full p-1 overflow-x-auto scrollbar-none">
              {[
                { id: 'all', label: 'Semua Status' },
                { id: 'hadir', label: 'Hadir' },
                { id: 'telat', label: 'Terlambat' },
                { id: 'alpha', label: 'Alpa' },
                { id: 'cuti', label: 'Cuti / Sakit' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setStatusFilter(f.id); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-full text-[11.5px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === f.id
                      ? 'bg-[#16A34A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLE ATTENDANCE MONITORING LIST ────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-150 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-[#16A34A]" />
            <h3 className="text-[14.5px] font-bold text-gray-900">Daftar Kehadiran Staf</h3>
            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {currentDeptLabel} ({activePeriodText})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11.5px] text-gray-500 font-semibold">
              Total {meta.total} rekaman
            </span>
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#16A34A] hover:text-[#0d9240] bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet size={14} /> {exporting ? 'Mengekspor...' : 'Cetak ke Excel'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-[13px] flex flex-col items-center gap-2">
            <RefreshCw size={22} className="animate-spin text-[#16A34A]" />
            <span>Memuat data absensi staf...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center text-gray-400 space-y-2 p-4">
            <UserCheck size={36} className="mx-auto text-gray-300" />
            <p className="text-[13px] font-bold text-gray-700">Tidak ada rekaman absensi ditemukan</p>
            <p className="text-[12px] text-gray-400 max-w-sm mx-auto">
              Cobalah untuk memilih unit kerja, bulan/tahun, atau merubah filter nama staf yang Anda cari.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[10px] font-extrabold border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Staf</th>
                  <th className="py-3.5 px-4">Tanggal</th>
                  <th className="py-3.5 px-4">Shift & Jadwal</th>
                  <th className="py-3.5 px-4">Jam Masuk</th>
                  <th className="py-3.5 px-4">Jam Pulang</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Detail & Foto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {records.map((rec, idx) => {
                  const empName = rec.employee?.name || 'Karyawan';
                  const empDept = rec.employee?.department || '-';

                  return (
                    <tr key={rec.id || idx} className="hover:bg-gray-50/70 transition-colors">
                      {/* Staf Profile (Tanpa NIK) */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-[#16A34A] text-[12px] overflow-hidden flex-shrink-0">
                            {rec.employee?.profile_picture ? (
                              <img src={rec.employee.profile_picture} alt={empName} className="w-full h-full object-cover" />
                            ) : (
                              empName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 leading-tight">{empName}</p>
                            <p className="text-[10.5px] text-gray-500 mt-0.5 font-semibold">
                              Unit: <span className="text-gray-700">{empDept}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tanggal */}
                      <td className="py-3.5 px-4 font-semibold text-gray-700 whitespace-nowrap">
                        {formatDateShort(rec.date)}
                      </td>

                      {/* Shift & Shift Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-gray-800 block text-[12px]">
                          {rec.shift_name || 'Reguler'}
                        </span>
                        {rec.shift_type === 'dinas_luar' && (
                          <span className="inline-block mt-0.5 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Dinas Luar
                          </span>
                        )}
                      </td>

                      {/* Jam Masuk */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rec.check_in ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-1 rounded-xl text-[12px]">
                            {rec.check_in.substring(0, 5)} WIB
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11.5px] italic">-</span>
                        )}
                      </td>

                      {/* Jam Pulang */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rec.check_out ? (
                          <span className="font-bold text-blue-700 bg-blue-50 border border-blue-150 px-2.5 py-1 rounded-xl text-[12px]">
                            {rec.check_out.substring(0, 5)} WIB
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11.5px] italic">-</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(rec.status, rec.display_status)}
                      </td>

                      {/* Read-Only Action: Detail Modal Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setDetailModalRecord(rec)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-[11.5px] font-bold text-gray-700 transition-all cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <Eye size={13} className="text-[#16A34A]" /> Detail Foto & Lokasi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PAGINATION BAR ────────────────────────────────────────────── */}
        {meta.last_page > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3 bg-gray-50/50">
            <p className="text-[12px] text-gray-500 font-medium">
              Halaman <span className="font-bold text-gray-800">{meta.current_page}</span> dari <span className="font-bold text-gray-800">{meta.last_page}</span> ({meta.total} total)
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Sebelumnya
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(meta.last_page, p + 1))}
                disabled={currentPage === meta.last_page || loading}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                Berikutnya <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── READ-ONLY DETAIL MODAL (FOTO & LOKASI ABSEN) ────────────────── */}
      {detailModalRecord && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden font-sans border border-gray-100 my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-green-100 text-[#16A34A] flex items-center justify-center font-bold">
                  <UserCheck size={16} />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-bold text-gray-900">Detail Monitoring Absensi</h3>
                  <p className="text-[11px] text-gray-500">{formatDateShort(detailModalRecord.date)}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalRecord(null)}
                className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Profil Staf Info */}
              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-150 flex items-center justify-between text-[12px]">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Nama Staf:</span>
                  <span className="font-extrabold text-gray-900 text-[13.5px]">{detailModalRecord.employee?.name || 'Karyawan'}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Unit / Jabatan:</span>
                  <span className="font-bold text-gray-800">{detailModalRecord.employee?.department || '-'}</span>
                </div>
              </div>

              {/* Status & Shift */}
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="p-3 bg-gray-50/70 border border-gray-100 rounded-2xl">
                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">Status Kehadiran</span>
                  <div className="mt-1">{getStatusBadge(detailModalRecord.status, detailModalRecord.display_status)}</div>
                </div>
                <div className="p-3 bg-gray-50/70 border border-gray-100 rounded-2xl">
                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block">Jadwal Shift</span>
                  <span className="font-bold text-gray-800 mt-1 block">{detailModalRecord.shift_name || 'Reguler'}</span>
                </div>
              </div>

              {/* Foto Selfie Check-in & Check-out */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-[#16A34A]" /> Foto Bukti Absensi (Selfie)
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Foto Check-in */}
                  <div className="space-y-1.5 text-center">
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                      Masuk: {detailModalRecord.check_in ? detailModalRecord.check_in.substring(0, 5) + ' WIB' : 'Belum Absen'}
                    </span>
                    {detailModalRecord.checkin_photo_url || detailModalRecord.image_check_in ? (
                      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black/5 aspect-square relative shadow-xs">
                        <img
                          src={detailModalRecord.checkin_photo_url || detailModalRecord.image_check_in || ''}
                          alt="Foto Masuk"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 aspect-square flex flex-col items-center justify-center p-3 text-gray-400">
                        <ImageIcon size={24} className="mb-1 opacity-50" />
                        <span className="text-[10px] font-semibold text-center">Tidak Ada Foto Masuk</span>
                      </div>
                    )}
                    {detailModalRecord.checkin_location_note && (
                      <p className="text-[10.5px] text-gray-500 italic mt-1 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        📍 "{detailModalRecord.checkin_location_note}"
                      </p>
                    )}
                  </div>

                  {/* Foto Check-out */}
                  <div className="space-y-1.5 text-center">
                    <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                      Pulang: {detailModalRecord.check_out ? detailModalRecord.check_out.substring(0, 5) + ' WIB' : 'Belum Absen'}
                    </span>
                    {detailModalRecord.checkout_photo_url || detailModalRecord.image_check_out ? (
                      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black/5 aspect-square relative shadow-xs">
                        <img
                          src={detailModalRecord.checkout_photo_url || detailModalRecord.image_check_out || ''}
                          alt="Foto Pulang"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 aspect-square flex flex-col items-center justify-center p-3 text-gray-400">
                        <ImageIcon size={24} className="mb-1 opacity-50" />
                        <span className="text-[10px] font-semibold text-center">Tidak Ada Foto Pulang</span>
                      </div>
                    )}
                    {detailModalRecord.checkout_location_note && (
                      <p className="text-[10.5px] text-gray-500 italic mt-1 bg-gray-50 p-2 rounded-xl border border-gray-100">
                        📍 "{detailModalRecord.checkout_location_note}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Catatan / Notes - hanya tampilkan jika bukan catatan sistem otomatis */}
              {detailModalRecord.note && 
               detailModalRecord.note !== 'Tidak Hadir Tanpa Keterangan' &&
               detailModalRecord.note !== 'Belum Absen Masuk' && (
                <div className="p-3 bg-amber-50 border border-amber-150 rounded-2xl text-[11.5px] text-amber-900">
                  <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700">Catatan Absensi:</span>
                  <p className="mt-0.5 font-medium">{detailModalRecord.note}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-right">
              <button
                onClick={() => setDetailModalRecord(null)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-[12.5px] font-bold rounded-2xl transition-all cursor-pointer"
              >
                Tutup Monitoring
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
