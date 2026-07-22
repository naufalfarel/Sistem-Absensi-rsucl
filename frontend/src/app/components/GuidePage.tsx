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
  CheckSquare,
  CalendarDays,
  UserPlus,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

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
  category: 'employee' | 'pj_bagian' | 'general';
  icon: typeof BookOpen;
  title: string;
  subtitle: string;
  steps?: Step[];
  tips?: Tip[];
  menuItems?: MenuItem[];
}

const sections: Section[] = [
  {
    id: 'checkin',
    category: 'employee',
    icon: LogIn,
    title: 'Presensi Absensi Masuk (Check-In)',
    subtitle: 'Tata cara melakukan absensi masuk harian berbasis GPS & selfie',
    steps: [
      {
        icon: Smartphone,
        title: 'Buka Menu Absen',
        desc: 'Pilih menu "Absen" di sidebar utama. Pastikan koneksi internet dan fitur lokasi (GPS) perangkat aktif.',
      },
      {
        icon: Navigation,
        title: 'Izinkan Akses Lokasi (GPS)',
        desc: 'Saat pertama kali membuka menu, izinkan browser mengakses lokasi perangkat agar sistem dapat mendeteksi posisi koordinat Anda.',
      },
      {
        icon: MapPin,
        title: 'Validasi Radius Geo-fence RSUCL',
        desc: 'Sistem secara otomatis mengukur jarak posisi Anda dengan lokasi RSUCL. Pastikan indikator status menunjukkan "Dalam Area RSUCL" (Maks. 40 meter).',
      },
      {
        icon: User,
        title: 'Verifikasi Wajah (Selfie)',
        desc: 'Ketuk tombol "Buka Kamera" dan posisikan wajah Anda di tengah bingkai untuk mengambil foto selfie verifikasi presensi.',
      },
      {
        icon: LogIn,
        title: 'Proses Check-In',
        desc: 'Setelah verifikasi lokasi dan foto selesai, ketuk tombol "CHECK IN". Waktu jam masuk, koordinat, dan foto tersimpan otomatis.',
      },
    ],
    tips: [
      { type: 'warning', text: 'Check-in hanya dapat dilakukan sekali per hari sesuai dengan jam buka shift yang berlaku.' },
      { type: 'info', text: 'Jika indikator GPS menunjukkan Luar Area, pastikan Anda berada di area terbuka dan tidak menggunakan layanan VPN.' },
    ],
  },
  {
    id: 'checkout',
    category: 'employee',
    icon: LogOut,
    title: 'Presensi Absensi Pulang (Check-Out)',
    subtitle: 'Tata cara melakukan absensi kepulangan jam kerja',
    steps: [
      {
        icon: Smartphone,
        title: 'Akses Kembali Menu Absen',
        desc: 'Setelah jam kerja berakhir, buka kembali menu "Absen" yang secara otomatis menampilkan mode check-out.',
      },
      {
        icon: MapPin,
        title: 'Konfirmasi Lokasi Kepulangan',
        desc: 'Pastikan Anda masih berada di dalam radius area RSUCL saat menekan tombol check-out.',
      },
      {
        icon: LogOut,
        title: 'Proses Check-Out',
        desc: 'Ketuk tombol "CHECK OUT" untuk mencatat jam kepulangan resmi dan menghitung total durasi jam kerja Anda.',
      },
      {
        icon: CheckCircle2,
        title: 'Selesai & Rekapitulasi',
        desc: 'Status presensi harian dinyatakan selesai dan rekapitulasi jam kerja otomatis tercatat di halaman Riwayat.',
      },
    ],
    tips: [
      { type: 'success', text: 'Selalu lakukan check-out sebelum meninggalkan lingkungan kerja RSUCL.' },
    ],
  },
  {
    id: 'leave',
    category: 'employee',
    icon: Calendar,
    title: 'Pengajuan Cuti & Sakit (Formulir Resmi & QR Code)',
    subtitle: 'Prosedur pengajuan cuti, sakit, dan penerbitan dokumen resmi RSUCL',
    steps: [
      {
        icon: FileText,
        title: 'Buka Menu Pengajuan Cuti & Sakit',
        desc: 'Masuk ke menu "Pengajuan Cuti & Sakit" lalu ketuk tombol "Ajukan Cuti Baru".',
      },
      {
        icon: ClipboardList,
        title: 'Mengisi Detail Permohonan',
        desc: 'Pilih jenis permohonan (Cuti Tahunan, Sakit, atau Cuti Khusus), tentukan tanggal mulai & selesai, alasan permohonan, dan pegawai pengganti tugas.',
      },
      {
        icon: Paperclip,
        title: 'Lampirkan Surat Keterangan Dokter',
        desc: 'Khusus pengajuan izin sakit, wajib mengunggah berkas Surat Keterangan Dokter (PDF/JPG, Maks 5MB) agar permohonan dapat diproses.',
      },
      {
        icon: Send,
        title: 'Kirim Permohonan',
        desc: 'Ketuk tombol "Kirim Pengajuan". Permohonan akan diteruskan ke PJ Bagian dan Administrator RSUCL untuk diverifikasi.',
      },
      {
        icon: FileText,
        title: 'Unduh Form Surat Cuti & QR Code Otorisasi',
        desc: 'Setelah disetujui, ketuk "Lihat Form Cuti & QR Code" untuk melihat dokumen resmi ber-kop RSUCL yang dilengkapi stempel digital QR Code Direktur PT Cempaka Lima Utama.',
      },
    ],
    tips: [
      { type: 'info', text: 'Disarankan mengajukan cuti tahunan minimal 3 hari sebelumnya agar PJ Bagian dapat mengatur jadwal shift pengganti.' },
      { type: 'success', text: 'Dokumen Form Surat Cuti dapat dicetak langsung atau disimpan dalam format PDF untuk keperluan arsip pribadi pegawai.' },
    ],
  },
  {
    id: 'overtime',
    category: 'employee',
    icon: Clock,
    title: 'Pengajuan Lembur Harian',
    subtitle: 'Prosedur pengajuan jam kerja lembur pegawai',
    steps: [
      {
        icon: Clock,
        title: 'Buka Menu Pengajuan Lembur',
        desc: 'Pilih menu "Pengajuan Lembur" pada sidebar lalu ketuk "Ajukan Lembur Baru".',
      },
      {
        icon: FileText,
        title: 'Input Tanggal & Durasi Lembur',
        desc: 'Tentukan tanggal pelaksanaan lembur, jam mulai, jam selesai, serta deskripsi rincian tugas lembur yang akan dikerjakan.',
      },
      {
        icon: Bell,
        title: 'Verifikasi & Notifikasi',
        desc: 'Pengajuan akan ditinjau oleh PJ Bagian dan Admin. Pemberitahuan status approval dikirimkan secara langsung melalui pusat Notifikasi.',
      },
    ],
    tips: [
      { type: 'info', text: 'Pastikan jam lembur tidak bertabrakan dengan jadwal shift reguler Anda.' },
    ],
  },
  {
    id: 'assignment',
    category: 'employee',
    icon: FileText,
    title: 'Pengajuan Surat Tugas Resmi (Dinas Luar)',
    subtitle: 'Permohonan penugasan kegiatan dinas luar dan pengecualian GPS',
    steps: [
      {
        icon: FileText,
        title: 'Buka Menu Pengajuan Surat Tugas',
        desc: 'Pilih menu "Pengajuan Surat Tugas" lalu ketuk "Ajukan Surat Tugas".',
      },
      {
        icon: ClipboardList,
        title: 'Melengkapi Detail Penugasan',
        desc: 'Isikan perihal kegiatan, instansi pemberi tugas, nomor surat penugasan (opsional), serta rentang tanggal pelaksanaan tugas.',
      },
      {
        icon: Paperclip,
        title: 'Unggah Undangan & Foto Kehadiran',
        desc: 'Lampirkan file PDF/Gambar Surat Undangan Resmi dan unggah bukti foto kegiatan di lokasi penugasan dinas luar.',
      },
      {
        icon: ShieldCheck,
        title: 'Pengecualian Validasi Geo-fence GPS',
        desc: 'Surat Tugas yang disetujui Admin otomatis mengecualikan (skip) pembatasan radius GPS absensi selama masa dinas luar.',
      },
    ],
    tips: [
      { type: 'success', text: 'Selalu pastikan mengunggah foto bukti kehadiran di lokasi kegiatan agar laporan penugasan dinas luar terverifikasi valid.' },
    ],
  },
  {
    id: 'pj_approvals',
    category: 'pj_bagian',
    icon: CheckSquare,
    title: 'Persetujuan Pengajuan Staf (Khusus PJ Bagian)',
    subtitle: 'Prosedur verifikasi dan approval permohonan cuti & lembur staf departemen',
    steps: [
      {
        icon: CheckSquare,
        title: 'Buka Menu Pengajuan Staf',
        desc: 'Masuk ke menu "Pengajuan Staf" di bagian Manajemen Staf & Bagian.',
      },
      {
        icon: Eye,
        title: 'Tinjau Rincian Permohonan',
        desc: 'Periksa detail pengajuan cuti atau lembur dari anggota staf, termasuk tanggal, alasan, pegawai pengganti, dan berkas pendukung.',
      },
      {
        icon: CheckCircle2,
        title: 'Berikan Verifikasi & Catatan',
        desc: 'Ketuk tombol "Setuju" atau "Tolak", lalu masukkan catatan petunjuk supervisor jika diperlukan.',
      },
    ],
    tips: [
      { type: 'info', text: 'Persetujuan PJ Bagian merupakan tahap verifikasi pertama sebelum pengajuan diproses final oleh Administrator RSUCL.' },
    ],
  },
  {
    id: 'pj_shifts',
    category: 'pj_bagian',
    icon: CalendarDays,
    title: 'Pengaturan Jadwal Shift Dinamis 30 Hari (Khusus PJ Bagian)',
    subtitle: 'Tata cara mengatur jadwal kerja harian, shift, dan libur anggota staf',
    steps: [
      {
        icon: CalendarDays,
        title: 'Buka Menu Jadwal Shift Staf',
        desc: 'Pilih menu "Jadwal Shift Staf" pada grup Manajemen Staf & Bagian.',
      },
      {
        icon: Search,
        title: 'Pilih Bulan & Anggota Staf',
        desc: 'Gunakan filter kalender bulanan dan pilih nama pegawai di departemen Anda yang akan diatur jadwalnya.',
      },
      {
        icon: Calendar,
        title: 'Atur Shift Per Tanggal Kalender',
        desc: 'Ketuk tanggal tertentu pada kalender 30 hari untuk menentukan jenis shift (Pagi, Siang, Malam, Cuti, atau Libur).',
      },
      {
        icon: CheckCircle2,
        title: 'Simpan Perubahan Jadwal',
        desc: 'Tekan tombol "Simpan Jadwal" untuk memperbarui penugasan shift staf secara publik di sistem.',
      },
    ],
    tips: [
      { type: 'success', text: 'Jadwal shift dinamis memudahkan pengawasan kehadiran staf harian dan memastikan operasional pelayanan rumah sakit berjalan lancar.' },
    ],
  },
  {
    id: 'general_menu',
    category: 'general',
    icon: Smartphone,
    title: 'Deskripsi Navigasi & Fitur Utama',
    subtitle: 'Ringkasan fungsi seluruh menu di aplikasi Sistem Absensi RSUCL',
    menuItems: [
      { icon: Home, label: 'Beranda', desc: 'Halaman utama yang menampilkan ringkasan presensi harian, info shift kerja aktif, notifikasi terkini, dan aksi cepat.' },
      { icon: MapPin, label: 'Absen', desc: 'Halaman untuk melakukan check-in dan check-out dengan peta GPS interaktif dan verifikasi selfie wajah.' },
      { icon: History, label: 'Riwayat Absen', desc: 'Merekapitulasi riwayat presensi bulanan, status keterlambatan, jam kerja, serta penyesuaian kehadiran.' },
      { icon: FileText, label: 'Pengajuan Cuti & Sakit', desc: 'Mengajukan permohonan cuti/sakit, memantau sisa kuota, serta mencetak dokumen resmi Form Cuti ber-QR Code.' },
      { icon: Clock, label: 'Pengajuan Lembur', desc: 'Mengajukan jam kerja lembur harian dan memantau persetujuan PJ Bagian & Admin.' },
      { icon: FileText, label: 'Pengajuan Surat Tugas', desc: 'Mengajukan permohonan dinas luar dengan melampirkan surat undangan dan bukti foto kehadiran.' },
      { icon: Bell, label: 'Notifikasi', desc: 'Pusat pemberitahuan otomatis yang terhubung langsung dengan halaman persetujuan modul.' },
      { icon: User, label: 'Profil Saya', desc: 'Kelola informasi biodata pribadi, ganti kata sandi, dan input nomor plat kendaraan operasional.' },
      { icon: BookOpen, label: 'Panduan App', desc: 'Halaman dokumentasi operasional resmi aplikasi Sistem Absensi RSUCL.' },
    ],
  },
];

function TipBox({ type, text }: { type: TipType; text: string }) {
  const map = {
    info: { Icon: Info, borderColor: '#93C5FD', iconColor: '#2563EB' },
    warning: { Icon: AlertTriangle, borderColor: '#FCD34D', iconColor: '#D97706' },
    success: { Icon: CheckCircle2, borderColor: '#86EFAC', iconColor: '#16A34A' },
  };
  const { Icon, borderColor, iconColor } = map[type];
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-150"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <Icon size={14} style={{ color: iconColor }} className="mt-0.5 flex-shrink-0" />
      <p className="text-[12px] text-gray-700 leading-relaxed font-medium">{text}</p>
    </div>
  );
}

/**
 * Halaman Panduan Penggunaan (GuidePage) — Sistem Absensi RSUCL
 * Formal, Tanpa Emojis AI, Terstruktur Berdasarkan Role (Pegawai & PJ Bagian)
 */
export function GuidePage() {
  const { logoUrl, user } = useAuth();
  const isPJ = user?.role === 'pj_bagian' || user?.role === 'admin' || user?.role === 'super_admin' || (user as any)?.is_pj_bagian;

  const [activeCategory, setActiveCategory] = useState<'all' | 'employee' | 'pj_bagian'>('all');
  const [openSection, setOpenSection] = useState<string | null>('checkin');
  const [searchQuery, setSearchQuery] = useState('');

  const toggle = (id: string) =>
    setOpenSection(prev => (prev === id ? null : id));

  const filteredSections = sections.filter(sec => {
    // Sembunyikan panduan khusus PJ Bagian jika pengguna bukan PJ Bagian/Admin
    if (sec.category === 'pj_bagian' && !isPJ) {
      return false;
    }

    const matchesCategory = activeCategory === 'all' || sec.category === activeCategory || sec.category === 'general';
    const matchesSearch = searchQuery.trim() === '' || 
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-5 md:p-7 max-w-3xl mx-auto font-sans">
      
      {/* ── Header Banner ── */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#15803D] text-white shadow-xs">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm p-1">
            {logoUrl && logoUrl !== 'none' ? (
              <img src={logoUrl} alt="Logo RSUCL" className="w-10 h-10 object-contain" />
            ) : (
              <img src={logoImg} alt="Logo RSUCL" className="w-10 h-10 object-contain" />
            )}
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight">Panduan Penggunaan</h1>
            <p className="text-[12px] text-green-100 mt-0.5 font-medium">Absensi RSUCL</p>
          </div>
        </div>
        <p className="text-[12px] text-green-50 leading-relaxed mt-3 border-t border-white/20 pt-3 font-normal">
          Ikuti langkah-langkah di bawah ini untuk menggunakan setiap fitur dengan benar. Klik judul bagian untuk membuka panduan.
        </p>
      </div>

      {/* Accordion Sections List */}
      <div className="space-y-2">
        {filteredSections.map(section => {
            const Icon = section.icon;
            const isOpen = openSection === section.id;

            return (
              <div
                key={section.id}
                id={`guide-${section.id}`}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
                  isOpen ? 'border-[#16A34A] shadow-md' : 'border-gray-150 hover:border-gray-250'
                }`}
              >
                {/* Accordion Button */}
                <button
                  onClick={() => toggle(section.id)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors cursor-pointer ${
                    isOpen ? 'bg-green-50/40' : 'hover:bg-gray-55/60'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isOpen ? 'bg-[#16A34A] text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-[13.5px] font-bold ${isOpen ? 'text-[#15803D]' : 'text-gray-900'}`}>
                          {section.title}
                        </p>
                        {section.category === 'pj_bagian' && (
                          <span className="text-[9.5px] font-extrabold text-purple-700 bg-purple-50 border border-purple-150 px-2 py-0.5 rounded-md uppercase">
                            Khusus PJ Bagian
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-gray-500 font-normal mt-0.5 truncate">{section.subtitle}</p>
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 ${
                    isOpen ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </button>

                {/* Body Content */}
                {isOpen && (
                  <div className="px-5 pb-6 border-t border-gray-100 pt-4">

                    {/* Timeline Steps */}
                    {section.steps && (
                      <div className="space-y-0">
                        {section.steps.map((step, i) => {
                          const StepIcon = step.icon;
                          const isLast = i === section.steps!.length - 1;
                          return (
                            <div key={i} className="flex items-start gap-4">
                              <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                <div className="w-8 h-8 rounded-full border border-green-200 bg-green-50 flex items-center justify-center shadow-2xs">
                                  <StepIcon size={14} className="text-[#16A34A]" />
                                </div>
                                {!isLast && (
                                  <div className="w-0.5 flex-1 bg-green-200/60 my-1 min-h-[28px]" />
                                )}
                              </div>
                              <div className={`flex-1 ${!isLast ? 'pb-5' : ''}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] font-bold text-[#16A34A] bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                                    Langkah {i + 1}
                                  </span>
                                  <h4 className="text-[13px] font-bold text-gray-900">{step.title}</h4>
                                </div>
                                <p className="text-[12px] text-gray-600 leading-relaxed font-normal">{step.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Menu Items List */}
                    {section.menuItems && (
                      <div className="divide-y divide-gray-100">
                        {section.menuItems.map((item, i) => {
                          const MIcon = item.icon;
                          return (
                            <div key={i} className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                              <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <MIcon size={15} className="text-[#16A34A]" />
                              </div>
                              <div>
                                <p className="text-[13px] font-bold text-gray-900">{item.label}</p>
                                <p className="text-[12px] text-gray-600 leading-relaxed mt-0.5 font-normal">{item.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tips and Warnings Box */}
                    {section.tips && section.tips.length > 0 && (
                      <div className="mt-5 space-y-2 pt-2 border-t border-gray-100">
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

      {/* Footer Meta info */}
      <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <BookOpen size={13} className="text-[#16A34A]" />
          <span className="font-semibold text-gray-600">Dokumentasi Panduan Operasional RSUCL</span>
        </div>
        <span>Diperbarui Resmi: 20 Juli 2026</span>
      </div>

    </div>
  );
}
