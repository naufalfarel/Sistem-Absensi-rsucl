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
  FileText,
  Send,
  Eye,
  WifiOff,
  CircleDot,
  Navigation,
  ClipboardList,
  Paperclip,
  Car,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

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
      { icon: Smartphone,    title: 'Buka Menu Absensi',    desc: 'Ketuk menu "Absensi" di sidebar (desktop) atau navbar bawah (mobile). Pastikan koneksi internet dan GPS aktif.' },
      { icon: Navigation,    title: 'Izinkan Akses Lokasi',  desc: 'Saat pertama kali, browser akan meminta izin lokasi. Pilih "Izinkan" agar GPS dapat mendeteksi posisi Anda.' },
      { icon: MapPin,        title: 'Verifikasi Posisi',      desc: 'Sistem menampilkan peta dan status lokasi Anda. Pastikan status menunjukkan "Dalam Area RSUCL".' },
      { icon: FileText,      title: 'Ketik Keterangan Lokasi', desc: 'Ketik keterangan lokasi manual Anda saat ini pada kolom input (Wajib diisi, maks. 150 karakter).' },
      { icon: LogIn,         title: 'Tekan Tombol Check-In', desc: 'Setelah wajah terverifikasi dan lokasi diisi, tekan tombol "CHECK IN". Waktu, foto, dan lokasi dicatat otomatis.' },
      { icon: CheckCircle2,  title: 'Konfirmasi Berhasil',   desc: 'Notifikasi sukses akan muncul menandakan check-in berhasil. Rekap jam masuk tampil di halaman.' },
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
      { icon: Smartphone,  title: 'Buka Menu Absensi',      desc: 'Kembali ke menu "Absensi". Setelah check-in, tampilan berganti ke mode check-out.' },
      { icon: MapPin,      title: 'Pastikan Dalam Area',     desc: 'Anda harus berada di dalam radius area RSUCL saat melakukan check-out, sama seperti check-in.' },
      { icon: FileText,    title: 'Ketik Keterangan Lokasi', desc: 'Ketik keterangan lokasi manual check-out Anda (Wajib diisi, terpisah dari lokasi saat check-in).' },
      { icon: LogOut,      title: 'Tekan Tombol Check-Out',  desc: 'Tekan tombol "CHECK OUT" untuk menyimpan jam kepulangan Anda.' },
      { icon: Eye,         title: 'Lihat Ringkasan',         desc: 'Setelah check-out, status absensi dinyatakan selesai dan rekap total jam kerja tampil penuh.' },
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
      { icon: User,          title: 'Buka Menu Profil',                  desc: 'Masuk ke menu "Profil". Scroll ke bawah untuk menemukan bagian pengajuan izin/cuti.' },
      { icon: ClipboardList, title: 'Pilih Jenis Izin',                  desc: 'Pilih jenis permohonan: Cuti Tahunan, Izin Sakit, Izin Mendadak, atau jenis lainnya sesuai kebutuhan.' },
      { icon: Calendar,      title: 'Isi Tanggal & Alasan',             desc: 'Tentukan tanggal mulai dan selesai. Tuliskan alasan dengan jelas pada kolom keterangan.' },
      { icon: Paperclip,     title: 'Lampirkan Dokumen Pelengkap',       desc: 'Unggah dokumen pendukung yang relevan (contoh: surat dokter untuk izin sakit, surat keterangan untuk cuti). Format yang diterima: PDF, JPG, atau PNG (maks. 5 MB). Dokumen ini bersifat wajib dan akan diverifikasi oleh Admin.' },
      { icon: Send,          title: 'Kirim Permohonan',                  desc: 'Tekan tombol "Ajukan". Permohonan beserta dokumen pelengkap dikirim untuk disetujui admin.' },
      { icon: Bell,          title: 'Pantau Status',                     desc: 'Status permohonan (Menunggu/Disetujui/Ditolak) dapat dipantau di menu Notifikasi atau Riwayat.' },
    ],
    tips: [
      { type: 'info',    text: 'Ajukan cuti minimal H-3 agar ada waktu bagi atasan untuk menyetujui permohonan.' },
      { type: 'success', text: 'Dokumen pelengkap wajib dilampirkan untuk setiap pengajuan izin/cuti. Pastikan dokumen jelas dan terbaca sebelum diunggah.' },
      { type: 'warning', text: 'Permohonan tanpa dokumen pendukung tidak dapat diproses. Kuota cuti tahunan terbatas — pantau sisa cuti Anda di halaman Profil.' },
    ],
  },
  {
    id: 'vehicles',
    icon: Car,
    title: 'Cara Mencatat Plat Kendaraan Pegawai',
    subtitle: 'Langkah mendaftarkan plat nomor kendaraan di halaman Profil',
    steps: [
      { icon: User,        title: 'Buka Menu Profil',                  desc: 'Ketuk menu "Profil" di sidebar (desktop) atau navbar bawah (mobile).' },
      { icon: Smartphone,  title: 'Temukan Bagian Data Kendaraan',     desc: 'Scroll ke bawah hingga menemukan kartu "Data Kendaraan Pegawai".' },
      { icon: FileText,    title: 'Input Plat Nomor Kendaraan',        desc: 'Masukkan plat nomor kendaraan Anda (maksimal 2 motor dan 2 mobil). Kolom bersifat opsional (diisi sesuai kepemilikan).' },
      { icon: CheckCircle2,title: 'Simpan Data',                       desc: 'Tekan tombol "Simpan Data Kendaraan". Notifikasi sukses akan muncul menandakan plat kendaraan berhasil diperbarui.' },
    ],
    tips: [
      { type: 'info',    text: 'Anda tidak wajib mengisi seluruh slot kendaraan. Cukup isi sesuai dengan kendaraan yang Anda bawa dinas sehari-hari.' },
      { type: 'success', text: 'Data kendaraan yang Anda simpan akan terlaporkan ke sistem laporan admin RSUCL demi menertibkan tertib parkir rumah sakit.' },
    ],
  },
  {
    id: 'gps',
    icon: Navigation,
    title: 'Cara Membaca Status GPS / Lokasi',
    subtitle: 'Memahami indikator lokasi di halaman Absensi',
    steps: [
      { icon: CheckCircle2, title: 'Dalam Area',         desc: 'Indikator hijau "Dalam Area RSUCL" berarti posisi Anda terdeteksi dalam radius yang diizinkan. Absensi dapat dilakukan.' },
      { icon: CircleDot,    title: 'Di Luar Area',       desc: 'Indikator merah berarti Anda berada di luar radius. Anda perlu berpindah ke lokasi yang sesuai terlebih dahulu.' },
      { icon: Clock,        title: 'Memuat Lokasi',      desc: 'Indikator kuning berarti GPS sedang mendeteksi posisi. Tunggu beberapa saat hingga status berubah.' },
      { icon: WifiOff,      title: 'GPS Tidak Tersedia', desc: 'Jika GPS gagal: (1) pastikan izin lokasi browser sudah diberikan, (2) GPS perangkat aktif, (3) Anda tidak menggunakan VPN.' },
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
      { icon: Home,     label: 'Beranda',    desc: 'Halaman utama yang menampilkan ringkasan kehadiran hari ini, info shift, notifikasi terbaru, dan aksi cepat.' },
      { icon: MapPin,   label: 'Absensi',    desc: 'Halaman untuk melakukan check-in dan check-out, dilengkapi peta interaktif dan status GPS real-time.' },
      { icon: History,  label: 'Riwayat',    desc: 'Melihat rekap kehadiran bulanan termasuk status hadir, terlambat, izin, dan filter berdasarkan bulan/tahun.' },
      { icon: Bell,     label: 'Notifikasi', desc: 'Pusat pemberitahuan untuk approval izin, pengumuman shift, dan informasi penting dari admin.' },
      { icon: User,     label: 'Profil',     desc: 'Kelola data diri, ganti foto profil, lihat sisa cuti, dan ajukan permohonan izin/cuti.' },
      { icon: BookOpen, label: 'Panduan',    desc: 'Halaman ini — panduan lengkap penggunaan seluruh fitur aplikasi.' },
    ],
  },
];

/* ─── Sub-components ─────────────────────────────────────────── */
function TipBox({ type, text }: { type: TipType; text: string }) {
  const map = {
    info:    { Icon: Info,          borderColor: '#93C5FD', iconColor: '#3B82F6' },
    warning: { Icon: AlertTriangle, borderColor: '#FCD34D', iconColor: '#D97706' },
    success: { Icon: CheckCircle2,  borderColor: '#86EFAC', iconColor: '#16A34A' },
  };
  const { Icon, borderColor, iconColor } = map[type];
  return (
    <div
      className="flex items-start gap-3 px-3.5 py-2.5 rounded-lg bg-gray-50"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <Icon size={13} style={{ color: iconColor }} className="mt-0.5 flex-shrink-0" />
      <p className="text-[12px] text-gray-600 leading-relaxed">{text}</p>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
/**
 * Halaman Panduan Penggunaan (GuidePage) — Sistem Absensi RSUCL
 * 
 * Menampilkan petunjuk operasional interaktif berbentuk accordion untuk memandu karyawan
 * mengenai alur check-in, check-out, pengajuan cuti, pembacaan status lokasi GPS,
 * dan deskripsi masing-masing menu.
 */
export function GuidePage() {
  const { logoUrl } = useAuth();
  
  // State accordion bagian mana yang sedang terbuka (default: 'checkin')
  const [openSection, setOpenSection] = useState<string | null>('checkin');

  // Toggle buka/tutup bagian accordion panduan
  const toggle = (id: string) =>
    setOpenSection(prev => (prev === id ? null : id));

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#15803D] text-white">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm">
            {logoUrl && logoUrl !== 'none' ? (
              <img src={logoUrl} alt="Logo RSUCL" className="w-10 h-10 object-contain" />
            ) : (
              <img src={logoImg} alt="Logo RSUCL" className="w-10 h-10 object-contain" />
            )}
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight">Panduan Penggunaan</h1>
            <p className="text-[12px] text-green-100 mt-0.5">Absensi RSUCL</p>
          </div>
        </div>
        <p className="text-[12px] text-green-50 leading-relaxed mt-3 border-t border-white/20 pt-3">
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
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                isOpen ? 'border-[#16A34A]/25' : 'border-gray-100'
              }`}
            >
              {/* Header button */}
              <button
                onClick={() => toggle(section.id)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
                  isOpen ? 'bg-[#F0FDF4]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isOpen ? 'bg-[#16A34A]' : 'bg-gray-100'
                  }`}>
                    <Icon size={15} className={isOpen ? 'text-white' : 'text-gray-500'} />
                  </div>
                  <div className="text-left">
                    <p className={`text-[13px] font-semibold ${isOpen ? 'text-[#15803D]' : 'text-gray-800'}`}>
                      {section.title}
                    </p>
                    <p className="text-[11px] text-gray-400">{section.subtitle}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isOpen ? 'bg-[#16A34A]/10' : 'bg-gray-100'
                }`}>
                  {isOpen
                    ? <ChevronUp size={13} className="text-[#16A34A]" />
                    : <ChevronDown size={13} className="text-gray-400" />
                  }
                </div>
              </button>

              {/* Body */}
              {isOpen && (
                <div className="px-5 pb-5 border-t border-[#16A34A]/10">

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
                              <div className="w-7 h-7 rounded-full border-2 border-[#16A34A]/30 bg-[#F0FDF4] flex items-center justify-center">
                                <StepIcon size={13} className="text-[#16A34A]" />
                              </div>
                              {!isLast && (
                                <div className="w-px flex-1 bg-[#16A34A]/15 mt-1 min-h-[24px]" />
                              )}
                            </div>
                            {/* Content */}
                            <div className={`flex-1 ${!isLast ? 'pb-4' : ''}`}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-[#16A34A]">
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
                            <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] border border-[#16A34A]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <MIcon size={13} className="text-[#16A34A]" />
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
      <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-gray-300">
        <FileText size={10} />
        <span>Panduan v1.0 · Absensi RSUCL · Diperbarui Juli 2026</span>
      </div>
    </div>
  );
}
