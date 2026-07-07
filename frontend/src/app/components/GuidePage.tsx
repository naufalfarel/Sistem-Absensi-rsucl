import { useState } from 'react';
import {
  BookOpen,
  MapPin,
  LogIn,
  LogOut,
  Calendar,
  Home,
  History,
  Bell,
  User,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Info,
  Smartphone,
  Clock,
  HelpCircle,
  Navigation,
  ClipboardList,
  FileText,
  Paperclip,
  Send,
  Eye,
  WifiOff,
  CircleDot,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────── */
type TipType = 'info' | 'warning' | 'success';

interface Step {
  icon: typeof BookOpen;
  title: string;
  desc: string;
}

interface Tip {
  type: TipType;
  text: string;
}

interface MenuItem {
  icon: typeof Home;
  label: string;
  desc: string;
}

interface Section {
  id: string;
  icon: typeof BookOpen;
  title: string;
  subtitle: string;
  steps?: Step[];
  tips?: Tip[];
  menuItems?: MenuItem[];
}

/* ─── Content ────────────────────────────────────────────────── */
const sections: Section[] = [
  {
    id: 'checkin',
    icon: LogIn,
    title: 'Cara Check-In (Absen Masuk)',
    subtitle: 'Langkah melakukan absensi masuk harian',
    steps: [
      { icon: Smartphone,    title: 'Buka Menu Absensi',     desc: 'Ketuk menu "Absensi" di sidebar (desktop) atau navbar bawah (mobile). Pastikan koneksi internet dan GPS aktif.' },
      { icon: Navigation,    title: 'Izinkan Akses Lokasi',   desc: 'Saat pertama kali, browser akan meminta izin lokasi. Pilih "Izinkan" agar GPS dapat mendeteksi posisi Anda.' },
      { icon: MapPin,        title: 'Verifikasi Posisi',       desc: 'Sistem menampilkan peta dan status lokasi Anda. Pastikan status menunjukkan "Dalam Area RSUCL".' },
      { icon: LogIn,         title: 'Tekan Tombol Check-In',  desc: 'Jika lokasi sudah terverifikasi, tekan tombol "Check In". Waktu dan lokasi dicatat otomatis.' },
      { icon: CheckCircle2,  title: 'Konfirmasi Berhasil',    desc: 'Notifikasi akan muncul menandakan check-in berhasil. Jam masuk tampil di dashboard.' },
    ],
    tips: [
      { type: 'warning', text: 'Check-in hanya bisa dilakukan sekali per hari dalam radius yang ditentukan admin.' },
      { type: 'info',    text: 'Jika GPS tidak akurat, aktifkan "High Accuracy" di pengaturan lokasi perangkat Anda.' },
    ],
  },
  {
    id: 'checkout',
    icon: LogOut,
    title: 'Cara Check-Out (Absen Pulang)',
    subtitle: 'Langkah melakukan absensi pulang',
    steps: [
      { icon: Smartphone,   title: 'Buka Menu Absensi',      desc: 'Kembali ke menu "Absensi". Setelah check-in, tombol berganti menjadi "Check Out".' },
      { icon: MapPin,       title: 'Pastikan Dalam Area',     desc: 'Anda harus berada di dalam radius area RSUCL saat melakukan check-out, sama seperti check-in.' },
      { icon: LogOut,       title: 'Tekan Tombol Check-Out',  desc: 'Tekan tombol "Check Out". Sistem mencatat jam kepulangan Anda.' },
      { icon: Eye,          title: 'Lihat Ringkasan',         desc: 'Setelah check-out, dashboard menampilkan ringkasan kehadiran hari ini termasuk total jam kerja.' },
    ],
    tips: [
      { type: 'success', text: 'Pastikan selalu melakukan check-out sebelum meninggalkan area kerja.' },
      { type: 'warning', text: 'Jika lupa check-out, hubungi admin HRD untuk koreksi data kehadiran.' },
    ],
  },
  {
    id: 'leave',
    icon: Calendar,
    title: 'Cara Mengajukan Izin / Cuti',
    subtitle: 'Langkah pengajuan izin atau cuti melalui aplikasi',
    steps: [
      { icon: User,          title: 'Buka Menu Profil',       desc: 'Masuk ke menu "Profil". Scroll ke bawah untuk menemukan bagian pengajuan izin/cuti.' },
      { icon: ClipboardList, title: 'Pilih Jenis Izin',       desc: 'Pilih jenis permohonan: Cuti Tahunan, Izin Sakit, Izin Mendadak, atau jenis lainnya sesuai kebutuhan.' },
      { icon: Calendar,      title: 'Isi Tanggal & Alasan',   desc: 'Tentukan tanggal mulai dan selesai. Tuliskan alasan dengan jelas pada kolom keterangan.' },
      { icon: Send,          title: 'Kirim Permohonan',       desc: 'Tekan tombol "Ajukan". Permohonan dikirim untuk disetujui.' },
      { icon: Bell,          title: 'Pantau Status',          desc: 'Status permohonan (Menunggu/Disetujui/Ditolak) dapat dipantau di menu Notifikasi atau Riwayat.' },
    ],
    tips: [
      { type: 'info',    text: 'Ajukan cuti minimal H-3 agar ada waktu bagi atasan untuk menyetujui permohonan.' },
      { type: 'warning', text: 'Kuota cuti tahunan terbatas. Pantau sisa cuti Anda di halaman Profil.' },
    ],
  },
  {
    id: 'gps',
    icon: Navigation,
    title: 'Cara Membaca Status GPS / Lokasi',
    subtitle: 'Memahami indikator lokasi di halaman Absensi',
    steps: [
      { icon: CheckCircle2, title: 'Dalam Area',          desc: 'Indikator hijau "Dalam Area RSUCL" berarti posisi Anda terdeteksi dalam radius yang diizinkan. Absensi dapat dilakukan.' },
      { icon: CircleDot,    title: 'Di Luar Area',        desc: 'Indikator merah berarti Anda berada di luar radius. Anda perlu berpindah ke lokasi yang sesuai terlebih dahulu.' },
      { icon: Clock,        title: 'Memuat Lokasi',       desc: 'Indikator kuning berarti GPS sedang mendeteksi posisi. Tunggu beberapa saat hingga status berubah.' },
      { icon: WifiOff,      title: 'GPS Tidak Tersedia',  desc: 'Jika GPS gagal: (1) pastikan izin lokasi browser sudah diberikan, (2) GPS perangkat aktif, (3) Anda tidak menggunakan VPN.' },
    ],
    tips: [
      { type: 'info',    text: 'Akurasi GPS lebih baik di area terbuka dibanding dalam gedung dengan banyak penghalang.' },
      { type: 'warning', text: 'Jangan gunakan VPN atau aplikasi pemalsuan lokasi — dapat mengakibatkan pemblokiran akun.' },
      { type: 'success', text: 'Gunakan browser Chrome atau Firefox untuk hasil GPS yang paling akurat.' },
    ],
  },
  {
    id: 'menu',
    icon: Smartphone,
    title: 'Penjelasan Menu Sidebar',
    subtitle: 'Fungsi setiap menu yang tersedia di aplikasi',
    menuItems: [
      { icon: Home,      label: 'Beranda',   desc: 'Halaman utama yang menampilkan ringkasan kehadiran hari ini, info shift, notifikasi terbaru, dan aksi cepat.' },
      { icon: MapPin,    label: 'Absensi',   desc: 'Halaman untuk melakukan check-in dan check-out, dilengkapi peta interaktif dan status GPS real-time.' },
      { icon: History,   label: 'Riwayat',   desc: 'Melihat rekap kehadiran bulanan termasuk status hadir, terlambat, izin, dan filter berdasarkan bulan/tahun.' },
      { icon: Bell,      label: 'Notifikasi',desc: 'Pusat pemberitahuan untuk approval izin, pengumuman shift, dan informasi penting dari admin.' },
      { icon: User,      label: 'Profil',    desc: 'Kelola data diri, ganti foto profil, lihat sisa cuti, dan ajukan permohonan izin/cuti.' },
      { icon: BookOpen,  label: 'Panduan',   desc: 'Halaman ini — panduan lengkap penggunaan seluruh fitur aplikasi.' },
    ],
  },
];

/* ─── Sub-components ─────────────────────────────────────────── */
function TipBox({ type, text }: { type: TipType; text: string }) {
  const map = {
    info:    { Icon: Info,          color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'Info' },
    warning: { Icon: AlertTriangle, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', label: 'Perhatian' },
    success: { Icon: CheckCircle2,  color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', label: 'Tips' },
  };
  const { Icon, color, bg, border, label } = map[type];

  return (
    <div
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-[12px] leading-relaxed"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <Icon size={13} style={{ color }} className="mt-0.5 flex-shrink-0" />
      <span style={{ color }}>
        <span className="font-semibold">{label}:</span> {text}
      </span>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export function GuidePage() {
  const [openSection, setOpenSection] = useState<string | null>('checkin');

  const toggle = (id: string) =>
    setOpenSection(prev => (prev === id ? null : id));

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#16A34A] flex items-center justify-center">
            <BookOpen size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-gray-900">Panduan Penggunaan</h1>
            <p className="text-[12px] text-gray-400">Sistem Absensi RSUCL · Panduan Pegawai</p>
          </div>
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed border-l-2 border-[#16A34A]/30 pl-3">
          Ikuti langkah-langkah di bawah ini untuk menggunakan setiap fitur dengan benar.
          Klik judul bagian untuk membuka panduan.
        </p>
      </div>

      {/* ── Sections ── */}
      <div className="space-y-2">
        {sections.map(section => {
          const Icon = section.icon;
          const isOpen = openSection === section.id;

          return (
            <div
              key={section.id}
              id={`guide-${section.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Header button */}
              <button
                onClick={() => toggle(section.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isOpen ? 'bg-[#16A34A]' : 'bg-gray-100'}`}>
                    <Icon size={15} className={isOpen ? 'text-white' : 'text-gray-500'} />
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-gray-800">{section.title}</p>
                    <p className="text-[11px] text-gray-400">{section.subtitle}</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {isOpen
                    ? <ChevronUp size={13} className="text-gray-500" />
                    : <ChevronDown size={13} className="text-gray-400" />
                  }
                </div>
              </button>

              {/* Body */}
              {isOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">

                  {/* Steps */}
                  {section.steps && (
                    <div className="mt-4 space-y-0">
                      {section.steps.map((step, i) => {
                        const StepIcon = step.icon;
                        const isLast = i === section.steps!.length - 1;
                        return (
                          <div key={i} className="flex items-start gap-4">
                            {/* Timeline */}
                            <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                              <div className="w-7 h-7 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center">
                                <StepIcon size={13} className="text-gray-400" />
                              </div>
                              {!isLast && (
                                <div className="w-px flex-1 bg-gray-100 mt-1 min-h-[24px]" />
                              )}
                            </div>
                            {/* Content */}
                            <div className={`flex-1 ${!isLast ? 'pb-4' : ''}`}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-medium text-gray-400">
                                  {i + 1}.
                                </span>
                                <p className="text-[13px] font-semibold text-gray-800">{step.title}</p>
                              </div>
                              <p className="text-[12px] text-gray-500 leading-relaxed">{step.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Menu Items */}
                  {section.menuItems && (
                    <div className="mt-4 divide-y divide-gray-50">
                      {section.menuItems.map((item, i) => {
                        const MIcon = item.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <MIcon size={13} className="text-gray-500" />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-gray-800">{item.label}</p>
                              <p className="text-[12px] text-gray-500 leading-relaxed mt-0.5">{item.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tips */}
                  {section.tips && section.tips.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {section.tips.map((tip, i) => (
                        <TipBox key={i} type={tip.type} text={tip.text} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Version note */}
      <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-gray-300">
        <FileText size={10} />
        <span>Panduan v1.0 · Sistem Absensi RSUCL · Diperbarui Juli 2026</span>
      </div>
    </div>
  );
}
