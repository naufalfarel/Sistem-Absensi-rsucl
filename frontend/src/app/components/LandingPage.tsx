import { useState, useEffect } from 'react';
import {
  MapPin, Clock, Shield, Smartphone, ChevronRight,
  CheckCircle2, BarChart3, Bell, ArrowRight, Navigation
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import rsPhoto from '../../imports/2328bb14-b47f-4ac6-a2be-6db33f64fce3_980x381.png';

interface LandingPageProps {
  onEnter: () => void;
}

const features = [
  {
    icon: MapPin,
    color: '#16A34A',
    bg: '#F0FDF4',
    title: 'Absensi Berbasis GPS',
    desc: 'Verifikasi lokasi otomatis dengan teknologi geofencing dalam radius area rumah sakit.',
  },
  {
    icon: Clock,
    color: '#2563EB',
    bg: '#EFF6FF',
    title: 'Real-Time Monitoring',
    desc: 'Pantau kehadiran karyawan secara langsung kapanpun dan dimanapun oleh manajemen.',
  },
  {
    icon: BarChart3,
    color: '#7C3AED',
    bg: '#F5F3FF',
    title: 'Laporan Otomatis',
    desc: 'Rekap kehadiran harian, mingguan, dan bulanan dapat diekspor ke PDF maupun Excel.',
  },
  {
    icon: Bell,
    color: '#EA580C',
    bg: '#FFF7ED',
    title: 'Notifikasi Instan',
    desc: 'Pengingat jam masuk, perubahan jadwal, dan pengumuman rumah sakit secara real-time.',
  },
  {
    icon: Shield,
    color: '#0891B2',
    bg: '#ECFEFF',
    title: 'Data Aman & Terenkripsi',
    desc: 'Seluruh data karyawan dan rekam absensi tersimpan aman dengan sistem keamanan berlapis.',
  },
  {
    icon: Smartphone,
    color: '#D97706',
    bg: '#FFFBEB',
    title: 'Akses Multi-Platform',
    desc: 'Dapat diakses dari smartphone, tablet, maupun komputer kapan saja dengan mudah.',
  },
];


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
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
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

              {/* Mini map below photo */}
              <div className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-[#e8f4e8]" style={{ height: '140px' }}>
                <div className="absolute inset-0" style={{
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`,
                  backgroundSize: '36px 36px',
                }} />
                <div className="absolute top-[40%] left-0 right-0 h-4 bg-white/75" />
                <div className="absolute top-[72%] left-0 right-0 h-2.5 bg-white/50" />
                <div className="absolute left-[28%] top-0 bottom-0 w-3.5 bg-white/75" />
                <div className="absolute left-[65%] top-0 bottom-0 w-2.5 bg-white/50" />
                <div className="absolute top-[10%] left-[8%] w-14 h-9 bg-green-300/25 rounded-lg" />
                <div className="absolute bottom-[12%] right-[10%] w-12 h-7 bg-green-300/20 rounded-lg" />
                <div className="absolute" style={{
                  top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  width: '100px', height: '100px', borderRadius: '50%',
                  border: '2px dashed #16A34A', background: 'rgba(22,163,74,0.1)',
                }} />
                <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -90%)' }}>
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#16A34A] flex items-center justify-center shadow-lg border-2 border-white overflow-hidden">
                      <img src={logoUrl || logoImg} alt="RS" className="w-7 h-7 object-contain" />
                    </div>
                    <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#16A34A] -mt-px" />
                  </div>
                </div>
                <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, 8px)' }}>
                  <div className="bg-white shadow-md rounded-lg px-2.5 py-1 text-center border border-gray-100 whitespace-nowrap">
                    <p className="text-[10px] font-bold text-gray-800">RSUCL</p>
                    <p className="text-[8px] text-gray-500">Jl. Politeknik No. 23</p>
                  </div>
                </div>
                <div className="absolute bottom-2 right-3 bg-white/80 rounded-md px-2 py-0.5 shadow-sm">
                  <span className="text-[9px] text-gray-600">Banda Aceh</span>
                </div>
                <div className="absolute top-2 right-3 flex items-center gap-1 bg-white/80 rounded-full px-2 py-0.5 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                  <span className="text-[9px] text-[#16A34A] font-semibold">GPS Live</span>
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
                      <p className="text-[11px] text-gray-400 font-medium">Radius Absensi GPS</p>
                      <p className="text-[13px] text-gray-800 mt-0.5">100 meter dari titik pusat RS</p>
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

      {/* ── FEATURES ── */}
      <section className="py-20 px-6 bg-[#F5F7FA]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[12px] font-semibold text-[#16A34A] bg-green-50 px-3 py-1 rounded-full uppercase tracking-wider">Fitur Unggulan</span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-3 mb-2">Sistem Absensi Modern & Terpercaya</h2>
            <p className="text-[14px] text-gray-500 max-w-lg mx-auto">
              Dirancang khusus untuk kebutuhan tenaga kesehatan dan staf administrasi rumah sakit.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: f.bg }}>
                  <f.icon size={18} style={{ color: f.color }} />
                </div>
                <h3 className="text-[14px] font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PHOTO BANNER ── */}
      <section className="relative overflow-hidden" style={{ height: '280px' }}>
        <img
          src={rsPhoto}
          alt="RSU Cempaka Lima Banda Aceh"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 25%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent" />
        <div className="absolute inset-0 flex items-center px-8 md:px-16">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center overflow-hidden">
                <img src={logoUrl || logoImg} alt="logo" className="w-7 h-7 object-contain" />
              </div>
              <span className="text-white/80 text-[12px] font-medium uppercase tracking-wider">RSU Cempaka Lima</span>
            </div>
            <h3 className="text-white text-2xl md:text-3xl font-bold leading-tight mb-2">
              Melayani dengan Sepenuh Hati
            </h3>
            <p className="text-white/75 text-[14px] leading-relaxed mb-4">
              Berkomitmen memberikan pelayanan kesehatan terbaik untuk masyarakat Kota Banda Aceh dan sekitarnya sejak 2010.
            </p>
            <div className="flex items-center gap-2 text-white/70 text-[12px]">
              <MapPin size={13} className="text-green-300 flex-shrink-0" />
              <span>Jl. Politeknik No. 23, Desa Beurawe, Kec. Kuta Alam, Banda Aceh</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCHEDULE SECTION ── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-[12px] font-semibold text-[#16A34A] bg-green-50 px-3 py-1 rounded-full uppercase tracking-wider">Jadwal Kerja</span>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-3">Jadwal Absensi RSUCL</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                day: 'Senin – Jumat',
                masuk: '08:30',
                pulang: '17:00',
                note: 'Istirahat 12:30 – 13:30',
                color: '#16A34A', bg: 'from-[#16A34A] to-[#0d9240]',
                emoji: '📅',
              },
              {
                day: 'Sabtu',
                masuk: '08:30',
                pulang: '13:00',
                note: 'Setengah hari kerja',
                color: '#2563EB', bg: 'from-[#2563EB] to-[#1d4ed8]',
                emoji: '📆',
              },
              {
                day: 'Minggu & Libur',
                masuk: '—',
                pulang: '—',
                note: 'Hari libur nasional',
                color: '#6B7280', bg: 'from-[#6B7280] to-[#4B5563]',
                emoji: '🌴',
              },
            ].map((s, i) => (
              <div key={i} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-5 text-white relative overflow-hidden`}>
                <div className="absolute top-0 right-0 text-5xl opacity-10 -translate-y-1 translate-x-1">{s.emoji}</div>
                <p className="text-[13px] font-semibold text-white/80 mb-3">{s.day}</p>
                {s.masuk !== '—' ? (
                  <>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[11px] text-white/60">Masuk</span>
                      <span className="text-2xl font-bold font-mono">{s.masuk}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-[11px] text-white/60">Pulang</span>
                      <span className="text-2xl font-bold font-mono">{s.pulang}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-3xl font-bold mb-4">Libur</p>
                )}
                <div className="text-[11px] text-white/65 bg-white/10 rounded-lg px-2.5 py-1.5 inline-block">
                  {s.note}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-800">Ketentuan Absensi</p>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Absensi hanya dapat dilakukan dalam radius 100m dari RSUCL · Check-out maksimal pukul 18:00 WIB · Sistem otomatis mencatat status tepat waktu atau terlambat.
              </p>
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
