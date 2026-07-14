import { useState, useEffect } from 'react';
import { Search, CheckCircle2, Clock, AlertTriangle, XCircle, Coffee, CalendarOff, Eye, X } from 'lucide-react';
import { attendanceApi, AttendanceRecord } from '../../../services/api';

interface MappedAttendance {
  id: number | null;
  name: string;
  dept: string;
  shift: string;
  checkIn: string;
  checkOut: string | null;
  status: 'working' | 'done' | 'late' | 'absent' | 'leave' | 'not_yet' | 'no_shift';
  pos: string;
  imageCheckIn?: string | null;
  imageCheckOut?: string | null;
  checkinLocationNote?: string | null;
  checkoutLocationNote?: string | null;
  checkinPhotoUrl?: string | null;
  checkoutPhotoUrl?: string | null;
  checkinDistance?: number | null;
  checkoutDistance?: number | null;
  shiftType?: 'normal' | 'dinas_luar';
  isHolidayWork?: boolean;
  holiday?: string | null;
  profile_picture?: string | null;
  is_lembur?: boolean;
  durasi_lembur_menit?: number | null;
  keterangan_lembur?: string | null;
  status_approval_lembur?: 'pending' | 'disetujui' | 'ditolak' | null;
}

const statusMap: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2; border: string }> = {
  working:  { label: 'Sedang Bekerja', color: '#2563EB', bg: '#EFF6FF', icon: Clock,         border: '#BFDBFE' },
  done:     { label: 'Sudah Pulang',   color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle2,  border: '#BBF7D0' },
  late:     { label: 'Terlambat',      color: '#D97706', bg: '#FFFBEB', icon: AlertTriangle,  border: '#FDE68A' },
  absent:   { label: 'Alpha',          color: '#DC2626', bg: '#FEE2E2', icon: XCircle,        border: '#FECACA' },
  leave:    { label: 'Cuti/Izin',      color: '#7C3AED', bg: '#F5F3FF', icon: CalendarOff,    border: '#DDD6FE' },
  not_yet:  { label: 'Belum Hadir',    color: '#6B7280', bg: '#F9FAFB', icon: Coffee,         border: '#E5E7EB' },
  no_shift: { label: 'Tidak Ada Shift',color: '#6B7280', bg: '#F3F4F6', icon: Coffee,         border: '#E5E7EB' },
};

const summaryStats = [
  { key: 'working', label: 'Sedang Bekerja', color: '#2563EB', bg: '#EFF6FF' },
  { key: 'done',    label: 'Sudah Pulang',   color: '#16A34A', bg: '#F0FDF4' },
  { key: 'late',    label: 'Terlambat',      color: '#D97706', bg: '#FFFBEB' },
  { key: 'absent',  label: 'Alpha',          color: '#DC2626', bg: '#FEE2E2' },
  { key: 'leave',   label: 'Cuti/Izin',      color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'not_yet', label: 'Belum Hadir',    color: '#6B7280', bg: '#F9FAFB' },
];

/**
 * Komponen Tab Kehadiran Admin (AttendanceTab) — Sistem Absensi RSUCL
 * 
 * Digunakan oleh Administrator untuk memantau status absensi seluruh karyawan RSUCL secara realtime
 * pada hari berjalan. Menampilkan ringkasan statistik (Bekerja, Pulang, Terlambat, Alpha, Izin/Cuti, Belum Hadir),
 * daftar pencarian nama, detil jam masuk/pulang, serta pratinjau foto selfie wajah absensi karyawan.
 */
export function AttendanceTab() {
  // State menampung daftar absensi karyawan yang dipetakan
  const [records, setRecords] = useState<MappedAttendance[]>([]);
  
  // State untuk pencarian nama atau departemen karyawan
  const [search, setSearch] = useState('');
  
  // Filter status absensi aktif ('all' atau status spesifik)
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Objek karyawan terpilih untuk pratinjau detil & foto selfie
  const [selected, setSelected] = useState<MappedAttendance | null>(null);
  
  // Indikator memproses/loading data dari server
  const [loading, setLoading] = useState(false);

  // State untuk preview pas foto besar
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);
  const loadTodayRecords = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.allToday();
      if (res.success) {
        const mapped: MappedAttendance[] = res.data.map(r => {
          let statusKey: MappedAttendance['status'] = 'not_yet';
          if (r.status === 'hadir') {
            statusKey = r.check_out ? 'done' : 'working';
          } else if (r.status === 'telat') {
            statusKey = r.check_out ? 'done' : 'late';
          } else if (r.status === 'izin' || r.status === 'sakit' || r.status === 'cuti') {
            statusKey = 'leave';
          } else if (r.status === 'alpha') {
            statusKey = 'absent';
          } else if (r.status === 'tidak_ada_shift') {
            statusKey = 'no_shift';
          } else if (r.status === 'belum_hadir') {
            statusKey = 'not_yet';
          }

          return {
            id: r.id,
            name: r.employee?.name ?? 'Karyawan',
            dept: r.employee?.department ?? 'Umum',
            shift: r.shift_name || 'Reguler',
            checkIn: r.check_in ? r.check_in.substring(0, 5) : '--',
            checkOut: r.check_out ? r.check_out.substring(0, 5) : null,
            status: statusKey,
            pos: 'Staff',
            imageCheckIn: r.checkin_photo_url || r.image_check_in,
            imageCheckOut: r.checkout_photo_url || r.image_check_out,
            checkinLocationNote: r.checkin_location_note,
            checkoutLocationNote: r.checkout_location_note,
            checkinPhotoUrl: r.checkin_photo_url || r.image_check_in,
            checkoutPhotoUrl: r.checkout_photo_url || r.image_check_out,
            checkinDistance: r.checkin_distance_meters,
            checkoutDistance: r.checkout_distance_meters,
            shiftType: r.shift_type ?? 'normal',
            isHolidayWork: r.is_holiday_work,
            holiday: r.holiday,
            profile_picture: r.employee?.profile_picture,
            is_lembur: r.is_lembur,
            durasi_lembur_menit: r.durasi_lembur_menit,
            keterangan_lembur: r.keterangan_lembur,
            status_approval_lembur: r.status_approval_lembur,
          };
        });
        setRecords(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodayRecords();
  }, []);


  const counts: Record<string, number> = {};
  records.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });

  const filtered = records.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.dept.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getDuration = (inTime: string, outTime: string | null) => {
    if (inTime === '--') return '--';
    const [ih, im] = inTime.split(':').map(Number);
    if (outTime) {
      const [oh, om] = outTime.split(':').map(Number);
      const diff = (oh * 60 + om) - (ih * 60 + im);
      return diff > 0 ? `${Math.floor(diff / 60)}j ${diff % 60}m` : '0j';
    } else {
      const now = new Date();
      const diff = (now.getHours() * 60 + now.getMinutes()) - (ih * 60 + im);
      return diff > 0 ? `${Math.floor(diff / 60)}j ${diff % 60}m` : '--';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Date header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Kehadiran Hari Ini</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
        {summaryStats.map(s => (
          <button
            key={s.key}
            onClick={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)}
            className={`rounded-2xl p-3.5 text-center border-2 transition-all ${
              filterStatus === s.key ? 'border-current shadow-md scale-[1.02]' : 'border-transparent hover:border-gray-200'
            }`}
            style={{ background: s.bg, borderColor: filterStatus === s.key ? s.color : undefined }}
          >
            <p className="text-[22px] font-bold text-black">{counts[s.key] || 0}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search & filter */}

          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama atau departemen/bagian..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
              />
            </div>
            {filterStatus !== 'all' && (
              <button onClick={() => setFilterStatus('all')} className="text-[12px] text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2.5 hover:bg-gray-50 shadow-sm">
                Reset filter
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    {['Nama Karyawan', 'Departemen/Bagian', 'Shift', 'Jam Masuk', 'Jam Keluar', 'Durasi', 'Status', ''].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-gray-400 text-[12px]">Memuat absensi hari ini...</td>
                    </tr>
                  )}
                  {filtered.map(emp => {
                    const sc = statusMap[emp.status] || { label: emp.status, color: '#6B7280', bg: '#F9FAFB', icon: Coffee, border: '#E5E7EB' };
                    return (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div 
                              onClick={() => {
                                if (emp.profile_picture) {
                                  setPreviewPhoto({ url: emp.profile_picture, name: emp.name });
                                }
                              }}
                              className={`w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 ${emp.profile_picture ? 'cursor-zoom-in hover:scale-105 active:scale-95 transition-all' : ''}`}
                              style={{ background: sc.bg }}
                            >
                              {emp.profile_picture ? (
                                <img src={emp.profile_picture} alt={emp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold" style={{ color: sc.color }}>
                                  {emp.name.replace(/^(dr\.|Ns\.|Dr\.)\s*/i, '').charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-[13px] font-medium text-gray-800">{emp.name}</p>
                              <p className="text-[11px] text-gray-400">{emp.pos}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-600">{emp.dept}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700`}>{emp.shift}</span>
                          {emp.shiftType === 'dinas_luar' && (
                            <span className="block mt-1 text-[9px] font-bold text-purple-600 bg-purple-50 border border-purple-100 rounded-md px-1.5 py-0.5 w-max">Dinas Luar</span>
                          )}
                          {emp.isHolidayWork && (
                            <span className="block mt-1 text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-md px-1.5 py-0.5 w-max" title={emp.holiday || 'Hari Libur'}>Kerja Libur</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[13px] text-gray-700">{emp.checkIn}</td>
                        <td className="px-4 py-3.5 font-mono text-[13px] text-gray-700">
                          {emp.checkOut || (emp.checkIn !== '--' ? <span className="text-gray-300">Belum</span> : '--')}
                        </td>
                        <td className="px-4 py-3.5 text-[13px] text-gray-600">{getDuration(emp.checkIn, emp.checkOut)}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-dashed" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                            <sc.icon size={11} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button onClick={() => setSelected(emp)} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors">
                            <Eye size={13} className="text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && !loading && (
              <div className="text-center py-5 text-gray-300 text-[11px]">Tidak ada data absensi ditemukan.</div>
            )}
            <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
              <p className="text-[12px] text-gray-400">Menampilkan {filtered.length} dari {records.length} karyawan</p>
              <p className="text-[12px] text-gray-400">Diperbarui otomatis dari server</p>
            </div>
          </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-5">
              <div 
                onClick={() => {
                  if (selected.profile_picture) {
                    setPreviewPhoto({ url: selected.profile_picture, name: selected.name });
                  }
                }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 ${selected.profile_picture ? 'cursor-zoom-in hover:scale-105 active:scale-95 transition-all' : ''}`}
                style={{ background: statusMap[selected.status].bg }}
              >
                {selected.profile_picture ? (
                  <img src={selected.profile_picture} alt={selected.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold" style={{ color: statusMap[selected.status].color }}>
                    {selected.name.replace(/^(dr\.|Ns\.|Dr\.)\s*/i, '').charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-gray-900">{selected.name}</p>
                <p className="text-[12px] text-gray-500">{selected.pos} · {selected.dept}</p>
              </div>
            </div>
            <div className="space-y-2.5 bg-gray-50 rounded-xl p-4 mb-5">
               {[
                { l: 'Shift', v: selected.shift + (selected.shiftType === 'dinas_luar' ? ' (Dinas Luar)' : ' (Normal)') },
                { l: 'Jam Masuk', v: selected.checkIn + (selected.checkinDistance !== undefined && selected.checkinDistance !== null ? ` (${selected.checkinDistance}m dari RSUCL)` : '') },
                { l: 'Jam Keluar', v: (selected.checkOut || 'Belum checkout') + (selected.checkoutDistance !== undefined && selected.checkoutDistance !== null ? ` (${selected.checkoutDistance}m dari RSUCL)` : '') },
                { l: 'Status', v: statusMap[selected.status].label },
                ...(selected.checkinLocationNote ? [{ l: 'Lokasi Masuk', v: selected.checkinLocationNote }] : []),
                ...(selected.checkoutLocationNote ? [{ l: 'Lokasi Pulang', v: selected.checkoutLocationNote }] : []),
              ].map(({ l, v }, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[12px] text-gray-500">{l}</span>
                  <span className="text-[12px] font-medium text-gray-800 text-right max-w-[180px] break-words">{v}</span>
                </div>
              ))}
            </div>

            {/* Selfie Photo display if available */}
            {(selected.imageCheckIn || selected.imageCheckOut) && (
              <div className="mb-5 space-y-2.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Foto Selfie Absensi</p>
                <div className="flex gap-2">
                  {selected.imageCheckIn && (
                    <div className="flex-1 text-center bg-gray-50 rounded-xl p-2 border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase">Selfie Masuk</p>
                      <img src={selected.imageCheckIn} alt="Check In Selfie" className="w-full aspect-square object-cover rounded-lg border" />
                    </div>
                  )}
                  {selected.imageCheckOut && (
                    <div className="flex-1 text-center bg-gray-50 rounded-xl p-2 border border-gray-100 shadow-sm">
                      <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase">Selfie Pulang</p>
                      <img src={selected.imageCheckOut} alt="Check Out Selfie" className="w-full aspect-square object-cover rounded-lg border" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Overtime Info & Action Panel */}
            {selected.is_lembur && (
              <div className="mb-5 p-3.5 bg-orange-50 border border-orange-200 rounded-xl space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-orange-600 font-semibold text-[12px]">
                    <Clock size={13} />
                    <span>Lembur (+{selected.durasi_lembur_menit} mnt)</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selected.status_approval_lembur === 'disetujui' ? 'bg-green-100 text-green-700' :
                    selected.status_approval_lembur === 'ditolak' ? 'bg-red-100 text-red-650' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {selected.status_approval_lembur === 'disetujui' ? 'Disetujui' :
                     selected.status_approval_lembur === 'ditolak' ? 'Ditolak' : 'Menunggu'}
                  </span>
                </div>
                <p className="text-[11.5px] text-gray-600">
                  <span className="font-semibold">Pekerjaan Lembur:</span> {selected.keterangan_lembur || '-'}
                </p>
                {selected.status_approval_lembur === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t border-orange-200/50 mt-1">
                    <button
                      onClick={async () => {
                        if (!selected.id) return;
                        try {
                          await attendanceApi.approveOvertime(selected.id);
                          alert('Lembur berhasil disetujui.');
                          setSelected(null);
                          loadTodayRecords();
                        } catch (err: any) {
                          alert(err?.message ?? 'Gagal menyetujui lembur.');
                        }
                      }}
                      className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={async () => {
                        if (!selected.id) return;
                        try {
                          await attendanceApi.rejectOvertime(selected.id);
                          alert('Lembur ditolak dan jam pulang dibatalkan.');
                          setSelected(null);
                          loadTodayRecords();
                        } catch (err: any) {
                          alert(err?.message ?? 'Gagal menolak lembur.');
                        }
                      }}
                      className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setSelected(null)} className="w-full py-2.5 bg-gray-100 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-200 transition-colors">Tutup</button>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX PHOTO PREVIEW MODAL ── */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setPreviewPhoto(null)} />
          <div className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-fade-in flex flex-col items-center">
            {/* Header/Close button */}
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={() => setPreviewPhoto(null)} 
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all focus:outline-none"
              >
                <X size={18} />
              </button>
            </div>
            {/* Image Wrapper */}
            <div className="p-3 w-full bg-gray-50 flex justify-center items-center">
              <img 
                src={previewPhoto.url} 
                alt={previewPhoto.name} 
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-sm border border-gray-100" 
              />
            </div>
            {/* Caption */}
            <div className="px-6 py-4.5 bg-white w-full text-center border-t border-gray-50">
              <p className="text-[14px] font-bold text-gray-900 leading-tight">{previewPhoto.name}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">Foto Profil Karyawan RSUCL</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
