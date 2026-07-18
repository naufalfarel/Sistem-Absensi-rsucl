import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, FileText, MapPin, Eye, Printer, X } from 'lucide-react';
import { overtimeApi, OvertimeRequest } from '../../../services/api';
import qrCodeImg from '../../../imports/qr_code_cempaka_lima.png';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { useAuth } from '../../../context/AuthContext';

type OvertimeStatus = 'pending' | 'approved' | 'rejected';

// "warna status lembur ini pada bagian admin nya nanti keteranganya bewarna biru"
// We map all status colors to blue shades to comply with user's specific request.
const statusConfig: Record<OvertimeStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: 'Menunggu',   color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' }, // Amber
  approved: { label: 'Disetujui',  color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' }, // Green
  rejected: { label: 'Ditolak',    color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' }, // Red
};

interface OvertimeApprovalTabProps {
  user: { id: number; name: string };
  onUpdateCount?: () => void;
}

export function OvertimeApprovalTab({ user, onUpdateCount }: OvertimeApprovalTabProps) {
  const { logoUrl } = useAuth();
  const [records, setRecords] = useState<OvertimeRequest[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [confirmModal, setConfirmModal] = useState<{ id: number; action: 'approve' | 'reject'; name: string } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedSplRecord, setSelectedSplRecord] = useState<OvertimeRequest | null>(null);

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

  const pendingCount = records.filter(r => r.pj_status === 'pending' && r.status === 'pending').length;

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
      <div className="bg-gradient-to-br from-[#16A34A] to-[#0B7A36] rounded-2xl p-5 relative overflow-hidden shadow-sm text-left animate-fade-in">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full border-[20px] border-white/10 translate-x-8 -translate-y-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full border-[12px] border-white/10 -translate-x-6 translate-y-6" />
        
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-xs flex-shrink-0">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-full h-full object-contain" />
            </div>
            <div className="text-white">
              <h2 className="text-[16px] font-bold text-white leading-tight">Persetujuan Lembur</h2>
              <p className="text-[12px] text-white/80 mt-0.5">Sistem Absensi RSUCL</p>
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

      {/* Filter Tabs */}
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
        {loading && (
          <div className="text-center py-5 text-gray-400 text-[11px]">Memuat data...</div>
        )}
        {records.length === 0 && !loading && (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 w-full">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-gray-100">
              <FileText size={20} className="text-gray-400" />
            </div>
            <p className="text-[13px] font-semibold text-gray-700">Tidak ada pengajuan lembur ditemukan</p>
            <p className="text-[11px] text-gray-400 mt-1">Semua permohonan lembur telah diproses.</p>
          </div>
        )}
        {records.map(req => {
          const displayStatus = req.status !== 'pending' ? req.status : req.pj_status;
          const sc = statusConfig[displayStatus as OvertimeStatus] || { label: displayStatus, color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' };
          const isOwnRequest = req.employee?.id === user.id;

          return (
            <div key={req.id} className={`bg-white rounded-xl border p-4 shadow-xs ${req.pj_status === 'pending' && req.status === 'pending' ? 'border-amber-200' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <p className="text-[13px] font-bold text-gray-900">{req.employee?.name}</p>
                    {isOwnRequest && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md">Milik Anda</span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg, border: `1px solid ${sc.border}` }}>
                      {sc.label}
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

                    {/* Detail SPL info */}
                    <div className="grid grid-cols-2 gap-2 mt-2 bg-gray-50/50 p-2.5 rounded-lg border border-gray-100 text-[10.5px] text-left">
                      <div>
                        <span className="text-gray-400 font-semibold block text-[8.5px] uppercase">Unit Kerja</span>
                        <span className="font-semibold text-gray-700">{req.unit_kerja || req.employee?.department || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-semibold block text-[8.5px] uppercase">Waktu Lembur</span>
                        <span className="font-semibold text-gray-700">{req.start_time || '17:00'} - {req.end_time || '19:00'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-semibold block text-[8.5px] uppercase">Tipe Hari</span>
                        <span className="font-semibold text-gray-700">{req.overtime_day_type === 'holiday' ? 'Hari Libur' : 'Hari Kerja'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 font-semibold block text-[8.5px] uppercase">Tugas Lembur</span>
                        <span className="font-semibold text-gray-700 truncate block max-w-[120px]">{req.tasks || req.reason}</span>
                      </div>
                    </div>
                  </div>

                  {req.status === 'approved' && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedSplRecord(req)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 transition-all cursor-pointer"
                      >
                        <Printer size={11} /> Lihat SPL & QR Code
                      </button>
                    </div>
                  )}

                  {req.photo_url && (
                    <div className="mt-2.5">
                      <button 
                        onClick={() => setSelectedPhoto(req.photo_url)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16A34A] bg-green-50/70 hover:bg-green-100 px-2.5 py-1.5 rounded-lg border border-green-100 transition-all">
                        <Eye size={11} /> Lihat Bukti Foto Kegiatan
                      </button>
                    </div>
                  )}

                  {req.pj_note && (
                    <div className="mt-2 rounded-lg px-2.5 py-1 border bg-green-50/40 text-[10px] text-green-800 border-green-100">
                      Catatan PJ: <span className="font-semibold">{req.pj_note}</span>
                    </div>
                  )}

                  {req.admin_note && (
                    <div className="mt-2 rounded-lg px-2.5 py-1 border bg-gray-50 text-[10px] text-gray-700 border-gray-100">
                      Catatan Admin: <span className="font-semibold">{req.admin_note}</span>
                    </div>
                  )}
                </div>

                {req.pj_status === 'pending' && req.status === 'pending' && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button 
                      onClick={() => setConfirmModal({ id: req.id, action: 'approve', name: req.employee?.name || 'Karyawan' })}
                      disabled={isOwnRequest}
                      className={`flex items-center justify-center gap-1 px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-lg text-[11px] font-semibold transition-all ${isOwnRequest ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-[11px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmModal(null); setAdminNote(''); }}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button onClick={() => handleAction(confirmModal.id, confirmModal.action, adminNote)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-bold text-white ${confirmModal.action === 'approve' ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-650'}`}>
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

      {/* Modal Surat Perintah Lembur (SPL) dengan QR Code */}
      {selectedSplRecord && (() => {
        const reqDateStr = selectedSplRecord.date ? selectedSplRecord.date.substring(0, 10).replace(/-/g, '') : '';
        const splNumber = `SPL-${selectedSplRecord.id}-${reqDateStr}`;
        
        const dateObj = selectedSplRecord.date ? new Date(selectedSplRecord.date) : new Date();
        const monthYears = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const periodLabel = `${monthYears[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        
        // Generate QR code content
        const qrContent = `SURAT PERINTAH LEMBUR RESMI
RSU CEMPAKA LIMA
------------------------------
No. Dokumen: ${splNumber}
Nama Pegawai: ${selectedSplRecord.employee?.name}
NIK KTP: ${selectedSplRecord.employee?.nik_ktp}
Unit Kerja: ${selectedSplRecord.unit_kerja || selectedSplRecord.employee?.department || '-'}
Tanggal Lembur: ${formatDate(selectedSplRecord.date)}
Waktu: ${selectedSplRecord.start_time || '17:00'} s/d ${selectedSplRecord.end_time || '19:00'} (${selectedSplRecord.overtime_day_type === 'holiday' ? 'Hari Libur' : 'Hari Kerja'})
Tugas: ${selectedSplRecord.tasks || selectedSplRecord.reason}
Status Dokumen: SAH / DISETUJUI
Otorisasi Final: Direktur PT Cempaka Lima (Amir Hidayat, ST., MKM)`;

        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrContent)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-xs" onClick={() => setSelectedSplRecord(null)} />
            <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 md:p-8 animate-scale-up max-h-[90vh] overflow-y-auto">
              
              {/* Modal controls */}
              <div className="flex justify-end gap-2 mb-4 border-b border-gray-100 pb-3 no-print">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-[12px] font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Printer size={13} /> Cetak Dokumen
                </button>
                <button
                  onClick={() => setSelectedSplRecord(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* SPL Printable Document Container */}
              <div className="border-[3px] border-double border-gray-800 p-6 md:p-8 bg-white font-serif text-gray-900 leading-normal text-left">
                
                {/* Header */}
                <div className="text-center border-b-[2px] border-gray-800 pb-3 mb-5">
                  <h2 className="text-[20px] font-bold tracking-wide uppercase">Surat Perintah Lembur</h2>
                  <p className="text-[12px] font-bold text-gray-700 tracking-wider mt-0.5">RSU CEMPAKA LIMA</p>
                  <p className="text-[11px] text-gray-500 font-mono mt-1">No. Dokumen: {splNumber}</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 text-[12px] mb-5 border-b border-gray-250 pb-3">
                  <div>
                    <span className="font-bold text-gray-500">Bulan/Tahun :</span>
                    <span className="ml-1.5 font-semibold text-gray-800">{periodLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-500">Lembur Pada Waktu :</span>
                    <span className="ml-2 font-semibold text-gray-800 border border-gray-800 px-2 py-0.5 rounded bg-gray-50">
                      {selectedSplRecord.overtime_day_type === 'holiday' ? '☑ Hari Libur' : '☑ Hari Kerja'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-500">Bagian/Unit :</span>
                    <span className="ml-1.5 font-semibold text-gray-800">{selectedSplRecord.unit_kerja || selectedSplRecord.employee?.department || '-'}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse border border-gray-800 text-[11.5px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-800 text-center font-bold">
                        <th className="border border-gray-800 p-2 w-10">No</th>
                        <th className="border border-gray-800 p-2">Nama Karyawan</th>
                        <th className="border border-gray-800 p-2">Unit Kerja</th>
                        <th className="border border-gray-800 p-2">Tanggal</th>
                        <th className="border border-gray-800 p-2 col-span-2">Jam Lembur</th>
                        <th className="border border-gray-800 p-2">Tugas Saat Lembur</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-center font-semibold text-gray-800">
                        <td className="border border-gray-800 p-2">1</td>
                        <td className="border border-gray-800 p-2 text-left">{selectedSplRecord.employee?.name}</td>
                        <td className="border border-gray-800 p-2">{selectedSplRecord.unit_kerja || selectedSplRecord.employee?.department || '-'}</td>
                        <td className="border border-gray-800 p-2">{formatDate(selectedSplRecord.date)}</td>
                        <td className="border border-gray-800 p-2 font-mono">{selectedSplRecord.start_time || '17:00'} - {selectedSplRecord.end_time || '19:00'}</td>
                        <td className="border border-gray-800 p-2 text-left font-medium">{selectedSplRecord.tasks || selectedSplRecord.reason}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer and Signatures */}
                <div className="grid grid-cols-2 gap-12 pt-6 items-end">
                  
                  {/* Diajukan */}
                  <div className="text-center">
                    <p className="text-[12px] font-bold text-gray-650">Diajukan Oleh,</p>
                    <div className="h-20" />
                    <p className="text-[12px] font-bold text-gray-800 underline">{selectedSplRecord.employee?.name}</p>
                    <p className="text-[10px] text-gray-500 font-semibold font-mono">NIK KTP: {selectedSplRecord.employee?.nik_ktp}</p>
                  </div>

                  {/* Disetujui */}
                  <div className="text-center flex flex-col items-center">
                    <p className="text-[12px] font-bold text-gray-650">Disetujui Oleh,</p>
                    <p className="text-[10px] font-bold text-gray-500 italic mt-0.5">Direktur PT Cempaka Lima</p>
                    
                    {/* QR Code placed directly here above the name */}
                    <div className="my-2 p-1 border border-gray-200 rounded-lg bg-white shadow-xs">
                      <img src={qrCodeImg} alt="QR Verification" className="w-20 h-20 object-contain" />
                    </div>
                    
                    <p className="text-[12px] font-bold text-gray-800 underline">Amir Hidayat, ST., MKM</p>
                    <p className="text-[10px] text-gray-500 font-semibold">Direktur Utama</p>
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
