import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { leaveApi, LeaveRequest } from '../../../services/api';

type LeaveType = 'cuti' | 'izin' | 'sakit';
type LeaveStatus = 'pending' | 'approved' | 'rejected';

const typeConfig: Record<LeaveType, { label: string; color: string; bg: string; border: string }> = {
  cuti:  { label: 'Cuti Tahunan', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  izin:  { label: 'Izin',         color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  sakit: { label: 'Sakit',        color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
};

const statusConfig: Record<LeaveStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Menunggu',  color: '#D97706', bg: '#FEF3C7' },
  approved: { label: 'Disetujui', color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: 'Ditolak',   color: '#DC2626', bg: '#FEE2E2' },
};

const filterTabs = ['Semua', 'Menunggu', 'Disetujui', 'Ditolak'];

export function LeaveTab() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState('Semua');
  const [typeFilter, setTypeFilter] = useState('all');
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'approve' | 'reject'; name: string } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadRequests();
  }, []);

  const filtered = requests.filter(r => {
    const matchFilter = filter === 'Semua' ||
      (filter === 'Menunggu' && r.status === 'pending') ||
      (filter === 'Disetujui' && r.status === 'approved') ||
      (filter === 'Ditolak' && r.status === 'rejected');
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
      <div className="grid grid-cols-3 gap-3">
        {['cuti', 'izin', 'sakit'].map(t => {
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

      {/* Filter tabs */}
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
          return (
            <div key={req.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${req.status === 'pending' ? 'border-amber-200' : 'border-gray-100'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: tc.bg, border: `1.5px solid ${tc.border}` }}>
                      <span className="text-[13px] font-bold" style={{ color: tc.color }}>
                        {req.type === 'cuti' ? 'C' : req.type === 'izin' ? 'I' : 'S'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-[14px] font-semibold text-gray-900">{req.employee?.name}</p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: tc.color, background: tc.bg }}>{tc.label}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                      </div>
                      <p className="text-[12px] text-gray-500 mb-1">{req.employee?.department || 'Karyawan'}</p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-[12px] text-gray-600">
                            {formatDate(req.start_date)}{req.days > 1 ? ` – ${formatDate(req.end_date)}` : ''} ({req.days} hari)
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400">Diajukan: {formatDate(req.created_at)}</span>
                      </div>
                      <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-[12px] text-gray-600 italic">"{req.reason}"</p>
                      </div>
                      {req.admin_note && (
                        <div className={`mt-2 rounded-xl px-3 py-2 border ${req.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                          <p className="text-[11px] font-medium text-gray-600">Catatan admin: <span className={req.status === 'approved' ? 'text-green-700' : 'text-red-600'}>{req.admin_note}</span></p>
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
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 rounded-xl text-[12px] font-semibold transition-all">
                        <XCircle size={13} /> Tolak
                      </button>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-[#16A34A]" />
                    </div>
                  )}
                  {req.status === 'rejected' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                      <XCircle size={16} className="text-red-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
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
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all ${confirmModal.action === 'approve' ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-600'}`}>
                {confirmModal.action === 'approve' ? 'Ya, Setujui' : 'Ya, Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
