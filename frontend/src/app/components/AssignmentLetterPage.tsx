import React, { useState, useEffect } from 'react';
import {
  FileText,
  Building2,
  Calendar,
  Paperclip,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  ArrowLeft,
  FileDown,
  UploadCloud,
  ArrowRight,
  Send,
  ClipboardCheck,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { assignmentLetterApi, AssignmentLetter } from '../../services/api';
import { MonthYearDeptFilter } from './ui/MonthYearDeptFilter';

/* ─── Helpers ───────────────────────────────────────────────── */
const MONTH_NAMES = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

/* ─── Status Config ──────────────────────────────────────────── */
function getStatusConfig(status: AssignmentLetter['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Selesai', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
    case 'approved':
      return { label: 'Tugas Aktif', dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 };
    case 'rejected':
      return { label: 'Ditolak', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200', icon: XCircle };
    default:
      return { label: 'Menunggu', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock };
  }
}

/* ─── Timeline Step ──────────────────────────────────────────── */
interface StepProps {
  num: number;
  title: string;
  sub: string;
  state: 'done' | 'active' | 'pending' | 'error';
  isLast?: boolean;
}
function TimelineStep({ num, title, sub, state, isLast }: StepProps) {
  const circleStyle = {
    done:    'bg-green-500 text-white shadow-green-200 shadow-sm',
    active:  'bg-amber-400 text-white shadow-amber-200 shadow-sm',
    pending: 'bg-gray-200 text-gray-400',
    error:   'bg-red-500 text-white shadow-red-200 shadow-sm',
  }[state];
  const textStyle = {
    done:    'text-green-700',
    active:  'text-amber-700',
    pending: 'text-gray-400',
    error:   'text-red-600',
  }[state];
  const lineStyle = {
    done:    'bg-green-300',
    active:  'bg-gray-200',
    pending: 'bg-gray-200',
    error:   'bg-gray-200',
  }[state];

  return (
    <div className="flex items-start gap-3 flex-1 min-w-0">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold ${circleStyle}`}>
          {state === 'done' ? <CheckCircle2 size={15} /> : state === 'error' ? <XCircle size={15} /> : num}
        </div>
        {!isLast && <div className={`w-0.5 h-6 mt-1 ${lineStyle}`} />}
      </div>
      <div className="pt-0.5 min-w-0">
        <p className={`text-[12px] font-bold leading-tight ${textStyle}`}>{title}</p>
        <p className="text-[10.5px] text-gray-400 mt-0.5 leading-snug">{sub}</p>
      </div>
    </div>
  );
}

/* ─── Step States Helper ─────────────────────────────────────── */
function getStepStates(letter: AssignmentLetter): [StepProps['state'], StepProps['state'], StepProps['state']] {
  const s = letter.status;
  const step1: StepProps['state'] = 'done';
  const step2: StepProps['state'] =
    s === 'rejected' ? 'error' :
    (letter.document_url || s === 'approved' || s === 'completed') ? 'done' : 'active';
  const step3: StepProps['state'] =
    s === 'completed' ? 'done' :
    (s === 'approved') ? 'active' : 'pending';
  return [step1, step2, step3];
}

/* ─── Letter Card ────────────────────────────────────────────── */
function LetterCard({
  letter,
  onUploadReport,
  onCancel,
}: {
  letter: AssignmentLetter;
  onUploadReport: (l: AssignmentLetter) => void;
  onCancel: (l: AssignmentLetter) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sc = getStatusConfig(letter.status);
  const StatusIcon = sc.icon;
  const [s1, s2, s3] = getStepStates(letter);
  const isAdminIssued = letter.source === 'admin_assignment';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ── Card Header ─────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 flex flex-col gap-3">
        {/* Top row: title + badges + status */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div className="min-w-0">
            {/* Type badge */}
            <div className="mb-1.5">
              {isAdminIssued ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <FileText size={10} /> Diterbitkan oleh Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  <Send size={10} /> Diajukan oleh Saya
                </span>
              )}
            </div>

            <h4 className="text-[15px] font-extrabold text-gray-900 leading-snug">{letter.title}</h4>
            <p className="text-[11.5px] text-gray-500 mt-0.5 flex items-center gap-1">
              <Building2 size={11} className="flex-shrink-0" />
              {letter.issuing_institution}
            </p>
          </div>

          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border flex-shrink-0 ${sc.badge}`}>
            <StatusIcon size={12} /> {sc.label}
          </span>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-[12px]">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
            <Calendar size={12} className="text-gray-400" />
            <span className="font-semibold text-gray-700">{formatDate(letter.start_date)}</span>
          </div>
          <ArrowRight size={13} className="text-gray-400 flex-shrink-0" />
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
            <Calendar size={12} className="text-gray-400" />
            <span className="font-semibold text-gray-700">{formatDate(letter.end_date)}</span>
          </div>
        </div>
      </div>

      {/* ── Progress Timeline ────────────────────────────── */}
      <div className="mx-5 mb-4 bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-3">Progres Penugasan</p>
        <div className="flex flex-col gap-0">
          <TimelineStep
            num={1}
            title={isAdminIssued ? 'Surat Tugas Diterbitkan Admin' : 'Pengajuan Dikirim'}
            sub={isAdminIssued ? 'Admin menerbitkan surat tugas untuk Anda' : 'Menunggu respon dan balasan surat dari Admin'}
            state={s1}
          />
          <TimelineStep
            num={2}
            title={
              letter.status === 'rejected'
                ? 'Pengajuan Ditolak'
                : letter.document_url
                ? 'Surat Balasan Diterima'
                : 'Menunggu Surat Balasan Admin'
            }
            sub={
              letter.status === 'rejected'
                ? 'Admin tidak menyetujui pengajuan ini'
                : letter.document_url
                ? 'Dokumen resmi sudah tersedia, unduh di bawah'
                : 'Admin sedang memproses dan menerbitkan surat balasan'
            }
            state={s2}
          />
          <TimelineStep
            num={3}
            title={letter.status === 'completed' ? 'Laporan Kegiatan Diunggah' : 'Upload Laporan Kegiatan'}
            sub={
              letter.status === 'completed'
                ? 'Foto & keterangan kegiatan sudah diserahkan'
                : letter.status === 'approved'
                ? 'Kegiatan sedang berlangsung — upload laporan setelah selesai'
                : 'Tersedia setelah mendapat persetujuan admin'
            }
            state={s3}
            isLast
          />
        </div>
      </div>

      {/* ── Action Buttons ───────────────────────────────── */}
      <div className="px-5 pb-4 flex flex-wrap items-center gap-2">
        {letter.document_url && (
          <a
            href={letter.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#16A34A] hover:text-[#0d9240] bg-green-50 hover:bg-green-100 border border-green-200 px-3.5 py-2 rounded-xl transition-all"
          >
            <FileDown size={14} /> Unduh Surat Balasan
          </a>
        )}

        {(letter.status === 'approved' || letter.status === 'completed') && (
          <button
            onClick={() => onUploadReport(letter)}
            className={`inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-xl transition-all ${
              letter.status === 'completed'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-[#16A34A] text-white hover:bg-[#0d9240] shadow-sm'
            }`}
          >
            <ImagePlus size={14} />
            {letter.status === 'completed' ? 'Lihat / Edit Laporan' : 'Upload Laporan Kegiatan'}
          </button>
        )}

        {/* Tombol Batalkan Pengajuan (Pegawai - jika belum disetujui admin) */}
        {!isAdminIssued && letter.status === 'pending' && (
          <button
            onClick={() => onCancel(letter)}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-xl transition-all cursor-pointer"
          >
            <XCircle size={14} /> Batalkan Pengajuan
          </button>
        )}

        {/* Toggle detail */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-gray-500 hover:text-gray-700 px-2.5 py-2 rounded-xl transition-all ml-auto"
        >
          {expanded ? <><ChevronUp size={14} /> Sembunyikan Detail</> : <><ChevronDown size={14} /> Lihat Detail</>}
        </button>
      </div>

      {/* ── Expandable Detail ────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-3">
          {/* Purpose */}
          {letter.purpose && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 mb-1">Uraian Kegiatan</p>
              <p className="text-[12.5px] text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                {letter.purpose}
              </p>
            </div>
          )}

          {/* Laporan Pegawai (jika sudah ada) */}
          {(letter.attendance_proof_url || letter.activity_notes) && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-extrabold text-emerald-800 flex items-center gap-1.5">
                  <ClipboardCheck size={13} className="text-emerald-600" />
                  Laporan Kegiatan Saya
                </span>
                {letter.attendance_proof_url && (
                  <a
                    href={letter.attendance_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-all"
                  >
                    <FileDown size={11} /> Lihat Foto Kegiatan
                  </a>
                )}
              </div>
              {letter.activity_notes && (
                <p className="text-[12px] text-gray-700 leading-relaxed bg-white/80 rounded-lg px-3 py-2.5 border border-emerald-100">
                  {letter.activity_notes}
                </p>
              )}
            </div>
          )}

          {/* Ditolak Admin */}
          {letter.status === 'rejected' && letter.admin_note && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-extrabold mb-0.5">Alasan Penolakan</p>
                <p className="text-[12px] leading-relaxed">{letter.admin_note}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function AssignmentLetterPage() {
  const [letters, setLetters] = useState<AssignmentLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [issuingInstitution, setIssuingInstitution] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Report modal
  const [selectedLetterForReport, setSelectedLetterForReport] = useState<AssignmentLetter | null>(null);
  const [reportProofFile, setReportProofFile] = useState<File | null>(null);
  const [activityNotes, setActivityNotes] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');

  // Filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('all');
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await assignmentLetterApi.list({ status: statusFilter, personal: true });
      if (res.success) setLetters(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLetters(); }, [statusFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFormError('Ukuran file maksimal 2MB.'); return; }
    setDocumentFile(file); setFormError('');
  };

  const handleReportProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setReportError('Ukuran file foto maksimal 2MB.'); return; }
    setReportProofFile(file); setReportError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim() || !issuingInstitution.trim() || !startDate || !endDate || !purpose.trim()) {
      setFormError('Semua field bertanda (*) wajib diisi.'); return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setFormError('Tanggal selesai tidak boleh sebelum tanggal mulai.'); return;
    }
    setFormError(''); setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('issuing_institution', issuingInstitution.trim());
      fd.append('start_date', startDate);
      fd.append('end_date', endDate);
      fd.append('purpose', purpose.trim());
      if (documentFile) fd.append('document', documentFile);
      const res = await assignmentLetterApi.create(fd);
      if (res.success) {
        setSubmitSuccess(true);
        setTitle(''); setIssuingInstitution(''); setStartDate(''); setEndDate(''); setPurpose(''); setDocumentFile(null);
        fetchLetters();
        setTimeout(() => { setSubmitSuccess(false); setShowForm(false); }, 1800);
      }
    } catch (err: any) {
      setFormError(err?.message ?? 'Gagal mengirim pengajuan.');
    } finally { setSubmitting(false); }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLetterForReport || reportSubmitting) return;
    if (!reportProofFile && !selectedLetterForReport.attendance_proof_url) {
      setReportError('Foto kegiatan wajib diunggah.'); return;
    }
    if (!activityNotes.trim()) { setReportError('Keterangan laporan wajib diisi.'); return; }
    setReportError(''); setReportSubmitting(true);
    try {
      const fd = new FormData();
      if (reportProofFile) fd.append('attendance_proof', reportProofFile);
      fd.append('activity_notes', activityNotes.trim());
      const res = await assignmentLetterApi.uploadReport(selectedLetterForReport.id, fd);
      if (res.success) {
        setSelectedLetterForReport(null); setReportProofFile(null); setActivityNotes('');
        fetchLetters();
      }
    } catch (err: any) {
      setReportError(err?.message ?? 'Gagal mengunggah laporan.');
    } finally { setReportSubmitting(false); }
  };

  // Filtered list
  const filteredLetters = letters.filter(l => {
    if (filterMonth > 0 && l.start_date) {
      if (new Date(l.start_date).getMonth() + 1 !== filterMonth) return false;
    }
    if (filterYear > 0 && l.start_date) {
      if (new Date(l.start_date).getFullYear() !== filterYear) return false;
    }
    return true;
  });

  const handleCancelLetter = async (letter: AssignmentLetter) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan pengajuan surat tugas "${letter.title}"?`)) return;
    try {
      const res = await assignmentLetterApi.cancel(letter.id);
      if (res.success) {
        fetchLetters();
      }
    } catch (err: any) {
      alert(err?.message || 'Gagal membatalkan pengajuan surat tugas.');
    }
  };

  /* ── STATUS FILTER TABS ─ */
  const STATUS_TABS = [
    { key: 'all', label: 'Semua' },
    { key: 'pending', label: 'Menunggu' },
    { key: 'approved', label: 'Tugas Aktif' },
    { key: 'completed', label: 'Selesai' },
    { key: 'rejected', label: 'Ditolak' },
  ] as const;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#16A34A] to-green-400 flex items-center justify-center shadow-sm">
              <FileText className="text-white" size={18} />
            </div>
            Surat Tugas
          </h1>
          <p className="text-[12px] text-gray-500 mt-1">
            Pengajuan dinas luar, penerimaan surat resmi, dan pelaporan kegiatan.
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-bold shadow-sm transition-all"
          >
            <Plus size={15} /> Ajukan Surat Tugas
          </button>
        )}
      </div>

      {/* ══ INFO BANNER — Cara Kerja ═════════════════════════════ */}
      {!showForm && (
        <div className="mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-bold text-blue-800 mb-1">Cara Kerja Surat Tugas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                <div>
                  <p className="text-[11px] text-blue-700 font-semibold mb-0.5">📤 Diajukan oleh Saya (Pegawai)</p>
                  <ol className="text-[10.5px] text-blue-600 space-y-0.5 list-decimal list-inside">
                    <li>Isi & kirim formulir pengajuan</li>
                    <li>Admin membalas dengan surat resmi</li>
                    <li>Ikuti kegiatan & upload laporan foto</li>
                  </ol>
                </div>
                <div>
                  <p className="text-[11px] text-blue-700 font-semibold mb-0.5">📥 Diterbitkan oleh Admin</p>
                  <ol className="text-[10.5px] text-blue-600 space-y-0.5 list-decimal list-inside">
                    <li>Admin langsung menerbitkan surat tugas</li>
                    <li>Anda menerima dokumen surat resmi</li>
                    <li>Ikuti kegiatan & upload laporan foto</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ FORM PENGAJUAN ══════════════════════════════════════ */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          {/* Form Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <button
              onClick={() => { setShowForm(false); setFormError(''); }}
              className="w-8 h-8 rounded-xl hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              <ArrowLeft size={15} />
            </button>
            <div>
              <h2 className="text-[14px] font-extrabold text-gray-800">Formulir Pengajuan Surat Tugas</h2>
              <p className="text-[10.5px] text-gray-400">Lengkapi detail penugasan untuk diproses Admin.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {formError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-[12px] font-semibold">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}
              </div>
            )}
            {submitSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl text-[12px] font-bold">
                <CheckCircle2 size={15} /> Pengajuan berhasil dikirim ke Admin!
              </div>
            )}

            {/* Perihal */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Perihal / Judul Kegiatan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Workshop Pelayanan Kesehatan Primer"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                  required
                />
              </div>
            </div>

            {/* Instansi */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Instansi Pengirim / Pihak Pemberi Tugas <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={issuingInstitution} onChange={e => setIssuingInstitution(e.target.value)}
                  placeholder="Contoh: Dinas Kesehatan Provinsi Aceh"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                  required
                />
              </div>
            </div>

            {/* Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Tanggal Mulai <span className="text-red-500">*</span>
                </label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-semibold text-gray-800 cursor-pointer"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Tanggal Selesai <span className="text-red-500">*</span>
                </label>
                <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-semibold text-gray-800 cursor-pointer"
                  required
                />
              </div>
            </div>

            {/* Uraian */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Uraian Keperluan / Rincian Kegiatan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={purpose} onChange={e => setPurpose(e.target.value)}
                placeholder="Deskripsikan singkat tujuan dan rincian kegiatan penugasan Anda..."
                rows={3} maxLength={1000}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all resize-none text-gray-800 placeholder:text-gray-300 leading-relaxed"
                required
              />
            </div>

            {/* Upload Surat Undangan */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Lampiran Surat / Undangan <span className="text-gray-400 font-normal">(Opsional)</span>
              </label>
              <label className="flex items-center gap-3 w-full border border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-green-300 transition-all">
                <Paperclip size={16} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-700 truncate">
                    {documentFile ? documentFile.name : 'Pilih file surat undangan'}
                  </p>
                  <p className="text-[10px] text-gray-400">PDF, JPG, PNG — Maks 2MB</p>
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
              <button type="button" onClick={() => { setShowForm(false); setFormError(''); }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-[12.5px] font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12.5px] font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50">
                {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {submitting ? 'Mengirim...' : <><Send size={13} /> Kirim Pengajuan</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ DAFTAR SURAT TUGAS ══════════════════════════════════ */}
      {!showForm && (
        <>
          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <MonthYearDeptFilter
              month={filterMonth} year={filterYear}
              showAllMonthsOption={true} embedded={true}
              onMonthChange={setFilterMonth} onYearChange={setFilterYear}
            />
            <div className="sm:ml-auto flex gap-1 flex-wrap">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-bold transition-all ${
                    statusFilter === tab.key
                      ? 'bg-[#16A34A] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-150'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-[3px] border-green-100 border-t-[#16A34A] rounded-full animate-spin" />
              <p className="text-[12px] text-gray-400">Memuat data...</p>
            </div>
          ) : filteredLetters.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-gray-100">
                <FileText className="text-gray-300" size={22} />
              </div>
              <h4 className="text-[14px] font-bold text-gray-600">Tidak Ada Surat Tugas</h4>
              <p className="text-[11.5px] text-gray-400 mt-1">
                {statusFilter !== 'all'
                  ? `Tidak ada surat tugas dengan status "${STATUS_TABS.find(t => t.key === statusFilter)?.label}".`
                  : 'Tidak ada data untuk periode yang dipilih.'}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#16A34A] text-white rounded-xl text-[12.5px] font-bold shadow-sm hover:bg-[#0d9240] transition-all"
              >
                <Plus size={14} /> Ajukan Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLetters.map(letter => (
                <LetterCard
                  key={letter.id}
                  letter={letter}
                  onUploadReport={l => {
                    setSelectedLetterForReport(l);
                    setActivityNotes(l.activity_notes || '');
                    setReportProofFile(null);
                    setReportError('');
                  }}
                  onCancel={handleCancelLetter}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ══ MODAL UPLOAD LAPORAN ════════════════════════════════ */}
      {selectedLetterForReport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !reportSubmitting && setSelectedLetterForReport(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-emerald-50/60">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <UploadCloud size={18} className="text-emerald-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14px] font-extrabold text-gray-900">Upload Laporan Kegiatan</h3>
                <p className="text-[11px] text-gray-500 truncate">"{selectedLetterForReport.title}"</p>
              </div>
              <button onClick={() => !reportSubmitting && setSelectedLetterForReport(null)}
                className="ml-auto w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="p-5 space-y-4">
              {reportError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 px-3.5 py-3 rounded-xl text-[12px] font-semibold">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {reportError}
                </div>
              )}

              {/* Upload foto */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  1. Foto Kegiatan / Bukti Kehadiran <span className="text-red-500">*</span>
                </label>
                <label className="flex items-center gap-3 w-full border border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-300 transition-all">
                  <ImagePlus size={18} className="text-emerald-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-700 truncate">
                      {reportProofFile
                        ? reportProofFile.name
                        : selectedLetterForReport.attendance_proof_url
                        ? 'Foto sudah ada — klik untuk mengganti'
                        : 'Pilih foto selfie / dokumentasi kegiatan'}
                    </p>
                    <p className="text-[10px] text-gray-400">JPG, PNG, PDF — Maks 2MB</p>
                  </div>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleReportProofChange} className="hidden" />
                </label>
              </div>

              {/* Keterangan laporan */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  2. Keterangan Hasil Kegiatan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={activityNotes} onChange={e => setActivityNotes(e.target.value)}
                  placeholder="Tuliskan ringkasan singkat: apa yang dilakukan, siapa narasumber, hasil yang diperoleh..."
                  rows={4} maxLength={1000}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all resize-none text-gray-800 leading-relaxed"
                  required
                />
              </div>

              {/* Modal actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                <button type="button" onClick={() => setSelectedLetterForReport(null)} disabled={reportSubmitting}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Batal
                </button>
                <button type="submit" disabled={reportSubmitting}
                  className="px-5 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all">
                  {reportSubmitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {reportSubmitting ? 'Menyimpan...' : <><ClipboardCheck size={13} /> Simpan Laporan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
