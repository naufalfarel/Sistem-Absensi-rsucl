import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, MapPin, Eye } from 'lucide-react';
import { overtimeApi, OvertimeRequest } from '../../../services/api';

type OvertimeStatus = 'pending' | 'approved' | 'rejected';

// "warna status lembur ini pada bagian admin nya nanti keteranganya bewarna biru"
// We map all status colors to blue shades to comply with user's specific request.
const statusConfig: Record<OvertimeStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: 'Menunggu',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' }, // Blue
  approved: { label: 'Disetujui',  color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' }, // Blue
  rejected: { label: 'Ditolak',    color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' }, // Blue
};

interface OvertimeApprovalTabProps {
  user: { id: number; name: string };
  onUpdateCount?: () => void;
}

export function OvertimeApprovalTab({ user, onUpdateCount }: OvertimeApprovalTabProps) {
  const [records, setRecords] = useState<OvertimeRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'approve' | 'reject'; name: string } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await overtimeApi.list({
        status: filter === 'all' ? undefined : filter,
        page: 1,
        per_page: 100,
      });
      if (res.success) {
        setRecords(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [filter]);

  const pendingCount = records.filter(r => r.status === 'pending').length;

  const handleAction = async (id: number, action: 'approve' | 'reject', note?: string) => {
    try {
      let res;
      if (action === 'approve') {
        res = await overtimeApi.approve(id, note);
      } else {
        res = await overtimeApi.reject(id, note || 'Ditolak PJ Bagian');
      }
      if (res.success) {
        setRecords(prev => prev.map(r => r.id === id ? res.data : r));
        if (onUpdateCount) onUpdateCount();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memproses permohonan lembur.');
    } finally {
      setConfirmModal(null);
      setAdminNote('');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Persetujuan Lembur</h2>
          <p className="text-[11px] text-gray-400">Verifikasi permohonan lembur departemen Anda</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
            <Clock size={12} className="text-blue-600 animate-pulse" />
            <span className="text-[11px] font-semibold text-blue-700">{pendingCount} menunggu</span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-xs w-fit overflow-x-auto">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap capitalize ${f === filter ? 'bg-[#2563EB] text-white shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}>
            {f === 'all' ? 'Semua' : f === 'pending' ? 'Menunggu' : f === 'approved' ? 'Disetujui' : 'Ditolak'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-5 text-gray-400 text-[11px]">Memuat data...</div>
        )}
        {records.length === 0 && !loading && (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
            <FileText size={24} className="text-gray-200 mx-auto mb-1.5" />
            <p className="text-[12px] text-gray-400">Tidak ada pengajuan lembur ditemukan</p>
          </div>
        )}
        {records.map(req => {
          const sc = statusConfig[req.status] || { label: req.status, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
          const isOwnRequest = req.employee?.id === user.id;

          return (
            <div key={req.id} className={`bg-white rounded-xl border p-4 shadow-xs ${req.status === 'pending' ? 'border-blue-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <p className="text-[13px] font-bold text-gray-900">{req.employee?.name}</p>
                    {isOwnRequest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md">Milik Anda</span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                      {sc.label} (Keterangan Lembur Biru)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">{req.employee?.department || 'Karyawan'}</p>
                  
                  <div className="text-[11px] text-gray-700 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Clock size={11} className="text-gray-400" />
                      <span className="font-semibold">{formatDate(req.date)}</span>
                    </div>
                    {req.location_note && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <MapPin size={11} className="text-gray-400" />
                        <span>Lokasi: {req.location_note}</span>
                      </div>
                    )}
                    <div className="bg-gray-50/75 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-600 italic">
                      "{req.reason}"
                    </div>
                  </div>

                  {req.photo_url && (
                    <div className="mt-2.5">
                      <button 
                        onClick={() => setSelectedPhoto(req.photo_url)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2563EB] bg-blue-50/70 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-100 transition-all">
                        <Eye size={11} /> Lihat Bukti Foto Kegiatan
                      </button>
                    </div>
                  )}

                  {req.admin_note && (
                    <div className="mt-2 rounded-lg px-2.5 py-1 border bg-blue-50/20 text-[10px] text-blue-700 border-blue-100">
                      Catatan: <span className="font-semibold">{req.admin_note}</span>
                    </div>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button 
                      onClick={() => setConfirmModal({ id: req.id, action: 'approve', name: req.employee?.name || 'Karyawan' })}
                      disabled={isOwnRequest}
                      className={`flex items-center justify-center gap-1 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-lg text-[11px] font-semibold transition-all ${isOwnRequest ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <CheckCircle2 size={11} /> Setuju
                    </button>
                    <button 
                      onClick={() => setConfirmModal({ id: req.id, action: 'reject', name: req.employee?.name || 'Karyawan' })}
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

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => { setConfirmModal(null); setAdminNote(''); }} />
          <div className="relative bg-white rounded-xl p-5 shadow-xl w-full max-w-xs">
            <h3 className="text-[13px] font-bold text-gray-900 mb-1">
              {confirmModal.action === 'approve' ? 'Setujui Lembur?' : 'Tolak Lembur?'}
            </h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Permohonan lembur dari <strong>{confirmModal.name}</strong> akan diproses.
            </p>
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-gray-500 mb-1">Catatan (Opsional)</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
                placeholder="Masukkan catatan..."
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] bg-gray-50 focus:outline-none focus:border-[#2563EB] transition-all resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmModal(null); setAdminNote(''); }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={() => handleAction(confirmModal.id, confirmModal.action, adminNote)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-bold text-white ${confirmModal.action === 'approve' ? 'bg-[#2563EB] hover:bg-[#1d4ed8]' : 'bg-red-500 hover:bg-red-650'}`}>
                {confirmModal.action === 'approve' ? 'Setuju' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedPhoto(null)} />
          <div className="relative bg-white rounded-xl overflow-hidden shadow-2xl max-w-sm w-full p-3 z-10">
            <div className="flex justify-between items-center pb-2 mb-2 border-b">
              <h3 className="text-[12px] font-bold text-gray-900">Bukti Kegiatan Lembur</h3>
              <button onClick={() => setSelectedPhoto(null)} className="text-gray-500 hover:text-gray-700">
                <XCircle size={16} />
              </button>
            </div>
            <img src={selectedPhoto} alt="Bukti Lembur" className="w-full h-auto max-h-[300px] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
