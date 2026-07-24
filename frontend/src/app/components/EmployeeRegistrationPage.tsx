import { useState, useEffect } from 'react';
import { UserPlus, ArrowLeft, CheckCircle2, Copy, Check, FileText, Building2, User, Mail, Phone, ShieldCheck, AlertCircle, Search, Instagram, Facebook, Car, Plus, Camera } from 'lucide-react';
import { employeeRegistrationApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

interface RegistrationPageProps {
  onBack?: () => void;
  onGoToCheckStatus?: (regNumber?: string) => void;
}

export function EmployeeRegistrationPage({ onBack, onGoToCheckStatus }: RegistrationPageProps) {
  const { logoUrl } = useAuth();

  // Meta options
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  // Form State
  const [form, setForm] = useState({
    name: '',
    nik_ktp: '',
    email: '',
    profile_picture: '',
    phone: '',
    gender: 'Laki-laki',
    department_id: '',
    position_id: '',
    motor_plate_1: '',
    motor_plate_2: '',
    car_plate_1: '',
    car_plate_2: '',
    instagram: '',
    facebook: '',
    tiktok: '',
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("File harus berupa gambar.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Ukuran file foto profil maksimal 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, profile_picture: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);
  const [copiedReg, setCopiedReg] = useState(false);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const res = await employeeRegistrationApi.getMeta();
        if (res.success) {
          setDepartments(res.data.departments);
          setPositions(res.data.positions);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setMetaLoading(false);
      }
    };
    loadMeta();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.nik_ktp.trim() || !form.email.trim() || !form.phone.trim()) {
      setErrorMsg('Nama Lengkap, NIK KTP, Email, dan Nomor HP wajib diisi.');
      return;
    }
    if (!form.department_id) {
      setErrorMsg('Departemen / Bagian Unit Kerja wajib dipilih.');
      return;
    }
    if (!form.position_id) {
      setErrorMsg('Posisi wajib dipilih.');
      return;
    }
    if (!form.profile_picture) {
      setErrorMsg('Foto Profil wajib diunggah.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await employeeRegistrationApi.submit({
        name: form.name.trim(),
        nik_ktp: form.nik_ktp.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        department_id: form.department_id ? Number(form.department_id) : null,
        position_id: form.position_id ? Number(form.position_id) : null,
        motor_plate_1: form.motor_plate_1.trim() || null,
        motor_plate_2: form.motor_plate_2.trim() || null,
        car_plate_1: form.car_plate_1.trim() || null,
        car_plate_2: form.car_plate_2.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: form.facebook.trim() || null,
        tiktok: form.tiktok.trim() || null,
        profile_picture: form.profile_picture || null,
      });

      if (res.success) {
        setSuccessData(res.data);
      }
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? 'Gagal mengirim formulir pendaftaran.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const copyRegNumber = (regNum: string) => {
    navigator.clipboard.writeText(regNum);
    setCopiedReg(true);
    setTimeout(() => setCopiedReg(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-4 sm:p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-fade-in">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#16A34A] to-[#0B7A36] px-6 py-6 text-white relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer mr-1"
                  title="Kembali"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              {logoUrl !== 'none' && (
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md overflow-hidden flex-shrink-0">
                  <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-9 h-9 object-contain" />
                </div>
              )}
              <div>
                <h1 className="text-[16px] font-bold leading-tight">Formulir Onboarding Pegawai Baru</h1>
                <p className="text-[11px] text-white/80 mt-0.5">Rumah Sakit Umum Cempaka Lima</p>
              </div>
            </div>

            {onGoToCheckStatus && (
              <button
                type="button"
                onClick={() => onGoToCheckStatus()}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[11px] font-bold border border-white/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Search size={12} /> Cek Status
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 sm:p-8">
          {!successData ? (
            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              {/* Panduan Pendaftaran Akun Pegawai Baru (Pre-login) */}
              <div className="bg-slate-900 text-white p-4.5 rounded-2xl text-[12px] leading-relaxed font-normal space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <UserPlus size={16} className="text-emerald-400 flex-shrink-0" />
                  <p className="font-bold text-white text-[13px]">Panduan Pendaftaran & Alur Akun Pegawai Baru</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="font-bold text-emerald-400 block mb-0.5">1. Isi Formulir</span>
                    Lengkapi NIK KTP, Nama, Email, dan No HP resmi Anda pada formulir di bawah ini.
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="font-bold text-emerald-400 block mb-0.5">2. Simpan Kode Ref</span>
                    Setelah submit, simpan Nomor Referensi Pendaftaran yang diterbitkan sistem.
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="font-bold text-emerald-400 block mb-0.5">3. Pantau & Login</span>
                    Cek status draf berkala. Setelah disetujui Admin RSUCL, akun aktif dan siap digunakan.
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[12px] font-semibold animate-fade-in">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Foto Profil */}
                <div className="md:col-span-2 flex flex-col items-center justify-center p-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl mb-2">
                  <span className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2.5 self-start font-bold">
                    Foto Profil <span className="text-red-500">*</span>
                  </span>
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-200 flex items-center justify-center relative">
                      {form.profile_picture ? (
                        <img src={form.profile_picture} alt="Preview Foto" className="w-full h-full object-cover" />
                      ) : (
                        <User size={36} className="text-gray-400" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#16A34A] hover:bg-[#0d9240] text-white flex items-center justify-center shadow-md cursor-pointer transition-transform group-hover:scale-105 active:scale-95">
                      <Plus size={16} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Format: JPG, JPEG, PNG. Maks: 2MB.</p>
                </div>

                {/* Nama Lengkap */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Nama Lengkap (Sesuai KTP) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Ahmad Fauzi, S.Kep / Dr. Rina Kusumawati"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 font-semibold text-gray-800 transition-all"
                    />
                  </div>
                </div>

                {/* NIK KTP */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    NIK KTP <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <ShieldCheck size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      maxLength={20}
                      placeholder="16 digit angka NIK KTP"
                      value={form.nik_ktp}
                      onChange={(e) => setForm({ ...form, nik_ktp: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-bold transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Alamat Email Terdaftar <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      required
                      placeholder="nama@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Nomor HP / WhatsApp <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="08xxxxxxxxxx"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Jenis Kelamin <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-bold transition-all cursor-pointer"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                 {/* Department */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Departemen / Bagian Unit Kerja <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-bold transition-all cursor-pointer"
                  >
                    <option value="">Pilih Departemen</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Position */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Posisi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.position_id}
                    onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-bold transition-all cursor-pointer"
                  >
                    <option value="">Pilih Posisi</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Sosial Media Section */}
                <div className="md:col-span-2 pt-3 border-t border-gray-100">
                  <p className="text-[12.5px] font-bold text-gray-700 uppercase tracking-wider border-l-2 border-[#16A34A] pl-2 mb-3">Sosial Media (Opsional)</p>
                </div>

                {/* Instagram */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Instagram
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-[13px]">@</span>
                    <input
                      type="text"
                      placeholder="username"
                      value={form.instagram}
                      onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Facebook */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Facebook
                  </label>
                  <div className="relative">
                    <Facebook size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="nama.pengguna"
                      value={form.facebook}
                      onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* TikTok */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    TikTok
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-[13px]">@</span>
                    <input
                      type="text"
                      placeholder="username"
                      value={form.tiktok}
                      onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Blank space for alignment */}
                <div className="hidden md:block"></div>

                {/* Data Kendaraan Section */}
                <div className="md:col-span-2 pt-3 border-t border-gray-100">
                  <p className="text-[12.5px] font-bold text-gray-700 uppercase tracking-wider border-l-2 border-[#16A34A] pl-2 mb-1">Data Kendaraan Staf (Opsional)</p>
                  <p className="text-[11px] text-gray-400 mb-3">Masukkan plat nomor kendaraan Anda (maksimal 2 motor dan 2 mobil, bersifat opsional).</p>
                </div>

                {/* Motor 1 */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Motor 1
                  </label>
                  <div className="relative">
                    <Car size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Contoh: BL 1234 AA"
                      maxLength={15}
                      value={form.motor_plate_1}
                      onChange={(e) => setForm({ ...form, motor_plate_1: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Motor 2 */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Motor 2
                  </label>
                  <div className="relative">
                    <Car size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Contoh: BL 5678 BB"
                      maxLength={15}
                      value={form.motor_plate_2}
                      onChange={(e) => setForm({ ...form, motor_plate_2: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Mobil 1 */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Mobil 1
                  </label>
                  <div className="relative">
                    <Car size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Contoh: B 9999 XX"
                      maxLength={15}
                      value={form.car_plate_1}
                      onChange={(e) => setForm({ ...form, car_plate_1: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Mobil 2 */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                    Mobil 2
                  </label>
                  <div className="relative">
                    <Car size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Contoh: B 8888 YY"
                      maxLength={15}
                      value={form.car_plate_2}
                      onChange={(e) => setForm({ ...form, car_plate_2: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 text-gray-800 font-medium transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl text-[13px] hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white font-bold rounded-xl text-[13px] shadow-md shadow-green-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Mengirim Pengajuan...</span>
                    </>
                  ) : (
                    'Kirim Formulir Pendaftaran'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="w-16 h-16 bg-emerald-50 text-[#16A34A] rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-sm">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h2 className="text-[18px] font-bold text-gray-900">Pengajuan Berhasil Dikirim!</h2>
                <p className="text-[12.5px] text-gray-500 mt-1 max-w-md mx-auto">
                  Terima kasih, <strong>{successData.name}</strong>. Formulir onboarding pegawai Anda telah masuk ke dalam draf antrean admin RSUCL.
                </p>
              </div>

              {/* Reference Box */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl space-y-3 shadow-lg max-w-md mx-auto">
                <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Nomor Referensi Pendaftaran Anda
                </p>
                <div className="flex items-center justify-between bg-slate-950/70 p-3.5 rounded-xl border border-slate-700">
                  <span className="font-mono text-xl font-bold tracking-wider text-emerald-400">
                    {successData.registration_number}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyRegNumber(successData.registration_number)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                  >
                    {copiedReg ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedReg ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Catat atau salin nomor di atas. Gunakan nomor referensi ini beserta NIK KTP Anda untuk mengecek status persetujuan & melihat password akun di kemudian hari.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                {onGoToCheckStatus && (
                  <button
                    type="button"
                    onClick={() => onGoToCheckStatus(successData.registration_number)}
                    className="flex-1 py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white font-bold rounded-xl text-[13px] shadow-sm transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                  >
                    <Search size={15} /> Cek Status Pengajuan Ini
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
