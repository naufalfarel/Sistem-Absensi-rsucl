import React, { useState, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  FileDown,
  AlertCircle,
  Plus,
  Trash2,
  Printer,
  X,
} from 'lucide-react';
import {
  assignmentLetterApi,
  AssignmentLetter,
  AssignedEmployee,
  departmentApi,
  DepartmentModel,
  employeeApi,
  Employee,
} from '../../../services/api';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';
import SuratTugasModal from './SuratTugasModal';

// ── Bulan Romawi ──────────────────────────────────────────────────────
const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

// ── Director config ───────────────────────────────────────────────────
const DIRECTORS = {
  rs_director: { label: 'Direktur RS', codeStr: 'RSUCL' },
  pt_director: { label: 'Direktur PT', codeStr: 'PTCLU' },
} as const;

// ── Preview nomor surat ───────────────────────────────────────────────
function previewLetterNumber(seq: string, dirType: keyof typeof DIRECTORS, dateStr: string): string {
  if (!seq || !dateStr) return 'XXX/STU/DIR/CODE/BLN/TAHUN';
  const seqPad = String(seq).padStart(3, '0');
  const d = new Date(dateStr);
  const bulan = ROMAN_MONTHS[d.getMonth()];
  const tahun = d.getFullYear();
  const code  = DIRECTORS[dirType].codeStr;
  return `${seqPad}/STU/DIR/${code}/${bulan}/${tahun}`;
}

// ── Format tanggal ────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try { return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return dateStr; }
}

export default function AssignmentLetterTab() {
  // ── Data ──────────────────────────────────────────────────────────
  const [letters, setLetters]       = useState<AssignmentLetter[]>([]);
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [meta, setMeta]             = useState({ current_page: 1, last_page: 1, total: 0 });

  // ── Filters ───────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter]   = useState('');
  const [search, setSearch]           = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());

  // ── Review Modal ──────────────────────────────────────────────────
  const [selectedLetter, setSelectedLetter] = useState<AssignmentLetter | null>(null);
  const [adminNote, setAdminNote]       = useState('');
  const [replyDocumentFile, setReplyDocumentFile] = useState<File | null>(null);
  const [actionType, setActionType]     = useState<'approve' | 'reject' | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [modalError, setModalError]     = useState('');

  // ── Preview Surat Tugas Digital ───────────────────────────────────
  const [previewLetter, setPreviewLetter] = useState<AssignmentLetter | null>(null);

  // ── Admin Create Modal ────────────────────────────────────────────
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [adminCreateSubmitting, setAdminCreateSubmitting] = useState(false);
  const [adminCreateError, setAdminCreateError] = useState('');

  // Form fields
  const [directorType, setDirectorType]   = useState<keyof typeof DIRECTORS>('rs_director');
  const [letterSeq, setLetterSeq]         = useState('');
  const [letterDate, setLetterDate]       = useState('');
  const [letterTitle, setLetterTitle]     = useState('');
  const [travelPurpose, setTravelPurpose] = useState('');
  const [travelDate, setTravelDate]       = useState('');
  const [travelTime, setTravelTime]       = useState('');
  const [travelPlace, setTravelPlace]     = useState('');
  const [adminCreateNote, setAdminCreateNote] = useState('');

  // Assigned employees
  const [assignedEmployees, setAssignedEmployees] = useState<AssignedEmployee[]>([
    { name: '', unit_kerja: '', jabatan: '', employee_id: null },
  ]);

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => {
    departmentApi.list().then(r => { if (r.success) setDepartments(r.data); }).catch(console.error);
    employeeApi.list().then(r => { if (r.success) setAllEmployees(r.data); }).catch(console.error);
  }, []);

  // ── Fetch letters ─────────────────────────────────────────────────
  const loadLetters = async () => {
    setLoading(true);
    try {
      const res = await assignmentLetterApi.list({
        status: statusFilter, start_date: startDate, end_date: endDate,
        department_id: deptFilter, search: search.trim(), page: currentPage,
      });
      if (res.success) {
        setLetters(res.data);
        if (res.meta) setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadLetters(); }, [statusFilter, deptFilter, startDate, endDate, currentPage]);

  // ── Review ────────────────────────────────────────────────────────
  const handleReviewAction = async () => {
    if (!selectedLetter || !actionType) return;
    if (actionType === 'reject' && !adminNote.trim()) { setModalError('Alasan penolakan wajib diisi.'); return; }
    setModalError(''); setReviewLoading(true);
    try {
      const res = actionType === 'approve'
        ? await assignmentLetterApi.approve(selectedLetter.id, adminNote.trim() || undefined, replyDocumentFile)
        : await assignmentLetterApi.reject(selectedLetter.id, adminNote.trim());
      if (res.success) { setSelectedLetter(null); setAdminNote(''); setReplyDocumentFile(null); setActionType(null); loadLetters(); }
    } catch (err: any) { setModalError(err?.message ?? 'Gagal memproses.'); }
    finally { setReviewLoading(false); }
  };

  const handleDeleteLetter = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus surat tugas ini?')) return;
    try {
      const res = await assignmentLetterApi.delete(id);
      if (res.success) { alert('Surat tugas berhasil dihapus.'); loadLetters(); }
    } catch (err: any) { alert(err?.message ?? 'Gagal menghapus.'); }
  };

  // ── Employee row helpers ──────────────────────────────────────────
  const addEmployeeRow = () =>
    setAssignedEmployees(prev => [...prev, { name: '', unit_kerja: '', jabatan: '', employee_id: null }]);

  const removeEmployeeRow = (idx: number) =>
    setAssignedEmployees(prev => prev.filter((_, i) => i !== idx));

  const updateEmpField = (idx: number, field: keyof AssignedEmployee, val: string | number | null) =>
    setAssignedEmployees(prev => { const n = [...prev]; (n[idx] as any)[field] = val; return n; });

  // Called when user types in datalist input — match by name to auto-fill
  const handleEmpNameChange = (idx: number, val: string) => {
    const found = allEmployees.find(ae => ae.name.toLowerCase() === val.toLowerCase());
    setAssignedEmployees(prev => {
      const n = [...prev];
      if (found) {
        n[idx] = {
          employee_id: found.id,
          name: found.name,
          unit_kerja: found.department ?? '',
          jabatan: found.position ?? '',
        };
      } else {
        n[idx] = { ...n[idx], name: val, employee_id: null };
      }
      return n;
    });
  };

  // ── Reset form ────────────────────────────────────────────────────
  const resetAdminCreateForm = () => {
    setDirectorType('rs_director');
    setLetterSeq(''); setLetterDate(''); setLetterTitle('');
    setTravelPurpose(''); setTravelDate(''); setTravelTime(''); setTravelPlace('');
    setAdminCreateNote('');
    setAssignedEmployees([{ name: '', unit_kerja: '', jabatan: '', employee_id: null }]);
    setAdminCreateError('');
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleAdminCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCreateSubmitting) return;
    if (!letterSeq || !letterDate || !letterTitle.trim() || !travelPurpose.trim() || !travelDate.trim() || !travelTime.trim() || !travelPlace.trim()) {
      setAdminCreateError('Semua field bertanda (*) wajib diisi.'); return;
    }
    const validEmps = assignedEmployees.filter(e => e.name.trim());
    if (validEmps.length === 0) { setAdminCreateError('Minimal satu pegawai harus diisi.'); return; }
    const primaryEmpId = validEmps.find(e => e.employee_id)?.employee_id ?? null;
    if (!primaryEmpId) { setAdminCreateError('Pilih minimal satu pegawai dari sistem agar notifikasi terkirim.'); return; }

    setAdminCreateError(''); setAdminCreateSubmitting(true);
    try {
      const res = await assignmentLetterApi.createByAdmin({
        employee_id: primaryEmpId as number,
        director_type: directorType,
        letter_number_seq: parseInt(letterSeq),
        letter_date: letterDate,
        title: letterTitle.trim(),
        travel_purpose: travelPurpose.trim(),
        travel_date: travelDate.trim(),
        travel_time: travelTime.trim(),
        travel_place: travelPlace.trim(),
        assigned_employees: validEmps,
        admin_note: adminCreateNote.trim() || undefined,
      });
      if (res.success) {
        setShowAdminCreateModal(false);
        resetAdminCreateForm();
        loadLetters();
        setPreviewLetter(res.data);
      }
    } catch (err: any) {
      setAdminCreateError(err?.message ?? 'Gagal menerbitkan surat tugas.');
    } finally { setAdminCreateSubmitting(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const getStatusStyle = (status: AssignmentLetter['status']) => {
    switch (status) {
      case 'completed': return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Selesai' };
      case 'approved':  return { bg: 'bg-green-50 text-green-700 border-green-200',       label: 'Tugas Aktif' };
      case 'rejected':  return { bg: 'bg-red-50 text-red-700 border-red-200',             label: 'Ditolak' };
      default:          return { bg: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Menunggu' };
    }
  };

  const checkOverlap = (target: AssignmentLetter) =>
    letters.some(l =>
      l.employee_id === target.employee_id &&
      (l.status === 'approved' || l.status === 'completed') &&
      l.id !== target.id &&
      l.start_date <= target.end_date &&
      l.end_date >= target.start_date,
    );

  const isDigital = (letter: AssignmentLetter) =>
    !!(letter.source === 'admin_assignment' && letter.director_type);

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[17px] font-extrabold text-gray-800 tracking-tight">Manajemen Surat Tugas Dinas Luar</h2>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Terbitkan surat tugas digital langsung dari sistem — tanpa upload file.</p>
        </div>
        <button onClick={() => setShowAdminCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12.5px] font-bold shadow-md shadow-green-100 hover:shadow-lg transition-all cursor-pointer">
          <Plus size={16} /> Terbitkan Surat Tugas Digital
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl border border-gray-150 p-5 mb-6 shadow-xs space-y-4">
        <MonthYearDeptFilter
          month={filterMonth} year={filterYear} deptId={deptFilter} departments={departments}
          showAllMonthsOption={true} embedded={true}
          onMonthChange={(m) => {
            setFilterMonth(m); setCurrentPage(1);
            if (m > 0) {
              const mm = String(m).padStart(2, '0');
              const lastDay = new Date(filterYear, m, 0).getDate();
              setStartDate(`${filterYear}-${mm}-01`);
              setEndDate(`${filterYear}-${mm}-${String(lastDay).padStart(2, '0')}`);
            } else { setStartDate(''); setEndDate(''); }
          }}
          onYearChange={(y) => {
            setFilterYear(y); setCurrentPage(1);
            if (filterMonth > 0) {
              const mm = String(filterMonth).padStart(2, '0');
              const lastDay = new Date(y, filterMonth, 0).getDate();
              setStartDate(`${y}-${mm}-01`);
              setEndDate(`${y}-${mm}-${String(lastDay).padStart(2, '0')}`);
            }
          }}
          onDeptChange={(d) => { setDeptFilter(d); setCurrentPage(1); }}
        />
        <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1); loadLetters(); }} className="space-y-4 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cari Nama / NIK KTP</label>
              <div className="relative">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ketik nama atau NIK KTP..."
                  className="w-full pl-3 pr-9 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] transition-all text-gray-800 placeholder:text-gray-300" />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><Search size={14} /></button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] bg-white cursor-pointer font-semibold text-gray-700">
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu Balasan</option>
                <option value="approved">Tugas Aktif</option>
                <option value="completed">Selesai</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="flex-1 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-bold shadow-xs transition-all cursor-pointer text-center">
                Terapkan Filter
              </button>
              <button type="button" onClick={() => { setSearch(''); setDeptFilter(''); setStatusFilter('all'); setStartDate(''); setEndDate(''); setFilterMonth(0); setCurrentPage(1); }}
                className="px-3 py-2 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl text-[12px] font-bold transition-all cursor-pointer">
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-150 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-[3px] border-green-200 border-t-[#16A34A] rounded-full animate-spin" />
            <p className="text-[11px] text-gray-400 font-medium">Memuat data surat tugas...</p>
          </div>
        ) : letters.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <FileText className="text-slate-300" size={24} />
            </div>
            <h4 className="text-[14px] font-bold text-gray-700">Tidak Ada Data Surat Tugas</h4>
            <p className="text-[11px] text-gray-400 mt-1">Belum ada surat tugas yang cocok dengan filter ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                  <th className="py-3.5 px-5">Pegawai</th>
                  <th className="py-3.5 px-4">Detail Surat Tugas</th>
                  <th className="py-3.5 px-4">Tanggal</th>
                  <th className="py-3.5 px-4">Dokumen</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[12.5px]">
                {letters.map(letter => {
                  const style = getStatusStyle(letter.status);
                  const isOverlapping = checkOverlap(letter);
                  const digital = isDigital(letter);
                  return (
                    <tr key={letter.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {letter.employee?.profile_picture ? (
                            <img src={letter.employee.profile_picture} alt={letter.employee.name} className="w-9 h-9 rounded-full object-cover border border-gray-100" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[13px] border border-gray-200">
                              {letter.employee?.name ? letter.employee.name[0].toUpperCase() : 'E'}
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-gray-800 leading-tight">{letter.employee?.name}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">NIK: {letter.employee?.nik_ktp}</p>
                            <span className="text-[9px] bg-slate-100 text-gray-500 px-2 py-0.5 rounded-md font-bold mt-1 inline-block">
                              {letter.employee?.department || 'Umum'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <h4 className="font-bold text-gray-800 leading-snug">{letter.title}</h4>
                          {digital && (
                            <span className="text-[8.5px] bg-blue-50 text-blue-700 border border-blue-150 px-1.5 py-0.5 rounded font-extrabold">Digital</span>
                          )}
                        </div>
                        {letter.letter_number && (
                          <p className="text-[10px] text-gray-500 font-mono mb-0.5">{letter.letter_number}</p>
                        )}
                        {(letter.travel_purpose || letter.purpose) && (
                          <p className="text-[11px] text-gray-500 italic line-clamp-2">"{letter.travel_purpose || letter.purpose}"</p>
                        )}
                        {letter.assigned_employees && letter.assigned_employees.length > 1 && (
                          <p className="text-[10px] text-blue-600 font-semibold mt-1">+{letter.assigned_employees.length} pegawai ditugaskan</p>
                        )}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-gray-700 font-semibold">{formatDate(letter.start_date)}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">s/d</p>
                          <p className="text-gray-700 font-semibold">{formatDate(letter.end_date)}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1.5 min-w-[140px]">
                          {digital ? (
                            <button onClick={() => setPreviewLetter(letter)}
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 hover:underline bg-blue-50/60 border border-blue-150 px-2 py-0.5 rounded-lg">
                              <Printer size={11} /> Lihat Surat Digital
                            </button>
                          ) : letter.document_url ? (
                            <a href={letter.document_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#16A34A] hover:underline bg-green-50/60 border border-green-150 px-2 py-0.5 rounded-lg">
                              <FileDown size={11} /> Surat Tugas
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic block">Dokumen belum ada</span>
                          )}
                          {letter.attendance_proof_url && (
                            <a href={letter.attendance_proof_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 hover:underline bg-blue-50/60 border border-blue-150 px-2 py-0.5 rounded-lg block">
                              <FileDown size={11} /> Foto Kegiatan
                            </a>
                          )}
                          {letter.activity_notes && (
                            <p className="text-[10.5px] text-gray-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 line-clamp-2 font-medium">
                              <strong>Laporan:</strong> "{letter.activity_notes}"
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <span className={`inline-flex items-center text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.bg}`}>
                            {style.label}
                          </span>
                          {letter.status === 'pending' && isOverlapping && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded-lg block">
                              <AlertTriangle size={10} /> Bentrok Tanggal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {letter.status === 'pending' && !digital ? (
                            <>
                              <button onClick={() => { setSelectedLetter(letter); setActionType('approve'); setAdminNote(''); setReplyDocumentFile(null); setModalError(''); }}
                                className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors cursor-pointer">
                                Setujui
                              </button>
                              <button onClick={() => { setSelectedLetter(letter); setActionType('reject'); setAdminNote(''); setModalError(''); }}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors cursor-pointer">
                                Tolak
                              </button>
                            </>
                          ) : digital ? (
                            <button onClick={() => setPreviewLetter(letter)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1">
                              <Printer size={13} /> Cetak
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-semibold mr-1">Tersimpan</span>
                          )}
                          <button onClick={() => handleDeleteLetter(letter.id)} title="Hapus"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all cursor-pointer flex-shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.last_page > 1 && (
          <div className="px-5 py-4 border-t border-gray-50 flex items-center justify-between bg-slate-50/30">
            <span className="text-[11px] text-gray-500">
              Halaman <strong>{meta.current_page}</strong> dari <strong>{meta.last_page}</strong> ({meta.total} surat tugas)
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}
                className="w-8 h-8 rounded-xl border border-gray-250 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, meta.last_page))} disabled={currentPage === meta.last_page}
                className="w-8 h-8 rounded-xl border border-gray-250 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Preview Modal Surat Digital ── */}
      {previewLetter && <SuratTugasModal letter={previewLetter} onClose={() => setPreviewLetter(null)} />}

      {/* ── Review Modal (approve/reject) ── */}
      {selectedLetter && actionType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => !reviewLoading && setSelectedLetter(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100">
            <h3 className="text-[15px] font-extrabold text-gray-900 mb-2">
              {actionType === 'approve' ? 'Setujui & Balas File Surat Tugas' : 'Tolak Pengajuan Surat Tugas?'}
            </h3>
            <p className="text-[12px] text-gray-500 mb-4">
              Meninjau surat dari <strong>{selectedLetter.employee?.name}</strong> — <strong>"{selectedLetter.title}"</strong>.
            </p>
            {modalError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 px-3.5 py-2.5 rounded-xl text-[11px] font-semibold mb-4">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /><span>{modalError}</span>
              </div>
            )}
            {actionType === 'approve' && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Unggah Dokumen Balasan <span className="text-gray-400">(Opsional)</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-200 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100 transition-all hover:border-green-400">
                  <div className="flex flex-col items-center p-2 text-center">
                    <FileDown className="w-5 h-5 text-gray-400 mb-1" />
                    <p className="text-[11px] text-gray-800 font-bold truncate max-w-[220px]">
                      {replyDocumentFile ? replyDocumentFile.name : 'Pilih File (PDF / Gambar)'}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">PDF, JPG, PNG (Maks 2MB)</p>
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      if (f.size > 2 * 1024 * 1024) { setModalError('File terlalu besar (maks 2MB).'); return; }
                      setModalError(''); setReplyDocumentFile(f);
                    }} />
                </label>
              </div>
            )}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Catatan {actionType === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3}
                placeholder={actionType === 'reject' ? 'Masukkan alasan penolakan...' : 'Pesan opsional...'}
                className="w-full px-3.5 py-2.5 border border-gray-250 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A] resize-none text-gray-800"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedLetter(null)} disabled={reviewLoading}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[12.5px] font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer">
                Batal
              </button>
              <button type="button" onClick={handleReviewAction} disabled={reviewLoading}
                className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-70 cursor-pointer ${
                  actionType === 'approve' ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-600'
                }`}>
                {reviewLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {actionType === 'approve' ? 'Ya, Setujui' : 'Ya, Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL TERBITKAN SURAT TUGAS DIGITAL ══ */}
      {showAdminCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center px-4 py-6 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-gray-100 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-green-100 text-[#16A34A] flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-gray-900">Terbitkan Surat Tugas Digital</h3>
                  <p className="text-[10.5px] text-gray-500">Surat akan di-generate otomatis dengan QR tanda tangan.</p>
                </div>
              </div>
              <button onClick={() => { setShowAdminCreateModal(false); resetAdminCreateForm(); }}
                className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAdminCreateSubmit} className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="px-6 py-5 space-y-5">

                {adminCreateError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-[11.5px] font-semibold">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /><span>{adminCreateError}</span>
                  </div>
                )}

                {/* Pilih Direktur */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                    Direktur Penandatangan <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(Object.entries(DIRECTORS) as [keyof typeof DIRECTORS, typeof DIRECTORS[keyof typeof DIRECTORS]][]).map(([key]) => (
                      <label key={key} className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                        directorType === key ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                      }`}>
                        <input type="radio" name="director_type" value={key} checked={directorType === key}
                          onChange={() => setDirectorType(key)} className="mt-0.5 accent-green-600" />
                        <div>
                          <p className={`text-[12px] font-bold ${directorType === key ? 'text-green-900' : 'text-gray-800'}`}>
                            {key === 'rs_director' ? 'dr. Meri Lidiawati, MM, MKM, CHLQM' : 'Amir Hidayat, ST., MKM'}
                          </p>
                          <p className={`text-[10.5px] ${directorType === key ? 'text-green-600' : 'text-gray-500'}`}>
                            {key === 'rs_director' ? 'Direktur Rumah Sakit' : 'Direktur PT Cempaka Lima Utama'}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Nomor Surat */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Nomor Urut Surat <span className="text-red-500">*</span>
                    </label>
                    <input type="number" min={1} max={999} value={letterSeq} onChange={e => setLetterSeq(e.target.value)}
                      placeholder="Contoh: 1"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-semibold text-gray-800"
                      required />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Preview: <span className="font-mono font-bold text-green-700">{previewLetterNumber(letterSeq, directorType, letterDate)}</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Tanggal Surat <span className="text-red-500">*</span>
                    </label>
                    <input type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-semibold text-gray-800 cursor-pointer"
                      required />
                  </div>
                </div>

                {/* Perihal */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Perihal / Judul Kegiatan <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={letterTitle} onChange={e => setLetterTitle(e.target.value)}
                    placeholder="Contoh: Kegiatan Penguatan Fungsi PIPP di FKRTL"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-semibold text-gray-800"
                    required />
                </div>

                {/* Tabel Pegawai */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                      Pegawai yang Ditugaskan <span className="text-red-500">*</span>
                    </label>
                    <button type="button" onClick={addEmployeeRow}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg border border-green-200 transition-all cursor-pointer">
                      <Plus size={12} /> Tambah Baris
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-2xl overflow-x-auto">
                    <table className="w-full text-left min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                          <th className="py-2.5 px-3 w-8">No</th>
                          <th className="py-2.5 px-3">Nama Pegawai <span className="text-red-500">*</span></th>
                          <th className="py-2.5 px-3">Unit Kerja</th>
                          <th className="py-2.5 px-3">Jabatan</th>
                          <th className="py-2.5 px-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {assignedEmployees.map((emp, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 text-[12px] font-bold text-gray-500 align-middle">{idx + 1}.</td>

                            {/* Input + datalist — satu kolom saja */}
                            <td className="py-2 px-2 align-middle">
                              <input
                                type="text"
                                list={`emp-list-${idx}`}
                                value={emp.name}
                                placeholder="Ketik nama lalu pilih..."
                                onChange={e => handleEmpNameChange(idx, e.target.value)}
                                className={`w-full px-2.5 py-2 border rounded-lg text-[12px] focus:outline-none transition-all text-gray-800 min-w-[150px] ${
                                  emp.employee_id
                                    ? 'border-green-400 bg-green-50'
                                    : 'border-gray-200 bg-white focus:border-[#16A34A]'
                                }`}
                                required
                              />
                              <datalist id={`emp-list-${idx}`}>
                                {allEmployees.map(e => (
                                  <option key={e.id} value={e.name}>
                                    {e.department || 'Umum'} · {e.position || '-'}
                                  </option>
                                ))}
                              </datalist>
                              {emp.employee_id && (
                                <p className="text-[9.5px] text-green-700 font-semibold mt-0.5">✓ Auto-isi dari sistem</p>
                              )}
                            </td>

                            {/* Unit Kerja */}
                            <td className="py-2 px-2 align-middle">
                              <input type="text" value={emp.unit_kerja ?? ''}
                                onChange={e => updateEmpField(idx, 'unit_kerja', e.target.value)}
                                placeholder="Unit kerja..."
                                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[12px] focus:outline-none focus:border-[#16A34A] text-gray-800 min-w-[90px]"
                              />
                            </td>

                            {/* Jabatan */}
                            <td className="py-2 px-2 align-middle">
                              <input type="text" value={emp.jabatan ?? ''}
                                onChange={e => updateEmpField(idx, 'jabatan', e.target.value)}
                                placeholder="Jabatan..."
                                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[12px] focus:outline-none focus:border-[#16A34A] text-gray-800 min-w-[90px]"
                              />
                            </td>

                            {/* Hapus */}
                            <td className="py-2 px-2 align-middle">
                              {assignedEmployees.length > 1 && (
                                <button type="button" onClick={() => removeEmployeeRow(idx)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
                                  <X size={13} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">Ketik nama → pilih dari saran → Unit Kerja &amp; Jabatan terisi otomatis.</p>
                </div>

                {/* Detail Perjalanan */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
                  <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">Detail Perjalanan / Penugasan</p>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Maksud Perjalanan <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={travelPurpose} onChange={e => setTravelPurpose(e.target.value)}
                      placeholder="Contoh: Kegiatan Penguatan Fungsi PIPP di FKRTL"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-medium text-gray-800"
                      required />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                        Hari / Tanggal <span className="text-red-500">*</span>
                      </label>
                      <input type="text" value={travelDate} onChange={e => setTravelDate(e.target.value)}
                        placeholder="Contoh: Selasa/ 07 Juli 2026"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-medium text-gray-800"
                        required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                        Pukul <span className="text-red-500">*</span>
                      </label>
                      <input type="text" value={travelTime} onChange={e => setTravelTime(e.target.value)}
                        placeholder="Contoh: 08.30 WIB s.d selesai"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-medium text-gray-800"
                        required />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                      Tempat <span className="text-red-500">*</span>
                    </label>
                    <textarea value={travelPlace} onChange={e => setTravelPlace(e.target.value)} rows={2}
                      placeholder={"Contoh: Hotel Ayani\nJl. Ayani Peunayong 23122 Banda Aceh"}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-medium text-gray-800 resize-none"
                      required />
                  </div>
                </div>

                {/* Catatan Admin */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Catatan Admin <span className="text-gray-400">(Opsional)</span>
                  </label>
                  <input type="text" value={adminCreateNote} onChange={e => setAdminCreateNote(e.target.value)}
                    placeholder="Catatan tambahan..."
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] text-gray-800"
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button type="button" onClick={() => { setShowAdminCreateModal(false); resetAdminCreateForm(); }}
                  disabled={adminCreateSubmitting}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-[12.5px] font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50">
                  Batal
                </button>
                <button type="submit" disabled={adminCreateSubmitting}
                  className="px-6 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12.5px] font-bold transition-all flex items-center gap-2 shadow-md shadow-green-100 cursor-pointer disabled:opacity-50">
                  {adminCreateSubmitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {adminCreateSubmitting ? 'Menerbitkan...' : <><FileText size={14} /> Terbitkan &amp; Preview Surat</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
