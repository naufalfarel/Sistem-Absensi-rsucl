import { useState } from 'react';
import { Eye, EyeOff, Lock, User, CreditCard, MapPin, Clock, BarChart3, Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

interface LoginPageProps {
  onLogin: (nip: string, username: string, password: string) => 'ok' | 'wrong';
  onBack?: () => void;
}

export function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [nip, setNip] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!nip.trim() || !username.trim() || !password) {
      setError('NIP, Username, dan Password wajib diisi.');
      return;
    }
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      const result = onLogin(nip, username, password);
      setIsLoading(false);
      if (result === 'wrong') {
        setError('NIP, Username, atau Password tidak sesuai. Hubungi administrator jika lupa akun.');
      }
    }, 800);
  };

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
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100 flex-shrink-0 overflow-hidden">
              <img src={logoImg} alt="Logo RSUCL" className="w-11 h-11 object-contain" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-gray-900 leading-tight">Sistem Absensi Karyawan</div>
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

            {/* NIP */}
            <div className="mb-4">
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">NIP / ID Pegawai</label>
              <div className="relative">
                <CreditCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Masukkan NIP Anda"
                  value={nip}
                  onChange={e => { setNip(e.target.value); setError(''); }}
                  onKeyDown={handleKey}
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-[14px] bg-gray-50 focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${error ? 'border-red-200 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-[#16A34A] focus:ring-[#16A34A]/15'}`}
                />
              </div>
            </div>

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
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-[14px] bg-gray-50 focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${error ? 'border-red-200 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-[#16A34A] focus:ring-[#16A34A]/15'}`}
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
                  className={`w-full pl-10 pr-10 py-2.5 border rounded-xl text-[14px] bg-gray-50 focus:outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${error ? 'border-red-200 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-[#16A34A] focus:ring-[#16A34A]/15'}`}
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
              <button className="text-[13px] text-[#16A34A] font-medium hover:text-[#0B7A36] transition-colors">
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
            © 2025 RSUCL · Sistem Absensi Digital v2.0.1
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
              <img src={logoImg} alt="Logo RSUCL" className="w-24 h-24 object-contain drop-shadow-lg" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">Absensi Digital RSUCL</h2>
          <p className="text-[13px] text-white/75 text-center leading-relaxed max-w-[280px] mb-8">
            Sistem absensi resmi Rumah Sakit Umum Cempaka Lima, Banda Aceh.
          </p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
            {[
              { icon: MapPin,    label: 'GPS & Geofencing', desc: 'Area RS terverifikasi' },
              { icon: Clock,     label: 'Real-time',         desc: 'Pemantauan langsung' },
              { icon: BarChart3, label: 'Laporan Otomatis',  desc: 'PDF & Excel export' },
              { icon: Shield,    label: 'Data Aman',         desc: 'Terenkripsi penuh' },
            ].map(({ icon: Icon, label, desc }, i) => (
              <div key={i} className="bg-white/12 rounded-xl p-3.5 backdrop-blur-sm border border-white/10">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center mb-2">
                  <Icon size={15} className="text-white" />
                </div>
                <div className="text-[13px] font-semibold leading-tight">{label}</div>
                <div className="text-[11px] text-white/65 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
