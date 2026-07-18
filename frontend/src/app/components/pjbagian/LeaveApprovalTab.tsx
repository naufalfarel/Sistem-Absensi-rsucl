import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, Paperclip, Printer } from 'lucide-react';
import { leaveApi, LeaveRequest } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

type LeaveType = 'cuti' | 'sakit' | 'cuti_khusus';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'draft';

const typeConfig: Record<LeaveType, { label: string; color: string; bg: string; border: string }> = {
  cuti:        { label: 'Cuti Tahunan',  color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' }, // Blue
  sakit:       { label: 'Sakit',         color: '#92400E', bg: '#FEF3C7', border: '#D97706' }, // Brown
  cuti_khusus: { label: 'Cuti Khusus',   color: '#EA580C', bg: '#FFF7ED', border: '#FDBA74' }, // Bright Orange
};

const statusConfig: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Menunggu',   color: '#D97706', bg: '#FEF3C7' },
  approved:  { label: 'Disetujui',  color: '#16A34A', bg: '#DCFCE7' },
  rejected:  { label: 'Ditolak',    color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: 'Dibatalkan', color: '#6B7280', bg: '#F3F4F6' },
  draft:     { label: 'Draf (Menunggu PJ)', color: '#4F46E5', bg: '#EEF2FF' },
};

const filterTabs = ['Semua', 'Menunggu', 'Disetujui', 'Ditolak', 'Dibatalkan'];

interface LeaveApprovalTabProps {
  user: { id: number; name: string };
  onUpdateCount?: () => void;
}

export function LeaveApprovalTab({ user, onUpdateCount }: LeaveApprovalTabProps) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState('Menunggu');
  const [typeFilter, setTypeFilter] = useState('all');
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'approve' | 'reject'; name: string } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLeaveForPrint, setSelectedLeaveForPrint] = useState<LeaveRequest | null>(null);
  const { logoUrl } = useAuth();

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await leaveApi.list();
      if (res.success) {
        // Filter out "izin" if they slip through, only show cuti, sakit, cuti_khusus
        setRequests(res.data.filter(r => r.type !== 'izin'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filtered = requests.filter(r => {
    const matchFilter = filter === 'Semua' ||
      (filter === 'Menunggu' && r.pj_status === 'pending' && r.status === 'pending') ||
      (filter === 'Disetujui' && r.pj_status === 'approved') ||
      (filter === 'Ditolak' && r.pj_status === 'rejected') ||
      (filter === 'Dibatalkan' && r.status === 'cancelled');
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchFilter && matchType;
  });

  const pendingCount = requests.filter(r => r.pj_status === 'pending' && r.status === 'pending').length;

  const handleAction = async (id: number, action: 'approve' | 'reject', note?: string) => {
    try {
      let res;
      if (action === 'approve') {
        res = await leaveApi.approve(id, note);
      } else {
        res = await leaveApi.reject(id, note);
      }
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? res.data : r));
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memproses permohonan.');
    } finally {
      setConfirmModal(null);
      setAdminNote('');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Persetujuan Cuti & Sakit</h2>
          <p className="text-[11px] text-gray-400">Verifikasi permohonan cuti dan sakit untuk departemen Anda</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
            <Clock size={12} className="text-amber-600 animate-pulse" />
            <span className="text-[11px] font-semibold text-amber-700">{pendingCount} menunggu</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        {['cuti', 'sakit', 'cuti_khusus'].map(t => {
          const tc = typeConfig[t as LeaveType];
          const count = requests.filter(r => r.type === t).length;
          return (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              className={`rounded-xl p-3 border text-left transition-all ${typeFilter === t ? 'shadow-xs border-gray-300' : 'border-gray-150 hover:border-gray-200'}`}
              style={{ background: tc.bg }}>
              <p className="text-[18px] font-bold text-gray-900">{count}</p>
              <p className="text-[11px] font-medium text-gray-700 truncate mt-0.5">{tc.label}</p>
              <p className="text-[9px] text-gray-400">{requests.filter(r => r.type === t && r.status === 'pending').length} menunggu</p>
            </button>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-xs w-fit overflow-x-auto">
        {filterTabs.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${f === filter ? 'bg-[#16A34A] text-white shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-5 text-gray-400 text-[11px]">Memuat data...</div>
        )}
        {filtered.length === 0 && !loading && (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 w-full">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-gray-100">
              <FileText size={20} className="text-gray-400" />
            </div>
            <p className="text-[13px] font-semibold text-gray-700">Tidak ada pengajuan ditemukan</p>
            <p className="text-[11px] text-gray-400 mt-1">Semua permohonan cuti, sakit, dan cuti khusus telah diproses.</p>
          </div>
        )}
        {filtered.map(req => {
          const typeKey = (req.type === 'izin' ? 'cuti' : req.type) as LeaveType;
          const tc = typeConfig[typeKey] || typeConfig.cuti;
          const displayStatus = req.status !== 'pending' ? req.status : req.pj_status;
          const sc = statusConfig[displayStatus as LeaveStatus] || { label: displayStatus, color: '#374151', bg: '#F3F4F6' };
          const isOwnRequest = req.employee?.id === user.id;

          return (
            <div key={req.id} className={`bg-white rounded-xl border p-4 shadow-xs ${req.pj_status === 'pending' && req.status === 'pending' ? 'border-amber-100' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <p className="text-[13px] font-bold text-gray-900">{req.employee?.name}</p>
                    {isOwnRequest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md">Milik Anda</span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: tc.color, background: tc.bg }}>
                      {req.type === 'cuti_khusus' && req.special_leave_category
                        ? `Cuti Khusus (${req.special_leave_category.name})`
                        : tc.label}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-1.5">{req.employee?.department || 'Karyawan'}</p>
                  
                  <div className="text-[11px] text-gray-700 space-y-1">
                    <div className="flex items-center gap-1">
                      <Clock size={11} className="text-gray-400" />
                      <span className="font-semibold">
                        {formatDate(req.start_date)}{req.days > 1 ? ` – ${formatDate(req.end_date)}` : ''} ({req.days} hari)
                      </span>
                    </div>
                    <div className="bg-gray-50/75 rounded-lg px-2.5 py-1.5 text-[11px] italic text-gray-600 mt-1">
                      "{req.reason}"
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {req.attachment_url && (
                      <a href={req.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] hover:underline bg-green-50/70 px-2 py-1 rounded-lg">
                        <Paperclip size={10} /> Lihat Dokumen
                      </a>
                    )}
                    
                    {req.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => setSelectedLeaveForPrint(req)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline bg-blue-50/70 px-2.5 py-1 rounded-lg border border-blue-100 transition-all cursor-pointer"
                      >
                        <FileText size={11} className="flex-shrink-0" /> Lihat Form Cuti & QR Code
                      </button>
                    )}
                  </div>

                  {req.pj_note && (
                    <div className="mt-2 rounded-lg px-2.5 py-1 border bg-gray-50 text-[10px] text-gray-600">
                      Catatan PJ: <span className="font-semibold">{req.pj_note}</span>
                    </div>
                  )}

                  {req.admin_note && (
                    <div className="mt-2 rounded-lg px-2.5 py-1 border bg-gray-50 text-[10px] text-gray-600">
                      Catatan Admin: <span className="font-semibold">{req.admin_note}</span>
                    </div>
                  )}
                </div>

                {req.pj_status === 'pending' && req.status === 'pending' && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button 
                      onClick={() => setConfirmModal({ id: req.id, action: 'approve', name: req.employee.name })}
                      disabled={isOwnRequest}
                      className={`flex items-center justify-center gap-1 px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-lg text-[11px] font-semibold transition-all ${isOwnRequest ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <CheckCircle2 size={11} /> Setuju
                    </button>
                    <button 
                      onClick={() => setConfirmModal({ id: req.id, action: 'reject', name: req.employee.name })}
                      disabled={isOwnRequest}
                      className={`flex items-center justify-center gap-1 px-3 py-1.5 bg-red-55 border border-red-100 text-red-650 hover:bg-red-100 rounded-lg text-[11px] font-semibold transition-all ${isOwnRequest ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <XCircle size={11} /> Tolak
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => { setConfirmModal(null); setAdminNote(''); }} />
          <div className="relative bg-white rounded-xl p-5 shadow-xl w-full max-w-xs">
            <h3 className="text-[13px] font-bold text-gray-900 mb-1">
              {confirmModal.action === 'approve' ? 'Setujui Pengajuan?' : 'Tolak Pengajuan?'}
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Permohonan dari <strong>{confirmModal.name}</strong> akan diproses.
            </p>
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Catatan (Opsional)</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                placeholder="Masukkan keterangan..."
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmModal(null); setAdminNote(''); }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={() => handleAction(confirmModal.id, confirmModal.action, adminNote)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-bold text-white ${confirmModal.action === 'approve' ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-600'}`}>
                {confirmModal.action === 'approve' ? 'Setuju' : 'Tolak'}
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
    </div>
  );
}
