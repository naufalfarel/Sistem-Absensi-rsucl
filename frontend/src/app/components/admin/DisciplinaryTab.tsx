import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, AlertTriangle, FileText, Search, Plus, Filter, 
  Trash2, XCircle, CheckCircle2, ChevronLeft, ChevronRight, 
  Paperclip, Loader2, Building2, User, Info, ExternalLink, Download
} from 'lucide-react';
import { disciplinarySanctionApi, DisciplinarySanction, departmentApi, employeeApi, Employee } from '../../../services/api';
import logoImg from "../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg";
import { useAuth } from "../../../context/AuthContext";

const typeLabels: Record<string, string> = {
  teguran: 'Surat Teguran',
  sp1: 'Surat Peringatan 1 (SP1)',
  sp2: 'Surat Peringatan 2 (SP2)',
  phk: 'Surat Pemutusan Hubungan Kerja (PHK)'
};

export const DisciplinaryTab: React.FC = () => {
  const { logoUrl } = useAuth();
  const [sanctions, setSanctions] = useState<DisciplinarySanction[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  
  // Table state / Filters
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Form Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<'teguran' | 'sp1' | 'sp2' | 'phk'>('teguran');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [chronologyFile, setChronologyFile] = useState<File | null>(null);
  const [adminNote, setAdminNote] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await disciplinarySanctionApi.list({
        type: filterType,
        department_id: deptFilter ? Number(deptFilter) : undefined,
        search: searchQuery.trim(),
      });
      if (res.success) {
        setSanctions(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat sanksi disiplin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterType, deptFilter]);

  useEffect(() => {
    // Load departments & employees
    departmentApi.list().then(res => {
      if (res.success) setDepartments(res.data);
    });
    employeeApi.list().then(res => {
      if (res.success) setAllEmployees(res.data);
    });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExportExcel = async () => {
    try {
      let base64Logo = "";
      try {
        const response = await fetch(logoUrl && logoUrl !== "none" ? logoUrl : logoImg);
        const blob = await response.blob();
        base64Logo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Failed to load logo for Excel", e);
      }

      const logoImgHtml = base64Logo
        ? `<img src="${base64Logo}" width="140" height="54" style="display:block;" />`
        : '<span style="font-size:11pt;font-weight:bold;color:#DC2626;">RSUCL</span>';

      const todayStr = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      let bodyRows = "";
      sanctions.forEach((san, index) => {
        const typeStyle = getSanctionStyle(san.type);
        const employeeName = san.employee?.user?.name || "--";
        const employeeNik = san.employee?.nik_ktp || "--";
        const employeeDept = san.employee?.department?.name || "--";
        const sanctionType = typeStyle.label || san.type;
        const note = san.admin_note || "--";
        const createdDate = formatDate(san.created_at);
        const creatorName = san.creator?.name || "Admin";

        bodyRows += `
          <tr>
            <td style="text-align:center; font-weight:bold;">${index + 1}</td>
            <td style="text-align:center; font-family:monospace; mso-number-format:'\\@';" x:str>${employeeNik}</td>
            <td style="text-align:left; font-weight:bold;">${employeeName}</td>
            <td style="text-align:left;">${employeeDept}</td>
            <td style="text-align:center; font-weight:bold; color:#B91C1C;">${sanctionType}</td>
            <td style="text-align:left; vertical-align:top; white-space:normal;">${note}</td>
            <td style="text-align:center;">${createdDate}</td>
            <td style="text-align:left;">${creatorName}</td>
          </tr>
        `;
      });

      const bodyHtml = `
        <table style="border:none; margin-bottom:12px; border-collapse:collapse;">
          <tr style="height:22px;">
            <td rowspan="3" colspan="2" class="logo-cell">${logoImgHtml}</td>
            <td colspan="6" class="header-title" style="text-align:right;">LAPORAN KEDISIPLINAN &amp; SANKSI STAF</td>
          </tr>
          <tr style="height:18px;">
            <td colspan="6" class="header-rs" style="text-align:right;">RSU CEMPAKA LIMA</td>
          </tr>
          <tr style="height:16px;">
            <td colspan="6" class="header-period" style="text-align:right;">Dicetak Tanggal: ${todayStr} | Total Rekaman: ${sanctions.length} Kasus</td>
          </tr>
          <tr style="height:3px;">
            <td colspan="8" class="separator">&nbsp;</td>
          </tr>
        </table>

        <h3 style="margin-top:20px; color:#991B1B; font-size:11pt; font-family:Calibri,sans-serif; font-weight:bold;">DAFTAR REKAMAN TATA TERTIB &amp; SANKSI DISIPLIN PEGAWAI</h3>
        <table style="width:100%; border:1px solid #000000; border-collapse:collapse;">
          <colgroup>
            <col width="45" style="width:45px;" />
            <col width="150" style="width:150px;" />
            <col width="200" style="width:200px;" />
            <col width="150" style="width:150px;" />
            <col width="180" style="width:180px;" />
            <col width="300" style="width:300px;" />
            <col width="110" style="width:110px;" />
            <col width="150" style="width:150px;" />
          </colgroup>
          <thead>
            <tr>
              <th style="width:45px; text-align:center;">No</th>
              <th style="width:150px; text-align:center;">NIK KTP</th>
              <th style="text-align:left;">Nama Staf / Pegawai</th>
              <th style="text-align:left;">Unit Kerja</th>
              <th style="text-align:center;">Jenis Sanksi</th>
              <th style="text-align:left;">Catatan Pelanggaran</th>
              <th style="text-align:center;">Tanggal Terbit</th>
              <th style="text-align:left;">Diterbitkan Oleh</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      `;

      const excelWrapper = (sheetName: string, bodyHtmlStr: string) => `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8" />
          <!--[if gte mso 9]><xml>
           <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
            <x:Name>${sheetName}</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
           </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
          </xml><![endif]-->
          <style>
            body { font-family: Calibri, Arial, sans-serif; }
            table { border-collapse: collapse; }
            .header-title { font-size: 13pt; font-weight: bold; color: #111827; text-align: right; vertical-align: bottom; border: none; padding: 2px 4px; }
            .header-rs    { font-size: 10pt; font-weight: bold; color: #374151; text-align: right; vertical-align: middle; border: none; padding: 2px 4px; }
            .header-period{ font-size: 9pt;  color: #6B7280; text-align: right; vertical-align: top;    border: none; padding: 2px 4px; }
            .logo-cell    { border: none; vertical-align: middle; padding: 4px; width: 140px; }
            .separator    { height: 3px; border: none; border-bottom: 2px solid #000000; padding: 0; font-size: 1px; mso-height-source: userset; }
            th { background-color: #15803D; color: #FFFFFF; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 8px; }
            td { font-size: 10pt; border: 1px solid #000000; vertical-align: middle; padding: 6px 8px; color: #1F2937; }
          </style>
        </head>
        <body>${bodyHtmlStr}</body>
        </html>`;

      const filename = `Laporan_Sanksi_Disiplin_RSUCL_${todayStr.replace(/\s+/g, "_")}.xls`;

      const blob = new Blob(["\uFEFF" + excelWrapper("Data Sanksi", bodyHtml)], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      alert(err?.message || "Gagal mengunduh Excel Data Sanksi.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus sanksi disiplin ini secara permanen?")) return;
    try {
      const res = await disciplinarySanctionApi.delete(id);
      if (res.success) {
        alert("Sanksi disiplin berhasil dihapus.");
        loadData();
      }
    } catch (err: any) {
      alert(err?.message ?? "Gagal menghapus sanksi disiplin.");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (selectedEmployeeIds.length === 0) {
      setModalError('Wajib memilih minimal 1 pegawai.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      selectedEmployeeIds.forEach(id => {
        formData.append('employee_ids[]', String(id));
      });
      formData.append('type', selectedType);
      if (attachmentFile) formData.append('attachment', attachmentFile);
      if (chronologyFile) formData.append('chronology', chronologyFile);
      if (adminNote.trim()) formData.append('admin_note', adminNote.trim());
      if (createdAt) formData.append('created_at', createdAt);

      const res = await disciplinarySanctionApi.create(formData);
      if (res.success) {
        alert("Sanksi disiplin berhasil diterbitkan.");
        setShowCreateModal(false);
        // Reset form
        setSelectedDeptId('');
        setSelectedEmployeeIds([]);
        setAttachmentFile(null);
        setChronologyFile(null);
        setAdminNote('');
        setCreatedAt('');
        loadData();
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal menerbitkan sanksi disiplin.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered list of employees in selected department for the form modal
  const departmentEmployees = allEmployees.filter(emp => 
    selectedDeptId ? emp.department_id === Number(selectedDeptId) : true
  );

  const getSanctionStyle = (type: DisciplinarySanction['type']) => {
    switch (type) {
      case 'teguran':
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Surat Teguran' };
      case 'sp1':
        return { bg: 'bg-orange-50 text-orange-700 border-orange-255', label: 'Surat Peringatan 1 (SP1)' };
      case 'sp2':
        return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Surat Peringatan 2 (SP2)' };
      case 'phk':
        return { bg: 'bg-red-50 text-red-700 border-red-200', label: 'Surat Pemutusan Hubungan Kerja (PHK)' };
      default:
        return { bg: 'bg-slate-50 text-slate-700 border-slate-200', label: 'Sanksi Disiplin' };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return new Date(dateStr).toLocaleDateString('id-ID', options);
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* ── HEADER BANNER ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/30">
        <div className="absolute right-0 top-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl -translate-y-16 translate-x-16 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Kedisiplinan &amp; Kepatuhan
            </span>
            <h2 className="text-xl md:text-2xl font-bold mt-2">Manajemen Sanksi Disiplin Pegawai</h2>
            <p className="text-[12.5px] text-slate-350 mt-1">
              Terbitkan surat teguran, SP1, SP2, atau PHK resmi kepada pegawai yang melanggar tata tertib Rumah Sakit.
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap w-full md:w-auto">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 px-4.5 py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-2xl text-[13px] font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex-1 md:flex-none"
            >
              <Download size={14} className="stroke-[2.5]" /> Export Excel Sanksi
            </button>
            <button
              onClick={() => {
                setModalError('');
                setCreatedAt('');
                setShowCreateModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4.5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[13px] font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex-1 md:flex-none"
            >
              <Plus size={16} /> Kirim Surat Peringatan / Sanksi
            </button>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama karyawan, NIK KTP..."
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl text-[13px] text-slate-800 bg-slate-50/50 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 font-medium transition-all"
            />
          </form>
          
          <button 
            type="submit"
            onClick={loadData}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold rounded-2xl transition-all cursor-pointer hidden lg:block"
          >
            Cari
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Dept filter */}
          <div className="relative w-full sm:w-64">
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-2xl text-[12.5px] focus:outline-none bg-white font-semibold text-slate-700 cursor-pointer appearance-none"
            >
              <option value="">Semua Unit Kerja</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto scrollbar-none w-full sm:w-auto justify-start sm:justify-end">
            {['all', 'teguran', 'sp1', 'sp2', 'phk'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer capitalize whitespace-nowrap ${
                  filterType === type 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {type === 'all' ? 'Semua' : type === 'teguran' ? 'Teguran' : type === 'phk' ? 'PHK' : type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABLE LIST ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-rose-600" size={32} />
            <span className="text-[13px] font-medium">Memuat data sanksi disiplin...</span>
          </div>
        ) : sanctions.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <ShieldAlert size={32} className="mx-auto text-slate-350" />
            <p className="text-[13.5px] font-bold text-slate-600">Tidak ada data sanksi disiplin ditemukan.</p>
          </div>
        ) : (
          <>
            {/* Desktop View (Table) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                    <th className="py-3.5 px-5">Pegawai</th>
                    <th className="py-3.5 px-4">Jenis Sanksi</th>
                    <th className="py-3.5 px-4">Lampiran &amp; Kronologi</th>
                    <th className="py-3.5 px-4">Catatan Pelanggaran</th>
                    <th className="py-3.5 px-4">Tanggal Terbit</th>
                    <th className="py-3.5 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12.5px] font-medium text-slate-700">
                  {sanctions.map((san) => {
                    const style = getSanctionStyle(san.type);
                    return (
                      <tr key={san.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Pegawai */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[13px] border border-slate-200">
                              {san.employee?.user?.name ? san.employee.user.name[0].toUpperCase() : 'E'}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 leading-tight">{san.employee?.user?.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5">NIK: {san.employee?.nik_ktp}</p>
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold mt-1 inline-block">
                                {san.employee?.department?.name || 'Umum'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Jenis Sanksi */}
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.bg}`}>
                            {style.label}
                          </span>
                        </td>

                        {/* Berkas Lampiran */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1 w-fit">
                            {san.attachment_url ? (
                              <a href={san.attachment_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-lg hover:underline">
                                <FileText size={10} /> {style.label}
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Tidak ada surat</span>
                            )}
                            {san.chronology_url ? (
                              <a href={san.chronology_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-lg hover:underline">
                                <FileText size={10} /> Kronologi
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Tidak ada kronologi</span>
                            )}
                          </div>
                        </td>

                        {/* Catatan Pelanggaran */}
                        <td className="py-4 px-4 max-w-xs">
                          <p className="text-[10.5px] text-slate-400 font-bold mb-0.5">
                            Tgl: {formatDate(san.created_at)}
                          </p>
                          <p className="text-[11.5px] text-slate-600 line-clamp-2 leading-relaxed" title={san.admin_note || ''}>
                            {san.admin_note || '-'}
                          </p>
                        </td>

                        {/* Tanggal Terbit */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <p className="font-semibold text-slate-800">{formatDate(san.created_at)}</p>
                          <p className="text-[9.5px] text-slate-400 mt-0.5">Oleh: {san.creator?.name || 'Admin'}</p>
                        </td>

                        {/* Aksi */}
                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => handleDelete(san.id)}
                            title="Hapus Sanksi"
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-all cursor-pointer inline-flex items-center justify-center"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Card List) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {sanctions.map((san) => {
                const style = getSanctionStyle(san.type);
                return (
                  <div key={san.id} className="p-4 space-y-3.5 hover:bg-slate-50/30 transition-colors">
                    {/* Header Card: Employee info and Delete button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[14px] border border-slate-200 flex-shrink-0">
                          {san.employee?.user?.name ? san.employee.user.name[0].toUpperCase() : 'E'}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 leading-tight">{san.employee?.user?.name}</h4>
                          <p className="text-[10px] text-slate-450 mt-0.5">NIK: {san.employee?.nik_ktp}</p>
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold mt-1 inline-block">
                            {san.employee?.department?.name || 'Umum'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(san.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-rose-100/30 flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Sanction Badge and Issuance Info */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <span className={`inline-flex items-center text-[9.5px] font-black px-2.5 py-0.5 rounded-full border ${style.bg}`}>
                        {style.label}
                      </span>
                      <div className="text-right">
                        <p className="text-[10.5px] font-bold text-slate-800">{formatDate(san.created_at)}</p>
                        <p className="text-[9.5px] text-slate-450">Oleh: {san.creator?.name || 'Admin'}</p>
                      </div>
                    </div>

                    {/* Note / Chronology description */}
                    {san.admin_note && (
                      <div className="text-[12px] text-slate-650 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed font-medium">
                        <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Catatan Pelanggaran:</span>
                        {san.admin_note}
                      </div>
                    )}

                    {/* Documents attachment links */}
                    <div className="flex flex-wrap gap-2 pt-1.5">
                      {san.attachment_url ? (
                        <a href={san.attachment_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all">
                          <FileText size={11} /> {style.label.replace('Surat ', '')}
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">Tanpa Surat</span>
                      )}
                      {san.chronology_url ? (
                        <a href={san.chronology_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all">
                          <FileText size={11} /> Kronologi
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">Tanpa Kronologi</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL TERBITKAN SANKSI BARU ────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-lg my-6 border border-slate-100 max-h-[90vh] overflow-y-auto font-sans">
            
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold text-slate-900">Terbitkan Sanksi Disiplin Pegawai</h3>
                <p className="text-[11px] text-slate-400">Peringatan disiplin resmi untuk staf di unit kerja.</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs ml-auto flex items-center justify-center cursor-pointer">✕</button>
            </div>

            {modalError && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl text-[11.5px] font-semibold mb-4">
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Jenis Sanksi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                  Jenis Sanksi / Perihal <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-rose-500 font-bold text-slate-800 cursor-pointer"
                  required
                >
                  <option value="teguran">Surat Teguran</option>
                  <option value="sp1">Surat Peringatan 1 (SP1)</option>
                  <option value="sp2">Surat Peringatan 2 (SP2)</option>
                  <option value="phk">PHK (Pemutusan Hubungan Kerja)</option>
                </select>
              </div>

              {/* Tanggal Sanksi / Terbit */}
              <div>
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                  Tanggal Terbit / Sanksi <span className="text-slate-400">(Opsional - Kosongkan jika hari ini)</span>
                </label>
                <input
                  type="date"
                  value={createdAt}
                  onChange={e => setCreatedAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-rose-500 font-semibold text-slate-800"
                />
              </div>

              {/* Unit Kerja */}
              <div>
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                  Pilih Unit Kerja / Departemen
                </label>
                <select
                  value={selectedDeptId}
                  onChange={e => {
                    setSelectedDeptId(e.target.value);
                    setSelectedEmployeeIds([]); // Reset selection
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-rose-500 font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="">-- Semua Unit Kerja --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Pegawai Checkboxes (Multi-Select) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                  Pilih Pegawai Penerima <span className="text-rose-600">*</span> (Bisa lebih dari 1)
                </label>
                <div className="border border-slate-200 rounded-2xl p-3 max-h-40 overflow-y-auto space-y-2 bg-slate-50/50">
                  {departmentEmployees.length === 0 ? (
                    <p className="text-[11.5px] text-slate-400 text-center py-4">Tidak ada pegawai dalam departemen ini.</p>
                  ) : (
                    departmentEmployees.map(emp => {
                      const isChecked = selectedEmployeeIds.includes(emp.id);
                      return (
                        <label key={emp.id} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-white rounded-xl cursor-pointer select-none transition-all">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedEmployeeIds(prev => prev.filter(id => id !== emp.id));
                              } else {
                                setSelectedEmployeeIds(prev => [...prev, emp.id]);
                              }
                            }}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                          />
                          <div className="text-left">
                            <p className="text-[12px] font-bold text-slate-800">{emp.name}</p>
                            <p className="text-[9.5px] text-slate-400 font-mono">NIK: {emp.nik_ktp} · {emp.department || 'Umum'}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Upload Surat Sanksi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                  Dokumen {typeLabels[selectedType] || 'Surat Sanksi'} Resmi <span className="text-rose-600">*</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100 transition-all hover:border-rose-500">
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <Paperclip className="w-4 h-4 text-slate-400 mb-0.5" />
                    <p className="text-[11px] text-slate-800 font-bold truncate max-w-[220px] sm:max-w-[350px]">
                      {attachmentFile ? attachmentFile.name : `Pilih Berkas ${typeLabels[selectedType] || 'Surat Sanksi'} (PDF/Gambar)`}
                    </p>
                    <p className="text-[9px] text-slate-400">PDF, JPG, PNG (Maks 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => e.target.files && setAttachmentFile(e.target.files[0])}
                    className="hidden"
                    required
                  />
                </label>
              </div>

              {/* Upload Kronologi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                  Dokumen Kronologi / Bukti Pelanggaran <span className="text-slate-400">(Opsional)</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100 transition-all hover:border-rose-500">
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <Paperclip className="w-4 h-4 text-slate-400 mb-0.5" />
                    <p className="text-[11px] text-slate-800 font-bold truncate max-w-[220px] sm:max-w-[350px]">
                      {chronologyFile ? chronologyFile.name : 'Pilih Berkas Kronologi Pelanggaran'}
                    </p>
                    <p className="text-[9px] text-slate-400">PDF, JPG, PNG (Maks 5MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => e.target.files && setChronologyFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Catatan Admin */}
              <div>
                <label className="block text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">
                  Catatan Admin / Rincian Pelanggaran <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder="Jelaskan jenis pelanggaran disiplin dan ketentuannya..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-[12px] bg-white focus:outline-none focus:border-rose-500 resize-none text-slate-850"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[12.5px] font-bold transition-all flex items-center gap-1.5 shadow-md shadow-rose-100 cursor-pointer disabled:opacity-50 animate-pulse"
                >
                  {submitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {submitting ? 'Menerbitkan...' : 'Terbitkan Sanksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
