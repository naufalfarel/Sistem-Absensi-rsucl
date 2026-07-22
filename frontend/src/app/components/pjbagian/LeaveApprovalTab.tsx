import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, Paperclip, Printer } from 'lucide-react';
import { leaveApi, LeaveRequest } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { LeaveFormPrintModal } from '../ui/LeaveFormPrintModal';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';
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
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());
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
    if (r.start_date) {
      const d = new Date(r.start_date);
      if (filterMonth > 0 && d.getMonth() + 1 !== filterMonth) return false;
      if (filterYear > 0 && d.getFullYear() !== filterYear) return false;
    }
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
      {/* Header Banner Hijau */}
      <div className="bg-gradient-to-br from-[#16A34A] to-[#0B7A36] rounded-2xl p-5 relative overflow-hidden shadow-sm text-left animate-fade-in">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full border-[20px] border-white/10 translate-x-8 -translate-y-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full border-[12px] border-white/10 -translate-x-6 translate-y-6" />
        
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-xs flex-shrink-0">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-full h-full object-contain" />
            </div>
            <div className="text-white">
              <h2 className="text-[16px] font-bold text-white leading-tight">Persetujuan Cuti & Sakit</h2>
              <p className="text-[12px] text-white/80 mt-0.5">Verifikasi permohonan cuti dan sakit untuk departemen Anda</p>
            </div>
          </div>
          {pendingCount > 0 ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500 text-white border border-amber-400 flex-shrink-0 animate-pulse">
              {pendingCount} Menunggu
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30 flex-shrink-0">
              Selesai
            </span>
          )}
        </div>
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

      {/* ── Month & Year Filter ──────────────────────────────────── */}
      <MonthYearDeptFilter
        month={filterMonth}
        year={filterYear}
        showAllMonthsOption={true}
        onMonthChange={setFilterMonth}
        onYearChange={setFilterYear}
      />

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
                    <div className="bg-gray-50/75 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-600 mt-1 space-y-1">
                      <p className="italic">"{req.reason}"</p>
                      {req.substitute_name && (
                        <p className="not-italic text-gray-500 font-medium pt-1 border-t border-gray-100">
                          👥 Rekan Kerja Pengganti: <span className="font-bold text-gray-800">{req.substitute_name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {req.attachment_url && (
                      <a href={req.attachment_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] hover:underline bg-green-50/70 px-2 py-1 rounded-lg">
                        <Paperclip size={10} /> Lihat Dokumen
                      </a>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => setSelectedLeaveForPrint(req)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline bg-blue-50/70 px-2.5 py-1 rounded-lg border border-blue-100 transition-all cursor-pointer"
                    >
                      <FileText size={11} className="flex-shrink-0" />
                      {req.status === 'approved' ? 'Lihat Form Cuti & QR Code' : 'Lihat Dokumen Form Cuti'}
                    </button>
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
      {selectedLeaveForPrint && (
        <LeaveFormPrintModal
          request={selectedLeaveForPrint}
          onClose={() => setSelectedLeaveForPrint(null)}
        />
      )}
    </div>
  );
}
