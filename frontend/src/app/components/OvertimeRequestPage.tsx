import { useState, useEffect, useRef } from 'react';
import {
  Calendar, FileText, Camera, MapPin, Clock, CheckCircle2,
  XCircle, AlertCircle, Plus, Upload, X, HelpCircle, Building2, User, Eye, Download, Printer, ChevronDown, Loader2
} from 'lucide-react';
import { overtimeApi, OvertimeRequest, departmentApi, DepartmentModel } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import qrCodeImg from '../../imports/qr_code_cempaka_lima.png';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

export function OvertimeRequestPage() {
  const { user, logoUrl } = useAuth();

  // Form State
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // New Overtime SPL Fields
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  const [unitKerja, setUnitKerja] = useState('');
  const [overtimeDayType, setOvertimeDayType] = useState<'workday' | 'holiday'>('workday');
  const [startHour, setStartHour] = useState('17');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('19');
  const [endMinute, setEndMinute] = useState('00');
  const [tasks, setTasks] = useState('');
  
  // UI State
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedSplRequest, setSelectedSplRequest] = useState<OvertimeRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch employee's overtime requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await overtimeApi.list({ per_page: 50, personal: '1' });
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

    const loadDepts = async () => {
      try {
        const res = await departmentApi.list();
        if (res.success) {
          setDepartments(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadDepts();
  }, []);

  useEffect(() => {
    const dept = user?.pj_bagian_department || user?.department || '';
    if (dept) {
      if (departments.length > 0) {
        const matched = departments.find(d => 
          d.name.toLowerCase().trim() === dept.toLowerCase().trim() ||
          d.name.toLowerCase().includes(dept.toLowerCase().trim()) ||
          dept.toLowerCase().trim().includes(d.name.toLowerCase())
        );
        if (matched) {
          setUnitKerja(matched.name);
        } else {
          setUnitKerja(dept);
        }
      } else {
        setUnitKerja(dept);
      }
    }
  }, [user, departments]);

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
    if (!date || !reason.trim() || !locationNote.trim() || !photo || !unitKerja || !startHour || !startMinute || !endHour || !endMinute || !tasks.trim()) {
      setErrorMsg('Mohon lengkapi semua kolom wajib termasuk unit kerja, jam lembur, dan tugas.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const startTimeStr = `${startHour}:${startMinute}`;
    const endTimeStr = `${endHour}:${endMinute}`;

    try {
      const formData = new FormData();
      formData.append('date', date);
      formData.append('reason', reason);
      formData.append('location_note', locationNote);
      formData.append('photo', photo);
      formData.append('unit_kerja', unitKerja);
      formData.append('overtime_day_type', overtimeDayType);
      formData.append('start_time', startTimeStr);
      formData.append('end_time', endTimeStr);
      formData.append('tasks', tasks);

      const res = await overtimeApi.create(formData);
      if (res.success) {
        setSuccessMsg('Pengajuan lembur berhasil dikirim.');
        setDate('');
        setReason('');
        setLocationNote('');
        setPhoto(null);
        setPhotoPreview(null);
        setTasks('');
        setStartHour('17');
        setStartMinute('00');
        setEndHour('19');
        setEndMinute('00');
        setOvertimeDayType('workday');
        const dept = user?.pj_bagian_department || user?.department || '';
        if (dept) setUnitKerja(dept);
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
      pending:  { label: 'Menunggu',   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Clock },
      approved: { label: 'Disetujui',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
      rejected: { label: 'Ditolak',    color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', icon: XCircle },
    };
    const c = config[status] || config.pending;
    return (
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold px-2.5 py-1 rounded-full border shadow-xs" style={{ color: c.color, background: c.bg, borderColor: c.border }}>
        <c.icon size={11} />
        {c.label}
      </span>
    );
  };

  const getStatusConfig = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'approved':
        return { borderColor: 'border-l-emerald-500 hover:border-l-emerald-600' };
      case 'rejected':
        return { borderColor: 'border-l-rose-500 hover:border-l-rose-600' };
      default:
        return { borderColor: 'border-l-amber-500 hover:border-l-amber-600' };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Stats Calculation
  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    totalApprovedMinutes: requests
      .filter(r => r.status === 'approved')
      .reduce((acc, r) => {
        const start = r.start_time || '17:00';
        const end = r.end_time || '19:00';
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60;
        return acc + diff;
      }, 0)
  };

  const formatHours = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins} Menit`;
    if (mins === 0) return `${hrs} Jam`;
    return `${hrs} Jam ${mins} Menit`;
  };

  const filteredRequests = requests.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 pb-10 text-slate-800">
      {/* Overtime Hero Card */}
      <div className="bg-gradient-to-br from-[#16A34A] to-[#0B7A36] rounded-2xl p-5 relative overflow-hidden shadow-sm text-left animate-fade-in">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full border-[20px] border-white/10 translate-x-8 -translate-y-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full border-[12px] border-white/10 -translate-x-6 translate-y-6" />
        
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-xs flex-shrink-0">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-full h-full object-contain" />
            </div>
            <div className="text-white">
              <h2 className="text-[16px] font-bold text-white leading-tight">Pengajuan Lembur Resmi</h2>
              <p className="text-[12px] text-white/80 mt-0.5">Sistem Absensi RSUCL</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/30 flex-shrink-0">
            Aktif
          </span>
        </div>
      </div>

      {/* Action Button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setErrorMsg(null); setSuccessMsg(null); }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-2xl text-[13px] font-bold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
        >
          <Plus size={16} />
          Ajukan Lembur
        </button>
      )}

      {successMsg && (
        <div className="flex items-start gap-2.5 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-[12.5px] font-semibold animate-fade-in shadow-xs">
          <CheckCircle2 size={16} className="mt-0.5 text-emerald-600 flex-shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Form Section */}
      {showForm && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-lg overflow-hidden p-4 sm:p-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
            <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-[#16A34A]" />
              Formulir Pengajuan Lembur Baru
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-emerald-50/60 border border-emerald-100 text-emerald-950 rounded-2xl text-[12.5px] leading-relaxed">
              <AlertCircle size={18} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-emerald-900">Penting Sebelum Mengajukan Lembur</p>
                <p className="mt-1 text-emerald-700 font-medium">
                  Pastikan kamu melakukan absensi masuk dan pulang sesuai dengan kehadiran aktual di rumah sakit. Jangan sengaja memperlambat jam kepulangan agar terhitung sebagai lembur.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[12px] font-semibold">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tanggal Lembur <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/10 font-semibold text-slate-800 transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* Location Note Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Keterangan Lokasi <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={150}
                    placeholder="Contoh: Ruang Farmasi Rawat Inap, Ruang IT Lantai 3..."
                    value={locationNote}
                    onChange={(e) => setLocationNote(e.target.value)}
                    className="w-full pl-9.5 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/10 placeholder:text-slate-400 font-semibold text-slate-850 transition-all"
                  />
                </div>
              </div>

              {/* Unit Kerja Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unit Kerja / Bagian <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    required
                    value={unitKerja}
                    onChange={(e) => setUnitKerja(e.target.value)}
                    className="w-full appearance-none pl-3.5 pr-9 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/10 font-bold text-slate-700 cursor-pointer transition-all"
                  >
                    <option value="" className="text-slate-400 font-medium">Pilih Unit Kerja</option>
                    {unitKerja && !departments.some((d) => d.name === unitKerja) && (
                      <option value={unitKerja}>{unitKerja}</option>
                    )}
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Lembur Pada Waktu (Hari Kerja / Hari Libur) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lembur Pada Waktu <span className="text-red-500">*</span></label>
                <div className="flex gap-6 pt-2">
                  <label className="flex items-center gap-2.5 text-[12.5px] font-bold text-slate-700 cursor-pointer group">
                    <input
                      type="radio"
                      name="overtimeDayType"
                      value="workday"
                      checked={overtimeDayType === 'workday'}
                      onChange={() => setOvertimeDayType('workday')}
                      className="accent-[#16A34A] w-4 h-4 cursor-pointer"
                    />
                    <span className="group-hover:text-slate-900 transition-colors">Hari Kerja</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-[12.5px] font-bold text-slate-700 cursor-pointer group">
                    <input
                      type="radio"
                      name="overtimeDayType"
                      value="holiday"
                      checked={overtimeDayType === 'holiday'}
                      onChange={() => setOvertimeDayType('holiday')}
                      className="accent-[#16A34A] w-4 h-4 cursor-pointer"
                    />
                    <span className="group-hover:text-slate-900 transition-colors">Hari Libur</span>
                  </label>
                </div>
              </div>

              {/* Jam Lembur (Mulai s/d Selesai) */}
              <div className="space-y-1.5 text-left">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jam Mulai Lembur <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <select
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white font-bold text-slate-700 cursor-pointer transition-all"
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="self-center font-extrabold text-slate-400">:</span>
                  <select
                    value={startMinute}
                    onChange={(e) => setStartMinute(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white font-bold text-slate-700 cursor-pointer transition-all"
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jam Selesai Lembur <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <select
                    value={endHour}
                    onChange={(e) => setEndHour(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white font-bold text-slate-700 cursor-pointer transition-all"
                  >
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="self-center font-extrabold text-slate-400">:</span>
                  <select
                    value={endMinute}
                    onChange={(e) => setEndMinute(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white font-bold text-slate-700 cursor-pointer transition-all"
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tugas Saat Lembur */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tugas / Pekerjaan Saat Lembur <span className="text-red-500">*</span></label>
              <div className="relative">
                <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Mengisi rekam medis rawat jalan, melakukan instalasi server..."
                  value={tasks}
                  onChange={(e) => setTasks(e.target.value)}
                  className="w-full pl-9.5 pr-3.5 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/10 placeholder:text-slate-400 font-semibold text-slate-800 transition-all"
                />
              </div>
            </div>

            {/* Reason Textarea */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Alasan & Rincian Pekerjaan Lembur <span className="text-red-500">*</span></label>
              <textarea
                required
                maxLength={1000}
                rows={3}
                placeholder="Jelaskan secara rinci kegiatan lembur yang dilakukan..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[12.5px] bg-slate-50/50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/10 placeholder:text-slate-400 resize-none font-semibold text-slate-800 transition-all"
              />
              <div className="flex justify-end text-[9.5px] text-slate-400 font-bold">
                {reason.length}/1000 karakter
              </div>
            </div>

            {/* Photo upload Box */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unggah Foto Bukti Kegiatan <span className="text-red-500">*</span></label>
              
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
                  className="border-2 border-dashed border-slate-200 hover:border-[#16A34A]/40 hover:bg-emerald-50/10 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/40 transition-all flex flex-col items-center justify-center gap-2.5 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-[#16A34A] group-hover:border-[#16A34A]/25 shadow-xs transition-all border border-slate-200 flex-shrink-0">
                    <Upload size={18} />
                  </div>
                  <div>
                    <p className="text-[12px] font-extrabold text-slate-700">Klik untuk Unggah Gambar</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Format JPG, JPEG, PNG (Maks. 2MB)</p>
                  </div>
                </div>
              ) : (
                <div className="relative border border-slate-200 rounded-2xl overflow-hidden max-w-xs bg-slate-50 shadow-inner group">
                  <img src={photoPreview} alt="Bukti Kegiatan" className="w-full h-40 object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                      className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow-md transition-transform hover:scale-105 cursor-pointer"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-[12.5px] font-extrabold hover:bg-slate-50 transition-colors cursor-pointer active:scale-98"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-[#16A34A] hover:bg-[#15803D] disabled:bg-slate-200 text-white rounded-xl text-[12.5px] font-extrabold shadow-sm transition-all disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  'Kirim Pengajuan'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History List */}
      <div className="space-y-4 text-left">
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-extrabold text-slate-800 tracking-tight">Riwayat Pengajuan Lembur</h3>
          <p className="text-[11.5px] text-slate-400 font-semibold">Tinjau seluruh pengajuan lembur Anda dan status persetujuannya</p>
        </div>

        {/* Summary Stats Cards */}
        {requests.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-4 mb-5 text-left">
            <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between shadow-xs">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">Total</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-none">{stats.total}</p>
                <p className="hidden sm:block text-[10px] text-slate-400 font-semibold mt-1">Keseluruhan pengajuan</p>
              </div>
              <div className="hidden sm:flex w-11 h-11 rounded-xl bg-white border border-slate-200 items-center justify-center text-slate-500 shadow-xs flex-shrink-0">
                <FileText size={18} />
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-150 rounded-2xl p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between shadow-xs">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-emerald-700 uppercase tracking-wider truncate">Disetujui</p>
                <p className="text-xl sm:text-2xl font-extrabold text-emerald-900 leading-none">{stats.approved}</p>
                <p className="hidden sm:block text-[10px] text-emerald-600 font-bold mt-1">Total: {formatHours(stats.totalApprovedMinutes)}</p>
              </div>
              <div className="hidden sm:flex w-11 h-11 rounded-xl bg-white border border-emerald-200 items-center justify-center text-emerald-600 shadow-xs flex-shrink-0">
                <CheckCircle2 size={18} />
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-150 rounded-2xl p-2.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between shadow-xs">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[9px] sm:text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate">Menunggu</p>
                <p className="text-xl sm:text-2xl font-extrabold text-amber-900 leading-none">{stats.pending}</p>
                <p className="hidden sm:block text-[10px] text-amber-600 font-bold mt-1">Review admin</p>
              </div>
              <div className="hidden sm:flex w-11 h-11 rounded-xl bg-white border border-amber-200 items-center justify-center text-emerald-600 shadow-xs flex-shrink-0">
                <Clock size={18} />
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        {requests.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="w-full overflow-x-auto pb-1 -mb-1 scrollbar-none">
              <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/40 w-max sm:w-fit">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => {
                  const label = {
                    all: 'Semua',
                    pending: 'Menunggu',
                    approved: 'Disetujui',
                    rejected: 'Ditolak'
                  }[status];
                  const count = {
                    all: stats.total,
                    pending: stats.pending,
                    approved: stats.approved,
                    rejected: stats.rejected
                  }[status];
                  const isActive = filterStatus === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-white text-slate-800 shadow-xs border border-slate-200/30'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {label}
                      <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-slate-100 text-slate-700 font-extrabold' : 'bg-slate-200/60 text-slate-650 font-bold'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        
        {loading && requests.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white border border-slate-100 rounded-2xl p-5 h-36 shadow-xs"></div>
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-xs p-6 w-full flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 text-slate-400">
              <FileText size={22} />
            </div>
            <p className="text-[13.5px] font-extrabold text-slate-700">Tidak Ada Pengajuan Lembur</p>
            <p className="text-[11.5px] text-slate-400 mt-1 font-semibold">
              {filterStatus === 'all' 
                ? 'Daftar pengajuan lembur resmi Anda akan muncul di sini.'
                : `Tidak ditemukan pengajuan lembur dengan status ${
                    filterStatus === 'pending' ? 'Menunggu' : filterStatus === 'approved' ? 'Disetujui' : 'Ditolak'
                  }.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((r) => (
              <div 
                key={r.id} 
                className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex border-l-4 ${getStatusConfig(r.status).borderColor}`}
              >
                <div className="p-4 sm:p-5 flex-1 space-y-4 text-left">
                  {/* Top Row: Date, Location, Status */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#16A34A] border border-slate-100">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-[13.5px] font-extrabold text-slate-800">{formatDate(r.date)}</p>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-semibold">
                          <MapPin size={11} className="text-slate-400" />
                          <span>{r.location_note}</span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(r.status)}
                  </div>

                  {/* Mid Row: Description and detail grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                    <div className="lg:col-span-3 space-y-3.5">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pekerjaan yang Dilakukan</p>
                        <p className="text-[12.5px] text-slate-600 leading-relaxed font-medium mt-1 whitespace-pre-wrap">{r.reason}</p>
                      </div>

                      {/* Detail SPL info grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 bg-slate-50/70 p-2.5 sm:p-3 rounded-xl border border-slate-200/40 text-[11px]">
                        <div className="flex items-start gap-2">
                          <Building2 size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Unit Kerja</span>
                            <span className="font-bold text-slate-700 leading-tight block">{r.unit_kerja || r.employee?.department || '-'}</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Clock size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Waktu</span>
                            <span className="font-bold text-slate-700 leading-tight block">{r.start_time || '17:00'} - {r.end_time || '19:00'}</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Tipe Hari</span>
                            <span className="font-bold text-slate-700 leading-tight block">{r.overtime_day_type === 'holiday' ? 'Hari Libur' : 'Hari Kerja'}</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <FileText size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Tugas</span>
                            <span className="font-bold text-slate-700 leading-tight block truncate max-w-[110px]" title={r.tasks || r.reason}>{r.tasks || r.reason}</span>
                          </div>
                        </div>
                      </div>
                      
                      {r.status === 'rejected' && r.admin_note && (
                        <div className="bg-rose-50/70 border border-rose-100 p-3 rounded-xl text-[11.5px] text-rose-800 leading-relaxed font-semibold flex items-start gap-2">
                          <XCircle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-rose-900 font-extrabold">Catatan Penolakan Admin:</strong> {r.admin_note}
                          </div>
                        </div>
                      )}
                      
                      {r.status === 'approved' && (
                        <div className="flex flex-col gap-3">
                          {r.admin_note && (
                            <div className="bg-emerald-50/50 border border-emerald-100/50 p-3 rounded-xl text-[11.5px] text-emerald-800 leading-relaxed font-semibold flex items-start gap-2">
                              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                              <div>
                                <strong className="text-emerald-950 font-extrabold">Catatan Admin:</strong> {r.admin_note}
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedSplRequest(r)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-[11.5px] font-extrabold mt-1 transition-all w-fit shadow-xs cursor-pointer active:scale-95"
                          >
                            <Printer size={13} className="text-slate-500" /> Lihat SPL & QR Code
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bukti Foto column */}
                    {r.photo_url && (
                      <div className="lg:col-span-1 flex flex-col justify-start">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Bukti Foto</p>
                        <a href={r.photo_url} target="_blank" rel="noreferrer" className="block relative rounded-xl overflow-hidden border border-slate-200 group aspect-[4/3] w-full max-w-[160px] shadow-xs bg-slate-50 cursor-zoom-in">
                          <img src={r.photo_url} alt="Bukti" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-extrabold tracking-wide uppercase">
                            Buka Foto
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Surat Perintah Lembur (SPL) dengan QR Code */}
      {selectedSplRequest && (() => {
        const reqDateStr = selectedSplRequest.date ? selectedSplRequest.date.substring(0, 10).replace(/-/g, '') : '';
        const splNumber = `SPL-${selectedSplRequest.id}-${reqDateStr}`;
        
        const dateObj = selectedSplRequest.date ? new Date(selectedSplRequest.date) : new Date();
        const monthYears = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        const periodLabel = `${monthYears[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
        
        // Generate QR code content
        const qrContent = `SURAT PERINTAH LEMBUR RESMI
RSU CEMPAKA LIMA
------------------------------
No. Dokumen: ${splNumber}
Nama Pegawai: ${selectedSplRequest.employee?.name}
NIK KTP: ${selectedSplRequest.employee?.nik_ktp}
Unit Kerja: ${selectedSplRequest.unit_kerja || selectedSplRequest.employee?.department || '-'}
Tanggal Lembur: ${formatDate(selectedSplRequest.date)}
Waktu: ${selectedSplRequest.start_time || '17:00'} s/d ${selectedSplRequest.end_time || '19:00'} (${selectedSplRequest.overtime_day_type === 'holiday' ? 'Hari Libur' : 'Hari Kerja'})
Tugas: ${selectedSplRequest.tasks || selectedSplRequest.reason}
Status Dokumen: SAH / DISETUJUI
Otorisasi Final: Direktur PT Cempaka Lima (Amir Hidayat, ST., MKM)`;

        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrContent)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedSplRequest(null)} />
            <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 md:p-8 animate-scale-up max-h-[90vh] overflow-y-auto z-10">
              
              {/* Modal controls */}
              <div className="flex justify-end gap-2 mb-4 border-b border-slate-100 pb-3 no-print">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-[12px] font-extrabold shadow-sm transition-all cursor-pointer hover:shadow active:scale-95"
                >
                  <Printer size={13} /> Cetak Dokumen
                </button>
                <button
                  onClick={() => setSelectedSplRequest(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* SPL Printable Document Container */}
              <div className="border-[3px] border-double border-slate-800 p-6 md:p-8 bg-slate-50/20 font-serif text-slate-900 leading-normal text-left shadow-inner rounded-xl">
                
                {/* Header */}
                <div className="text-center border-b-[2px] border-slate-800 pb-3 mb-5">
                  <h2 className="text-[20px] font-bold tracking-wide uppercase">Surat Perintah Lembur</h2>
                  <p className="text-[12px] font-bold text-slate-700 tracking-wider mt-0.5">RSU CEMPAKA LIMA</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">No. Dokumen: {splNumber}</p>
                </div>

                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 text-[12px] mb-5 border-b border-slate-200 pb-3">
                  <div>
                    <span className="font-bold text-slate-500">Bulan/Tahun :</span>
                    <span className="ml-1.5 font-semibold text-slate-800">{periodLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-500">Lembur Pada Waktu :</span>
                    <span className="ml-2 font-semibold text-slate-800 border border-slate-800 px-2 py-0.5 rounded bg-white shadow-xs">
                      {selectedSplRequest.overtime_day_type === 'holiday' ? '☑ Hari Libur' : '☑ Hari Kerja'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Bagian/Unit :</span>
                    <span className="ml-1.5 font-semibold text-slate-800">{selectedSplRequest.unit_kerja || selectedSplRequest.employee?.department || '-'}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse border border-slate-800 text-[11.5px]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-800 text-center font-bold">
                        <th className="border border-slate-800 p-2 w-10">No</th>
                        <th className="border border-slate-800 p-2">Nama Karyawan</th>
                        <th className="border border-slate-800 p-2">Unit Kerja</th>
                        <th className="border border-slate-800 p-2">Tanggal</th>
                        <th className="border border-slate-800 p-2 col-span-2">Jam Lembur</th>
                        <th className="border border-slate-800 p-2">Tugas Saat Lembur</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-center font-semibold text-slate-800">
                        <td className="border border-slate-800 p-2">1</td>
                        <td className="border border-slate-800 p-2 text-left">{selectedSplRequest.employee?.name}</td>
                        <td className="border border-slate-800 p-2">{selectedSplRequest.unit_kerja || selectedSplRequest.employee?.department || '-'}</td>
                        <td className="border border-slate-800 p-2">{formatDate(selectedSplRequest.date)}</td>
                        <td className="border border-slate-800 p-2 font-mono">{selectedSplRequest.start_time || '17:00'} - {selectedSplRequest.end_time || '19:00'}</td>
                        <td className="border border-slate-800 p-2 text-left font-medium">{selectedSplRequest.tasks || selectedSplRequest.reason}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer and Signatures */}
                <div className="grid grid-cols-2 gap-12 pt-6 items-end">
                  
                  {/* Diajukan */}
                  <div className="text-center">
                    <p className="text-[12px] font-bold text-slate-600">Diajukan Oleh,</p>
                    <div className="h-20" />
                    <p className="text-[12px] font-bold text-slate-800 underline">{selectedSplRequest.employee?.name}</p>
                    <p className="text-[10px] text-slate-500 font-semibold font-mono">NIK KTP: {selectedSplRequest.employee?.nik_ktp}</p>
                  </div>

                  {/* Disetujui */}
                  <div className="text-center flex flex-col items-center">
                    <p className="text-[12px] font-bold text-slate-600">Disetujui Oleh,</p>
                    <p className="text-[10px] font-bold text-slate-500 italic mt-0.5">Direktur PT Cempaka Lima</p>
                    
                    {/* QR Code placed directly here above the name */}
                    <div className="my-2 p-1 border border-slate-200 rounded-lg bg-white shadow-xs">
                      <img src={qrCodeImg} alt="QR Verification" className="w-20 h-20 object-contain" />
                    </div>
                    
                    <p className="text-[12px] font-bold text-slate-800 underline">Amir Hidayat, ST., MKM</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Direktur Utama</p>
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
