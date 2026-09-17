import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  UserCheck,
  Calendar,
  Loader2,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Building2,
  ShieldAlert,
  Trash2,
  Printer,
  X,
  PlusCircle,
  BadgeCheck,
  ChevronDown,
  User2
} from 'lucide-react';
import qrCodeImg from '../../../imports/qr_code_cempaka_lima.png';
import qrHrdImg from '../../../imports/qr_hrd_rsucl.png';
import qrDirRsImg from '../../../imports/qr_direktur_rs_cempaka_lima.png';
import { resignationApi, employeeApi, ResignationRequest, Employee } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

// ── Konfigurasi Direktur Penandatangan ─────────────────────────────────────────
const DIRECTORS = {
  pt_director: {
    label: 'Direktur PT Cempaka Lima',
    name: 'Amir Hidayat, ST, MKM',
    img: qrCodeImg,
  },
  rs_director: {
    label: 'Direktur Rumah Sakit Cempaka Lima',
    name: 'dr. Meri Lidiawati, MM, MKM, CHLQM',
    img: qrDirRsImg,
  },
} as const;

type DirectorType = keyof typeof DIRECTORS;

export const ResignationTab: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [requests, setRequests] = useState<ResignationRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedResignDoc, setSelectedResignDoc] = useState<ResignationRequest | null>(null);

  // Modal Review (Approve/Reject)
  const [selectedReq, setSelectedReq] = useState<ResignationRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [adminNote, setAdminNote] = useState<string>('');
  const [reviewing, setReviewing] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

  // ── STATE MODAL CATAT ADMIN ─────────────────────────────────────────────────
  const [showAdminRecordModal, setShowAdminRecordModal] = useState<boolean>(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [submittingRecord, setSubmittingRecord] = useState<boolean>(false);

  // Form fields pencatatan admin
  const [recEmployeeId, setRecEmployeeId] = useState<string>('');
  const [recEffectiveDate, setRecEffectiveDate] = useState<string>('');
  const [recReason, setRecReason] = useState<string>('');
  const [recDirectorType, setRecDirectorType] = useState<DirectorType>('pt_director');
  const [recAttachment, setRecAttachment] = useState<File | null>(null);
  const [recEmployeeSearch, setRecEmployeeSearch] = useState<string>('');
  const [showEmpDropdown, setShowEmpDropdown] = useState<boolean>(false);
  const empDropdownRef = useRef<HTMLDivElement>(null);
  // ────────────────────────────────────────────────────────────────────────────

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const res = await resignationApi.list({
        status: filterStatus,
        search: searchQuery
      });
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err: any) {
      console.error("Gagal memuat daftar pengajuan pengunduran diri:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRequests();
  }, [filterStatus]);

  // Muat daftar karyawan saat modal catat admin dibuka
  useEffect(() => {
    if (showAdminRecordModal && employees.length === 0) {
      setLoadingEmployees(true);
      employeeApi.list()
        .then(res => { if (res.success) setEmployees(res.data); })
        .catch(err => console.error('Gagal memuat daftar karyawan:', err))
        .finally(() => setLoadingEmployees(false));
    }
  }, [showAdminRecordModal]);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(e.target as Node)) {
        setShowEmpDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAllRequests();
  };

  const handleOpenReview = (req: ResignationRequest, action: 'approved' | 'rejected') => {
    setSelectedReq(req);
    setReviewAction(action);
    setAdminNote('');
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;

    if (reviewAction === 'rejected' && (!adminNote || adminNote.trim().length < 5)) {
      alert("Wajib menyertakan alasan penolakan pada catatan admin.");
      return;
    }

    setReviewing(true);
    try {
      const res = await resignationApi.review(selectedReq.id, reviewAction, adminNote);
      if (res.success) {
        alert(`Pengajuan pengunduran diri berhasil di-${reviewAction === 'approved' ? 'setujui' : 'tolak'}.`);
        setShowReviewModal(false);
        fetchAllRequests();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || "Gagal memproses peninjauan.");
    } finally {
      setReviewing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data pengajuan pengunduran diri ini secara permanen?")) return;
    try {
      const res = await resignationApi.delete(id);
      if (res.success) {
        alert("Pengajuan pengunduran diri berhasil dihapus.");
        fetchAllRequests();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.data?.message || err?.message || "Gagal menghapus pengajuan pengunduran diri.");
    }
  };

  // ── HANDLER SUBMIT CATAT ADMIN ──────────────────────────────────────────────
  const resetAdminRecordForm = () => {
    setRecEmployeeId('');
    setRecEffectiveDate('');
    setRecReason('');
    setRecDirectorType('pt_director');
    setRecAttachment(null);
    setRecEmployeeSearch('');
    setShowEmpDropdown(false);
  };

  const handleAdminRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recEmployeeId) { alert('Pilih karyawan terlebih dahulu.'); return; }
    if (!recEffectiveDate) { alert('Tanggal efektif berhenti wajib diisi.'); return; }
    if (!recReason || recReason.trim().length < 10) { alert('Alasan pengunduran diri minimal 10 karakter.'); return; }

    const formData = new FormData();
    formData.append('employee_id', recEmployeeId);
    formData.append('effective_date', recEffectiveDate);
    formData.append('reason', recReason);
    formData.append('director_type', recDirectorType);
    if (recAttachment) formData.append('attachment', recAttachment);

    setSubmittingRecord(true);
    try {
      const res = await resignationApi.adminRecord(formData);
      if (res.success) {
        alert('Pengunduran diri karyawan berhasil dicatat. Karyawan telah mendapat notifikasi.');
        setShowAdminRecordModal(false);
        resetAdminRecordForm();
        fetchAllRequests();
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.response?.data?.message || err?.message || 'Gagal mencatat pengunduran diri.';
      alert(msg);
    } finally {
      setSubmittingRecord(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

  const filteredItems = requests.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const empName = r.employee?.user?.name?.toLowerCase() || '';
    const nik = r.employee?.nik_ktp?.toLowerCase() || '';
    const dept = r.unit_kerja?.toLowerCase() || '';
    return empName.includes(q) || nik.includes(q) || dept.includes(q);
  });

  // Helper: daftar karyawan terfilter untuk dropdown
  const filteredEmployees = employees.filter(emp => {
    if (!recEmployeeSearch) return true;
    const q = recEmployeeSearch.toLowerCase();
    return emp.name?.toLowerCase().includes(q) || emp.nik_ktp?.toLowerCase().includes(q) || emp.department?.toLowerCase().includes(q);
  });

  const selectedEmployee = employees.find(e => String(e.user_id) === recEmployeeId || String(e.id) === recEmployeeId);

  // Helper: label direktur dari director_type
  const getDirectorInfo = (directorType: string | null | undefined) => {
    if (directorType === 'rs_director') return DIRECTORS.rs_director;
    return DIRECTORS.pt_director; // default
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* ── HEADER BANNER ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-rose-900/30">
        <div className="absolute right-0 top-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl -translate-y-16 translate-x-16 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Manajemen SDM &amp; HRD
            </span>
            <h2 className="text-xl md:text-2xl font-bold mt-2">Peninjauan Surat Pengunduran Diri (Resignation)</h2>
            <p className="text-[12.5px] text-slate-300 mt-1">
              Verifikasi pengajuan pengunduran diri karyawan &amp; PJ Bagian. Admin juga dapat mencatat pengunduran diri secara langsung.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] font-bold text-slate-300 uppercase block tracking-wider">Total Masuk</span>
              <span className="text-lg font-extrabold text-white">{requests.length}</span>
            </div>
            {/* ── TOMBOL CATAT ADMIN ── */}
            {isAdminOrSuperAdmin && (
              <button
                onClick={() => { setShowAdminRecordModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-[12.5px] rounded-2xl transition-all shadow-lg border border-rose-400/30 cursor-pointer"
              >
                <PlusCircle size={16} />
                Catat Pengunduran Diri
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama karyawan, NIK, atau unit kerja..."
            className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl text-[13px] text-slate-800 bg-slate-50/50 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 font-medium transition-all"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Filter size={13} /> Status:
          </span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${filterStatus === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${filterStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
          >
            Menunggu ({requests.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('approved')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${filterStatus === 'approved' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            Disetujui
          </button>
          <button
            onClick={() => setFilterStatus('rejected')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer ${filterStatus === 'rejected' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}
          >
            Ditolak
          </button>
        </div>
      </div>

      {/* ── TABLE / LIST PENGAJUAN RESIGN ─────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-rose-600" size={32} />
            <span className="text-[13px] font-medium">Memuat pengajuan pengunduran diri...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <FileText size={32} className="mx-auto text-slate-300" />
            <p className="text-[13.5px] font-bold text-slate-600">Tidak ada pengajuan pengunduran diri ditemukan.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const empName = item.employee?.user?.name || 'Karyawan';
              const empNik = item.employee?.nik_ktp || '-';
              const unitKerja = item.unit_kerja || item.employee?.department?.name || 'RSUCL';
              const efDateFormatted = new Date(item.effective_date).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });
              const reqDateFormatted = new Date(item.request_date).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const effDate = new Date(item.effective_date);
              effDate.setHours(0, 0, 0, 0);
              const remainingDays = Math.max(0, Math.ceil((effDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

              const isAdminRecorded = !!item.recorded_by;

              return (
                <div key={item.id} className="p-6 hover:bg-slate-50/50 transition-colors space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 font-extrabold text-[15px] flex items-center justify-center border border-rose-200 flex-shrink-0">
                        {empName.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[15px] font-bold text-slate-900">{empName}</h4>
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            NIK: {empNik}
                          </span>
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            Unit: {unitKerja}
                          </span>
                          {/* ── BADGE "DICATAT ADMIN" ── */}
                          {isAdminRecorded && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                              <BadgeCheck size={11} /> Dicatat Admin
                            </span>
                          )}
                        </div>

                        <p className="text-[12px] text-slate-500">
                          Dicatat pada: <strong className="text-slate-700">{reqDateFormatted}</strong> · Notice Period: <strong className="text-rose-600">{item.notice_days} Hari</strong>
                          {isAdminRecorded && item.director_type && (
                            <span className="ml-2 text-violet-600 font-semibold">
                              · {getDirectorInfo(item.director_type).label}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap self-end lg:self-auto">
                      {/* BADGE STATUS PJ */}
                      {item.pj_status === 'pending' && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-extrabold text-[11px] rounded-full">
                          Menunggu PJ Bagian
                        </span>
                      )}
                      {item.pj_status === 'approved' && (
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-extrabold text-[11px] rounded-full">
                          Disetujui PJ Bagian
                        </span>
                      )}
                      {item.pj_status === 'rejected' && (
                        <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[11px] rounded-full">
                          Ditolak PJ Bagian
                        </span>
                      )}

                      {/* BADGE STATUS HRD */}
                      {item.status === 'approved' && (
                        <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[11.5px] rounded-full flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Disetujui HRD
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[11.5px] rounded-full flex items-center gap-1.5">
                          <XCircle size={14} /> Ditolak HRD
                        </span>
                      )}

                      {/* ACTION BUTTONS UNTUK PENDING */}
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenReview(item, 'approved')}
                            disabled={item.pj_status !== 'approved'}
                            title={item.pj_status !== 'approved' ? "Menunggu persetujuan PJ Bagian terlebih dahulu" : "Setujui pengunduran diri"}
                            className={`px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[12px] rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <CheckCircle2 size={14} /> Setujui
                          </button>
                          <button
                            onClick={() => handleOpenReview(item, 'rejected')}
                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[12px] rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1"
                          >
                            <XCircle size={14} /> Tolak
                          </button>
                        </div>
                      )}

                      {/* ACTION BUTTON LIHAT SURAT UNTUK APPROVED */}
                      {item.status === 'approved' && (
                        <button
                          onClick={() => setSelectedResignDoc(item)}
                          title="Lihat Surat Pengunduran Diri"
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[12px] rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Printer size={14} /> Lihat Surat
                        </button>
                      )}

                      {/* ACTION BUTTON HAPUS UNTUK ADMIN / SUPER ADMIN */}
                      {isAdminOrSuperAdmin && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Hapus Pengajuan Resign"
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-bold text-[12px] rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={14} /> Hapus
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KARTU DETAIL PERSYARATAN & ALASAN */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[12.5px]">
                    <div className="md:col-span-8 space-y-2">
                      <span className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider block">Alasan Pengunduran Diri:</span>
                      <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-line">{item.reason}</p>
                      
                      {item.attachment_url && (
                        <div className="pt-2 flex items-center gap-2 text-[11.5px]">
                          <FileText size={14} className="text-rose-600" />
                          <span className="font-bold text-slate-600">Surat Resign Fisik:</span>
                          <a
                            href={item.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-rose-600 hover:text-rose-700 font-bold underline flex items-center gap-1"
                          >
                            Buka Dokumen <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-4 bg-white p-3.5 rounded-xl border border-slate-200/60 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Tanggal Efektif Berhenti:</span>
                        <p className="text-[14px] font-extrabold text-rose-600 mt-0.5">{efDateFormatted}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Sisa Sesi Kerja:</span>
                        <span className="font-extrabold text-slate-800 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-100">
                          {remainingDays} Hari Lagi
                        </span>
                      </div>
                    </div>
                  </div>

                  {item.pj_note && (
                    <div className="p-3 bg-blue-50 text-blue-900 rounded-xl border border-blue-100 text-[12px] flex items-start gap-2">
                      <MessageSquare size={15} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Catatan PJ Bagian ({item.pj_reviewer?.name || 'PJ'}):</span>
                        <span>{item.pj_note}</span>
                      </div>
                    </div>
                  )}

                  {item.admin_note && (
                    <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[12px] text-amber-900 flex items-start gap-2">
                      <MessageSquare size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Catatan HRD/Admin ({item.reviewer?.name || 'Admin'}):</span>
                        <span>{item.admin_note}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL PENINJAUAN ADMIN (APPROVE / REJECT) ──────────────────── */}
      {showReviewModal && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {reviewAction === 'approved' ? 'Setujui Pengunduran Diri' : 'Tolak Pengunduran Diri'}
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-[12px] space-y-1">
              <p><span className="text-slate-400 font-medium">Pemohon:</span> <strong>{selectedReq.employee?.user?.name}</strong></p>
              <p><span className="text-slate-400 font-medium">Unit Kerja:</span> <strong>{selectedReq.unit_kerja}</strong></p>
              <p><span className="text-slate-400 font-medium">Tanggal Efektif:</span> <strong className="text-rose-600">{new Date(selectedReq.effective_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-800 mb-1">
                  Catatan Admin / HRD {reviewAction === 'rejected' && <span className="text-rose-600">*</span>}
                </label>
                <textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={reviewAction === 'approved' ? 'Catatan instruksi serah terima tugas (opsional)...' : 'Tuliskan alasan penolakan secara jelas...'}
                  required={reviewAction === 'rejected'}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-[12.5px] text-slate-800 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 font-medium resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={reviewing}
                  className={`flex-1 py-2.5 px-4 font-bold text-[12.5px] text-white rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${reviewAction === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                >
                  {reviewing ? <Loader2 size={15} className="animate-spin" /> : (reviewAction === 'approved' ? <CheckCircle2 size={15} /> : <XCircle size={15} />)}
                  {reviewAction === 'approved' ? 'Konfirmasi Setujui' : 'Konfirmasi Tolak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CATAT PENGUNDURAN DIRI OLEH ADMIN ────────────────────── */}
      {showAdminRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 font-sans overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-violet-50 to-rose-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <PlusCircle size={16} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Catat Pengunduran Diri</h3>
                  <p className="text-[11px] text-slate-500">Dicatat langsung oleh Administrator</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAdminRecordModal(false); resetAdminRecordForm(); }}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Info Banner */}
            <div className="px-6 pt-4 flex-shrink-0">
              <div className="flex items-start gap-2.5 p-3 bg-violet-50 rounded-xl border border-violet-200/60 text-[11.5px] text-violet-800">
                <BadgeCheck size={16} className="text-violet-600 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">
                  Pengunduran diri yang dicatat admin akan <strong>langsung disetujui</strong> (bypass alur PJ Bagian) dan karyawan akan mendapat notifikasi.
                </p>
              </div>
            </div>

            {/* Form Scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <form id="admin-record-form" onSubmit={handleAdminRecordSubmit} className="space-y-5">

                {/* Pilih Karyawan */}
                <div ref={empDropdownRef} className="relative">
                  <label className="block text-[12px] font-bold text-slate-800 mb-1.5">
                    Karyawan <span className="text-rose-500">*</span>
                  </label>
                  <div
                    onClick={() => setShowEmpDropdown(v => !v)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-[12.5px] text-slate-800 bg-slate-50/50 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 font-medium cursor-pointer flex items-center justify-between gap-2 hover:border-violet-400 transition-all"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <User2 size={14} className="text-slate-400 flex-shrink-0" />
                      {selectedEmployee ? (
                        <span className="text-slate-900 font-semibold truncate">{selectedEmployee.name} <span className="text-slate-400 font-normal">— {selectedEmployee.department}</span></span>
                      ) : (
                        <span className="text-slate-400">Pilih karyawan...</span>
                      )}
                    </div>
                    <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${showEmpDropdown ? 'rotate-180' : ''}`} />
                  </div>

                  {showEmpDropdown && (
                    <div className="absolute z-[70] top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <input
                          type="text"
                          value={recEmployeeSearch}
                          onChange={e => setRecEmployeeSearch(e.target.value)}
                          placeholder="Cari nama / NIK / bagian..."
                          autoFocus
                          className="w-full px-3 py-2 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        {loadingEmployees ? (
                          <div className="p-4 text-center text-slate-400 text-[12px] flex items-center justify-center gap-2">
                            <Loader2 size={14} className="animate-spin" /> Memuat...
                          </div>
                        ) : filteredEmployees.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-[12px]">Tidak ada karyawan ditemukan</div>
                        ) : (
                          filteredEmployees.map(emp => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setRecEmployeeId(String(emp.user_id));
                                setShowEmpDropdown(false);
                                setRecEmployeeSearch('');
                              }}
                              className={`w-full text-left px-3.5 py-2.5 hover:bg-violet-50 transition-colors text-[12px] flex items-center gap-3 cursor-pointer ${String(emp.user_id) === recEmployeeId ? 'bg-violet-50' : ''}`}
                            >
                              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 font-extrabold text-[11px] flex items-center justify-center flex-shrink-0">
                                {emp.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{emp.name}</p>
                                <p className="text-slate-400 text-[10.5px]">{emp.nik_ktp} · {emp.department}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tanggal Efektif Berhenti */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-800 mb-1.5">
                    Tanggal Efektif Berhenti <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={recEffectiveDate}
                    onChange={e => setRecEffectiveDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-[12.5px] text-slate-800 bg-slate-50/50 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 font-medium transition-all"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">Untuk pencatatan oleh admin, aturan minimal 30 hari dapat disesuaikan.</p>
                </div>

                {/* Alasan */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-800 mb-1.5">
                    Alasan Pengunduran Diri <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={recReason}
                    onChange={e => setRecReason(e.target.value)}
                    placeholder="Tuliskan alasan pengunduran diri secara lengkap dan jelas (minimal 10 karakter)..."
                    required
                    minLength={10}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-2xl text-[12.5px] text-slate-800 bg-slate-50/50 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 font-medium resize-none transition-all"
                  />
                </div>

                {/* Pilih Direktur Penandatangan */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-800 mb-2">
                    Direktur Penandatangan Surat <span className="text-rose-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {(Object.entries(DIRECTORS) as [DirectorType, typeof DIRECTORS[DirectorType]][]).map(([key, dir]) => (
                      <label
                        key={key}
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${recDirectorType === key
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-slate-200 hover:border-violet-300 hover:bg-slate-50/50'}`}
                      >
                        <input
                          type="radio"
                          name="director_type"
                          value={key}
                          checked={recDirectorType === key}
                          onChange={() => setRecDirectorType(key)}
                          className="mt-0.5 accent-violet-600"
                        />
                        <div>
                          <p className={`text-[12.5px] font-bold ${recDirectorType === key ? 'text-violet-900' : 'text-slate-800'}`}>
                            {dir.name}
                          </p>
                          <p className={`text-[11px] font-medium ${recDirectorType === key ? 'text-violet-600' : 'text-slate-500'}`}>
                            {dir.label}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Upload Surat Fisik (Opsional) */}
                <div>
                  <label className="block text-[12px] font-bold text-slate-800 mb-1.5">
                    Upload Surat Fisik (Opsional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={e => setRecAttachment(e.target.files?.[0] ?? null)}
                    className="w-full text-[12px] text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:font-bold file:text-[11.5px] file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 file:cursor-pointer cursor-pointer"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">Format: PDF, maks. 5 MB</p>
                </div>

              </form>
            </div>

            {/* Footer Aksi */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setShowAdminRecordModal(false); resetAdminRecordForm(); }}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-all cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="submit"
                form="admin-record-form"
                disabled={submittingRecord}
                className="flex-1 py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white font-bold text-[12.5px] rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingRecord ? <Loader2 size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
                {submittingRecord ? 'Menyimpan...' : 'Catat & Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SURAT PENGUNDURAN DIRI (ADMIN VIEW) ────────────────── */}
      {selectedResignDoc && (() => {
        const empName = selectedResignDoc.employee?.user?.name || 'Karyawan';
        const empNik = selectedResignDoc.employee?.nik_ktp || '-';
        const unitKerja = selectedResignDoc.unit_kerja || selectedResignDoc.employee?.department?.name || 'RSU Cempaka Lima';
        const empPosition = typeof selectedResignDoc.employee?.position === 'object' && selectedResignDoc.employee?.position !== null
          ? selectedResignDoc.employee?.position.name
          : (selectedResignDoc.employee?.position || selectedResignDoc.posisi || '-');

        const reqDateStr = selectedResignDoc.request_date
          ? selectedResignDoc.request_date.substring(0, 10).replace(/-/g, '')
          : '';
        const docNumber = `SPD-${selectedResignDoc.id}-${reqDateStr}`;

        const formatLong = (dateStr: string) => {
          if (!dateStr) return '-';
          const d = new Date(dateStr);
          const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
          const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
          return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        };

        const reqFormatted = formatLong(selectedResignDoc.request_date);
        const effFormatted = formatLong(selectedResignDoc.effective_date);

        // Tentukan direktur berdasarkan director_type
        const directorInfo = getDirectorInfo(selectedResignDoc.director_type);

        const qrContent = `SURAT PENGUNDURAN DIRI RESMI\nRSU CEMPAKA LIMA\n------------------------------\nNo. Dokumen: ${docNumber}\nNama Pegawai: ${empName}\nNIK KTP: ${empNik}\nUnit Kerja: ${unitKerja}\nJabatan: ${empPosition}\nTanggal Pengajuan: ${reqFormatted}\nTanggal Efektif Berhenti: ${effFormatted}\nNotice Period: ${selectedResignDoc.notice_days} Hari\nStatus Dokumen: SAH / DISETUJUI\nOtorisasi Final: ${directorInfo.label} (${directorInfo.name})`;

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedResignDoc(null)} />
            <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto z-10">

              {/* Modal controls */}
              <div className="flex justify-end gap-2 mb-4 border-b border-slate-100 pb-3 no-print">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-[12px] font-extrabold shadow-sm transition-all cursor-pointer hover:shadow active:scale-95"
                >
                  <Printer size={13} /> Cetak Dokumen
                </button>
                <button
                  onClick={() => setSelectedResignDoc(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Info direktur yang dipilih (no-print) */}
              {selectedResignDoc.recorded_by && selectedResignDoc.director_type && (
                <div className="no-print mb-4 flex items-center gap-2 p-3 bg-violet-50 rounded-xl border border-violet-200 text-[11.5px] text-violet-800">
                  <BadgeCheck size={15} className="text-violet-600 flex-shrink-0" />
                  <span>Surat ini dicatat oleh Admin · Penandatangan: <strong>{directorInfo.name}</strong> ({directorInfo.label})</span>
                </div>
              )}

              {/* Printable Document Container */}
              <div className="border-[3px] border-double border-slate-800 p-6 md:p-8 bg-slate-50/20 font-serif text-slate-900 leading-normal text-left shadow-inner rounded-xl">

                {/* Header */}
                <div className="text-center border-b-[2px] border-slate-800 pb-3 mb-5">
                  <h2 className="text-[20px] font-bold tracking-wide uppercase">Surat Pengunduran Diri</h2>
                  <p className="text-[12px] font-bold text-slate-700 tracking-wider mt-0.5">RSU CEMPAKA LIMA</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">No. Dokumen: {docNumber}</p>
                </div>

                {/* Identity */}
                <div className="text-[12px] mb-5 border-b border-slate-200 pb-4 space-y-2">
                  <div className="grid grid-cols-[160px_1fr] gap-1">
                    <span className="font-bold text-slate-600">Nama Pegawai</span>
                    <span className="font-semibold text-slate-900">: {empName}</span>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-1">
                    <span className="font-bold text-slate-600">NIK KTP</span>
                    <span className="font-semibold text-slate-900">: {empNik}</span>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-1">
                    <span className="font-bold text-slate-600">Unit Kerja / Bagian</span>
                    <span className="font-semibold text-slate-900">: {unitKerja}</span>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-1">
                    <span className="font-bold text-slate-600">Jabatan</span>
                    <span className="font-semibold text-slate-900">: {empPosition}</span>
                  </div>
                  <div className="grid grid-cols-[160px_1fr] gap-1">
                    <span className="font-bold text-slate-600">Tanggal Pengajuan</span>
                    <span className="font-semibold text-slate-900">: {reqFormatted}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse border border-slate-800 text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-800 text-center font-bold">
                        <th className="border border-slate-800 p-2">Nama Karyawan</th>
                        <th className="border border-slate-800 p-2">Unit Kerja</th>
                        <th className="border border-slate-800 p-2">Tgl. Pengajuan</th>
                        <th className="border border-slate-800 p-2">Tgl. Efektif Berhenti</th>
                        <th className="border border-slate-800 p-2">Notice Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-center font-semibold text-slate-800">
                        <td className="border border-slate-800 p-2 text-left">{empName}</td>
                        <td className="border border-slate-800 p-2">{unitKerja}</td>
                        <td className="border border-slate-800 p-2">{new Date(selectedResignDoc.request_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                        <td className="border border-slate-800 p-2 font-bold text-rose-700">{new Date(selectedResignDoc.effective_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                        <td className="border border-slate-800 p-2">{selectedResignDoc.notice_days} Hari</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Alasan */}
                <div className="mb-6 text-[12px]">
                  <p className="font-bold text-slate-700 mb-1">Alasan Pengunduran Diri:</p>
                  <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-line pl-2 border-l-2 border-slate-300">{selectedResignDoc.reason}</p>
                </div>

                {/* Footer Signatures — dinamis berdasarkan director_type */}
                <div className="grid grid-cols-2 gap-12 pt-6 items-start">

                  {/* Disetujui Oleh */}
                  <div className="text-center flex flex-col items-center">
                    <p className="text-[12px] font-bold text-slate-800">Disetujui Oleh,</p>
                    <div className="my-2 p-1 border border-slate-200 rounded-lg bg-white shadow-xs">
                      <img src={qrHrdImg} alt="QR HRD RSUCL" className="w-20 h-20 object-contain" />
                    </div>
                    <p className="text-[12px] font-bold text-slate-800 underline">Tim Administrator RSUCL</p>
                  </div>

                  {/* Diketahui Oleh — dinamis sesuai director_type */}
                  <div className="text-center flex flex-col items-center">
                    <p className="text-[12px] font-bold text-slate-800">Diketahui Oleh,</p>
                    <div className="my-2 p-1 border border-slate-200 rounded-lg bg-white shadow-xs">
                      <img src={directorInfo.img} alt={`QR ${directorInfo.label}`} className="w-20 h-20 object-contain" />
                    </div>
                    <p className="text-[12px] font-bold text-slate-800 underline">{directorInfo.name}</p>
                    <p className="text-[10px] text-slate-600 font-semibold">{directorInfo.label}</p>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
