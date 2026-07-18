import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock, User, MapPin, Clock, BarChart3, Shield, AlertCircle, ArrowLeft, CheckCircle2, X } from 'lucide-react';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { authApi } from '../../services/api';

/**
 * Interface properti untuk komponen LoginPage.
 */
interface LoginPageProps {
  // Callback untuk memicu fungsi autentikasi login di parent component
  onLogin: (password: string, username: string) => Promise<'ok' | string>;
  // Callback opsional untuk tombol kembali ke landing page utama
  onBack?: () => void;
}

/**
 * Halaman Login — Sistem Absensi RSUCL
 * 
 * Menyediakan form masuk untuk Admin dan Karyawan, serta modal ubah/reset password mandiri
 * dengan mencocokkan data NIK KTP, Username, dan Email terdaftar.
 */
export function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const { logoUrl } = useAuth();
  
  // State untuk form login utama
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // State untuk alur modal lupa password (reset password mandiri)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotForm, setForgotForm] = useState({ username: '', nik_ktp: '', email: '', newPassword: '', confirmPassword: '' });
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  /**
   * Menangani proses submit login.
   * Melakukan validasi input lokal sebelum mengirim request login ke parent/API.
   */
  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Username dan Password wajib diisi.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const result = await onLogin(password, username);
      if (result !== 'ok') {
        if (result === 'wrong') {
          setError('Username atau Password tidak sesuai. Hubungi administrator jika lupa akun.');
        } else {
          setError(result);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? 'Terjadi kesalahan sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Menangani proses submit reset password mandiri.
   * Memvalidasi kecocokan data username, nik_ktp, email, dan password baru sebelum dikirim ke backend.
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotForm.username.trim() || !forgotForm.nik_ktp.trim() || !forgotForm.email.trim() || !forgotForm.newPassword) {
      setForgotError('Semua kolom wajib diisi.');
      return;
    }
    if (forgotForm.newPassword.length < 6) {
      setForgotError('Password baru minimal 6 karakter.');
      return;
    }
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      setForgotError('Konfirmasi password tidak cocok.');
      return;
    }
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);
    try {
      const res = await authApi.forgotPassword({
        username: forgotForm.username.trim(),
        nik_ktp: forgotForm.nik_ktp.trim(),
        email: forgotForm.email.trim(),
        password: forgotForm.newPassword,
      });
      if (res.success) {
        setForgotSuccess(res.message);
        setForgotForm({ username: '', nik_ktp: '', email: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      setForgotError(err?.response?.data?.message ?? err?.message ?? 'Data tidak cocok atau terjadi kesalahan.');
    } finally {
      setForgotLoading(false);
    }
  };

  /**
   * Mengirimkan form login ketika menekan tombol Enter pada keyboard di kolom input.
   */
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── LEFT: Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F5F7FA] px-6 py-10">
        <div className="w-full max-w-[420px]">

          {/* Back to landing */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-[#16A34A] transition-colors mb-6 group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Kembali ke Beranda
            </button>
          )}

          {/* Logo & title */}
          <div className="flex items-center gap-3 mb-8">
            {logoUrl !== 'none' && (
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100 flex-shrink-0 overflow-hidden">
                <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-11 h-11 object-contain" />
              </div>
            )}
            <div>
              <div className="text-[15px] font-semibold text-gray-900 leading-tight">Sistem Absensi Pegawai</div>
              <div className="text-xs text-gray-500 mt-0.5">Rumah Sakit Umum Cempaka Lima</div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-6">
              <h1 className="text-xl font-semibold text-gray-900">Selamat Datang</h1>
              <p className="text-[13px] text-gray-500 mt-1">Masuk menggunakan akun yang diberikan administrator</p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-red-600 leading-snug">{error}</p>
              </div>
            )}



            {/* Username */}
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  onKeyDown={handleKey}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${error ? 'border-red-200 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-[#16A34A] focus:ring-[#16A34A]/15'}`}
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-5">
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={handleKey}
                  className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${error ? 'border-red-200 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-[#16A34A] focus:ring-[#16A34A]/15'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-[#16A34A] border-[#16A34A]' : 'border-gray-300 bg-white'}`}>
                  {rememberMe && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-[13px] text-gray-600">Ingat saya</span>
              </label>
              <button 
                onClick={() => setShowForgotModal(true)}
                className="text-[13px] text-[#16A34A] font-medium hover:text-[#0B7A36] transition-colors"
              >
                Lupa Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full py-3 bg-[#16A34A] hover:bg-[#0d9240] active:bg-[#0B7A36] text-white rounded-xl text-[14px] font-semibold transition-all duration-150 shadow-md shadow-green-200/60 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                  Memverifikasi...
                </span>
              ) : 'Masuk'}
            </button>

            {/* Info akun */}
            <div className="mt-5 flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Shield size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-blue-600 leading-snug">
                Akun dan password diberikan oleh Administrator RSUCL. Hubungi admin jika belum memiliki akun.
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-gray-400 mt-6">
            © 2026 RSUCL · Sistem Absensi Digital v1.0.0
          </p>
        </div>
      </div>

      {/* ── RIGHT: Panel ── */}
      <div className="hidden lg:flex w-[500px] flex-col bg-gradient-to-br from-[#16A34A] via-[#14a349] to-[#0B7A36] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full border-[40px] border-white -translate-y-24 translate-x-24" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full border-[40px] border-white translate-y-32 -translate-x-32" />
        </div>
        <div className="relative flex flex-col items-center justify-center flex-1 p-12 text-white">
          <div className="mb-7 flex items-center justify-center">
            <div className="w-32 h-32 rounded-3xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-2xl">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-24 h-24 object-contain drop-shadow-lg" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">Absensi Digital RSUCL</h2>
          <p className="text-[13px] text-white/75 text-center leading-relaxed max-w-[280px] mb-8">
            Sistem absensi resmi Rumah Sakit Umum Cempaka Lima, Banda Aceh.
          </p>
          <div className="w-full max-w-[340px] space-y-3.5">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-white/90 text-center mb-4">
              Panduan Langkah Absensi
            </h3>
            {[
              { step: '1', title: 'Masuk Akun', desc: 'Login dengan username & password Anda' },
              { step: '2', title: 'Izinkan Lokasi (GPS)', desc: 'Pastikan GPS perangkat aktif & izinkan akses lokasi saat diminta' },
              { step: '3', title: 'Ambil Foto Selfie', desc: 'Ambil foto selfie verifikasi wajah di area rumah sakit' },
              { step: '4', title: 'Ketik Lokasi & Kirim', desc: 'Ketik keterangan lokasi manual Anda saat ini, lalu tekan tombol absen sesuai jadwal' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-white/10 rounded-2xl p-4 border border-white/15 flex items-start gap-4 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-[14px] flex-shrink-0">
                  {step}
                </div>
                <div>
                  <h4 className="text-[14px] font-bold leading-none">{title}</h4>
                  <p className="text-[11px] text-white/70 mt-1.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowForgotModal(false); setForgotError(''); setForgotSuccess(''); }} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm border border-gray-100">
            <button 
              onClick={() => { setShowForgotModal(false); setForgotError(''); setForgotSuccess(''); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3 text-[#16A34A]">
                <Lock size={22} />
              </div>
              <h3 className="text-[16px] font-bold text-gray-900">Ubah Kata Sandi Pegawai</h3>
              <p className="text-[11px] text-gray-500 mt-1">Verifikasi identitas Anda untuk mengubah kata sandi secara mandiri</p>
            </div>

            {forgotError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4 text-red-600 text-[11px] leading-snug">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 mb-4 text-green-700 text-[11px] leading-snug">
                <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Username Login</label>
                <input 
                  type="text" 
                  placeholder="Masukkan username" 
                  value={forgotForm.username} 
                  onChange={e => setForgotForm({ ...forgotForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">NIK KTP</label>
                <input 
                  type="text" 
                  placeholder="Masukkan NIK KTP Anda" 
                  value={forgotForm.nik_ktp} 
                  onChange={e => setForgotForm({ ...forgotForm, nik_ktp: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Alamat Email Terdaftar</label>
                <input 
                  type="email" 
                  placeholder="Masukkan email Anda" 
                  value={forgotForm.email} 
                  onChange={e => setForgotForm({ ...forgotForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Password Baru</label>
                <input 
                  type="password" 
                  placeholder="Minimal 6 karakter" 
                  value={forgotForm.newPassword} 
                  onChange={e => setForgotForm({ ...forgotForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Konfirmasi Password Baru</label>
                <input 
                  type="password" 
                  placeholder="Ulangi password baru" 
                  value={forgotForm.confirmPassword} 
                  onChange={e => setForgotForm({ ...forgotForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => { setShowForgotModal(false); setForgotError(''); setForgotSuccess(''); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={forgotLoading}
                  className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-bold shadow-md shadow-green-200/60 disabled:opacity-75"
                >
                  {forgotLoading ? 'Memproses...' : 'Ubah Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
