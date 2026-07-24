import React, { useState, useEffect } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { resignationApi, ResignationRequest } from '../../../services/api';

export const ResignationTab: React.FC = () => {
  const [requests, setRequests] = useState<ResignationRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Review (Approve/Reject)
  const [selectedReq, setSelectedReq] = useState<ResignationRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [adminNote, setAdminNote] = useState<string>('');
  const [reviewing, setReviewing] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

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

  const filteredItems = requests.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const empName = r.employee?.user?.name?.toLowerCase() || '';
    const nik = r.employee?.nik_ktp?.toLowerCase() || '';
    const dept = r.unit_kerja?.toLowerCase() || '';
    return empName.includes(q) || nik.includes(q) || dept.includes(q);
  });

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
              Verifikasi pengajuan pengunduran diri karyawan &amp; PJ Bagian dengan aturan ketat One Month Notice (Min 30 Hari).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
              <span className="text-[10px] font-bold text-slate-300 uppercase block tracking-wider">Total Masuk</span>
              <span className="text-lg font-extrabold text-white">{requests.length}</span>
            </div>
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
                        </div>

                        <p className="text-[12px] text-slate-500">
                          Diajukan pada: <strong className="text-slate-700">{reqDateFormatted}</strong> · Notice Period: <strong className="text-rose-600">{item.notice_days} Hari</strong>
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
    </div>
  );
};
