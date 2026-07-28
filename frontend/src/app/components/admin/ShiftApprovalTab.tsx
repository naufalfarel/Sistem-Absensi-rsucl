import React, { useState, useEffect } from 'react';
import { 
  Check, X, Calendar, User, Clock, FileText, CheckCircle2, 
  XCircle, AlertCircle, ShieldAlert, Loader2, Sparkles, Building
} from 'lucide-react';
import { scheduleApi, ShiftSchedule } from '../../../services/api';

export function ShiftApprovalTab() {
  const [proposals, setProposals] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  
  // Reject Modal State
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await scheduleApi.list();
      if (res.success) {
        // Kita filter data di frontend untuk menampilkan shift yang diusulkan oleh PJ Bagian (has proposed_by)
        const proposedShifts = (res.data ?? []).filter(s => s.proposed_by !== null && s.parent_id === null);
        setProposals(proposedShifts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleApprove = async (id: number) => {
    const proposal = proposals.find(p => p.id === id);
    const isDelete = proposal?.status === 'pending_delete';
    const confirmMsg = isDelete 
      ? 'Setujui usulan penghapusan shift ini? Shift ini akan dihapus secara permanen dari database.'
      : 'Setujui usulan jam kerja shift ini? Staf unit terkait akan dapat menggunakan shift ini.';
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await scheduleApi.approve(id);
      if (res.success) {
        alert(isDelete ? 'Usulan penghapusan shift disetujui, shift dihapus.' : 'Usulan shift disetujui.');
        fetchProposals();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memproses usulan shift.');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectId || !rejectNote.trim()) return;
    setSubmittingReject(true);
    try {
      const res = await scheduleApi.reject(rejectId, rejectNote.trim());
      if (res.success) {
        setRejectId(null);
        setRejectNote('');
        fetchProposals();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menolak usulan shift.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const filtered = proposals.filter(p => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') {
      return p.status === 'pending' || p.status === 'pending_delete';
    }
    return p.status === filterStatus;
  });

  const isRejectingDelete = proposals.find(p => p.id === rejectId)?.status === 'pending_delete';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-[#16A34A]" /> Persetujuan Usulan Shift Kerja
          </h2>
          <p className="text-[11.5px] text-gray-400 mt-1">Daftar usulan penambahan, penyuntingan, atau penghapusan shift dari PJ Bagian unit kerja RSUCL</p>
        </div>

        {/* Tab Filters */}
        <div className="flex bg-gray-50 p-1.5 rounded-full border border-gray-100 flex-shrink-0">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-1.8 rounded-full text-[11px] font-bold capitalize transition-all cursor-pointer ${
                filterStatus === status
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {status === 'pending' ? 'Menunggu' : status === 'approved' ? 'Disetujui' : status === 'rejected' ? 'Ditolak' : 'Semua'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <Loader2 className="animate-spin text-[#16A34A]" size={28} />
          <p className="text-[12px] font-medium">Memuat usulan shift...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-gray-400">
            <Calendar size={22} />
          </div>
          <h3 className="text-[13.5px] font-bold text-gray-800">Tidak Ada Usulan Shift</h3>
          <p className="text-[11px] text-gray-400 mt-1">Belum ada usulan shift yang sesuai dengan filter saat ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(proposal => {
            const children = (proposal as any).children ?? [];
            const proposedName = (proposal as any).proposed_by_name ?? 'PJ Bagian';
            const deptName = (proposal as any).owner_department_name ?? 'Unit Kerja';
            const isDelete = proposal.status === 'pending_delete';
            const isPending = proposal.status === 'pending';

            return (
              <div 
                key={proposal.id} 
                className="border border-gray-150 rounded-2xl p-5 bg-white relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
              >
                {/* Visual Accent */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1" 
                  style={{ background: isDelete ? '#EF4444' : proposal.color }} 
                />

                <div className="space-y-4">
                  {/* Header Info */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ background: isDelete ? '#EF4444' : proposal.color }}
                      >
                        <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="text-[14px] font-bold text-gray-800">{proposal.name}</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Building size={11} /> {deptName}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    <span className={`text-[10px] font-bold px-2.5 py-0.8 rounded-full ${
                      isDelete ? 'bg-red-50 text-red-600 border border-red-200/50' :
                      isPending ? 'bg-amber-50 text-amber-600 border border-amber-200/50' :
                      proposal.status === 'approved' ? 'bg-green-50 text-[#16A34A] border border-green-200/50' :
                      'bg-red-50 text-red-650 border border-red-200/50'
                    }`}>
                      {isDelete ? 'Usulan Hapus' : 
                       isPending ? 'Menunggu Review' : 
                       proposal.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                    </span>
                  </div>

                  {/* Proposal details */}
                  <div className="bg-slate-50/50 rounded-xl p-3 space-y-2 text-[11px] border border-slate-100/50">
                    <div className="flex justify-between items-center pb-1.5 border-b border-gray-100/50 text-gray-500">
                      <span className="flex items-center gap-1.5"><User size={12} /> Diusulkan Oleh</span>
                      <span className="font-bold text-gray-700">{proposedName}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-500">
                      <span className="flex items-center gap-1.5"><Clock size={12} /> Jam Shift (Acuan)</span>
                      <span className="font-bold text-gray-750 bg-white px-2 py-0.5 rounded border border-gray-250/20 font-mono">
                        {(proposal.start_time || '').substring(0, 5)} – {(proposal.end_time || '').substring(0, 5)} WIB
                      </span>
                    </div>
                  </div>

                  {/* Sub Shifts list */}
                  {children.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sub-Waktu Kerja Staf ({children.length})</p>
                      <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {children.map((child: any) => (
                          <div key={child.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50 border border-gray-100 text-[11px]">
                            <span className="font-semibold text-gray-750">{child.name}</span>
                            <span className="font-mono text-gray-500">{(child.start_time || '').substring(0, 5)} – {(child.end_time || '').substring(0, 5)} WIB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Penolakan Note */}
                  {proposal.status === 'rejected' && proposal.admin_note && (
                    <div className="p-3 bg-red-50/50 border border-red-100/50 rounded-xl text-[10.5px] text-red-650 flex items-start gap-2">
                      <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Alasan Penolakan: </span>
                        <span>{proposal.admin_note}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {(isPending || isDelete) && (
                  <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setRejectId(proposal.id)}
                      className="flex-1 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center"
                    >
                      {isDelete ? 'Tolak Hapus' : 'Tolak Usulan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(proposal.id)}
                      className={`flex-1 py-2 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer text-center ${
                        isDelete 
                          ? 'bg-red-650 hover:bg-red-700' 
                          : 'bg-[#16A34A] hover:bg-[#0d9240]'
                      }`}
                    >
                      {isDelete ? 'Setujui Hapus' : 'Setujui Shift'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setRejectId(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm z-10 border border-red-150 text-left">
            <h3 className="text-[14px] font-extrabold text-gray-900 mb-2">
              {isRejectingDelete ? 'Tolak Usulan Hapus Shift' : 'Tolak Usulan Shift Kerja'}
            </h3>
            <p className="text-[10.5px] text-gray-400 mb-4">Harap berikan catatan alasan mengapa usulan {isRejectingDelete ? 'penghapusan' : 'jam shift'} ini ditolak</p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder={isRejectingDelete ? "Contoh: Shift ini masih aktif digunakan unit..." : "Contoh: Jam kerja terlalu panjang / tumpang tindih..."}
                  rows={3}
                  required
                  maxLength={250}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setRejectId(null); setRejectNote(''); }}
                  className="flex-1 py-2.5 border border-gray-250 hover:bg-gray-50 rounded-xl text-[11px] font-bold text-gray-600 cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReject || !rejectNote.trim()}
                  className="flex-1 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingReject ? <Loader2 size={13} className="animate-spin" /> : 'Tolak Usulan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
