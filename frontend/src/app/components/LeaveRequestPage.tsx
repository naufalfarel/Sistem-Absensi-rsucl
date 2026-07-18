import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, X, CheckCircle2, Clock, XCircle, AlertTriangle,
  Calendar, Paperclip, ChevronDown, Trash2, AlertCircle, Info,
  User, Building2, Phone, ChevronLeft, Shield, BookOpen, Printer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { leaveApi, LeaveRequest as ApiLeave, LeaveQuota, specialLeaveApi } from '../../services/api';

type LeaveType = 'cuti' | 'sakit' | 'cuti_khusus';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'draft';

const typeConfig: Record<LeaveType, { label: string; color: string; bg: string; border: string; initial: string }> = {
  cuti:        { label: 'Cuti Tahunan',                     color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', initial: 'C' },
  sakit:       { label: 'Sakit',                             color: '#92400E', bg: '#FEF3C7', border: '#D97706', initial: 'S' },
  cuti_khusus: { label: 'Cuti Khusus / Diluar Tanggungan',  color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5', initial: 'CK' },
};

const statusConfig: Record<LeaveStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: 'Menunggu',   color: '#D97706', bg: '#FEF3C7', icon: Clock },
  approved:  { label: 'Disetujui',  color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
  rejected:  { label: 'Ditolak',    color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  cancelled: { label: 'Dibatalkan', color: '#6B7280', bg: '#F3F4F6', icon: XCircle },
  draft:     { label: 'Draf (Menunggu PJ)', color: '#4F46E5', bg: '#EEF2FF', icon: Clock },
};

const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const formatDate = (str: string) => {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// ── Warning Notes Content ─────────────────────────────────────────────
const LEAVE_NOTES = [
  {
    icon: Clock,
    title: 'Penundaan Cuti',
    desc: 'Perusahaan dapat menunda cuti paling lama 1 bulan sejak timbulnya hak cuti.',
  },
  {
    icon: Calendar,
    title: 'Pengajuan 2 Minggu Sebelumnya',
    desc: 'Karyawan/ti yang akan cuti harus dua minggu sebelumnya telah mengajukan permohonan cuti kepada Kabag. Bila permohonan cuti belum dilengkapi namun karyawan/ti sudah tidak masuk kerja, maka karyawan/ti yang bersangkutan dianggap mangkir / Alpa.',
  },
  {
    icon: Info,
    title: 'Periode Cuti',
    desc: 'Expired atau transisi cuti berlaku dari April s/d Maret tahun berikutnya.',
  },
  {
    icon: BookOpen,
    title: 'Hak Cuti 12 Hari',
    desc: 'Hak cuti adalah 12 hari, dimana 10 hari cuti dan 2 hari disisakan untuk kebutuhan emergensi.',
  },
];

interface LeaveRequestPageProps {
  onBack?: () => void;
}

export function LeaveRequestPage({ onBack }: LeaveRequestPageProps) {
  const { user, logoUrl } = useAuth();

  // ── Warning Popup State (shown every time page opens) ─────────────────
  const [showWarning, setShowWarning] = useState(true);
  const [warningChecked, setWarningChecked] = useState(false);

  // ── Data State ────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<ApiLeave[]>([]);
  const [quota, setQuota]       = useState<LeaveQuota | null>(null);
  const [loading, setLoading]   = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);

  // ── Form Submission State ─────────────────────────────────────────────
  const [showForm, setShowForm]     = useState(false);
  const [leaveType, setLeaveType]   = useState<LeaveType>('cuti');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [reason, setReason]         = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ── Form Custom Fields State ──────────────────────────────────────────
  const [posisi, setPosisi]         = useState(user?.position || 'Medis');
  const [unitKerja, setUnitKerja]   = useState(user?.department || 'Adm');
  const [substituteName, setSubstituteName] = useState('');
  const [alamatCuti, setAlamatCuti] = useState('');

  // Sync default form custom fields when user profile loads
  useEffect(() => {
    if (user) {
      setPosisi(user.position || 'Medis');
      setUnitKerja(user.department || 'Adm');
    }
  }, [user]);

  // ── Attachment State ──────────────────────────────────────────────────
  const [attachmentName, setAttachmentName]     = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile]     = useState<File | null>(null);

  // ── Cancel State ──────────────────────────────────────────────────────
  const [cancelId, setCancelId]         = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── Print State ───────────────────────────────────────────────────────
  const [selectedLeaveForPrint, setSelectedLeaveForPrint] = useState<ApiLeave | null>(null);

  // ── Filter State ──────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');

  // ── Derived Quota ─────────────────────────────────────────────────────
  const quotaTotal     = quota?.quota ?? 12;
  const usedCuti       = quota?.used ?? 0;
  const pendingCuti    = quota?.pending ?? 0;
  const remainingCuti  = quota?.remaining ?? quotaTotal;
  const cutiPercentage = Math.round((remainingCuti / quotaTotal) * 100);
  const pendingCount   = requests.filter(r => r.status === 'pending').length;

  // ── Load Data ─────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const [res, quotaRes] = await Promise.all([
        leaveApi.list({ personal: '1' }),
        leaveApi.quota(),
      ]);
      if (res.success) setRequests(res.data);
      if (quotaRes.success && !Array.isArray(quotaRes.data)) setQuota(quotaRes.data as LeaveQuota);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setQuotaLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await specialLeaveApi.listActive();
      if (res.success) {
        const sorted = [...(res.data || [])].sort((a, b) => {
          if ((a.name || '').toLowerCase() === 'lainnya') return 1;
          if ((b.name || '').toLowerCase() === 'lainnya') return -1;
          return (a.name || '').localeCompare(b.name || '', 'id');
        });
        setCategories(sorted);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAll();
    loadCategories();
  }, []);

  // ── Attachment Handler ─────────────────────────────────────────────────
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setFormError('Ukuran file maksimal adalah 2MB.'); return; }
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) { setFormError('Format file harus PDF, PNG, atau JPG/JPEG.'); return; }
    setFormError('');
    setAttachmentName(file.name);
    setAttachmentFile(file);
    const reader = new FileReader();
    reader.onload = () => setAttachmentBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => { setAttachmentName(''); setAttachmentBase64(null); setAttachmentFile(null); };

  // ── Calc Days ─────────────────────────────────────────────────────────
  const calcDays = () => {
    if (!startDate || !endDate) return 0;
    return Math.max(1, Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting) return;
    if (leaveType === 'cuti_khusus') {
      if (!startDate || !endDate || !reason.trim() || !selectedCategory || !attachmentFile) {
        setFormError('Semua field wajib diisi termasuk kategori cuti khusus dan dokumen pendukung.');
        return;
      }
    } else {
      if (!startDate || !endDate || !reason.trim()) {
        setFormError('Tanggal mulai, tanggal selesai, dan keterangan wajib diisi.');
        return;
      }
    }
    if (new Date(endDate) < new Date(startDate)) {
      setFormError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', leaveType);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      formData.append('reason', reason.trim());
      formData.append('posisi', posisi);
      formData.append('unit_kerja', unitKerja);
      formData.append('substitute_name', substituteName.trim());
      formData.append('alamat_cuti', alamatCuti.trim());
      if (leaveType === 'cuti_khusus') formData.append('special_leave_category_id', selectedCategory);
      if (attachmentFile) formData.append('attachment', attachmentFile);
      else if (attachmentBase64) formData.append('attachment', attachmentBase64);
      const res = await leaveApi.create(formData);
      if (res.success) {
        setRequests(prev => [res.data, ...prev]);
        setShowForm(false);
        setStartDate(''); setEndDate(''); setReason('');
        setLeaveType('cuti'); setSelectedCategory('');
        setSubstituteName(''); setAlamatCuti('');
        clearAttachment();
        setSubmitSuccess(true);
        await leaveApi.quota().then(r => {
          if (r.success && !Array.isArray(r.data)) setQuota(r.data as LeaveQuota);
        });
        setTimeout(() => setSubmitSuccess(false), 4000);
      }
    } catch (err: any) {
      setFormError(err?.message ?? 'Gagal mengirim pengajuan cuti.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel Handler ─────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelLoading(true);
    try {
      await leaveApi.cancel(cancelId);
      setCancelId(null);
      await loadAll();
    } catch (err: any) {
      alert(err?.message ?? 'Gagal membatalkan pengajuan.');
    } finally {
      setCancelLoading(false);
    }
  };

  const posisiOptions = ["Medis", "Non Medis", "Dokter", "Perawat", "Bidan"];
  const finalPosisiOptions = posisiOptions.includes(posisi) ? posisiOptions : [posisi, ...posisiOptions].filter(Boolean);

  const unitOptions = [
    "Adm", "Asuransi", "Casemix", "CSSD", "Driver Ambulance", "Depo", "Endoscopy", 
    "Farmasi", "Gizi", "IT", "IPSRS", "IPSL", "ICU", "IBS", "IGD", "KB", 
    "Laboratorium", "Laundry", "NICU", "Poli", "Kasir", "Keuangan", "PPI", 
    "Radiologi", "Ranap", "RMIGD", "Resepsionis", "Transporter", "Penyimpanan"
  ];
  const finalUnitOptions = unitOptions.includes(unitKerja) ? unitOptions : [unitKerja, ...unitOptions].filter(Boolean);

  // ── Filtered Requests ─────────────────────────────────────────────────
  const filteredRequests = filterStatus === 'all'
    ? requests
    : requests.filter(r => r.status === filterStatus);

  return (
    <>

      {/* ─── WARNING POPUP (SETIAP BUKA HALAMAN) ─────────────────────────────── */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            
            {/* Header Warning */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Shield size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-white">Perhatian Penting</h2>
                  <p className="text-[12px] text-white/80">Harap dibaca sebelum mengajukan cuti</p>
                </div>
              </div>
              <p className="text-[12px] text-white/70 italic">
                Setiap karyawan wajib memahami peraturan cuti perusahaan berikut ini.
              </p>
            </div>

            {/* Notes Content */}
            <div className="px-6 pt-5 pb-4 space-y-3.5 max-h-[50vh] overflow-y-auto">
              {LEAVE_NOTES.map((note, i) => {
                const Icon = note.icon;
                return (
                  <div key={i} className="flex items-start gap-3.5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100/60 border border-amber-250/50 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-700">
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-amber-900 mb-0.5">{note.title}</p>
                      <p className="text-[12px] text-amber-800 leading-relaxed">{note.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acknowledge Checkbox */}
            <div className="px-6 py-4 border-t border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setWarningChecked(v => !v)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer ${
                    warningChecked ? 'bg-[#16A34A] border-[#16A34A]' : 'border-gray-300 group-hover:border-[#16A34A]'
                  }`}
                >
                  {warningChecked && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <p className="text-[12.5px] text-gray-700 leading-relaxed">
                  Saya telah membaca dan memahami peraturan cuti perusahaan di atas dan akan mematuhinya.
                </p>
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 pb-6">
              <button
                onClick={() => { if (warningChecked) setShowWarning(false); }}
                disabled={!warningChecked}
                className={`w-full py-3 rounded-2xl text-[14px] font-semibold transition-all ${
                  warningChecked
                    ? 'bg-[#16A34A] text-white shadow-sm shadow-green-200 hover:bg-[#0d9240] active:scale-[0.98]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {warningChecked ? 'Saya Mengerti, Lanjutkan' : 'Centang kotak di atas untuk melanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAGE CONTENT ─────────────────────────────────────────────────── */}
      {/* ─── STICKY PAGE HEADER ───────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#F5F7FA] border-b border-gray-200/80 py-4 px-4 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 rounded-xl bg-white border border-gray-150 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all shadow-sm cursor-pointer">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-[17px] md:text-[18px] font-bold text-gray-950">Pengajuan Cuti & Sakit</h1>
            <p className="text-[11px] md:text-[12px] text-gray-400 mt-0.5">Kelola pengajuan cuti, sakit, dan cuti khusus Anda</p>
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE PAGE CONTENT ─────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-10">

        {/* Success Banner */}
        {submitSuccess && (
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 animate-pulse">
            <CheckCircle2 size={16} className="text-[#16A34A] flex-shrink-0" />
            <p className="text-[13px] text-[#16A34A] font-medium">Pengajuan berhasil dikirim! Menunggu persetujuan PJ Bagian / Admin.</p>
          </div>
        )}

        {/* Info Pegawai Card */}
        <div className="bg-gradient-to-br from-[#16A34A] to-[#0B7A36] rounded-2xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full border-[20px] border-white/10 translate-x-8 -translate-y-8" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full border-[16px] border-white/10" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center flex-shrink-0">
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <span className="text-white text-xl font-bold">{(user?.name || 'U').charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-white truncate">{user?.name}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] text-white/75">
                  <Building2 size={10} /> {user?.department || '-'}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-white/75">
                  <User size={10} /> {user?.position || '-'}
                </span>
                {user?.phone && (
                  <span className="flex items-center gap-1 text-[11px] text-white/75">
                    <Phone size={10} /> {user.phone}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/60 mt-0.5">NIK KTP: {user?.nik_ktp || '-'}</p>
            </div>
          </div>

          {/* Quota Summary */}
          <div className="relative mt-4 pt-4 border-t border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] text-white/70">
                {quota?.period_label ? `Periode: ${quota.period_label}` : 'Kuota Cuti Tahunan'}
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <span className="text-[30px] font-bold text-white">{quotaLoading ? '...' : remainingCuti}</span>
                <span className="text-white/70 text-[13px] ml-1">/ {quotaTotal} hari</span>
              </div>
              <div className="flex-1 mb-1.5">
                <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${cutiPercentage}%` }} />
                </div>
                <p className="text-[10px] text-white/55 mt-1">
                  {usedCuti} hari disetujui{pendingCuti > 0 ? ` · ${pendingCuti} hari pending` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              {[
                { label: 'Menunggu',  value: String(pendingCount), clr: 'bg-amber-400/30 text-amber-100 border-amber-300/30' },
                { label: 'Disetujui', value: String(requests.filter(r => r.status === 'approved').length), clr: 'bg-white/20 text-white border-white/20' },
                { label: 'Ditolak',   value: String(requests.filter(r => r.status === 'rejected').length), clr: 'bg-red-400/30 text-red-200 border-red-300/30' },
              ].map((s, i) => (
                <div key={i} className={`flex-1 rounded-xl px-3 py-2 text-center border ${s.clr}`}>
                  <p className="text-[16px] font-bold">{s.value}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Warning Info Banner */}
        <button
          onClick={() => setShowWarning(true)}
          className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 hover:bg-amber-100 transition-colors group text-left"
        >
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen size={14} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-amber-800">Lihat Aturan Cuti Karyawan</p>
            <p className="text-[11px] text-amber-600">Klik untuk membaca peraturan cuti perusahaan</p>
          </div>
          <AlertTriangle size={14} className="text-amber-500 group-hover:text-amber-600 flex-shrink-0" />
        </button>

        {/* Action Buttons */}
        {!showForm && (
          <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
            <button
              onClick={() => { setShowForm(true); setLeaveType('cuti'); setFormError(''); }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-2xl text-[13px] font-semibold transition-all shadow-sm shadow-blue-200 active:scale-[0.98]"
            >
              <Plus size={16} /> Ajukan Cuti
            </button>
            <button
              onClick={() => { setShowForm(true); setLeaveType('sakit'); setFormError(''); }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-700 hover:bg-amber-800 text-white rounded-2xl text-[13px] font-semibold transition-all shadow-sm shadow-amber-200 active:scale-[0.98]"
            >
              <Plus size={16} /> Ajukan Sakit
            </button>
            <button
              onClick={() => { setShowForm(true); setLeaveType('cuti_khusus'); setFormError(''); }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-[13px] font-semibold transition-all shadow-sm shadow-orange-200 active:scale-[0.98]"
            >
              <Plus size={16} /> Ajukan Cuti Khusus
            </button>
          </div>
        )}

        {/* ─── SUBMISSION FORM ──────────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
            {/* Form Header */}
            <div className={`px-6 py-4 flex items-center justify-between border-b border-gray-100 ${
              leaveType === 'cuti_khusus' ? 'bg-orange-50' : 'bg-green-50'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  leaveType === 'cuti_khusus' ? 'bg-orange-100' : 'bg-green-100'
                }`}>
                  <FileText size={16} className={leaveType === 'cuti_khusus' ? 'text-orange-600' : 'text-[#16A34A]'} />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">
                    {leaveType === 'cuti_khusus' ? 'Form Cuti Khusus / Diluar Tanggungan' : 'Form Pengajuan Cuti / Sakit'}
                  </p>
                  <p className="text-[11px] text-gray-500">Isi data pengajuan dengan lengkap dan benar</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); setFormError(''); clearAttachment(); setStartDate(''); setEndDate(''); setReason(''); setSelectedCategory(''); }}
                className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white flex items-center justify-center border border-gray-200 transition-colors"
              >
                <X size={14} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl">
                  <AlertCircle size={14} className="flex-shrink-0" /> {formError}
                </div>
              )}

              {/* Data Pegawai (read only from profile) */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Data Pengaju (dari Profil)</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] text-gray-400">Nama</p>
                    <p className="text-[13px] font-semibold text-gray-800">{user?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">NIK KTP</p>
                    <p className="text-[13px] font-semibold text-gray-800">{user?.nik_ktp || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Departemen</p>
                    <p className="text-[13px] font-semibold text-gray-800">{user?.department || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Jabatan</p>
                    <p className="text-[13px] font-semibold text-gray-800">{user?.position || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Jenis Pengajuan */}
              {leaveType !== 'cuti_khusus' ? (
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-2">Jenis Pengajuan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cuti', 'sakit'] as LeaveType[]).map(t => {
                      const tc = typeConfig[t];
                      return (
                        <button key={t} onClick={() => { setLeaveType(t); setFormError(''); }}
                          className={`py-3 rounded-xl border-2 text-center transition-all ${
                            leaveType === t ? 'shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                          }`}
                          style={leaveType === t ? { borderColor: tc.color, background: tc.bg } : {}}>
                          <p className="text-[16px] mb-0.5">{tc.initial}</p>
                          <p className="text-[11px] font-semibold" style={{ color: leaveType === t ? tc.color : '#6B7280' }}>{tc.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-xl px-3.5 py-3">
                    <span className="text-[18px]">✨</span>
                    <div>
                      <p className="text-[12px] font-bold text-orange-800">Cuti Khusus / Diluar Tanggungan</p>
                      <p className="text-[11px] text-orange-600">Tidak memotong kuota cuti tahunan 12 hari</p>
                    </div>
                  </div>
                  {/* Switch ke reguler */}
                  <button
                    onClick={() => { setLeaveType('cuti'); setSelectedCategory(''); clearAttachment(); }}
                    className="mt-2 text-[11px] text-[#2563EB] font-semibold hover:underline"
                  >
                    ← Kembali ke Cuti / Sakit biasa
                  </button>
                </div>
              )}

              {/* Kategori Cuti Khusus */}
              {leaveType === 'cuti_khusus' && (
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                    Kategori Cuti Khusus <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={e => { setSelectedCategory(e.target.value); setFormError(''); }}
                      className="w-full pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/15 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {categories.map(c => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Posisi & Unit Kerja (2 Columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                    Posisi / Profesi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={posisi}
                      onChange={e => setPosisi(e.target.value)}
                      className="w-full pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all appearance-none cursor-pointer font-medium text-gray-800"
                    >
                      {finalPosisiOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                    Unit Kerja / Instalasi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={unitKerja}
                      onChange={e => setUnitKerja(e.target.value)}
                      className="w-full pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all appearance-none cursor-pointer font-medium text-gray-800"
                    >
                      {finalUnitOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Orang yang Menggantikan & Alamat Cuti (2 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                    Rekan Kerja Pengganti
                  </label>
                  <input
                    type="text"
                    value={substituteName}
                    onChange={e => setSubstituteName(e.target.value)}
                    placeholder="Nama rekan kerja pengganti..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all placeholder:text-gray-300 font-semibold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                    Alamat Selama Cuti
                  </label>
                  <input
                    type="text"
                    value={alamatCuti}
                    onChange={e => setAlamatCuti(e.target.value)}
                    placeholder="Alamat tinggal selama cuti..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all placeholder:text-gray-300 font-semibold text-gray-800"
                  />
                </div>
              </div>

              {/* Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Tanggal Mulai <span className="text-red-500">*</span></label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setFormError(''); }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Tanggal Selesai <span className="text-red-500">*</span></label>
                  <input type="date" value={endDate} min={startDate} onChange={e => { setEndDate(e.target.value); setFormError(''); }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                </div>
              </div>

              {/* Duration Preview */}
              {startDate && endDate && (
                <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border ${
                  leaveType === 'cuti' && calcDays() > remainingCuti
                    ? 'bg-red-50 border-red-200'
                    : leaveType === 'cuti_khusus'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-green-50 border-green-100'
                }`}>
                  <Calendar size={14} className={
                    leaveType === 'cuti' && calcDays() > remainingCuti
                      ? 'text-red-500'
                      : leaveType === 'cuti_khusus'
                        ? 'text-orange-600'
                        : 'text-[#16A34A]'
                  } />
                  <p className={`text-[12px] font-medium ${
                    leaveType === 'cuti' && calcDays() > remainingCuti
                      ? 'text-red-600'
                      : leaveType === 'cuti_khusus'
                        ? 'text-orange-700'
                        : 'text-[#16A34A]'
                  }`}>
                    Durasi: <strong>{calcDays()} hari</strong>
                    {leaveType === 'cuti' && calcDays() > remainingCuti && (
                      <span className="ml-1 font-normal"> — Melebihi sisa kuota ({remainingCuti} hari)! Pengajuan mungkin ditolak.</span>
                    )}
                    {leaveType === 'cuti_khusus' && (
                      <span className="ml-1 font-normal text-orange-600/90"> — Tidak memotong kuota cuti tahunan.</span>
                    )}
                  </p>
                </div>
              )}

              {/* Keterangan */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                  Keterangan / Alasan <span className="text-red-500">*</span>
                </label>
                <textarea value={reason} onChange={e => { setReason(e.target.value); setFormError(''); }} rows={3}
                  placeholder={leaveType === 'sakit' ? 'Jelaskan kondisi kesehatan Anda...' : 'Jelaskan keperluan cuti Anda secara singkat...'}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all resize-none placeholder:text-gray-300" />
              </div>

              {/* Lampiran */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">
                  Dokumen Pendukung{' '}
                  {leaveType === 'cuti_khusus'
                    ? <span className="text-red-500">* (Wajib)</span>
                    : <span className="text-gray-400 font-normal">(Opsional)</span>
                  }{' '}
                  <span className="text-gray-400 font-normal">PDF, PNG, JPG max 2MB</span>
                </label>
                {!attachmentName ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-[#16A34A] hover:bg-green-50/30 transition-all text-center">
                    <Paperclip size={20} className="text-gray-300 mb-2" />
                    <span className="text-[12px] text-gray-500 font-medium">Klik untuk unggah dokumen</span>
                    <span className="text-[11px] text-gray-400 mt-0.5">Surat sakit, surat tugas, atau dokumen pendukung lainnya</span>
                    <input type="file" onChange={handleAttachmentChange} accept=".pdf,image/png,image/jpeg,image/jpg" className="hidden" />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={16} className="text-[#16A34A] flex-shrink-0" />
                      <span className="text-[12px] font-medium text-gray-700 truncate">{attachmentName}</span>
                    </div>
                    <button type="button" onClick={clearAttachment} className="w-6 h-6 rounded-lg hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Sakit Note */}
              {leaveType === 'sakit' && (
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                  <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-600">Sertakan surat keterangan dokter jika sakit lebih dari 2 hari. Bisa diserahkan langsung ke admin.</p>
                </div>
              )}

              {/* Submit & Cancel */}
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => { setShowForm(false); setFormError(''); clearAttachment(); setStartDate(''); setEndDate(''); setReason(''); setSelectedCategory(''); }}
                  disabled={submitting}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || (leaveType === 'cuti_khusus' && (!selectedCategory || !attachmentFile))}
                  className="flex-1 py-3 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-all shadow-sm shadow-green-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {submitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── HISTORY LIST ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-[14px] font-bold text-gray-800">Riwayat Pengajuan</p>
            {/* Status Filter */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
              {([
                { key: 'all', label: 'Semua' },
                { key: 'pending', label: 'Menunggu' },
                { key: 'approved', label: 'Disetujui' },
                { key: 'rejected', label: 'Ditolak' },
              ] as { key: typeof filterStatus; label: string }[]).map(f => (
                <button key={f.key} onClick={() => setFilterStatus(f.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    filterStatus === f.key ? 'bg-[#16A34A] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="text-center py-8 text-gray-400 text-[13px]">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#16A34A] rounded-full animate-spin mx-auto mb-2" />
              Memuat data...
            </div>
          )}

          {filteredRequests.length === 0 && !loading && (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 w-full">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-gray-100">
                <FileText size={20} className="text-gray-400" />
              </div>
              <p className="text-[13px] font-semibold text-gray-700">Belum ada pengajuan</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {filterStatus !== 'all' 
                  ? `Tidak ada pengajuan dengan status "${statusConfig[filterStatus as LeaveStatus]?.label || filterStatus}".`
                  : 'Daftar permohonan cuti dan sakit Anda akan muncul di sini.'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filteredRequests.map(req => {
              const tc = typeConfig[req.type as LeaveType] || { label: req.type, color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', initial: '?' };
              const sc = statusConfig[req.status as LeaveStatus] || { label: req.status, color: '#6B7280', bg: '#F3F4F6', icon: Clock };
              const StatusIcon = sc.icon || Clock;
              return (
                <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${req.status === 'pending' ? 'border-amber-200' : 'border-gray-100'}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                          style={{ background: tc.bg, border: `1.5px solid ${tc.border}`, color: tc.color }}>
                          {tc.initial}
                        </div>
                        <div>
                          <span className="text-[13px] font-bold text-gray-800">
                            {req.type === 'cuti_khusus' && req.special_leave_category
                              ? `Cuti Khusus (${req.special_leave_category.name})`
                              : tc.label}
                          </span>
                          <p className="text-[11px] text-gray-400 mt-0.5">Diajukan: {formatDate(req.created_at)}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ color: sc.color, background: sc.bg }}>
                        <StatusIcon size={11} /> {sc.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-gray-400">Tanggal Mulai</p>
                        <p className="text-[12px] font-semibold text-gray-800 mt-0.5">{formatDate(req.start_date)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-gray-400">{req.actual_end_date ? 'Selesai (Dipersingkat)' : 'Tanggal Selesai'}</p>
                        <p className="text-[12px] font-semibold text-gray-800 mt-0.5">
                          {req.actual_end_date ? formatDate(req.actual_end_date) : formatDate(req.end_date)}
                        </p>
                      </div>
                    </div>

                    {req.actual_end_date && (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3 text-[11px] text-amber-800">
                        <span className="font-semibold">Masa cuti diperpendek admin:</span> selesai {formatDate(req.actual_end_date)} (semula {formatDate(req.end_date)}).
                        {req.shortened_reason && <p className="mt-0.5 italic">Alasan: "{req.shortened_reason}"</p>}
                      </div>
                    )}

                    {req.status === 'cancelled' && req.cancellation_reason && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3 text-[11px] text-gray-600">
                        <span className="font-semibold">Alasan dibatalkan:</span> "{req.cancellation_reason}"
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-gray-500 italic flex-1 mr-3 leading-relaxed">"{req.reason}"</p>
                      <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
                        {req.days} hari
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {req.attachment_url && (
                        <a href={req.attachment_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] hover:text-[#0d9240] bg-green-50 hover:bg-green-100 px-3.5 py-1.5 rounded-xl border border-green-100 transition-all">
                          <Paperclip size={11} className="flex-shrink-0" />
                          Lihat Dokumen Pendukung
                        </a>
                      )}
                      
                      {req.status === 'approved' && (
                        <button
                          type="button"
                          onClick={() => setSelectedLeaveForPrint(req)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-xl border border-blue-100 transition-all cursor-pointer"
                        >
                          <FileText size={11} className="flex-shrink-0" />
                          Lihat Form Cuti & QR Code
                        </button>
                      )}
                    </div>

                    {/* PJ Approval Info */}
                    {req.pj_status === 'approved' && req.pj_reviewer && (
                      <div className="mt-3 rounded-xl px-3 py-2 border border-green-100 bg-green-50/50 text-[11px]">
                        <p className="font-semibold text-green-800">
                          ✓ Disetujui PJ Bagian: <span className="font-normal text-gray-700">{req.pj_reviewer.name}</span>
                        </p>
                        {req.pj_note && <p className="text-gray-500 italic mt-0.5">"{req.pj_note}"</p>}
                      </div>
                    )}

                    {req.pj_status === 'rejected' && (
                      <div className="mt-3 rounded-xl px-3 py-2 border border-red-100 bg-red-50/50 text-[11px]">
                        <p className="font-semibold text-red-700">✗ Ditolak PJ Bagian</p>
                        {req.pj_note && <p className="text-gray-500 italic mt-0.5">Alasan: "{req.pj_note}"</p>}
                      </div>
                    )}

                    {req.admin_note && (
                      <div className={`mt-3 px-3 py-2 rounded-xl border text-[11px] ${
                        req.status === 'approved' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'
                      }`}>
                        <span className="font-semibold">Catatan Admin:</span> {req.admin_note}
                      </div>
                    )}

                    {req.status === 'pending' && (
                      <div className="mt-3 pt-3 border-t border-amber-100">
                        <button
                          onClick={() => setCancelId(req.id)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-100 transition-all"
                        >
                          <Trash2 size={11} />
                          Batalkan Pengajuan
                        </button>
                      </div>
                    )}
                  </div>
                  {req.status === 'pending' && <div className="h-0.5 bg-gradient-to-r from-amber-400 to-transparent" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── CANCEL CONFIRM MODAL ─────────────────────────────────────────────── */}
      {cancelId !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => !cancelLoading && setCancelId(null)} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xs">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">Batalkan Pengajuan?</h3>
            <p className="text-[13px] text-gray-500 text-center mb-5">
              Pengajuan yang dibatalkan tidak bisa dikembalikan.
              {requests.find(r => r.id === cancelId)?.type === 'cuti' && (
                <span className="block mt-1 text-amber-600 font-medium">Kuota cuti yang terpakai akan dikembalikan.</span>
              )}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setCancelId(null)} disabled={cancelLoading}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                Kembali
              </button>
              <button onClick={handleCancel} disabled={cancelLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-70">
                {cancelLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {cancelLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PRINT LEAVE FORM MODAL ───────────────────────────────────────────── */}
      {selectedLeaveForPrint && (() => {
        const req = selectedLeaveForPrint;
        const reqDateStr = req.created_at ? req.created_at.substring(0, 10).replace(/-/g, '') : '';
        const docNumber = `CUTI-${req.id}-${reqDateStr}`;
        
        // Generate QR code content
        const qrContent = `SURAT PERMOHONAN CUTI RESMI
RSU CEMPAKA LIMA
------------------------------
No. Dokumen: ${docNumber}
Nama Pegawai: ${req.employee?.name}
NIK KTP: ${req.employee?.nik_ktp}
Posisi: ${req.posisi || '-'}
Unit Kerja: ${req.unit_kerja || '-'}
No. Telp: ${req.employee?.phone || '-'}
Masa Cuti: ${req.days} Hari
Tanggal: ${formatDate(req.start_date)} s/d ${req.actual_end_date ? formatDate(req.actual_end_date) : formatDate(req.end_date)}
Keterangan: ${req.reason}
Pengganti: ${req.substitute_name || '-'}
Alamat Cuti: ${req.alamat_cuti || '-'}
Status Dokumen: SAH / DISETUJUI ADMIN
Verifikasi Digital RSUCL`;

        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrContent)}`;

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 print:p-0 print:static print:inset-auto">
            <style dangerouslySetInnerHTML={{__html: `
              @media print {
                body * {
                  visibility: hidden;
                }
                .print-container, .print-container * {
                  visibility: visible;
                }
                .print-container {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  margin: 0;
                  padding: 0;
                }
              }
            `}} />
            <div className="absolute inset-0 bg-black/55 backdrop-blur-xs print:hidden" onClick={() => setSelectedLeaveForPrint(null)} />
            <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 md:p-8 animate-scale-up max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:p-0 print:rounded-none print:w-full">
              
              {/* Header Controls (Print / Close) */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 print:hidden">
                <h2 className="text-[14px] font-bold text-gray-800">Dokumen Permohonan Cuti</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <Printer size={12} /> Cetak Form
                  </button>
                  <button
                    onClick={() => setSelectedLeaveForPrint(null)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>

              {/* Paper Content */}
              <div className="print-container bg-white p-4 md:p-6 text-black" style={{ fontFamily: "'Inter', sans-serif" }}>
                
                {/* Kop Surat (Letterhead) */}
                <div className="flex items-center justify-between gap-4 border-b-0 pb-1 text-center">
                  {/* Logo RSUCL (Left) */}
                  <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-white p-1">
                    <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-full h-full object-contain" />
                  </div>
                  
                  {/* Header Text (Middle) */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] md:text-[14px] font-bold text-[#16A34A] leading-tight tracking-wide">
                      PT. CEMPAKA LIMA UTAMA
                    </p>
                    <h1 className="text-[16px] md:text-[18px] font-extrabold text-red-650 leading-tight tracking-wider mt-0.5">
                      RUMAH SAKIT UMUM CEMPAKA LIMA
                    </h1>
                    <p className="text-[9px] md:text-[10px] text-gray-700 leading-relaxed mt-1 font-medium max-w-lg mx-auto">
                      Jln. Politeknik No.23 Dusun Meunasah Dayah Lr.B, Gp.Beurawe,
                      Kecamatan Kuta Alam, Kode Pos 23124, Telp. (0651) 3619999,
                      Fax. (0651) 3619999, Email: rsu@cempakalima.co.id
                    </p>
                    <p className="text-[10px] font-bold text-slate-800 tracking-widest mt-0.5">
                      BANDA ACEH
                    </p>
                  </div>
                  
                  {/* Logo KARS (Right) */}
                  <div className="w-16 h-16 flex-shrink-0 flex flex-col items-center justify-center p-1 bg-white">
                    <div className="w-10 h-10 border border-slate-200 rounded-full flex items-center justify-center text-[10px] text-[#16A34A] font-extrabold shadow-2xs">
                      ★ KARS ★
                    </div>
                    <span className="text-[7px] text-gray-500 font-bold leading-tight mt-1 text-center uppercase tracking-wide">
                      PARIPURNA KARS
                    </span>
                  </div>
                </div>

                {/* Double Horizontal Line */}
                <div className="border-t-[3px] border-[#16A34A] mt-2 mb-0.5" />
                <div className="border-t-[1px] border-slate-750 mb-5" />

                {/* Title */}
                <div className="text-center mb-6">
                  <h2 className="text-[14px] md:text-[15px] font-extrabold text-black tracking-wider uppercase underline decoration-2">
                    PENGAJUAN PERMOHONAN CUTI
                  </h2>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">No. Dokumen: {docNumber}</p>
                </div>

                {/* Content Details */}
                <div className="text-[12px] text-slate-900 leading-relaxed space-y-4 text-left">
                  <p className="font-semibold">Yang bertanda tangan di bawah ini :</p>
                  
                  <table className="w-full border-collapse text-left text-[12px]">
                    <tbody>
                      <tr className="align-top">
                        <td className="w-[180px] py-1.5 font-medium text-slate-600">Nama</td>
                        <td className="w-4 py-1.5">:</td>
                        <td className="py-1.5 font-bold text-black">{req.employee?.name}</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">NIK KTP</td>
                        <td>:</td>
                        <td className="py-1.5 font-semibold text-slate-800">{req.employee?.nik_ktp || '-'}</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">Posisi / Jabatan</td>
                        <td>:</td>
                        <td className="py-1.5 font-semibold text-slate-800">{req.posisi || '-'}</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">Unit Kerja / Instalasi</td>
                        <td>:</td>
                        <td className="py-1.5 font-semibold text-slate-800">{req.unit_kerja || '-'}</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">No. Tlp / HP</td>
                        <td>:</td>
                        <td className="py-1.5 font-semibold text-slate-800">{req.employee?.phone || '-'}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="border-t border-slate-100 my-4" />

                  <table className="w-full border-collapse text-left text-[12px]">
                    <tbody>
                      <tr className="align-top">
                        <td className="w-[180px] py-1.5 font-medium text-slate-600">Mohon cuti/izin/sakit selama</td>
                        <td className="w-4 py-1.5">:</td>
                        <td className="py-1.5 font-semibold text-slate-800">
                          <span className="font-bold text-black">{req.days}</span> hari kerja
                        </td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">Mulai Tanggal</td>
                        <td>:</td>
                        <td className="py-1.5 font-semibold text-slate-800">
                          {formatDate(req.start_date)} s/d {req.actual_end_date ? formatDate(req.actual_end_date) : formatDate(req.end_date)}
                        </td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">Keterangan Cuti</td>
                        <td>:</td>
                        <td className="py-1.5 font-bold text-[#16A34A] uppercase">
                          {req.type === 'cuti_khusus' && req.special_leave_category
                            ? `Cuti Khusus (${req.special_leave_category.name})`
                            : req.type === 'cuti'
                              ? 'Cuti Tahunan'
                              : req.type === 'sakit'
                                ? 'Sakit'
                                : req.type}
                        </td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">Alasan Cuti</td>
                        <td>:</td>
                        <td className="py-1.5 text-slate-800 italic">"{req.reason}"</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">Alamat selama cuti</td>
                        <td>:</td>
                        <td className="py-1.5 font-semibold text-slate-800">{req.alamat_cuti || '-'}</td>
                      </tr>
                      <tr className="align-top">
                        <td className="py-1.5 font-medium text-slate-600">Orang yang menggantikan</td>
                        <td>:</td>
                        <td className="py-1.5 font-bold text-red-700">{req.substitute_name || '-'}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Digital Verification Seal & QR Code */}
                  <div className="mt-8 pt-6 border-t border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="text-center sm:text-left space-y-1">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Status Dokumen</p>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-lg text-[11px] font-extrabold text-[#16A34A]">
                        ✓ DISETUJUI SECARA DIGITAL
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium mt-1">
                        Disetujui oleh: {req.reviewer?.name || 'Administrator'}
                      </p>
                      {req.pj_reviewer && (
                        <p className="text-[10px] text-gray-400 font-medium">
                          Mengetahui PJ Bagian: {req.pj_reviewer.name}
                        </p>
                      )}
                      <p className="text-[9px] text-gray-400 leading-normal max-w-sm mt-2">
                        Surat Permohonan Cuti ini sah dan diotorisasi secara elektronik oleh RSU Cempaka Lima Banda Aceh melalui verifikasi QR Code terlampir. Tanda tangan fisik tidak diperlukan.
                      </p>
                    </div>
                    
                    {/* QR Code image container */}
                    <div className="flex flex-col items-center p-2.5 bg-white border border-slate-100 rounded-2xl shadow-xs">
                      <img src={qrCodeUrl} alt="QR Code Verifikasi Cuti" className="w-[120px] h-[120px] object-contain" />
                      <span className="text-[8px] font-mono text-slate-400 mt-1.5">VERIFIKASI SAH</span>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          </div>
        );
      })()}
    </>
  );
}
