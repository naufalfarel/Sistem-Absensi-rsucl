import { useState, useEffect, useRef } from 'react';
import {
  Calendar, FileText, Camera, MapPin, Clock, CheckCircle2,
  XCircle, AlertCircle, Plus, Upload, X, HelpCircle
} from 'lucide-react';
import { overtimeApi, OvertimeRequest } from '../../services/api';

export function OvertimeRequestPage() {
  // Form State
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // UI State
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch employee's overtime requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await overtimeApi.list({ per_page: 50 });
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Handle Photo Select
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2097152) {
        alert('Ukuran file maksimal 2MB.');
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason.trim() || !locationNote.trim() || !photo) {
      setErrorMsg('Mohon lengkapi semua kolom wajib dan unggah foto kegiatan.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('date', date);
      formData.append('reason', reason);
      formData.append('location_note', locationNote);
      formData.append('photo', photo);

      const res = await overtimeApi.create(formData);
      if (res.success) {
        setSuccessMsg('Pengajuan lembur berhasil dikirim.');
        setDate('');
        setReason('');
        setLocationNote('');
        setPhoto(null);
        setPhotoPreview(null);
        setShowForm(false);
        fetchRequests();
      }
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? 'Gagal mengirim pengajuan lembur.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    const config = {
      pending:  { label: 'Menunggu',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Clock },
      approved: { label: 'Disetujui',  color: '#1D4ED8', bg: '#E0E7FF', border: '#C7D2FE', icon: CheckCircle2 },
      rejected: { label: 'Ditolak',    color: '#475569', bg: '#F1F5F9', border: '#E2E8F0', icon: XCircle },
    };
    const c = config[status] || config.pending;
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border" style={{ color: c.color, background: c.bg, borderColor: c.border }}>
        <c.icon size={11} />
        {c.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-gray-900">Pengajuan Lembur Resmi</h2>
          <p className="text-[12px] text-gray-450 mt-0.5">Ajukan persetujuan lembur dinas resmi Anda secara formal</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setErrorMsg(null); setSuccessMsg(null); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-[12.5px] font-bold shadow-md transition-all active:scale-95"
          >
            <Plus size={15} />
            Ajukan Lembur
          </button>
        )}
      </div>

      {successMsg && (
        <div className="flex items-start gap-2.5 p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-[12.5px]">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      {/* Form Section */}
      {showForm && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden p-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-gray-150 mb-5">
            <h3 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
              <FileText size={16} className="text-[#2563EB]" />
              Formulir Pengajuan Lembur Baru
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-gray-450 hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-650 rounded-xl text-[12px] font-medium">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-500">Tanggal Lembur <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-3 pr-3 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 font-medium text-gray-800"
                  />
                </div>
              </div>

              {/* Location Note Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-gray-500">Keterangan Lokasi <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    maxLength={150}
                    placeholder="Contoh: Ruang Farmasi Rawat Inap, Ruang IT Lantai 3..."
                    value={locationNote}
                    onChange={(e) => setLocationNote(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 placeholder:text-gray-350 font-medium text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* Reason Textarea */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-500">Alasan & Rincian Pekerjaan Lembur <span className="text-red-500">*</span></label>
              <textarea
                required
                maxLength={1000}
                rows={3}
                placeholder="Jelaskan secara rinci kegiatan lembur yang dilakukan..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/25 placeholder:text-gray-350 resize-none font-medium text-gray-800"
              />
              <div className="flex justify-end text-[9.5px] text-gray-400 font-medium">
                {reason.length}/1000 karakter
              </div>
            </div>

            {/* Photo upload Box */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-gray-500">Unggah Foto Bukti Kegiatan <span className="text-red-500">*</span></label>
              
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />

              {!photoPreview ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-250 hover:border-[#2563EB]/40 rounded-2xl p-6 text-center cursor-pointer bg-gray-50 transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-[#2563EB] shadow-sm transition-colors border border-gray-100">
                    <Upload size={18} />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-gray-700">Klik untuk Unggah Gambar</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Format JPG, JPEG, PNG (Maks. 2MB)</p>
                  </div>
                </div>
              ) : (
                <div className="relative border border-gray-200 rounded-2xl overflow-hidden max-w-xs bg-gray-100 shadow-inner group">
                  <img src={photoPreview} alt="Bukti Kegiatan" className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                      className="w-8 h-8 rounded-full bg-red-550 text-white flex items-center justify-center hover:bg-red-600 shadow-lg transition-transform hover:scale-105"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-gray-250 text-gray-600 rounded-xl text-[13px] font-semibold hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 text-white rounded-xl text-[13px] font-bold shadow-md transition-all disabled:cursor-not-allowed"
              >
                {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History List */}
      <div className="space-y-3">
        <h3 className="text-[13.5px] font-bold text-gray-700">Riwayat Pengajuan Lembur</h3>
        
        {loading && requests.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white border border-gray-50 rounded-2xl p-4 h-24"></div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
            <HelpCircle className="mx-auto text-gray-300 mb-2 opacity-50" size={30} />
            <p className="text-[12.5px] font-bold text-gray-700">Belum Ada Pengajuan Lembur</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Daftar pengajuan lembur dinas resmi Anda akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#2563EB]">
                      <Calendar size={15} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">{formatDate(r.date)}</p>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <MapPin size={10} />
                        <span>{r.location_note}</span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(r.status)}
                </div>

                <div className="pt-2.5 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-3 space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Pekerjaan yang Dilakukan</p>
                    <p className="text-[12px] text-gray-650 leading-relaxed font-medium">{r.reason}</p>
                    
                    {r.status === 'rejected' && r.admin_note && (
                      <div className="mt-2 bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[11px] text-slate-600 leading-normal">
                        <strong>Catatan Penolakan Admin:</strong> {r.admin_note}
                      </div>
                    )}
                    {r.status === 'approved' && r.admin_note && (
                      <div className="mt-2 bg-indigo-50/50 border border-indigo-100/50 p-2.5 rounded-xl text-[11px] text-indigo-700 leading-normal font-medium">
                        <strong>Catatan Admin:</strong> {r.admin_note}
                      </div>
                    )}
                  </div>

                  {r.photo_url && (
                    <div className="md:col-span-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Bukti Foto</p>
                      <a href={r.photo_url} target="_blank" rel="noreferrer" className="block relative rounded-lg overflow-hidden border border-gray-150 group h-20 w-32 shadow-sm">
                        <img src={r.photo_url} alt="Bukti" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[9.5px] font-bold">
                          Buka Foto
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
