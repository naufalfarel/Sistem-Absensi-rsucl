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
  AlertCircle
} from 'lucide-react';
import { assignmentLetterApi, AssignmentLetter, departmentApi, DepartmentModel } from '../../../services/api';

export default function AssignmentLetterTab() {
  // Lists & Data States
  const [letters, setLetters] = useState<AssignmentLetter[]>([]);
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Filters & Search States
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Review Modal State
  const [selectedLetter, setSelectedLetter] = useState<AssignmentLetter | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Fetch Departments for filter
  useEffect(() => {
    departmentApi.list().then(res => {
      if (res.success) setDepartments(res.data);
    }).catch(err => console.error('Gagal mengambil departemen:', err));
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
    // Cari surat tugas milik pegawai yang sama yang sudah disetujui (approved)
    // dan rentang tanggalnya bertabrakan (start_date <= target_end && end_date >= target_start)
    return letters.some(l => 
      l.employee_id === target.employee_id &&
      l.status === 'approved' &&
      l.id !== target.id &&
      l.start_date <= target.end_date &&
      l.end_date >= target.start_date
    );
  };

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
        res = await assignmentLetterApi.approve(selectedLetter.id, adminNote.trim() || undefined);
      } else {
        res = await assignmentLetterApi.reject(selectedLetter.id, adminNote.trim());
      }

      if (res.success) {
        // Close modal & reset
        setSelectedLetter(null);
        setAdminNote('');
        setActionType(null);
        // Refresh list
        loadLetters();
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal memproses persetujuan.');
    } finally {
      setReviewLoading(false);
    }
  };

  const getStatusStyle = (status: AssignmentLetter['status']) => {
    switch (status) {
      case 'approved':
        return { bg: 'bg-green-50 text-green-700 border-green-200', label: 'Disetujui' };
      case 'rejected':
        return { bg: 'bg-red-50 text-red-700 border-red-200', label: 'Ditolak' };
      default:
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Menunggu' };
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
      
      {/* Filters Toolbar */}
      <div className="bg-white rounded-3xl border border-gray-150 p-5 mb-6 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
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

            {/* Department */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Bagian / Departemen</label>
              <select
                value={deptFilter}
                onChange={e => { setDeptFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] bg-white cursor-pointer font-semibold text-gray-700"
              >
                <option value="">Semua Bagian</option>
                {departments.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status Pengajuan</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] bg-white cursor-pointer font-semibold text-gray-700"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
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
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-200 text-gray-500 hover:bg-gray-55 rounded-xl text-[12px] font-bold transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>

          </div>

          {/* Additional date filter toggle */}
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

      {/* Main List Container */}
      <div className="bg-white rounded-3xl border border-gray-150 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-green-200 border-t-[#16A34A] rounded-full animate-spin" />
            <p className="text-[11px] text-gray-400 font-medium">Memuat data pengajuan surat tugas...</p>
          </div>
        ) : letters.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <FileText className="text-slate-300" size={24} />
            </div>
            <h4 className="text-[14px] font-bold text-gray-700">Tidak Ada Pengajuan</h4>
            <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
              Tidak ditemukan pengajuan surat tugas dinas luar yang cocok dengan filter atau pencarian saat ini.
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
                            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">NIK KTP: {letter.employee?.nik_ktp}</p>
                            <span className="text-[9px] bg-slate-100 text-gray-500 px-2 py-0.5 rounded-md font-bold mt-1 inline-block">
                              {letter.employee?.department || 'Umum'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Detail Kegiatan column */}
                      <td className="py-4 px-4 max-w-xs">
                        <div>
                          <h4 className="font-bold text-gray-800 leading-snug">{letter.title}</h4>
                          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1 font-medium">
                            <Building2 size={11} /> {letter.issuing_institution}
                          </p>
                          {letter.letter_number && (
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">No: {letter.letter_number}</p>
                          )}
                          <p className="text-[11px] text-gray-500 italic mt-1 line-clamp-2">"{letter.purpose}"</p>
                        </div>
                      </td>

                      {/* Masa Tugas column */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <p className="text-gray-700 font-semibold">{formatDate(letter.start_date)}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Sampai Dengan</p>
                          <p className="text-gray-700 font-semibold">{formatDate(letter.end_date)}</p>
                        </div>
                      </td>

                      {/* Status column */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <span className={`inline-flex items-center text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${style.bg}`}>
                            {style.label}
                          </span>
                          
                          {/* Alert overlap badge */}
                          {letter.status === 'pending' && isOverlapping && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded-lg">
                              <AlertTriangle size={10} /> Bentrok Tanggal
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aksi column */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                          {letter.document_url && (
                            <a
                              href={letter.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-[#16A34A] hover:bg-green-50 rounded-xl transition-all border border-green-100"
                            >
                              <FileDown size={12} /> Dokumen
                            </a>
                          )}

                          {letter.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedLetter(letter);
                                  setActionType('approve');
                                  setAdminNote('');
                                  setModalError('');
                                }}
                                className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                              >
                                Setujui
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
                            </div>
                          )}
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

      {/* APPROVAL / REJECTION CONFIRMATION MODAL */}
      {selectedLetter && actionType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => !reviewLoading && setSelectedLetter(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md animate-scale-up">
            
            <h3 className="text-[15px] font-extrabold text-gray-900 mb-2">
              {actionType === 'approve' ? 'Setujui Pengajuan Surat Tugas?' : 'Tolak Pengajuan Surat Tugas?'}
            </h3>
            
            <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
              Anda meninjau permohonan surat tugas dari <strong>{selectedLetter.employee?.name}</strong> untuk kegiatan <strong>"{selectedLetter.title}"</strong>.
            </p>

            {/* Overlap warning check */}
            {actionType === 'approve' && checkOverlap(selectedLetter) && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-2xl text-[11.5px] font-semibold mb-4 leading-relaxed">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-600 animate-pulse" />
                <div>
                  <p className="font-bold text-amber-900">Deteksi Rentang Tanggal Bertumpukan</p>
                  <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                    Peringatan: Pegawai ini sudah memiliki surat tugas lain yang berstatus DISETUJUI pada tanggal yang bertumpukan dengan permohonan ini ({formatDate(selectedLetter.start_date)} - {formatDate(selectedLetter.end_date)}).
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

            <div className="mb-5">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Catatan Peninjauan {actionType === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                placeholder={actionType === 'reject' ? 'Masukkan alasan penolakan surat tugas...' : 'Masukkan catatan persetujuan jika ada (opsional)...'}
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
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[12.5px] font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
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
                {actionType === 'approve' ? 'Ya, Setujui' : 'Ya, Tolak'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
