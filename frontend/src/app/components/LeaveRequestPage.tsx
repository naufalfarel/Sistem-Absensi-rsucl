import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, X, CheckCircle2, Clock, XCircle, AlertTriangle,
  Calendar, Paperclip, ChevronDown, Trash2, AlertCircle, Info,
  User, Building2, Phone, ChevronLeft, Shield, BookOpen, Printer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { leaveApi, LeaveRequest as ApiLeave, LeaveQuota, specialLeaveApi } from '../../services/api';
import { MonthYearDeptFilter } from './ui/MonthYearDeptFilter';
import { LeaveFormPrintModal } from './ui/LeaveFormPrintModal';

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
  {
    icon: AlertTriangle,
    title: 'Batas Cuti Tahunan: Maks. 4 Hari / Bulan',
    desc: 'Pengajuan Cuti Tahunan dibatasi maksimal 4 hari beruntun dalam 1 kali pengajuan, dan maksimal 4 hari total dalam 1 bulan kalender yang sama. Batas ini TIDAK berlaku untuk Sakit — pengajuan Sakit tidak dibatasi hari per bulan.',
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
  const [substitute1, setSubstitute1] = useState('');
  const [substitute2, setSubstitute2] = useState('');
  const [substitute3, setSubstitute3] = useState('');
  const [substitute4, setSubstitute4] = useState('');
  const [numSubstitutesSelect, setNumSubstitutesSelect] = useState(1);
  const [alamatCuti, setAlamatCuti] = useState('');

  // Sync numSubstitutesSelect based on selected dates duration automatically
  useEffect(() => {
    const days = calcDays();
    if (days > 0) {
      const needed = Math.min(days, 4);
      setNumSubstitutesSelect(needed);
      if (needed < 4) setSubstitute4('');
      if (needed < 3) setSubstitute3('');
      if (needed < 2) setSubstitute2('');
    } else {
      setNumSubstitutesSelect(1);
      setSubstitute2('');
      setSubstitute3('');
      setSubstitute4('');
    }
  }, [startDate, endDate]);

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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth]   = useState<number>(0);
  const [filterYear, setFilterYear]     = useState<number>(new Date().getFullYear());

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

  /**
   * Hitung berapa hari pengajuan baru (startDate..endDate) jatuh di bulan Y-M.
   */
  const calcNewDaysInMonth = (year: number, month: number): number => {
    if (!startDate || !endDate) return 0;
    const mStart = new Date(year, month - 1, 1);
    const mEnd   = new Date(year, month, 0); // last day of month
    const rStart = new Date(startDate);
    const rEnd   = new Date(endDate);
    const overlapStart = rStart > mStart ? rStart : mStart;
    const overlapEnd   = rEnd < mEnd   ? rEnd   : mEnd;
    if (overlapStart > overlapEnd) return 0;
    return Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
  };

  /**
   * Hitung total hari cuti (approved+pending) dari `requests` yang jatuh di bulan Y-M.
   * Tidak menghitung request sementara (hanya dari data server yang sudah ada).
   */
  const existingCutiDaysInMonth = (year: number, month: number): number => {
    return requests
      .filter(r => r.type === 'cuti' && (r.status === 'approved' || r.status === 'pending'))
      .reduce((total, r) => {
        if (!r.start_date || !r.end_date) return total;
        const mStart = new Date(year, month - 1, 1);
        const mEnd   = new Date(year, month, 0);
        const rStart = new Date(r.start_date);
        const rEnd   = new Date(r.end_date);
        const oStart = rStart > mStart ? rStart : mStart;
        const oEnd   = rEnd < mEnd   ? rEnd   : mEnd;
        if (oStart > oEnd) return total;
        return total + Math.floor((oEnd.getTime() - oStart.getTime()) / 86400000) + 1;
      }, 0);
  };

  /**
   * Hitung months covered by startDate..endDate.
   * Returns array of {year, month}.
   */
  const getMonthsCovered = (): { year: number; month: number }[] => {
    if (!startDate || !endDate) return [];
    const result: { year: number; month: number }[] = [];
    const s = new Date(startDate);
    const e = new Date(endDate);
    const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
    const endMonth = new Date(e.getFullYear(), e.getMonth(), 1);
    while (cursor <= endMonth) {
      result.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  };

  const INDO_MONTHS = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  /**
   * Cek apakah ada bulan yang melampaui batas 4 hari total cuti.
   * Mengembalikan pesan error, atau null jika aman.
   */
  const checkMonthlyLimit = (): string | null => {
    if (leaveType !== 'cuti') return null;
    for (const { year, month } of getMonthsCovered()) {
      const existing = existingCutiDaysInMonth(year, month);
      const newDays  = calcNewDaysInMonth(year, month);
      if (existing + newDays > 4) {
        return `Total cuti pada ${INDO_MONTHS[month]} ${year}: sudah ada ${existing} hari, pengajuan baru ${newDays} hari di bulan ini = ${existing + newDays} hari (maks. 4 hari/bulan).`;
      }
    }
    return null;
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitting) return;
    if (leaveType === 'cuti_khusus') {
      if (!startDate || !endDate || !reason.trim() || !selectedCategory || !attachmentFile) {
        setFormError('Semua field wajib diisi termasuk kategori cuti khusus dan dokumen pendukung.');
        return;
      }
    } else if (leaveType === 'sakit') {
      if (!startDate || !endDate || !reason.trim() || !attachmentFile) {
        setFormError('Semua field wajib diisi termasuk dokumen surat sakit.');
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
    // ── Validasi Cuti Tahunan ─────────────────────────────────────────
    if (leaveType === 'cuti') {
      const days = calcDays();
      if (days > 4) {
        setFormError(`Pengajuan cuti tahunan maksimal 4 hari beruntun. Anda memilih ${days} hari sekaligus. Silakan bagi menjadi beberapa pengajuan.`);
        return;
      }
      const monthlyErr = checkMonthlyLimit();
      if (monthlyErr) {
        setFormError(`Batas cuti tahunan 4 hari/bulan terlampaui. ${monthlyErr}`);
        return;
      }

      // Validasi Rekan Kerja Pengganti wajib diisi sesuai jumlah yang dipilih
      if (numSubstitutesSelect >= 1 && !substitute1.trim()) {
        setFormError('Nama Rekan Kerja Pengganti 1 wajib diisi.');
        return;
      }
      if (numSubstitutesSelect >= 2 && !substitute2.trim()) {
        setFormError('Nama Rekan Kerja Pengganti 2 wajib diisi.');
        return;
      }
      if (numSubstitutesSelect >= 3 && !substitute3.trim()) {
        setFormError('Nama Rekan Kerja Pengganti 3 wajib diisi.');
        return;
      }
      if (numSubstitutesSelect >= 4 && !substitute4.trim()) {
        setFormError('Nama Rekan Kerja Pengganti 4 wajib diisi.');
        return;
      }
    }
    setFormError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', leaveType);
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      formData.append('reason', reason.trim());
      formData.append('posisi', user?.position || posisi || '-');
      formData.append('unit_kerja', user?.department || unitKerja || '-');
      const allSubstitutes = [substitute1, substitute2, substitute3, substitute4]
        .slice(0, numSubstitutesSelect)
        .map(s => s.trim())
        .filter(Boolean)
        .join(', ');
      formData.append('substitute_name', allSubstitutes);
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
        setSubstitute1(''); setSubstitute2(''); setSubstitute3(''); setSubstitute4('');
        setAlamatCuti('');
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
  const filteredRequests = requests.filter(req => {
    if (filterStatus !== 'all' && req.status !== filterStatus) return false;
    if (req.start_date) {
      const d = new Date(req.start_date);
      if (filterMonth > 0 && d.getMonth() + 1 !== filterMonth) return false;
      if (filterYear > 0 && d.getFullYear() !== filterYear) return false;
    }
    return true;
  });

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

              {/* Tanggal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Tanggal Mulai <span className="text-red-500">*</span></label>
                  <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setFormError(''); }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all font-semibold" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Tanggal Selesai <span className="text-red-500">*</span></label>
                  <input type="date" value={endDate} min={startDate} onChange={e => { setEndDate(e.target.value); setFormError(''); }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all font-semibold" />
                </div>
              </div>

              {/* Duration Preview */}
              {startDate && endDate && (
                <div className={`flex flex-col gap-1.5 rounded-xl px-3.5 py-2.5 border ${
                  (leaveType === 'cuti' && (calcDays() > remainingCuti || calcDays() > 4 || !!checkMonthlyLimit()))
                    ? 'bg-red-50 border-red-200'
                    : leaveType === 'cuti_khusus'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-green-50 border-green-100'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Calendar size={14} className={
                      (leaveType === 'cuti' && (calcDays() > remainingCuti || calcDays() > 4 || !!checkMonthlyLimit()))
                        ? 'text-red-500'
                        : leaveType === 'cuti_khusus'
                          ? 'text-orange-600'
                          : 'text-[#16A34A]'
                    } />
                    <p className={`text-[12px] font-medium ${
                      (leaveType === 'cuti' && (calcDays() > remainingCuti || calcDays() > 4 || !!checkMonthlyLimit()))
                        ? 'text-red-600'
                        : leaveType === 'cuti_khusus'
                          ? 'text-orange-700'
                          : 'text-[#16A34A]'
                    }`}>
                      Durasi: <strong>{calcDays()} hari</strong>
                      {leaveType === 'cuti' && calcDays() > remainingCuti && (
                        <span className="ml-1 font-normal"> — Melebihi sisa kuota ({remainingCuti} hari)! Pengajuan mungkin ditolak.</span>
                      )}
                      {leaveType === 'cuti' && calcDays() > 4 && (
                        <span className="ml-1 font-normal"> — Melebihi batas 4 hari beruntun!</span>
                      )}
                      {leaveType === 'cuti_khusus' && (
                        <span className="ml-1 font-normal text-orange-600/90"> — Tidak memotong kuota cuti tahunan.</span>
                      )}
                    </p>
                  </div>
                  {/* Monthly limit warning */}
                  {leaveType === 'cuti' && !!checkMonthlyLimit() && (
                    <div className="flex items-start gap-1.5 mt-0.5">
                      <AlertTriangle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-red-600 font-medium">{checkMonthlyLimit()}</p>
                    </div>
                  )}
                  {/* Monthly hint for cuti when within limit */}
                  {leaveType === 'cuti' && calcDays() <= 4 && !checkMonthlyLimit() && (() => {
                    const months = getMonthsCovered();
                    return months.map(({ year, month }) => {
                      const existing = existingCutiDaysInMonth(year, month);
                      const newDays  = calcNewDaysInMonth(year, month);
                      const remain   = 4 - existing - newDays;
                      if (existing > 0 || newDays < calcDays()) {
                        return (
                          <p key={`${year}-${month}`} className="text-[11px] text-[#16A34A] font-medium">
                            {INDO_MONTHS[month]} {year}: sudah ada {existing} hari, +{newDays} hari baru → total {existing + newDays}/4 hari
                            {remain > 0 ? ` (sisa ${remain} hari lagi)` : ' (penuh bulan ini)'}
                          </p>
                        );
                      }
                      return null;
                    });
                  })()}
                </div>
              )}

              {/* Rekan Kerja Pengganti (Hanya untuk Cuti Tahunan) */}
              {leaveType === 'cuti' && (
                <div className="space-y-3 text-left">
                  {calcDays() > 0 ? (
                    <>
                      <div>
                        <label className="block text-[12px] font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                          <span>Jumlah Rekan Kerja Pengganti <span className="text-red-500">*</span></span>
                          <span className="text-[11px] font-semibold text-[#16A34A] bg-green-50 px-2 py-0.5 rounded-md border border-green-150">Otomatis sesuai durasi {calcDays()} hari</span>
                        </label>
                        <div className="relative">
                          <select
                            disabled
                            value={numSubstitutesSelect}
                            className="w-full pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-100 focus:outline-none transition-all appearance-none cursor-not-allowed font-bold text-gray-500"
                          >
                            <option value={numSubstitutesSelect}>{numSubstitutesSelect} Orang</option>
                          </select>
                          <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {numSubstitutesSelect >= 1 && (
                          <div>
                            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                              Pengganti 1 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={substitute1}
                              onChange={e => setSubstitute1(e.target.value)}
                              placeholder="Nama rekan kerja pengganti 1..."
                              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all placeholder:text-gray-300 font-semibold text-gray-800"
                            />
                          </div>
                        )}
                        {numSubstitutesSelect >= 2 && (
                          <div>
                            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                              Pengganti 2 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={substitute2}
                              onChange={e => setSubstitute2(e.target.value)}
                              placeholder="Nama rekan kerja pengganti 2..."
                              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all placeholder:text-gray-300 font-semibold text-gray-800"
                            />
                          </div>
                        )}
                        {numSubstitutesSelect >= 3 && (
                          <div>
                            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                              Pengganti 3 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={substitute3}
                              onChange={e => setSubstitute3(e.target.value)}
                              placeholder="Nama rekan kerja pengganti 3..."
                              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all placeholder:text-gray-300 font-semibold text-gray-800"
                            />
                          </div>
                        )}
                        {numSubstitutesSelect >= 4 && (
                          <div>
                            <label className="block text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                              Pengganti 4 <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={substitute4}
                              onChange={e => setSubstitute4(e.target.value)}
                              placeholder="Nama rekan kerja pengganti 4..."
                              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all placeholder:text-gray-300 font-semibold text-gray-800"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5 text-center text-amber-700 text-[11.5px] font-medium">
                      ⚠️ Silakan tentukan tanggal mulai & selesai terlebih dahulu untuk menentukan rekan kerja pengganti.
                    </div>
                  )}
                </div>
              )}

              {/* Alamat Selama Cuti */}
              <div className="text-left">
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
                  {leaveType === 'cuti_khusus' || leaveType === 'sakit'
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
                  <p className="text-[11px] text-blue-600">Wajib mengunggah surat keterangan dokter dari fasilitas kesehatan.</p>
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
                  disabled={
                    submitting ||
                    (leaveType === 'cuti_khusus' && (!selectedCategory || !attachmentFile)) ||
                    (leaveType === 'sakit' && !attachmentFile)
                  }
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

          {/* ── Month & Year Filter ──────────────────────────────────── */}
          <MonthYearDeptFilter
            month={filterMonth}
            year={filterYear}
            showAllMonthsOption={true}
            onMonthChange={setFilterMonth}
            onYearChange={setFilterYear}
            className="mb-4"
          />

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
                      
                      <button
                        type="button"
                        onClick={() => setSelectedLeaveForPrint(req)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-xl border border-blue-100 transition-all cursor-pointer"
                      >
                        <FileText size={11} className="flex-shrink-0" />
                        {req.status === 'approved' ? 'Lihat Form Cuti & QR Code' : 'Lihat Dokumen Form Cuti'}
                      </button>
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

                    {req.status === 'pending' && req.pj_status === 'pending' && (
                      <div className="mt-3 pt-3 border-t border-amber-100">
                        <button
                          onClick={() => setCancelId(req.id)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-100 transition-all cursor-pointer"
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
      {selectedLeaveForPrint && (
        <LeaveFormPrintModal
          request={selectedLeaveForPrint}
          onClose={() => setSelectedLeaveForPrint(null)}
        />
      )}
    </>
  );
}
