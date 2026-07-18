import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Building2, 
  Calendar, 
  Paperclip, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Plus,
  ArrowLeft,
  Search,
  ChevronRight,
  FileDown
} from 'lucide-react';
import { assignmentLetterApi, AssignmentLetter } from '../../services/api';

export default function AssignmentLetterPage() {
  // Navigation & UI States
  const [letters, setLetters] = useState<AssignmentLetter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form Field States
  const [title, setTitle] = useState('');
  const [issuingInstitution, setIssuingInstitution] = useState('');
  const [letterNumber, setLetterNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  // Load Letters History
  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await assignmentLetterApi.list();
      if (res.success) {
        setLetters(res.data);
      }
    } catch (err: any) {
      console.error('Gagal mengambil riwayat surat tugas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setFormError('Ukuran file maksimal adalah 2MB.');
        return;
      }
      setDocumentFile(file);
      setFormError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!title.trim() || !issuingInstitution.trim() || !startDate || !endDate || !purpose.trim() || !documentFile) {
      setFormError('Semua field wajib diisi, termasuk bukti dokumen surat tugas.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setFormError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('issuing_institution', issuingInstitution.trim());
      formData.append('letter_number', letterNumber.trim());
      formData.append('start_date', startDate);
      formData.append('end_date', endDate);
      formData.append('purpose', purpose.trim());
      formData.append('document', documentFile);

      const res = await assignmentLetterApi.create(formData);
      if (res.success) {
        setSubmitSuccess(true);
        setTitle('');
        setIssuingInstitution('');
        setLetterNumber('');
        setStartDate('');
        setEndDate('');
        setPurpose('');
        setDocumentFile(null);
        
        // Refresh list
        fetchLetters();
        
        setTimeout(() => {
          setSubmitSuccess(false);
          setShowForm(false);
        }, 2000);
      }
    } catch (err: any) {
      setFormError(err?.message ?? 'Gagal mengirim pengajuan surat tugas.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: AssignmentLetter['status']) => {
    switch (status) {
      case 'approved':
        return {
          bg: 'bg-green-50 text-green-700 border-green-150',
          label: 'Disetujui',
          icon: CheckCircle2
        };
      case 'rejected':
        return {
          bg: 'bg-red-50 text-red-700 border-red-150',
          label: 'Ditolak',
          icon: XCircle
        };
      default:
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-150',
          label: 'Menunggu',
          icon: Clock
        };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return new Date(dateStr).toLocaleDateString('id-ID', options);
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[20px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#16A34A] to-green-400 flex items-center justify-center shadow-md shadow-green-100">
              <FileText className="text-white" size={20} />
            </div>
            Pengajuan Surat Tugas
          </h1>
          <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
            Ajukan surat tugas dinas luar atau undangan kegiatan resmi untuk skip validasi geofence GPS absensi.
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-bold shadow-md shadow-green-100 hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <Plus size={16} /> Ajukan Surat Tugas
          </button>
        )}
      </div>

      {/* TAMPILAN FORM PENGAJUAN (Didesain seperti dokumen resmi) */}
      {showForm ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-scale-up mb-8">
          {/* Header Form */}
          <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className="text-[14px] font-bold text-gray-800">Formulir Surat Tugas Resmi</h2>
                <p className="text-[10px] text-gray-400">Silakan lengkapi detail surat undangan/tugas dinas luar Anda.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {formError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-2xl text-[12px] font-semibold">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {submitSuccess && (
              <div className="flex items-center gap-2.5 bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-2xl text-[12px] font-bold">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>Pengajuan surat tugas berhasil dikirim ke Admin!</span>
              </div>
            )}

            {/* Document Frame-like inputs */}
            <div className="border border-dashed border-gray-200 rounded-2xl p-6 bg-slate-50/50 space-y-4">
              <div className="text-center pb-3 border-b border-gray-150">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Dokumen Administrasi Dinas Luar</p>
              </div>

              {/* Judul Kegiatan / Perihal */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Perihal / Judul Kegiatan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <FileText size={15} />
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Contoh: Undangan Workshop Penerapan Tarif BPJS Terbaru"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-250 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-semibold text-gray-800 placeholder:text-gray-300"
                    required
                  />
                </div>
              </div>

              {/* Grid: Instansi & Nomor Surat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Instansi / Pihak Pemberi Tugas <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <Building2 size={15} />
                    </span>
                    <input
                      type="text"
                      value={issuingInstitution}
                      onChange={e => setIssuingInstitution(e.target.value)}
                      placeholder="Contoh: Dinas Kesehatan Provinsi Aceh"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-255 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-medium text-gray-800 placeholder:text-gray-300"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Nomor Surat Tugas <span className="text-gray-400">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-[11px] font-bold">№</span>
                    <input
                      type="text"
                      value={letterNumber}
                      onChange={e => setLetterNumber(e.target.value)}
                      placeholder="Contoh: 094/123/ST/2026"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-255 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-mono text-gray-800 placeholder:text-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Grid: Tanggal Mulai & Tanggal Selesai */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Tanggal Mulai Tugas <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-255 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-semibold text-gray-800 cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Tanggal Selesai Tugas <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-255 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all font-semibold text-gray-800 cursor-pointer"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Uraian Keperluan / Kegiatan */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Uraian Keperluan / Kegiatan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="Deskripsikan dengan singkat rincian kegiatan penugasan Anda..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-3.5 py-2.5 border border-gray-255 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all resize-none text-gray-800 placeholder:text-gray-300 leading-relaxed"
                  required
                />
              </div>

              {/* Upload Bukti Surat Tugas */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Unggah Bukti Surat Tugas / Undangan <span className="text-red-500">*</span>
                </label>
                
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-200 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-slate-50 transition-all hover:border-green-300">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Paperclip className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-[12px] text-gray-500 font-bold">
                        {documentFile ? documentFile.name : 'Pilih file dokumen...'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">PDF, JPG, JPEG, PNG (Maks. 2MB)</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-[13px] font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-green-150 disabled:opacity-50"
              >
                {submitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* TAMPILAN RIWAYAT PENGAJUAN */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-[13px] font-extrabold text-gray-700 uppercase tracking-wider">Riwayat Pengajuan Surat Tugas</h3>
            <span className="text-[10px] bg-slate-200/70 text-gray-500 px-2 py-0.5 rounded-full font-bold">
              {letters.length} Pengajuan
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-3 border-green-200 border-t-[#16A34A] rounded-full animate-spin" />
              <p className="text-[11px] text-gray-400 font-medium">Memuat data pengajuan...</p>
            </div>
          ) : letters.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <FileText className="text-slate-300" size={24} />
              </div>
              <h4 className="text-[14px] font-bold text-gray-700">Belum Ada Pengajuan</h4>
              <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto">
                Anda belum pernah mengajukan surat tugas dinas luar. Klik tombol di atas untuk membuat pengajuan baru.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {letters.map(letter => {
                const badge = getStatusBadge(letter.status);
                const BadgeIcon = badge.icon;
                
                return (
                  <div key={letter.id} className="p-5 hover:bg-slate-50/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[13px] font-bold text-gray-800">{letter.title}</h4>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                            <BadgeIcon size={10} /> {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Building2 size={11} /> {letter.issuing_institution}
                          {letter.letter_number && <span>• No: {letter.letter_number}</span>}
                        </p>
                      </div>

                      {letter.document_url && (
                        <a
                          href={letter.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="self-start inline-flex items-center gap-1 text-[11px] font-bold text-[#16A34A] hover:text-[#0d9240] bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <FileDown size={12} /> Lihat Bukti
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 max-w-sm">
                      <div className="bg-slate-50/70 border border-slate-100/50 rounded-xl px-3 py-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block">Mulai</span>
                        <span className="text-[11.5px] font-semibold text-gray-700">{formatDate(letter.start_date)}</span>
                      </div>
                      <div className="bg-slate-50/70 border border-slate-100/50 rounded-xl px-3 py-1.5">
                        <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold block">Selesai</span>
                        <span className="text-[11.5px] font-semibold text-gray-700">{formatDate(letter.end_date)}</span>
                      </div>
                    </div>

                    <p className="text-[12px] text-gray-500 bg-slate-50/30 rounded-xl p-3 border border-slate-100/30 italic">
                      "{letter.purpose}"
                    </p>

                    {letter.status === 'rejected' && letter.admin_note && (
                      <div className="mt-3 bg-red-50/50 border border-red-100 text-red-700 px-3.5 py-2.5 rounded-xl text-[11.5px]">
                        <span className="font-bold">Alasan Ditolak:</span> "{letter.admin_note}"
                      </div>
                    )}

                    {letter.status === 'approved' && letter.reviewed_at && (
                      <p className="text-[10px] text-gray-400 mt-2 text-right">
                        Disetujui oleh {letter.reviewed_by || 'Admin'} pada {new Date(letter.reviewed_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
