import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, Trash2, Paperclip } from 'lucide-react';
import { leaveApi, LeaveRequest } from '../../../services/api';

type LeaveType = 'cuti' | 'izin' | 'sakit' | 'cuti_khusus';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

const typeConfig: Record<LeaveType, { label: string; color: string; bg: string; border: string }> = {
  cuti:        { label: 'Cuti Tahunan', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  izin:        { label: 'Izin',         color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  sakit:       { label: 'Sakit',        color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  cuti_khusus: { label: 'Cuti Khusus / Diluar Tanggungan', color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5' },
};

const statusConfig: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Menunggu',   color: '#D97706', bg: '#FEF3C7' },
  approved:  { label: 'Disetujui',  color: '#16A34A', bg: '#DCFCE7' },
  rejected:  { label: 'Ditolak',    color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: 'Dibatalkan', color: '#6B7280', bg: '#F3F4F6' },
};

const filterTabs = ['Semua', 'Menunggu', 'Disetujui', 'Ditolak', 'Dibatalkan'];

interface LeaveTabProps {
  onUpdateCount?: () => void;
}

/**
 * Komponen Tab Cuti Admin (LeaveTab) — Sistem Absensi RSUCL
 * 
 * Digunakan oleh Administrator untuk meninjau, menyetujui, atau menolak permohonan
 * cuti, izin, dan sakit yang diajukan oleh karyawan. Administrator juga dapat mempersingkat,
 * membatalkan pengajuan yang sudah disetujui, serta mendeteksi pegawai yang kembali masuk lebih awal.
 */
export function LeaveTab({ onUpdateCount }: LeaveTabProps) {
  const getLocalDateString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 10);
  };
  const todayStr = getLocalDateString();

  // Daftar lengkap seluruh pengajuan cuti masuk
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  
  // Filter status aktif ('Semua', 'Menunggu', 'Disetujui', 'Ditolak', 'Dibatalkan')
  const [filter, setFilter] = useState('Semua');
  
  // Filter kategori tipe cuti ('all', 'cuti', 'izin', 'sakit')
  const [typeFilter, setTypeFilter] = useState('all');
  
  // Menyimpan data dialog konfirmasi permohonan
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'approve' | 'reject'; name: string } | null>(null);
  
  // Modals untuk pembatalan dan perpendekan masa cuti oleh admin
  const [cancelModal, setCancelModal] = useState<{ id: number; name: string } | null>(null);
  const [shortenModal, setShortenModal] = useState<{ id: number; name: string; startDate: string; endDate: string } | null>(null);

  // Form states untuk input di modal cancel/shorten
  const [cancellationReason, setCancellationReason] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [shortenedReason, setShortenedReason] = useState('');

  // Deteksi kemungkinan kembali lebih awal
  const [possibleReturns, setPossibleReturns] = useState<Array<{ leave_request: LeaveRequest; detected_dates: string[] }>>([]);

  // Catatan persetujuan/penolakan dari administrator
  const [adminNote, setAdminNote] = useState('');
  
  // Indikator loading request
  const [loading, setLoading] = useState(false);

  /**
   * Menarik seluruh daftar pengajuan cuti masuk dari API backend.
   */
  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await leaveApi.list();
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mendeteksi pegawai yang check-in saat rentang cuti aktif.
   */
  const loadPossibleReturns = async () => {
    try {
      const res = await leaveApi.possibleEarlyReturns();
      if (res.success) {
        setPossibleReturns(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Panggil load saat tab ini dimuat di layar
  useEffect(() => {
    loadRequests();
    loadPossibleReturns();
  }, []);

  const filtered = requests.filter(r => {
    const matchFilter = filter === 'Semua' ||
      (filter === 'Menunggu' && r.status === 'pending') ||
      (filter === 'Disetujui' && r.status === 'approved') ||
      (filter === 'Ditolak' && r.status === 'rejected') ||
      (filter === 'Dibatalkan' && r.status === 'cancelled');
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchFilter && matchType;
  });

  const pending = requests.filter(r => r.status === 'pending').length;

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
        loadPossibleReturns();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memproses permohonan.');
    } finally {
      setConfirmModal(null);
      setAdminNote('');
    }
  };

  const handleCancelAdmin = async (id: number, reason: string) => {
    if (!reason.trim()) {
      alert('Alasan pembatalan wajib diisi.');
      return;
    }
    try {
      const res = await leaveApi.cancelAdmin(id, reason);
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? res.data : r));
        loadPossibleReturns();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal membatalkan pengajuan.');
    } finally {
      setCancelModal(null);
      setCancellationReason('');
    }
  };

  const handleShortenAdmin = async (id: number, actualEnd: string, reason: string) => {
    if (!actualEnd) {
      alert('Tanggal efektif selesai wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      alert('Alasan mempersingkat wajib diisi.');
      return;
    }
    try {
      const res = await leaveApi.shortenAdmin(id, actualEnd, reason);
      if (res.success) {
        setRequests(prev => prev.map(r => r.id === id ? res.data : r));
        loadPossibleReturns();
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal mempersingkat pengajuan.');
    } finally {
      setShortenModal(null);
      setActualEndDate('');
      setShortenedReason('');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  const hasProcessed = requests.some(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled');

  const handleDeleteIndividual = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengajuan cuti ini?')) return;
    try {
      const res = await leaveApi.delete(id);
      if (res.success) {
        setRequests(prev => prev.filter(r => r.id !== id));
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus pengajuan.');
    }
  };

  const handleDeleteAllProcessed = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus SEMUA pengajuan cuti lama (yang sudah Disetujui/Ditolak/Dibatalkan)? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      const res = await leaveApi.deleteAllProcessed();
      if (res.success) {
        setRequests(prev => prev.filter(r => r.status === 'pending'));
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus pengajuan lama.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Pengajuan Cuti & Izin</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Kelola permintaan cuti, izin, dan sakit karyawan</p>
        </div>
        {pending > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2">
            <Clock size={14} className="text-amber-600" />
            <span className="text-[12px] font-semibold text-amber-700">{pending} pengajuan menunggu persetujuan</span>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['cuti', 'izin', 'sakit', 'cuti_khusus'].map(t => {
          const tc = typeConfig[t as LeaveType];
          const count = requests.filter(r => r.type === t).length;
          return (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              className={`rounded-2xl p-4 border-2 text-left transition-all ${typeFilter === t ? 'shadow-md' : 'border-transparent hover:border-gray-200'}`}
              style={{ background: tc.bg, borderColor: typeFilter === t ? tc.color : undefined }}>
              <p className="text-[22px] font-bold text-black">{count}</p>
              <p className="text-[12px] font-medium text-gray-700 mt-0.5">{tc.label}</p>
              <p className="text-[10px] text-gray-400">{requests.filter(r => r.type === t && r.status === 'pending').length} menunggu</p>
            </button>
          );
        })}
      </div>

      {/* Panel Kemungkinan Kembali Lebih Awal */}
      {possibleReturns.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600 animate-pulse" />
            <h3 className="text-[13px] font-bold text-amber-800">Deteksi Kemungkinan Kembali Lebih Awal</h3>
          </div>
          <p className="text-[11px] text-amber-700">
            Berikut adalah daftar karyawan dengan status cuti disetujui, namun sistem mendeteksi adanya check-in kehadiran di salah satu hari dalam rentang cuti tersebut.
          </p>
          <div className="grid gap-3">
            {possibleReturns.map(({ leave_request, detected_dates }) => {
              const tc = typeConfig[leave_request.type];
              return (
                <div key={leave_request.id} className="bg-white/80 backdrop-blur-sm border border-amber-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div>
                    <p className="text-[12px] font-semibold text-gray-800">{leave_request.employee.name} ({leave_request.employee.department})</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Jenis: <span className="font-semibold text-gray-755">{tc.label}</span> · Rentang: <span className="font-semibold text-gray-755">{formatDate(leave_request.start_date)} s/d {formatDate(leave_request.end_date)}</span>
                    </p>
                    <p className="text-[10px] text-red-600 font-bold mt-1">
                      Terdeteksi masuk/absen pada tanggal: {detected_dates.map(formatDate).join(', ')}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShortenModal({ 
                      id: leave_request.id, 
                      name: leave_request.employee.name, 
                      startDate: leave_request.start_date, 
                      endDate: leave_request.end_date 
                    })}
                    className="px-3.5 py-2 bg-amber-605 hover:bg-amber-700 text-white rounded-xl text-[11px] font-semibold transition-all shadow-sm active:scale-95 border border-amber-600"
                  >
                    Persingkat Cuti Resmi
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter & Bulk Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-100 p-1 shadow-sm w-fit">
          {filterTabs.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 ${f === filter ? 'bg-[#16A34A] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {f}
              {f === 'Menunggu' && pending > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${f === filter ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-600'}`}>{pending}</span>
              )}
            </button>
          ))}
        </div>

        {hasProcessed && (
          <button onClick={handleDeleteAllProcessed}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-50 border border-red-100 hover:bg-red-100 text-red-650 rounded-xl text-[12px] font-semibold transition-all shadow-sm active:scale-95">
            <Trash2 size={13} className="text-red-500" /> Hapus Semua Cuti Lama
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-5 text-gray-400 text-[12px]">Memuat pengajuan cuti...</div>
        )}
        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <FileText size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[13px] text-gray-400">Tidak ada pengajuan ditemukan</p>
          </div>
        )}
        {filtered.map(req => {
          const tc = typeConfig[req.type];
          const sc = statusConfig[req.status];
          
          const effectiveEnd = req.effective_end_date || req.end_date;
          const isPast = effectiveEnd < todayStr;
          const showShorten = req.days > 1 && !isPast;
          const showCancel = !isPast;

          return (
            <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${req.status === 'pending' ? 'border-amber-200' : 'border-gray-100'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc.bg, border: `1.5px solid ${tc.border}` }}>
                      <span className="text-[13px] font-bold" style={{ color: tc.color }}>
                        {req.type === 'cuti' ? 'C' : req.type === 'izin' ? 'I' : req.type === 'sakit' ? 'S' : 'CK'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-[14px] font-semibold text-gray-900">{req.employee?.name}</p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: tc.color, background: tc.bg }}>
                          {req.type === 'cuti_khusus' && req.special_leave_category
                            ? `Cuti Khusus (${req.special_leave_category.name})`
                            : tc.label}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                      </div>
                      <p className="text-[12px] text-gray-500 mb-1">{req.employee?.department || 'Karyawan'}</p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-[12px] text-gray-600 font-medium">
                            {formatDate(req.start_date)}{req.actual_end_date ? ` – ${formatDate(req.actual_end_date)}` : (req.days > 1 ? ` – ${formatDate(req.end_date)}` : '')} ({req.days} hari efektif)
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400">Diajukan: {formatDate(req.created_at)}</span>
                        {req.actual_end_date && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Dipersingkat: selesai {formatDate(req.actual_end_date)} (semula {formatDate(req.end_date)})
                          </span>
                        )}
                      </div>
                      <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-[12px] text-gray-600 italic">"{req.reason}"</p>
                      </div>
                      {req.attachment_url && (
                        <div className="mt-2">
                          <a 
                            href={req.attachment_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] hover:text-[#0d9240] bg-green-50/70 hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-100 transition-all"
                          >
                            <Paperclip size={11} className="flex-shrink-0" />
                            Lihat Dokumen Pendukung
                          </a>
                        </div>
                      )}
                      {req.admin_note && (
                        <div className={`mt-2 rounded-xl px-3 py-2 border ${req.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                          <p className="text-[11px] font-medium text-gray-600">Catatan admin: <span className={req.status === 'approved' ? 'text-green-700' : 'text-red-600'}>{req.admin_note}</span></p>
                        </div>
                      )}
                      {req.status === 'cancelled' && req.cancellation_reason && (
                        <div className="mt-2 rounded-xl px-3 py-2 border bg-gray-50 border-gray-200">
                          <p className="text-[11px] font-medium text-gray-650">Alasan pembatalan: <span className="text-gray-800 font-semibold">{req.cancellation_reason}</span></p>
                        </div>
                      )}
                      {req.actual_end_date && req.shortened_reason && (
                        <div className="mt-2 rounded-xl px-3 py-2 border bg-amber-50 border-amber-100">
                          <p className="text-[11px] font-medium text-amber-800">Alasan dipersingkat: <span className="text-amber-900 font-semibold">{req.shortened_reason}</span></p>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => setConfirmModal({ id: req.id, action: 'approve', name: req.employee.name })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm shadow-green-200">
                        <CheckCircle2 size={13} /> Setujui
                      </button>
                      <button onClick={() => setConfirmModal({ id: req.id, action: 'reject', name: req.employee.name })}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 border border-red-100 text-red-650 hover:bg-red-100 rounded-xl text-[12px] font-semibold transition-all">
                        <XCircle size={13} /> Tolak
                      </button>
                      {showCancel && (
                        <button onClick={() => setCancelModal({ id: req.id, name: req.employee.name })}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-xl text-[11px] font-semibold transition-all">
                          Batalkan Cuti
                        </button>
                      )}
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="flex flex-col md:flex-row items-center gap-2 flex-shrink-0">
                      {showShorten && (
                        <button 
                          onClick={() => setShortenModal({ id: req.id, name: req.employee.name, startDate: req.start_date, endDate: req.end_date })}
                          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-semibold transition-all shadow-sm"
                        >
                          Persingkat
                        </button>
                      )}
                      {showCancel && (
                        <button 
                          onClick={() => setCancelModal({ id: req.id, name: req.employee.name })}
                          className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 rounded-xl text-[11px] font-semibold transition-all shadow-sm"
                        >
                          Batalkan
                        </button>
                      )}
                      <button onClick={() => handleDeleteIndividual(req.id)}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center border border-gray-100 transition-colors"
                        title="Hapus Pengajuan">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {(req.status === 'rejected' || req.status === 'cancelled') && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                        <XCircle size={16} className="text-red-500" />
                      </div>
                      <button onClick={() => handleDeleteIndividual(req.id)}
                        className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center border border-gray-100 transition-colors"
                        title="Hapus Pengajuan">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal (Approve/Reject) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setConfirmModal(null); setAdminNote(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${confirmModal.action === 'approve' ? 'bg-green-50' : 'bg-red-50'}`}>
              {confirmModal.action === 'approve'
                ? <CheckCircle2 size={24} className="text-[#16A34A]" />
                : <XCircle size={24} className="text-red-500" />}
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 text-center mb-1">
              {confirmModal.action === 'approve' ? 'Setujui Pengajuan?' : 'Tolak Pengajuan?'}
            </h3>
            <p className="text-[12px] text-gray-500 text-center mb-4">
              Pengajuan dari <strong>{confirmModal.name}</strong> akan {confirmModal.action === 'approve' ? 'disetujui' : 'ditolak'}.
            </p>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Catatan Admin / Keterangan</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                placeholder="Masukkan catatan/alasan..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmModal(null); setAdminNote(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={() => handleAction(confirmModal.id, confirmModal.action, adminNote)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all ${confirmModal.action === 'approve' ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-650'}`}>
                {confirmModal.action === 'approve' ? 'Ya, Setujui' : 'Ya, Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setCancelModal(null); setCancellationReason(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <XCircle size={24} className="text-red-500" />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 text-center mb-1">
              Batalkan Pengajuan Cuti?
            </h3>
            <p className="text-[12px] text-gray-500 text-center mb-4">
              Anda akan membatalkan pengajuan cuti dari <strong>{cancelModal.name}</strong>. Tindakan ini akan mengembalikan kuota cuti karyawan secara otomatis.
            </p>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Alasan Pembatalan (Wajib)</label>
              <textarea 
                value={cancellationReason} 
                onChange={e => setCancellationReason(e.target.value)} 
                rows={2}
                placeholder="Masukkan alasan pembatalan..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" 
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setCancelModal(null); setCancellationReason(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={() => handleCancelAdmin(cancelModal.id, cancellationReason)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-all">
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shorten Modal */}
      {shortenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setShortenModal(null); setActualEndDate(''); setShortenedReason(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Clock size={24} className="text-amber-600" />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-900 text-center mb-1">
              Persingkat Masa Cuti?
            </h3>
            <p className="text-[12px] text-gray-500 text-center mb-4">
              Persingkat pengajuan dari <strong>{shortenModal.name}</strong>. Tanggal mulai asli: {formatDate(shortenModal.startDate)}.
            </p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Tanggal Efektif Selesai Baru</label>
                <input 
                  type="date"
                  value={actualEndDate}
                  onChange={e => setActualEndDate(e.target.value)}
                  min={shortenModal.startDate}
                  max={shortenModal.endDate}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold text-gray-800"
                />
                <p className="text-[10px] text-gray-400 mt-1">Harus di antara tanggal mulai dan sebelum selesai semula ({formatDate(shortenModal.endDate)}).</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Alasan Mempersingkat (Wajib)</label>
                <textarea 
                  value={shortenedReason} 
                  onChange={e => setShortenedReason(e.target.value)} 
                  rows={2}
                  placeholder="Masukkan alasan memperpendek durasi..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" 
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShortenModal(null); setActualEndDate(''); setShortenedReason(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={() => handleShortenAdmin(shortenModal.id, actualEndDate, shortenedReason)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-all">
                Simpan Penyesuaian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
