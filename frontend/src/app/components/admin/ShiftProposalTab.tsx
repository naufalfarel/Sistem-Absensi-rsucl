import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { shiftProposalApi, ShiftProposal } from '../../../services/api';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';

const statusConfig = {
  pending:  { label: 'Menunggu',   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  approved: { label: 'Disetujui',  color: '#16A34A', bg: '#DCFCE7', border: '#A7F3D0' },
  rejected: { label: 'Ditolak',    color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
};

export function ShiftProposalTab() {
  const [proposals, setProposals] = useState<ShiftProposal[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear]   = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Rejection modal
  const [rejectingProposal, setRejectingProposal] = useState<ShiftProposal | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const res = await shiftProposalApi.list({
        status: filter === 'all' ? undefined : filter,
      });
      if (res.success) {
        setProposals(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, [filter]);

  const handleApprove = async (id: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menyetujui usulan shift ini? Penugasan shift akan langsung aktif.')) return;
    setProcessingId(id);
    try {
      const res = await shiftProposalApi.approve(id);
      if (res.success) {
        if (filter === 'pending') {
          setProposals(prev => prev.filter(p => p.id !== id));
        } else {
          setProposals(prev => prev.map(p => p.id === id ? res.data : p));
        }
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menyetujui usulan.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingProposal) return;
    if (!rejectionNote.trim()) {
      alert('Alasan penolakan wajib diisi.');
      return;
    }

    setSubmittingReject(true);
    try {
      const res = await shiftProposalApi.reject(rejectingProposal.id, rejectionNote);
      if (res.success) {
        if (filter === 'pending') {
          setProposals(prev => prev.filter(p => p.id !== rejectingProposal.id));
        } else {
          setProposals(prev => prev.map(p => p.id === rejectingProposal.id ? res.data : p));
        }
        setRejectingProposal(null);
        setRejectionNote('');
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menolak usulan.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-4 max-w-5xl mx-auto px-2 sm:px-0">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Persetujuan Usulan Shift Staf</h2>
          <p className="text-[11px] text-gray-400">Tinjau usulan pembagian shift yang dikirimkan oleh PJ Bagian</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
            <Clock size={12} className="text-[#16A34A] animate-pulse" />
            <span className="text-[11px] font-semibold text-green-800">{pendingCount} usulan pending</span>
          </div>
        )}
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
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap capitalize ${f === filter ? 'bg-[#16A34A] text-white shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}>
            {f === 'all' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading && proposals.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-[11px]">Memuat usulan shift...</div>
        )}

        {proposals.length === 0 && !loading && (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
            <FileText size={24} className="text-gray-250 mx-auto mb-1.5" />
            <p className="text-[12px] text-gray-400">Tidak ada usulan shift ditemukan</p>
          </div>
        )}

        {proposals.map(prop => {
          const sc = statusConfig[prop.status as keyof typeof statusConfig] || { label: prop.status, color: '#374151', bg: '#F3F4F6', border: '#E5E7EB' };
          return (
            <div key={prop.id} className={`bg-white rounded-xl border p-4 shadow-xs ${prop.status === 'pending' ? 'border-green-200' : 'border-gray-100'}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                    <p className="text-[13px] font-bold text-gray-800">{prop.employee.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                      {sc.label}
                    </span>
                  </div>
                  
                  <div className="text-[11px] text-gray-500 space-y-1">
                    <p>Departemen: <span className="font-bold text-gray-750">{prop.employee.department}</span></p>
                    <p>
                      Hari: <span className="font-bold text-gray-750">{prop.day_of_week}</span> · Usulan Shift: <span className="font-bold text-gray-750">{prop.schedule ? `${prop.schedule.name} (${prop.schedule.start_time.slice(0, 5)} - ${prop.schedule.end_time.slice(0, 5)})` : 'Libur (Tidak Ada Shift)'}</span>
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Diusulkan oleh: <span className="font-semibold text-gray-500">{prop.proposed_by?.name || 'PJ Bagian'}</span> pada {prop.created_at.slice(0, 16)}
                    </p>
                  </div>

                  {prop.admin_note && (
                    <div className="mt-2.5 p-2 rounded-lg border bg-gray-50 text-[10px] text-gray-600">
                      Catatan Admin: <span className="font-semibold">{prop.admin_note}</span>
                    </div>
                  )}
                </div>

                {prop.status === 'pending' && (
                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                    <button
                      onClick={() => handleApprove(prop.id)}
                      disabled={processingId === prop.id}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-[#16A34A] hover:bg-[#15803d] text-white rounded-xl text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} /> Setuju
                    </button>
                    <button
                      onClick={() => setRejectingProposal(prop)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-red-50 border border-red-100 text-red-650 hover:bg-red-100 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                    >
                      <XCircle size={12} /> Tolak
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Modal */}
      {rejectingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setRejectingProposal(null)} />
          <div className="relative bg-white rounded-xl p-5 shadow-xl w-full max-w-xs z-10">
            <h3 className="text-[13px] font-bold text-gray-900 mb-1 flex items-center gap-1.5">
              <XCircle size={16} className="text-red-500" /> Tolak Usulan Shift
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">
              Usulan untuk <strong>{rejectingProposal.employee.name}</strong> akan ditolak.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">Alasan Penolakan (Wajib)</label>
                <textarea
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                  rows={3}
                  required
                  placeholder="Masukkan alasan penolakan..."
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingProposal(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-650 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {submittingReject ? 'Memproses...' : 'Tolak Usulan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
