import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  Trash2,
  Info,
  ArrowRight,
  Shield
} from 'lucide-react';
import { resignationApi, ResignationRequest } from '../../services/api';

interface ResignationRequestPageProps {
  user: {
    id: number;
    name: string;
    username: string;
    nik_ktp: string;
    department?: string;
    position?: string;
    role?: string;
  };
  onBack?: () => void;
}

const RESIGNATION_NOTES = [
  {
    icon: Clock,
    title: 'Wajib Minimal 30 Hari (One Month Notice)',
    desc: 'Pengajuan pengunduran diri (resignation) wajib dilakukan secara tertulis melalui sistem ini minimal 30 hari (1 bulan) sebelum tanggal efektif berhenti bekerja.'
  },
  {
    icon: AlertTriangle,
    title: 'Konsekuensi Ketentuan Batas Waktu',
    desc: 'Pengajuan yang tidak memenuhi ketentuan batas waktu (one month notice) dapat berakibat pada penolakan pengajuan atau pengenaan sanksi kedisiplinan sesuai dengan Peraturan Perusahaan yang berlaku.'
  },
  {
    icon: Calendar,
    title: 'Penguncian Efektif Berhenti Kerja',
    desc: 'Sistem mengunci tanggal efektif minimal 30 hari ke depan. Karyawan baru resmi berhenti bekerja 1 bulan setelah pengajuan dikirim dan disetujui oleh Manajemen/HRD.'
  },
  {
    icon: FileText,
    title: 'Dokumen Surat Resign Tertulis',
    desc: 'Setiap pengajuan wajib disertai alasan pengunduran diri tertulis yang jelas serta mengunggah berkas surat pengunduran diri fisik yang telah ditandatangani (Format wajib berupa file PDF saja).'
  }
];

export const ResignationRequestPage: React.FC<ResignationRequestPageProps> = ({ user, onBack }) => {
  const [requests, setRequests] = useState<ResignationRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Modal State: Peringatan awal terbuka otomatis saat halaman diakses
  const [showWarningModal, setShowWarningModal] = useState<boolean>(true);
  const [warningChecked, setWarningChecked] = useState<boolean>(false);
  const [showFormModal, setShowFormModal] = useState<boolean>(false);

  // Form State
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [attachment, setAttachment] = useState<File | null>(null);

  // Status Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tanggal minimal 30 hari ke depan (One Month Notice Rule)
  const getMinEffectiveDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  };

  const minDateStr = getMinEffectiveDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const calculateNoticeDays = (dateStr: string) => {
    if (!dateStr) return 0;
    const start = new Date(todayStr);
    const end = new Date(dateStr);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const selectedNoticeDays = calculateNoticeDays(effectiveDate);

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const renderTimeline = (req: ResignationRequest) => {
    const getStep1 = () => ({ status: 'done', label: 'Pengajuan Dikirim', sub: formatDateShort(req.request_date) });
    
    const getStep2 = () => {
      if (req.pj_status === 'pending') {
        return { status: 'active', label: 'Menunggu PJ Bagian', sub: 'Persetujuan divisi' };
      }
      if (req.pj_status === 'approved') {
        return { status: 'done', label: 'Disetujui PJ Bagian', sub: req.pj_reviewed_at ? formatDateShort(req.pj_reviewed_at) : 'Disetujui' };
      }
      return { status: 'rejected', label: 'Ditolak PJ Bagian', sub: req.pj_reviewed_at ? formatDateShort(req.pj_reviewed_at) : 'Ditolak' };
    };

    const getStep3 = () => {
      if (req.pj_status === 'rejected') {
        return { status: 'blocked', label: 'Admin / HRD', sub: 'Pengajuan ditolak PJ' };
      }
      if (req.pj_status === 'pending') {
        return { status: 'pending', label: 'Admin / HRD', sub: 'Menunggu PJ setuju' };
      }
      if (req.status === 'pending') {
        return { status: 'active', label: 'Menunggu Admin / HRD', sub: 'Tinjauan final' };
      }
      if (req.status === 'approved') {
        return { status: 'done', label: 'Disetujui Admin (Final)', sub: req.reviewed_at ? formatDateShort(req.reviewed_at) : 'Selesai' };
      }
      return { status: 'rejected', label: 'Ditolak Admin / HRD', sub: req.reviewed_at ? formatDateShort(req.reviewed_at) : 'Ditolak' };
    };

    const steps = [getStep1(), getStep2(), getStep3()];

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 pt-3 pb-2 w-full border-t border-slate-100 mt-3">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <React.Fragment key={idx}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-[11px] ${
                  step.status === 'done' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                  step.status === 'active' ? 'bg-amber-100 text-amber-700 border border-amber-300 animate-pulse' :
                  step.status === 'rejected' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                  step.status === 'blocked' ? 'bg-gray-50 text-gray-300 border border-gray-100' :
                  'bg-gray-100 text-gray-400 border border-gray-200'
                }`}>
                  {step.status === 'done' ? '✓' : step.status === 'rejected' ? '✗' : step.status === 'blocked' ? 'Ø' : idx + 1}
                </div>
                <div className="text-left">
                  <p className={`text-[12px] font-bold ${
                    step.status === 'done' ? 'text-emerald-800' :
                    step.status === 'active' ? 'text-amber-800 font-extrabold' :
                    step.status === 'rejected' ? 'text-rose-800' :
                    'text-gray-400'
                  }`}>{step.label}</p>
                  <p className="text-[10px] text-gray-400 font-medium leading-tight">{step.sub}</p>
                </div>
              </div>
              {!isLast && (
                <div className="hidden sm:block flex-1 h-[1.5px] bg-slate-100 min-w-[30px]" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await resignationApi.list({ personal: true });
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err: any) {
      console.error("Gagal mengambil data pengajuan pengunduran diri:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Otomatis buka pop up peringatan saat halaman pertama kali ditekan/diakses
    setShowWarningModal(true);
    fetchRequests();
  }, []);

  const handleOpenNoticeModal = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setWarningChecked(false);
    setShowWarningModal(true);
  };

  const handleProceedToForm = () => {
    if (!warningChecked) return;
    setShowWarningModal(false);
  };

  const handleOpenFormModal = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setEffectiveDate(minDateStr);
    setReason('');
    setAttachment(null);
    setShowFormModal(true);
  };

  const handleCloseFormModal = () => {
    setErrorMsg(null);
    setShowFormModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!effectiveDate) {
      setErrorMsg("Tanggal Efektif Berhenti wajib diisi.");
      return;
    }

    if (selectedNoticeDays < 30) {
      setErrorMsg(`Sesuai kebijakan One Month Notice, pengajuan pengunduran diri wajib minimal 30 hari sebelum tanggal efektif berhenti bekerja.`);
      return;
    }

    if (!reason || reason.trim().length < 10) {
      setErrorMsg("Alasan pengunduran diri wajib diisi minimal 10 karakter.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('effective_date', effectiveDate);
      formData.append('reason', reason);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      const res = await resignationApi.create(formData);
      if (res.success) {
        setSuccessMsg("Surat pengunduran diri berhasil diajukan.");
        setShowFormModal(false);
        fetchRequests();
      } else {
        setErrorMsg(res.message || "Gagal mengajukan pengunduran diri.");
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || "Terjadi kesalahan saat menyimpan pengajuan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm("Apakah Anda yakin ingin membatalkan pengajuan surat pengunduran diri ini?")) return;

    setCancellingId(id);
    try {
      const res = await resignationApi.cancel(id);
      if (res.success) {
        setSuccessMsg("Pengajuan pengunduran diri telah berhasil dibatalkan.");
        fetchRequests();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || "Gagal membatalkan pengajuan.");
    } finally {
      setCancellingId(null);
    }
  };

  const activeRequest = requests.find(r => r.status === 'pending' || r.status === 'approved');

  return (
    <div className="p-4 md:p-6 space-y-5 font-sans pb-10 max-w-7xl mx-auto">
      {/* ── HEADER BANNER UTAMA (RSUCL THEME) ───────────────────────────── */}
      <div className="bg-gradient-to-r from-[#16A34A] to-[#0D9240] rounded-3xl p-6 md:p-7 text-white shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[10.5px] font-extrabold uppercase tracking-wider">
              <ShieldAlert size={13} /> Notice Period 30 Hari
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">Pengajuan Surat Pengunduran Diri</h2>
            <p className="text-[12.5px] text-white/85 max-w-2xl leading-relaxed">
              Layanan pengunduran diri tertulis bagi Pegawai &amp; PJ Bagian RSU Cempaka Lima.
            </p>
          </div>

          <div className="flex-shrink-0 self-start sm:self-auto pt-2 sm:pt-0">
            {!activeRequest ? (
              <button
                onClick={handleOpenFormModal}
                className="flex items-center gap-2 px-5 py-3 bg-white text-[#16A34A] hover:bg-slate-50 font-bold rounded-2xl text-[13px] transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <FileText size={16} /> Buat Pengajuan Resign
              </button>
            ) : (
              <div className="px-4 py-2.5 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 text-left sm:text-right">
                <span className="text-[10px] font-extrabold uppercase text-green-100 block">Status Pengajuan</span>
                <span className="text-[12.5px] font-bold text-white">
                  {activeRequest.status === 'pending' ? '⏳ Menunggu Persetujuan' : '✅ Disetujui (Transisi)'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOTIFIKASI STATUS */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-[13px] font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold ml-4 cursor-pointer">Tutup</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between text-[13px] font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <XCircle size={18} className="text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold ml-4 cursor-pointer">Tutup</button>
        </div>
      )}

      {/* ── BANNER INFORMASI ATURAN RINGKAS ────────────────────────────── */}
      <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-[12.5px] text-amber-900 shadow-xs">
        <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-slate-800">Ketentuan Wajib One Month Notice (1 Bulan):</p>
          <p className="text-slate-600 leading-normal">
            Sesuai Peraturan Perusahaan, pengajuan pengunduran diri wajib dikirimkan minimal <strong>30 hari</strong> sebelum tanggal efektif berhenti bekerja. Tanggal efektif pada form dikunci otomatis oleh sistem.
          </p>
        </div>
      </div>

      {/* ── RIWAYAT PENGAJUKAN RESIGN ──────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-[15px]">Riwayat Pengajuan Pengunduran Diri</h3>
            <p className="text-[12px] text-slate-400">Daftar pengajuan pengunduran diri resmi Anda.</p>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
            {requests.length} Pengajuan
          </span>
        </div>

        {loading ? (
          <div className="py-14 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-[#16A34A]" size={24} />
            <span className="text-[12.5px]">Memuat riwayat pengajuan...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-14 px-4 text-center text-slate-400 space-y-2">
            <FileText size={32} className="mx-auto text-slate-300" />
            <p className="text-[13px] font-semibold text-slate-600">Belum ada pengajuan surat pengunduran diri.</p>
            <p className="text-[12px] text-slate-400 max-w-sm mx-auto">
              Klik tombol di atas atau buka pop-up peringatan jika Anda berencana mengajukan pengunduran diri.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((req) => {
              const effectiveFormatted = new Date(req.effective_date).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              });
              const requestFormatted = new Date(req.request_date).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              });

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const effDate = new Date(req.effective_date);
              effDate.setHours(0, 0, 0, 0);
              const remainingDays = Math.max(0, Math.ceil((effDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

              return (
                <div key={req.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-full">
                            <Clock size={13} className="animate-pulse" /> Menunggu Persetujuan
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-full">
                            <CheckCircle2 size={13} /> Disetujui Manajemen
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-full">
                            <XCircle size={13} /> Ditolak
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-slate-400">Diajukan: {requestFormatted}</span>
                      </div>

                      <h4 className="text-[14px] font-bold text-slate-800 pt-0.5">
                        Tanggal Efektif Berhenti: <span className="text-[#16A34A] font-extrabold">{effectiveFormatted}</span>
                      </h4>
                    </div>

                    {req.status !== 'rejected' && (
                      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-xl self-start sm:self-auto">
                        <div className="w-8 h-8 rounded-lg bg-[#16A34A] text-white font-extrabold text-[13px] flex items-center justify-center shadow-xs">
                          {remainingDays}
                        </div>
                        <div>
                          <p className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider">Sisa Transisi Notice</p>
                          <p className="text-[11.5px] font-bold text-slate-700">
                            {remainingDays > 0 ? `${remainingDays} Hari Lagi` : 'Efektif Hari Ini'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {renderTimeline(req)}

                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-[12.5px] text-slate-700 space-y-2">
                    <div>
                      <span className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider block">Alasan Pengunduran Diri:</span>
                      <p className="mt-0.5 text-slate-800 font-medium whitespace-pre-line">{req.reason}</p>
                    </div>

                    {req.attachment_url && (
                      <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                        <FileText size={14} className="text-[#16A34A]" />
                        <span className="font-bold text-[11.5px] text-slate-600">Surat Resign Tertulis:</span>
                        <a
                          href={req.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#16A34A] hover:underline font-bold text-[11.5px] ml-1"
                        >
                          Lihat Lampiran
                        </a>
                      </div>
                    )}

                    {req.admin_note && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider block">Catatan Manajemen:</span>
                        <p className="mt-0.5 font-semibold text-rose-700">{req.admin_note}</p>
                      </div>
                    )}
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex justify-end pt-0.5">
                      <button
                        onClick={() => handleCancel(req.id)}
                        disabled={cancellingId === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11.5px] rounded-xl transition-all cursor-pointer border border-rose-200 disabled:opacity-50"
                      >
                        {cancellingId === req.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        Batalkan Pengajuan Ini
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL 1: POP UP PERATURAN PERHATIAN WAJIB (PERSIS SEPERTI MODAL CUTI) ── */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden font-sans">
            
            {/* Header Warning Orange Gradient */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Shield size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-white leading-tight">Perhatian Penting</h2>
                  <p className="text-[12px] text-white/80">Harap dibaca sebelum mengajukan pengunduran diri</p>
                </div>
              </div>
              <p className="text-[12px] text-white/80 italic leading-snug">
                Setiap karyawan wajib memahami peraturan pengunduran diri perusahaan berikut ini.
              </p>
            </div>

            {/* Notes List (Cards Container Scrollable) */}
            <div className="px-6 pt-5 pb-4 space-y-3.5 max-h-[50vh] overflow-y-auto">
              {RESIGNATION_NOTES.map((note, i) => {
                const Icon = note.icon;
                return (
                  <div key={i} className="flex items-start gap-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-300/60 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-800">
                      <Icon size={15} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-amber-950 mb-0.5">{note.title}</p>
                      <p className="text-[12px] text-amber-900 leading-relaxed font-medium">{note.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acknowledge Checkbox */}
            <div className="px-6 py-4 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setWarningChecked(v => !v)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer ${
                    warningChecked ? 'bg-[#16A34A] border-[#16A34A]' : 'border-slate-300 group-hover:border-[#16A34A]'
                  }`}
                >
                  {warningChecked && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <p className="text-[12.5px] text-slate-700 leading-relaxed font-medium">
                  Saya telah membaca dan memahami peraturan pengunduran diri perusahaan di atas dan akan mematuhinya.
                </p>
              </label>
            </div>

            {/* Footer Action Button */}
            <div className="px-6 pb-6 pt-1">
              <button
                onClick={handleProceedToForm}
                disabled={!warningChecked}
                className={`w-full py-3 rounded-2xl text-[13.5px] font-bold transition-all text-center flex items-center justify-center gap-2 ${
                  warningChecked
                    ? 'bg-[#16A34A] text-white shadow-sm hover:bg-[#0d9240] active:scale-[0.98] cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {warningChecked ? 'Saya Mengerti & Lanjutkan' : 'Centang kotak di atas untuk melanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: FORM INPUT SURAT PENGUNDURAN DIRI ─────────────────── */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-7 shadow-2xl border border-slate-100 space-y-5 my-6 font-sans relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Form Pengajuan Surat Resign</h3>
                <p className="text-[11.5px] text-slate-400">Sertakan tanggal efektif dan alasan tertulis Anda.</p>
              </div>
              <button
                onClick={handleCloseFormModal}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Alert inside Modal */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2.5 text-[12px] font-semibold">
                  <XCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{errorMsg}</span>
                  </div>
                  <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer">✕</button>
                </div>
              )}

              {/* Profil singkat */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11.5px] flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block font-medium">Pemohon:</span>
                  <span className="font-bold text-slate-800">{user.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-medium">Unit Kerja:</span>
                  <span className="font-bold text-slate-800">{user.department || 'RSUCL'}</span>
                </div>
              </div>

              {/* Tanggal Efektif (Locked Min 30 Days) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-bold text-slate-800">
                    Tanggal Efektif Berhenti Kerja <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#16A34A] border border-green-200">
                    Min. 30 Hari Notice
                  </span>
                </div>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#16A34A]" />
                  <input
                    type="date"
                    min={minDateStr}
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-[13px] text-slate-800 font-bold focus:outline-none focus:border-[#16A34A] transition-all"
                  />
                </div>
                <div className="mt-2 p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[11.5px] text-amber-900 leading-relaxed font-medium">
                  Sistem mengunci tanggal efektif minimal 30 hari ke depan (Paling cepat: <strong className="text-slate-900">{new Date(minDateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>). Pegawai baru berhenti bekerja setelah 1 bulan ke depan jika pengajuan disetujui oleh Manajemen.
                </div>
              </div>

              {/* Alasan */}
              <div>
                <label className="block text-[12px] font-bold text-slate-800 mb-1">
                  Alasan Pengunduran Diri Tertulis <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tuliskan alasan pengunduran diri Anda secara jelas dan profesional..."
                  required
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-[12.5px] text-slate-800 focus:outline-none focus:border-[#16A34A] transition-all font-medium resize-none"
                />
              </div>

              {/* Upload Surat Resign Fisik */}
              <div>
                <label className="block text-[12px] font-bold text-slate-800 mb-1">
                  Unggah Berkas Surat Resign Fisik (PDF saja)
                </label>
                <div className="border border-dashed border-slate-300 rounded-2xl p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors text-center cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.type !== 'application/pdf') {
                        alert('Format berkas wajib berupa PDF saja!');
                        e.target.value = '';
                        setAttachment(null);
                      } else {
                        setAttachment(file);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center gap-1 text-slate-500">
                    <Upload size={18} className="text-[#16A34A]" />
                    <span className="text-[12px] font-bold text-slate-700">
                      {attachment ? attachment.name : 'Pilih berkas surat resign (Format PDF, Maks. 5MB)'}
                    </span>
                    <span className="text-[10px] text-slate-400">PDF saja</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseFormModal}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-2xl transition-all cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-[#16A34A] hover:bg-[#0d9240] text-white font-bold text-[12.5px] rounded-2xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                  Kirim Pengajuan Resign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
