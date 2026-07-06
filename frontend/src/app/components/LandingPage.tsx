import { useState, useEffect } from 'react';
import {
  MapPin, Clock, Shield, Smartphone, ChevronRight,
  CheckCircle2, BarChart3, Bell, ArrowRight, Navigation, Camera, HelpCircle, ZoomIn, Key
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import rsPhoto from '../../imports/2328bb14-b47f-4ac6-a2be-6db33f64fce3_980x381.png';

interface LandingPageProps {
  onEnter: () => void;
}

// Features array removed as per requirement.


export function LandingPage({ onEnter }: LandingPageProps) {
  const { logoUrl } = useAuth();
  const [time, setTime] = useState(new Date());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    setTimeout(() => setVisible(true), 100);
    return () => clearInterval(t);
  }, []);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dateStr = `${days[time.getDay()]}, ${time.getDate()} ${months[time.getMonth()]} ${time.getFullYear()}`;
  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-[#F5F7FA] overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900 leading-tight">RSUCL</p>
              <p className="text-[10px] text-gray-400">Banda Aceh</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[12px] text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            <Clock size={12} className="text-[#16A34A]" />
            <span className="font-mono font-medium text-gray-700">{timeStr}</span>
            <span className="text-gray-300 mx-1">·</span>
            <span>{dateStr}</span>
          </div>
          <button
            onClick={onEnter}
            className="flex items-center gap-2 px-4 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm shadow-green-200 active:scale-95"
          >
            Masuk <ChevronRight size={14} />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden pt-28 pb-16">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B7A36] via-[#16A34A] to-[#15803d]" />

        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full border-[80px] border-white/5 translate-x-48 -translate-y-48" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full border-[60px] border-white/5 -translate-x-32 translate-y-40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-white/5" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        <div className={`relative z-10 max-w-5xl mx-auto px-6 text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Logo badge */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shadow-2xl">
              <img src={logoUrl || logoImg} alt="Logo RSUCL" className="w-18 h-18 object-contain drop-shadow-lg" style={{ width: '72px', height: '72px' }} />
            </div>
          </div>

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
            <span className="text-white/90 text-[12px] font-medium">Sistem Absensi Digital · Versi 1.0</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 tracking-tight">
            Selamat Datang di<br />
            <span className="text-green-300">Sistem Absensi</span>
          </h1>
          <h2 className="text-xl md:text-2xl font-medium text-white/80 mb-3">
            Rumah Sakit Umum Cempaka Lima
          </h2>

          {/* Location */}
          <div className="inline-flex items-start gap-2 text-white/70 text-[13px] mb-10 max-w-sm mx-auto">
            <MapPin size={14} className="text-green-300 mt-0.5 flex-shrink-0" />
            <span>Jl. Politeknik No. 23, Desa Beurawe, Kec. Kuta Alam, Kota Banda Aceh</span>
          </div>

          {/* CTA Button */}
          <div className="flex justify-center mb-14">
            <button
              onClick={onEnter}
              className="flex items-center gap-2.5 px-10 py-4 bg-white text-[#16A34A] rounded-2xl text-[15px] font-bold hover:bg-green-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:scale-95"
            >
              <CheckCircle2 size={18} />
              Mulai Absensi Sekarang
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Floating hospital photo */}
          <div className="relative max-w-3xl mx-auto">
            {/* Glow behind card */}
            <div className="absolute -inset-3 bg-white/10 rounded-3xl blur-xl" />
            <div className="relative rounded-2xl overflow-hidden border-2 border-white/25 shadow-2xl">
              <img
                src={rsPhoto}
                alt="Gedung Rumah Sakit Umum Cempaka Lima"
                className="w-full object-cover"
                style={{ height: '220px', objectPosition: 'center 30%' }}
              />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 px-5 py-4 flex items-end justify-between">
                <div>
                  <p className="text-white font-semibold text-[14px] drop-shadow">Gedung RSU Cempaka Lima</p>
                  <p className="text-white/75 text-[12px] flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-green-300" />
                    Jl. Politeknik No. 23, Banda Aceh
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-[#16A34A] rounded-full px-3 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <span className="text-white text-[11px] font-semibold">GPS Aktif</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40">
          <span className="text-[11px]">Scroll untuk info lebih</span>
          <div className="w-5 h-8 border border-white/30 rounded-full flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── LOCATION SECTION ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[12px] font-semibold text-[#16A34A] bg-green-50 px-3 py-1 rounded-full uppercase tracking-wider">Lokasi Kami</span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-3 mb-2">Rumah Sakit Umum Cempaka Lima</h2>
            <p className="text-[14px] text-gray-500">Melayani masyarakat Kota Banda Aceh dan sekitarnya</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
            {/* Photo + map stacked */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              {/* Real hospital photo */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-md flex-1" style={{ minHeight: '200px' }}>
                <img
                  src={rsPhoto}
                  alt="Gedung RSU Cempaka Lima Banda Aceh"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center 30%', minHeight: '200px', maxHeight: '240px' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                {/* Top badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                  <img src={logoUrl || logoImg} alt="logo" className="w-5 h-5 object-contain" />
                  <span className="text-[11px] font-bold text-gray-800">RSU Cempaka Lima</span>
                </div>
                {/* Bottom label */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
                  <p className="text-white font-semibold text-[14px]">Gedung Utama RSUCL</p>
                  <p className="text-white/75 text-[12px] flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-green-300" />
                    Jl. Politeknik No. 23, Kec. Kuta Alam, Banda Aceh
                  </p>
                </div>
              </div>
            </div>

            {/* Info card */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-[#F5F7FA] rounded-2xl p-5 border border-gray-100">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#16A34A] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img src={logoUrl || logoImg} alt="RSUCL" className="w-9 h-9 object-contain" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">RSU Cempaka Lima</p>
                    <p className="text-[12px] text-gray-500">Kota Banda Aceh</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                      <MapPin size={13} className="text-[#16A34A]" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">Alamat</p>
                      <p className="text-[13px] text-gray-800 leading-snug mt-0.5">
                        Jl. Politeknik No. 23<br />
                        Desa Beurawe, Kec. Kuta Alam<br />
                        Kota Banda Aceh, Aceh
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                      <Clock size={13} className="text-[#16A34A]" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">Jam Operasional</p>
                      <p className="text-[13px] text-gray-800 mt-0.5">Senin – Jumat: 08:30 – 17:00</p>
                      <p className="text-[13px] text-gray-800">Sabtu: 08:30 – 13:00</p>
                      <p className="text-[12px] text-gray-500">IGD: 24 Jam</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
                      <Navigation size={13} className="text-[#16A34A]" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 font-medium">Verifikasi Area GPS</p>
                      <p className="text-[13px] text-gray-800 mt-0.5">Wajib berada di area lokasi RSU Cempaka Lima</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={onEnter}
                className="w-full py-3.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-2xl text-[14px] font-semibold transition-all shadow-md shadow-green-200/60 flex items-center justify-center gap-2 active:scale-95"
              >
                <CheckCircle2 size={16} />
                Masuk ke Sistem Absensi
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CARA PEMAKAIAN / PANDUAN PENGGUNAAN ── */}
      <section className="py-20 px-6 bg-[#F8FAFC] border-t border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="text-[11px] font-bold text-[#16A34A] bg-[#EFFDF4] border border-green-150 px-3 py-1 rounded-full uppercase tracking-wider">
              Alur Kehadiran
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mt-4 tracking-tight">
              Panduan Langkah Absensi RSUCL
            </h2>
            <p className="text-[14px] text-gray-500 max-w-xl mx-auto mt-3 leading-relaxed">
              Ikuti 4 langkah mudah berikut untuk melakukan pencatatan kehadiran harian secara tepat dan aman melalui perangkat Anda.
            </p>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <span className="absolute -right-2 -bottom-6 text-7xl font-extrabold text-gray-50 group-hover:text-gray-100/70 transition-colors pointer-events-none select-none font-mono">
                01
              </span>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-[#16A34A] group-hover:bg-[#16A34A] group-hover:text-white transition-all duration-300">
                    <Smartphone size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 group-hover:text-[#16A34A] transition-colors font-mono">LANGKAH 01</span>
                </div>
                <h3 className="text-[15px] font-bold text-gray-950 mb-2">Masuk ke Aplikasi</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed z-10 relative">
                  Buka aplikasi absensi di browser handphone Anda, lalu masuk menggunakan <strong>Username</strong> dan <strong>Kata Sandi</strong> yang telah terdaftar.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <span className="absolute -right-2 -bottom-6 text-7xl font-extrabold text-gray-50 group-hover:text-gray-100/70 transition-colors pointer-events-none select-none font-mono">
                02
              </span>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300">
                    <MapPin size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 group-hover:text-[#2563EB] transition-colors font-mono">LANGKAH 02</span>
                </div>
                <h3 className="text-[15px] font-bold text-gray-950 mb-2">Aktifkan GPS / Lokasi</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed z-10 relative">
                  Nyalakan fitur Lokasi/GPS pada HP Anda. Pastikan Anda berada secara fisik di lokasi RSU Cempaka Lima.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <span className="absolute -right-2 -bottom-6 text-7xl font-extrabold text-gray-50 group-hover:text-gray-100/70 transition-colors pointer-events-none select-none font-mono">
                03
              </span>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-[#7C3AED] group-hover:bg-[#7C3AED] group-hover:text-white transition-all duration-300">
                    <Camera size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 group-hover:text-[#7C3AED] transition-colors font-mono">LANGKAH 03</span>
                </div>
                <h3 className="text-[15px] font-bold text-gray-950 mb-2">Izinkan Akses Kamera</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed z-10 relative">
                  Browser akan meminta izin mengakses kamera HP. Pilih "Izinkan" (Allow) untuk mengambil foto selfie verifikasi wajah.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
              <span className="absolute -right-2 -bottom-6 text-7xl font-extrabold text-gray-50 group-hover:text-gray-100/70 transition-colors pointer-events-none select-none font-mono">
                04
              </span>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-[#D97706] group-hover:bg-[#D97706] group-hover:text-white transition-all duration-300">
                    <CheckCircle2 size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 group-hover:text-[#D97706] transition-colors font-mono">LANGKAH 04</span>
                </div>
                <h3 className="text-[15px] font-bold text-gray-950 mb-2">Pilih Aksi Absensi</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed z-10 relative">
                  Ketuk tombol "Absen Masuk (Check-In)" saat memulai dinas shift Anda, atau "Absen Pulang (Check-Out)" jika jam kerja Anda telah berakhir.
                </p>
              </div>
            </div>
          </div>

          {/* Help & Troubleshooting Section */}
          <div className="mt-20">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                Pusat Bantuan & Pemecahan Masalah
              </h3>
              <p className="text-[13px] text-gray-500 mt-2">
                Solusi cepat untuk kendala yang sering ditemui oleh staf saat melakukan absensi harian
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FAQ 1 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-[#16A34A] flex-shrink-0">
                  <ZoomIn size={18} />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-gray-900">Ukuran Teks / Tulisan Terlalu Kecil?</h4>
                  <p className="text-[12px] text-gray-500 leading-relaxed mt-2">
                    Gunakan gerakan mencubit layar dengan dua jari (zoom-in) untuk memperbesar halaman absensi, atau atur tingkat zoom huruf di pengaturan browser Google Chrome / Safari Anda.
                  </p>
                </div>
              </div>

              {/* FAQ 2 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-[#16A34A] flex-shrink-0">
                  <Camera size={18} />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-gray-900">Kamera Tidak Dapat Diakses?</h4>
                  <p className="text-[12px] text-gray-500 leading-relaxed mt-2">
                    Browser Anda memerlukan izin kamera HP. Jika tidak sengaja memilih blokir, ketuk ikon gembok di sebelah kiri kolom alamat web (URL) browser Anda, kemudian aktifkan kembali opsi Kamera menjadi "Izinkan" (Allow).
                  </p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-[#16A34A] flex-shrink-0">
                  <Navigation size={18} />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-gray-900">Lokasi GPS Di luar Geofence RSUCL?</h4>
                  <p className="text-[12px] text-gray-500 leading-relaxed mt-2">
                    Pastikan GPS di HP Anda menyala dengan mode akurasi tinggi. Apabila sinyal GPS lambat terdeteksi, berdirilah di dekat jendela, koridor terbuka, atau teras gedung rumah sakit beberapa saat agar lokasi terdeteksi akurat.
                  </p>
                </div>
              </div>

              {/* FAQ 4 */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-[#16A34A] flex-shrink-0">
                  <Key size={18} />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-gray-900">Lupa Password / Akun Terkunci?</h4>
                  <p className="text-[12px] text-gray-500 leading-relaxed mt-2">
                    Demi keamanan data, silakan hubungi langsung unit Kepegawaian (Administrasi IT RSU Cempaka Lima) untuk mereset kata sandi akun Anda kembali ke bawaan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* ── FOOTER ── */}
      <footer className="bg-gradient-to-br from-[#0B7A36] to-[#16A34A] text-white py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center overflow-hidden">
                  <img src={logoUrl || logoImg} alt="RSUCL" className="w-9 h-9 object-contain" />
                </div>
                <div>
                  <p className="text-[14px] font-bold">RSU Cempaka Lima</p>
                  <p className="text-[11px] text-white/65">Banda Aceh</p>
                </div>
              </div>
              <p className="text-[13px] text-white/70 leading-relaxed">
                Sistem absensi digital resmi Rumah Sakit Umum Cempaka Lima untuk mendukung pengelolaan SDM yang profesional dan efisien.
              </p>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-white/80 mb-3 uppercase tracking-wider">Alamat</p>
              <div className="flex items-start gap-2 text-[13px] text-white/70">
                <MapPin size={14} className="text-green-300 mt-0.5 flex-shrink-0" />
                <p>Jl. Politeknik No. 23<br />Desa Beurawe, Kec. Kuta Alam<br />Kota Banda Aceh, Aceh</p>
              </div>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-white/80 mb-3 uppercase tracking-wider">Akses Sistem</p>
              <button
                onClick={onEnter}
                className="w-full py-3 bg-white text-[#16A34A] rounded-xl text-[13px] font-bold hover:bg-green-50 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle2 size={15} />
                Masuk ke Sistem
              </button>
              <p className="text-[11px] text-white/50 mt-3 text-center">Khusus karyawan RSUCL yang terdaftar</p>
            </div>
          </div>

          <div className="border-t border-white/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[12px] text-white/50">© 2026 Rumah Sakit Umum Cempaka Lima. Hak cipta dilindungi.</p>
            <p className="text-[12px] text-white/50">Sistem Absensi Digital v1.0.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
