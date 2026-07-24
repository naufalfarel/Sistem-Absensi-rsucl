import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Building2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileDown,
  AlertCircle,
  Plus,
  Paperclip,
  Upload,
  UserCheck,
  Info,
  Trash2
} from 'lucide-react';
import { 
  assignmentLetterApi, 
  AssignmentLetter, 
  departmentApi, 
  DepartmentModel, 
  employeeApi, 
  Employee 
} from '../../../services/api';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';

export default function AssignmentLetterTab() {
  // Lists & Data States
  const [letters, setLetters] = useState<AssignmentLetter[]>([]);
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Filters & Search States
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());

  // Review Modal State (Approve / Reject)
  const [selectedLetter, setSelectedLetter] = useState<AssignmentLetter | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [replyDocumentFile, setReplyDocumentFile] = useState<File | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Admin Direct Issue Modal State (Skenario 2)
  const [showAdminCreateModal, setShowAdminCreateModal] = useState(false);
  const [adminCreateEmployeeId, setAdminCreateEmployeeId] = useState('');
  const [adminCreateTitle, setAdminCreateTitle] = useState('');
  const [adminCreateInstitution, setAdminCreateInstitution] = useState('');
  const [adminCreateStartDate, setAdminCreateStartDate] = useState('');
  const [adminCreateEndDate, setAdminCreateEndDate] = useState('');
  const [adminCreatePurpose, setAdminCreatePurpose] = useState('');
  const [adminCreateDocument, setAdminCreateDocument] = useState<File | null>(null);
  const [adminCreateNote, setAdminCreateNote] = useState('');
  const [adminCreateSubmitting, setAdminCreateSubmitting] = useState(false);
  const [adminCreateError, setAdminCreateError] = useState('');

  // Fetch Departments & Employees for filters/modals
  useEffect(() => {
    departmentApi.list().then(res => {
      if (res.success) setDepartments(res.data);
    }).catch(err => console.error('Gagal mengambil departemen:', err));

    employeeApi.list().then(res => {
      if (res.success) setAllEmployees(res.data);
    }).catch(err => console.error('Gagal mengambil daftar pegawai:', err));
  }, []);

  // Fetch Letters with filters
  const loadLetters = async () => {
    setLoading(true);
    try {
      const res = await assignmentLetterApi.list({
        status: statusFilter,
        start_date: startDate,
        end_date: endDate,
        department_id: deptFilter,
        search: search.trim(),
        page: currentPage
      });
      
      if (res.success) {
        setLetters(res.data);
        if (res.meta) {
          setMeta({
            current_page: res.meta.current_page,
            last_page: res.meta.last_page,
            total: res.meta.total
          });
        }
      }
    } catch (err) {
      console.error('Gagal memuat surat tugas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLetters();
  }, [statusFilter, deptFilter, startDate, endDate, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLetters();
  };

  const checkOverlap = (target: AssignmentLetter): boolean => {
    return letters.some(l => 
      l.employee_id === target.employee_id &&
      (l.status === 'approved' || l.status === 'completed') &&
      l.id !== target.id &&
      l.start_date <= target.end_date &&
      l.end_date >= target.start_date
    );
  };

  // Submit Approval / Rejection
  const handleReviewAction = async () => {
    if (!selectedLetter || !actionType) return;
    
    if (actionType === 'reject' && !adminNote.trim()) {
      setModalError('Alasan penolakan wajib diisi.');
      return;
    }

    setModalError('');
    setReviewLoading(true);

    try {
      let res;
      if (actionType === 'approve') {
        res = await assignmentLetterApi.approve(selectedLetter.id, adminNote.trim() || undefined, replyDocumentFile);
      } else {
        res = await assignmentLetterApi.reject(selectedLetter.id, adminNote.trim());
      }

      if (res.success) {
        setSelectedLetter(null);
        setAdminNote('');
        setReplyDocumentFile(null);
        setActionType(null);
        loadLetters();
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal memproses persetujuan.');
    } finally {
      setReviewLoading(false);
    }
  };

  // Submit Admin Direct Assignment (Skenario 2)
  const handleAdminCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCreateSubmitting) return;

    if (!adminCreateEmployeeId || !adminCreateTitle.trim() || !adminCreateInstitution.trim() || !adminCreateStartDate || !adminCreateEndDate || !adminCreatePurpose.trim() || !adminCreateDocument) {
      setAdminCreateError('Semua field bertanda bintang (*), termasuk file dokumen Surat Tugas resmi wajib diisi.');
      return;
    }

    if (new Date(adminCreateEndDate) < new Date(adminCreateStartDate)) {
      setAdminCreateError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }

    setAdminCreateError('');
    setAdminCreateSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('employee_id', adminCreateEmployeeId);
      formData.append('title', adminCreateTitle.trim());
      formData.append('issuing_institution', adminCreateInstitution.trim());
      formData.append('start_date', adminCreateStartDate);
      formData.append('end_date', adminCreateEndDate);
      formData.append('purpose', adminCreatePurpose.trim());
      formData.append('document', adminCreateDocument);
      if (adminCreateNote.trim()) {
        formData.append('admin_note', adminCreateNote.trim());
      }

      const res = await assignmentLetterApi.createByAdmin(formData);
      if (res.success) {
        setShowAdminCreateModal(false);
        setAdminCreateEmployeeId('');
        setAdminCreateTitle('');
        setAdminCreateInstitution('');
        setAdminCreateStartDate('');
        setAdminCreateEndDate('');
        setAdminCreatePurpose('');
        setAdminCreateDocument(null);
        setAdminCreateNote('');
        loadLetters();
      }
    } catch (err: any) {
      setAdminCreateError(err?.message ?? 'Gagal menerbitkan surat tugas.');
    } finally {
      setAdminCreateSubmitting(false);
    }
  };

  const handleDeleteLetter = async (id: number) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus surat tugas ini? Semua data terkait dan file dokumen akan dihapus permanen.")) return;

    try {
      const res = await assignmentLetterApi.delete(id);
      if (res.success) {
        alert("Surat tugas berhasil dihapus.");
        loadLetters();
      }
    } catch (err: any) {
      alert(err?.message ?? "Gagal menghapus surat tugas.");
    }
  };

  const getStatusStyle = (status: AssignmentLetter['status']) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Selesai (Laporan Ada)' };
      case 'approved':
        return { bg: 'bg-green-50 text-green-700 border-green-200', label: 'Tugas Aktif' };
      case 'rejected':
        return { bg: 'bg-red-50 text-red-700 border-red-200', label: 'Ditolak' };
      default:
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Menunggu Balasan' };
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
    <div className="w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* Top Header Bar & Tombol Terbitkan Surat Tugas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[17px] font-extrabold text-gray-800 tracking-tight">Manajemen Surat Tugas Dinas Luar</h2>
          <p className="text-[11.5px] text-gray-500 mt-0.5">Kelola pengajuan pegawai & penerbitan surat tugas resmi langsung oleh Admin.</p>
        </div>

        <button
          onClick={() => setShowAdminCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12.5px] font-bold shadow-md shadow-green-100 hover:shadow-lg transition-all cursor-pointer"
        >
          <Plus size={16} /> Terbitkan Surat Tugas Langsung
        </button>
      </div>

      {/* Wadah Filter Terpadu */}
      <div className="bg-white rounded-3xl border border-gray-150 p-5 mb-6 shadow-xs space-y-4">
        <MonthYearDeptFilter
          month={filterMonth}
          year={filterYear}
          deptId={deptFilter}
          departments={departments}
          showAllMonthsOption={true}
          embedded={true}
          onMonthChange={(m) => {
            setFilterMonth(m);
            setCurrentPage(1);
            if (m > 0) {
              const mm = String(m).padStart(2, '0');
              const lastDay = new Date(filterYear, m, 0).getDate();
              setStartDate(`${filterYear}-${mm}-01`);
              setEndDate(`${filterYear}-${mm}-${String(lastDay).padStart(2, '0')}`);
            } else {
              setStartDate('');
              setEndDate('');
            }
          }}
          onYearChange={(y) => {
            setFilterYear(y);
            setCurrentPage(1);
            if (filterMonth > 0) {
              const mm = String(filterMonth).padStart(2, '0');
              const lastDay = new Date(y, filterMonth, 0).getDate();
              setStartDate(`${y}-${mm}-01`);
              setEndDate(`${y}-${mm}-${String(lastDay).padStart(2, '0')}`);
            }
          }}
          onDeptChange={(d) => { setDeptFilter(d); setCurrentPage(1); }}
        />

        <form onSubmit={handleSearchSubmit} className="space-y-4 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Search */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cari Nama / NIK KTP</label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Ketik nama atau NIK KTP..."
                  className="w-full pl-3 pr-9 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] transition-all text-gray-800 placeholder:text-gray-300"
                />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <Search size={14} />
                </button>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status Penugasan</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] bg-white cursor-pointer font-semibold text-gray-700"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu Balasan Admin</option>
                <option value="approved">Tugas Aktif</option>
                <option value="completed">Selesai (Ada Laporan)</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>

            {/* Reset / Apply button group */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-bold shadow-xs hover:shadow-md transition-all cursor-pointer text-center"
              >
                Terapkan Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDeptFilter('');
                  setStatusFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setFilterMonth(0);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-200 text-gray-500 hover:bg-gray-55 rounded-xl text-[12px] font-bold transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>

          </div>

          {/* Additional date filter */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100 items-center">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={13} /> Rentang Tanggal Kegiatan:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-700"
              />
              <span className="text-[11px] text-gray-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] text-gray-700"
              />
            </div>
          </div>
        </form>
      </div>

      {/* Main List Table Container */}
      <div className="bg-white rounded-3xl border border-gray-150 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-green-200 border-t-[#16A34A] rounded-full animate-spin" />
            <p className="text-[11px] text-gray-400 font-medium">Memuat data surat tugas...</p>
          </div>
        ) : letters.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <FileText className="text-slate-300" size={24} />
            </div>
            <h4 className="text-[14px] font-bold text-gray-700">Tidak Ada Data Surat Tugas</h4>
            <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
              Tidak ditemukan surat tugas yang cocok dengan filter atau pencarian saat ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                  <th className="py-3.5 px-5">Pegawai</th>
                  <th className="py-3.5 px-4">Detail Kegiatan</th>
                  <th className="py-3.5 px-4">Masa Tugas</th>
                  <th className="py-3.5 px-4">Dokumen & Laporan</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[12.5px]">
                {letters.map(letter => {
                  const style = getStatusStyle(letter.status);
                  const isOverlapping = checkOverlap(letter);

                  return (
                    <tr key={letter.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Pegawai column */}
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

                      {/* Detail Kegiatan column */}
                      <td className="py-4 px-4 max-w-xs">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-gray-800 leading-snug">{letter.title}</h4>
                            {letter.source === 'admin_assignment' && (
                              <span className="text-[8.5px] bg-blue-50 text-blue-700 border border-blue-150 px-1.5 py-0.2 rounded font-extrabold">
                                Admin Direct
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 font-medium">
                            <Building2 size={11} /> {letter.issuing_institution}
                          </p>
                          <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2">"{letter.purpose}"</p>
                        </div>
                      </td>

                      {/* Masa Tugas column */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-gray-700 font-semibold">{formatDate(letter.start_date)}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">s/d</p>
                          <p className="text-gray-700 font-semibold">{formatDate(letter.end_date)}</p>
                        </div>
                      </td>

                      {/* Dokumen & Laporan column */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5 min-w-[150px]">
                          {letter.document_url ? (
                            <a
                              href={letter.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-[#16A34A] hover:underline bg-green-50/60 border border-green-150 px-2 py-0.5 rounded-lg"
                            >
                              <FileDown size={11} /> Surat Tugas Resmi
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic block">Dokumen Admin Belum Ada</span>
                          )}

                          {letter.attendance_proof_url && (
                            <a
                              href={letter.attendance_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 hover:underline bg-blue-50/60 border border-blue-150 px-2 py-0.5 rounded-lg block"
                            >
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

                      {/* Status column */}
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

                      {/* Aksi column */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {letter.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedLetter(letter);
                                  setActionType('approve');
                                  setAdminNote('');
                                  setReplyDocumentFile(null);
                                  setModalError('');
                                }}
                                className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                              >
                                Setujui & Balas File
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedLetter(letter);
                                  setActionType('reject');
                                  setAdminNote('');
                                  setModalError('');
                                }}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                              >
                                Tolak
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-semibold mr-1">Tersimpan</span>
                          )}
                          <button
                            onClick={() => handleDeleteLetter(letter.id)}
                            title="Hapus Surat Tugas"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all cursor-pointer flex-shrink-0"
                          >
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

        {/* Pagination Controls */}
        {meta.last_page > 1 && (
          <div className="px-5 py-4 border-t border-gray-50 flex items-center justify-between bg-slate-50/30">
            <span className="text-[11px] text-gray-500">
              Menampilkan halaman <strong>{meta.current_page}</strong> dari <strong>{meta.last_page}</strong> ({meta.total} surat tugas)
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-xl border border-gray-250 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, meta.last_page))}
                disabled={currentPage === meta.last_page}
                className="w-8 h-8 rounded-xl border border-gray-250 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* APPROVAL / REJECTION CONFIRMATION MODAL WITH DOCUMENT UPLOAD */}
      {selectedLetter && actionType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => !reviewLoading && setSelectedLetter(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md animate-scale-up border border-gray-100">
            
            <h3 className="text-[15px] font-extrabold text-gray-900 mb-2">
              {actionType === 'approve' ? 'Setujui & Balas File Surat Tugas' : 'Tolak Pengajuan Surat Tugas?'}
            </h3>
            
            <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
              Meninjau permohonan surat tugas dari <strong>{selectedLetter.employee?.name}</strong> untuk kegiatan <strong>"{selectedLetter.title}"</strong>.
            </p>

            {actionType === 'approve' && checkOverlap(selectedLetter) && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-2xl text-[11.5px] font-semibold mb-4 leading-relaxed">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-600 animate-pulse" />
                <div>
                  <p className="font-bold text-amber-900">Deteksi Tanggal Bertumpukan</p>
                  <p className="text-[10.5px] text-amber-700 mt-0.5">
                    Pegawai sudah memiliki surat tugas disetujui pada ({formatDate(selectedLetter.start_date)} - {formatDate(selectedLetter.end_date)}).
                  </p>
                </div>
              </div>
            )}

            {modalError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 px-3.5 py-2.5 rounded-xl text-[11px] font-semibold mb-4">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {actionType === 'approve' && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Unggah Dokumen Surat Tugas Balasan <span className="text-gray-400">(Sangat Direkomendasikan)</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100 transition-all hover:border-green-400">
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <Paperclip className="w-5 h-5 text-gray-400 mb-1" />
                    <p className="text-[11px] text-gray-800 font-bold truncate max-w-[220px]">
                      {replyDocumentFile ? replyDocumentFile.name : 'Pilih File Surat Tugas (PDF / Gambar)'}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">PDF, JPG, PNG (Maks 2MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => e.target.files && setReplyDocumentFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Catatan Peninjauan {actionType === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder={actionType === 'reject' ? 'Masukkan alasan penolakan surat tugas...' : 'Masukkan pesan persetujuan jika ada (opsional)...'}
                rows={3}
                className="w-full px-3.5 py-2.5 border border-gray-250 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all resize-none text-gray-800"
                required={actionType === 'reject'}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedLetter(null)}
                disabled={reviewLoading}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[12.5px] font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReviewAction}
                disabled={reviewLoading}
                className={`flex-1 py-2.5 rounded-xl text-[12.5px] font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-70 cursor-pointer ${
                  actionType === 'approve' 
                    ? 'bg-[#16A34A] hover:bg-[#0d9240] shadow-green-100' 
                    : 'bg-red-500 hover:bg-red-600 shadow-red-100'
                }`}
              >
                {reviewLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {actionType === 'approve' ? 'Ya, Setujui & Kirim' : 'Ya, Tolak'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL TERBITKAN SURAT TUGAS LANGSUNG OLEH ADMIN (SKENARIO 2) */}
      {showAdminCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => !adminCreateSubmitting && setShowAdminCreateModal(false)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-lg animate-scale-up border border-gray-100 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <div className="w-9 h-9 rounded-2xl bg-green-100 text-[#16A34A] flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-extrabold text-gray-900">Terbitkan Surat Tugas Langsung (Admin)</h3>
                <p className="text-[11px] text-gray-500">Berikan surat tugas resmi beserta dokumen kepada pegawai.</p>
              </div>
            </div>

            {adminCreateError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-[11.5px] font-semibold mb-4">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{adminCreateError}</span>
              </div>
            )}

            <form onSubmit={handleAdminCreateSubmit} className="space-y-4">
              {/* Select Pegawai */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Pilih Pegawai Penerima Surat Tugas <span className="text-red-500">*</span>
                </label>
                <select
                  value={adminCreateEmployeeId}
                  onChange={e => setAdminCreateEmployeeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-250 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-semibold text-gray-800 cursor-pointer"
                  required
                >
                  <option value="">-- Pilih Pegawai --</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} (NIK: {emp.nik_ktp}) - {emp.department || 'Umum'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Judul Kegiatan / Perihal */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Perihal / Judul Kegiatan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={adminCreateTitle}
                  onChange={e => setAdminCreateTitle(e.target.value)}
                  placeholder="Contoh: Undangan Narasumber Seminar Nasional Kesehatan"
                  className="w-full px-3.5 py-2.5 border border-gray-250 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-semibold text-gray-800"
                  required
                />
              </div>

              {/* Instansi Pemberi Tugas */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Instansi / Pihak Pemberi Tugas <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={adminCreateInstitution}
                  onChange={e => setAdminCreateInstitution(e.target.value)}
                  placeholder="Contoh: Kementerian Kesehatan Republik Indonesia"
                  className="w-full px-3.5 py-2.5 border border-gray-250 rounded-xl text-[12.5px] bg-white focus:outline-none focus:border-[#16A34A] font-medium text-gray-800"
                  required
                />
              </div>

              {/* Tanggal Mulai & Selesai */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Tanggal Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={adminCreateStartDate}
                    onChange={e => setAdminCreateStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] font-semibold cursor-pointer text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                    Tanggal Selesai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={adminCreateEndDate}
                    min={adminCreateStartDate}
                    onChange={e => setAdminCreateEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-250 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] font-semibold cursor-pointer text-gray-800"
                    required
                  />
                </div>
              </div>

              {/* Uraian Keperluan */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Uraian Keperluan / Penugasan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={adminCreatePurpose}
                  onChange={e => setAdminCreatePurpose(e.target.value)}
                  placeholder="Tuliskan uraian tugas yang diberikan kepada pegawai..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3.5 py-2 border border-gray-250 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] resize-none text-gray-800"
                  required
                />
              </div>

              {/* Upload File Surat Tugas Resmi */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Unggah Dokumen Surat Tugas Resmi <span className="text-red-500">*</span>
                </label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-200 border-dashed rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-100 transition-all hover:border-green-400">
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <Paperclip className="w-5 h-5 text-gray-400 mb-1" />
                    <p className="text-[11px] text-gray-800 font-bold truncate max-w-[250px]">
                      {adminCreateDocument ? adminCreateDocument.name : 'Pilih File Dokumen Surat Tugas (PDF/JPG)'}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">PDF, JPG, PNG (Maks 2MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => e.target.files && setAdminCreateDocument(e.target.files[0])}
                    className="hidden"
                    required
                  />
                </label>
              </div>

              {/* Catatan Admin (Opsional) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Catatan Admin <span className="text-gray-400">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={adminCreateNote}
                  onChange={e => setAdminCreateNote(e.target.value)}
                  placeholder="Catatan tambahan untuk pegawai..."
                  className="w-full px-3.5 py-2 border border-gray-250 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] text-gray-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAdminCreateModal(false)}
                  disabled={adminCreateSubmitting}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adminCreateSubmitting}
                  className="px-5 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12.5px] font-bold transition-all flex items-center gap-1.5 shadow-md shadow-green-150 cursor-pointer disabled:opacity-50"
                >
                  {adminCreateSubmitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {adminCreateSubmitting ? 'Menerbitkan...' : 'Terbitkan Surat Tugas'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
