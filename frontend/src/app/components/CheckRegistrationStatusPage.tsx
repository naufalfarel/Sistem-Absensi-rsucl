import { useState, useEffect } from 'react';
import { Search, ShieldCheck, CheckCircle2, Clock, XCircle, AlertTriangle, Copy, Check, Lock, User, ArrowLeft, Building2, Phone, FileText } from 'lucide-react';
import { employeeRegistrationApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

interface CheckStatusPageProps {
  onBack?: () => void;
  onGoToLogin?: () => void;
  initialRegNumber?: string;
}

export function CheckRegistrationStatusPage({ onBack, onGoToLogin, initialRegNumber }: CheckStatusPageProps) {
  const { logoUrl } = useAuth();

  const [registrationNumber, setRegistrationNumber] = useState(initialRegNumber || '');
  const [verificationData, setVerificationData] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationNumber.trim() || !verificationData.trim()) {
      setErrorMsg('Nomor pengajuan dan NIK KTP atau Nomor HP wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    const val = verificationData.trim();
    // Determine whether verification input looks like NIK (digits) or phone
    const isDigitsOnly = /^\d+$/.test(val);
    const nikVal = isDigitsOnly && val.length > 10 ? val : val;
    const phoneVal = val;

    try {
      const res = await employeeRegistrationApi.checkStatus({
        registration_number: registrationNumber.trim().toUpperCase(),
        nik: nikVal,
        phone: phoneVal,
      });

      if (res.success) {
        setResult(res.data);
      }
    } catch (err: any) {
      const msg = err?.data?.message ?? err?.message ?? 'Nomor pengajuan atau data verifikasi tidak sesuai.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-4 sm:p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-xl bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden animate-fade-in">
        
        {/* Top bar header */}
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
                <h1 className="text-[15px] font-bold leading-tight">Cek Status Pengajuan Pegawai</h1>
                <p className="text-[11px] text-white/80 mt-0.5">Rumah Sakit Umum Cempaka Lima</p>
              </div>
            </div>
            {onGoToLogin && (
              <button
                type="button"
                onClick={onGoToLogin}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[11px] font-bold border border-white/30 transition-all cursor-pointer"
              >
                Halaman Login
              </button>
            )}
          </div>
        </div>

        {/* Form Container */}
        <div className="p-6 space-y-6">
          {/* Panduan Cek Status (Pre-login) */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 rounded-2xl text-[12px] text-emerald-950 text-left leading-relaxed">
            <p className="font-bold mb-1 flex items-center gap-1.5 text-emerald-900">
              <Search size={15} className="text-[#16A34A]" /> Panduan Cek Status Pendaftaran Akun
            </p>
            <p className="text-[11.5px] text-gray-700">
              Masukkan <strong>Nomor Referensi Pendaftaran</strong> yang Anda dapatkan setelah mengisi formulir onboarding beserta <strong>NIK KTP atau Nomor HP</strong> terdaftar untuk memantau draf verifikasi Administrator RSUCL.
            </p>
          </div>

          <form onSubmit={handleCheck} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                Nomor Referensi Pengajuan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: REG-2026-000045"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 transition-all text-gray-800 font-bold uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-[11.5px] font-bold text-gray-700 uppercase tracking-wider">
                Verifikasi Data (NIK KTP atau No. HP) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Masukkan NIK KTP atau Nomor HP terdaftar"
                  value={verificationData}
                  onChange={(e) => setVerificationData(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/15 transition-all text-gray-800 font-medium"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Gunakan NIK KTP atau Nomor HP yang Anda masukkan saat mengisi formulir pendaftaran.
              </p>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[12px] font-semibold text-left animate-fade-in">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white font-bold rounded-xl text-[13px] shadow-sm transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <Search size={15} />
                  <span>Cek Status Pengajuan</span>
                </>
              )}
            </button>
          </form>

          {/* Result Section */}
          {result && (
            <div className="border-t border-gray-100 pt-6 space-y-4 text-left animate-fade-in">
              <div className="flex items-center justify-between gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nama Pendaftar</p>
                  <p className="text-[14px] font-bold text-gray-900 mt-0.5">{result.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">Ref: {result.registration_number}</p>
                </div>
                
                {/* Status Badges */}
                {result.status === 'pending' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock size={12} /> Menunggu Ditinjau
                  </span>
                )}
                {result.status === 'revision_required' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <AlertTriangle size={12} /> Perlu Revisi
                  </span>
                )}
                {result.status === 'approved' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} /> Disetujui
                  </span>
                )}
                {result.status === 'rejected' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                    <XCircle size={12} /> Ditolak
                  </span>
                )}
              </div>

              {/* Pending message */}
              {result.status === 'pending' && (
                <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-2xl text-[12.5px] text-amber-900 leading-relaxed font-medium">
                  <p className="font-bold text-amber-950 mb-1">Pengajuan Anda sedang ditinjau admin.</p>
                  <p>Proses verifikasi berkas oleh Tim HRD & Administrator RSUCL memerlukan waktu 1-3 hari kerja. Silakan periksa kembali halaman ini secara berkala.</p>
                </div>
              )}

              {/* Revision required message */}
              {result.status === 'revision_required' && (
                <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-[12.5px] text-blue-900 leading-relaxed space-y-2">
                  <p className="font-bold text-blue-950">Pengajuan Memerlukan Perbaikan Data</p>
                  {result.admin_note && (
                    <div className="bg-white p-3 rounded-xl border border-blue-200/60 font-semibold text-blue-800 text-[12px]">
                      Catatan Admin: "{result.admin_note}"
                    </div>
                  )}
                  <p className="text-[11.5px] text-blue-700">Silakan hubungi bagian HRD/Admin RSUCL untuk melengkapi perbaikan data yang diminta.</p>
                </div>
              )}

              {/* Rejected message */}
              {result.status === 'rejected' && (
                <div className="p-4 bg-red-50/70 border border-red-100 rounded-2xl text-[12.5px] text-red-900 leading-relaxed space-y-2">
                  <p className="font-bold text-red-950">Mohon Maaf, Pengajuan Pendaftaran Ditolak</p>
                  {result.admin_note && (
                    <div className="bg-white p-3 rounded-xl border border-red-200/60 font-semibold text-red-800 text-[12px]">
                      Alasan Admin: "{result.admin_note}"
                    </div>
                  )}
                </div>
              )}

              {/* Approved details & Password credentials */}
              {result.status === 'approved' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/70 border border-emerald-150 rounded-2xl space-y-3">
                    <p className="text-[13px] font-bold text-emerald-950">Selamat! Pengajuan Pendaftaran Anda Disetujui 🎉</p>
                    <p className="text-[11.5px] text-emerald-800">Akun pegawai Anda telah diaktifkan di sistem absensi RSUCL.</p>

                    <div className="grid grid-cols-2 gap-3 pt-2 text-[12px]">
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200/50">
                        <span className="text-gray-400 text-[10px] font-bold block uppercase">NIK KTP</span>
                        <span className="font-mono font-bold text-gray-800">{result.employee_code}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-emerald-200/50">
                        <span className="text-gray-400 text-[10px] font-bold block uppercase">Username Login</span>
                        <span className="font-mono font-bold text-[#16A34A]">{result.username}</span>
                      </div>
                    </div>
                  </div>

                  {/* Temporary Password Box or Changed Password Notice */}
                  {result.temp_password ? (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl space-y-3 shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Lock size={13} className="text-[#16A34A]" /> Password Sementara Anda
                        </span>
                        <span className="text-[9.5px] bg-[#16A34A]/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-[#16A34A]/30">
                          Aktif
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-950/70 p-3.5 rounded-xl border border-slate-700">
                        <span className="font-mono text-xl font-bold tracking-wider text-emerald-400">
                          {result.temp_password}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(result.temp_password)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                        >
                          {copiedPass ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedPass ? 'Tersalin' : 'Salin'}</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-normal font-medium">
                        {result.password_note || 'Ini password sementara Anda. Anda bisa login memakainya kapan saja, dan bisa menggantinya sendiri lewat halaman Profil setelah login.'}
                      </p>

                      {onGoToLogin && (
                        <button
                          type="button"
                          onClick={onGoToLogin}
                          className="w-full py-2.5 bg-white text-slate-900 font-bold rounded-xl text-[12.5px] hover:bg-slate-100 transition-colors shadow-sm cursor-pointer mt-2"
                        >
                          Masuk Sekarang ke Aplikasi
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-[12px] text-slate-700 leading-relaxed font-medium">
                      <p className="font-bold text-slate-900 mb-1">Status Kata Sandi</p>
                      <p>{result.password_note || 'Password sudah pernah diganti, silakan gunakan password baru Anda. Kalau lupa, hubungi admin untuk reset.'}</p>
                      {onGoToLogin && (
                        <button
                          type="button"
                          onClick={onGoToLogin}
                          className="mt-3 px-4 py-2 bg-[#16A34A] text-white font-bold rounded-xl text-[12px] hover:bg-[#0d9240] transition-colors cursor-pointer"
                        >
                          Ke Halaman Login
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
