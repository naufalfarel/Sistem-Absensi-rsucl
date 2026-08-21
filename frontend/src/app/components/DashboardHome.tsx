import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Stethoscope, MapPin, Calendar, ChevronRight, Bell, TrendingUp, Users, User, Activity, BookOpen, RotateCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi, AttendanceRecord, notificationApi, AppNotification, scheduleApi, MyShiftSchedule, settingApi } from '../../services/api';
import { useRealtimeGps } from '../../hooks/useRealtimeGps';

/** Format "HH:mm:ss" atau "HH:mm" menjadi "HH:mm" */
function fmtTime(t: string | undefined | null): string {
  if (!t) return '--:--';
  return t.substring(0, 5);
}

/** Rumus Haversine — mengembalikan jarak dalam meter */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Halaman Dashboard Utama Karyawan (DashboardHome) — Sistem Absensi RSUCL
 * 
 * Menampilkan ringkasan status kehadiran hari ini (Jam Masuk, Jam Pulang, Shift aktif),
 * koordinat lokasi GPS secara realtime untuk pengecekan geofencing, menu aksi cepat,
 * serta daftar notifikasi terbaru.
 * 
 * @param onNavigate Callback untuk berpindah tab/halaman di EmployeeApp parent
 */
export function DashboardHome({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { user } = useAuth();
  
  // State waktu jam realtime di pojok dashboard
  const [time, setTime] = useState(new Date());
  
  // State data absensi hari ini yang ditarik dari API
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [todayHoliday, setTodayHoliday] = useState<{ name: string; is_assigned: boolean } | null>(null);
  
  // State notifikasi dan jumlah notifikasi yang belum dibaca
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  
  // State jadwal shift kerja yang berlaku hari ini
  const [todayShift, setTodayShift] = useState<MyShiftSchedule | null | undefined>(undefined); // undefined = sedang memuat
  const [shiftDay, setShiftDay] = useState<string>('');
  const [todayShiftsList, setTodayShiftsList] = useState<any[]>([]);
  const [todayRecordsList, setTodayRecordsList] = useState<any[]>([]);
 
  // ── State GPS / Geofencing RSUCL ──────────────────────────────────────────
  
  // Koordinat latitude RSUCL (diambil dari settings database, default Banda Aceh)
  const [hospLat, setHospLat] = useState<number>(5.552740480177099);
  
  // Koordinat longitude RSUCL
  const [hospLng, setHospLng] = useState<number>(95.33486560781716);
  
  // Radius maksimal toleransi absensi (meter)
  const [hospRadius, setHospRadius] = useState<number>(40);
  
  // Status keberadaan GPS ('loading', 'in' = dalam area, 'out' = di luar area, 'unavailable')
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'in' | 'out' | 'unavailable'>('loading');

  // Menjalankan interval jam digital
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * Mengambil data dashboard secara paralel (hari ini, notifikasi, jadwal shift).
   */
  const fetchDashboardData = async () => {
    try {
      const [attendRes, notifRes, shiftRes] = await Promise.allSettled([
        attendanceApi.today(),
        notificationApi.list(),
        scheduleApi.mySchedule(),
      ]);

      if (attendRes.status === 'fulfilled' && attendRes.value.success) {
        setTodayRecord(attendRes.value.data);
        if (attendRes.value.today_shifts && attendRes.value.today_shifts.length > 0) {
          setTodayShiftsList(attendRes.value.today_shifts);
        }
        if (attendRes.value.records) {
          setTodayRecordsList(attendRes.value.records);
        }
        if (attendRes.value.holiday) {
          setTodayHoliday(attendRes.value.holiday);
        }
      }
      if (notifRes.status === 'fulfilled' && notifRes.value.success) {
        setNotifications(notifRes.value.data.notifications.slice(0, 3));
        setUnreadNotifsCount(notifRes.value.data.unread_count);
      }
      if (shiftRes.status === 'fulfilled' && shiftRes.value.success) {
        setTodayShift(shiftRes.value.data); // null jika tidak ada jadwal hari ini
        setShiftDay(shiftRes.value.day ?? '');
      } else {
        setTodayShift(null);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setTodayShift(null);
    }
  };

  // Panggil data awal saat mounting
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ── Memuat koordinat rumah sakit dari pengaturan API ─────────────────────
  useEffect(() => {
    settingApi.get().then(res => {
      if (res.success && res.data) {
        const lat = parseFloat(res.data.hospital_latitude || res.data.hospital_lat);
        const lng = parseFloat(res.data.hospital_longitude || res.data.hospital_lng);
        const rad = parseFloat(res.data.attendance_radius_meters || res.data.gps_radius);
        if (!isNaN(lat)) setHospLat(lat);
        if (!isNaN(lng)) setHospLng(lng);
        if (!isNaN(rad) && rad > 0) setHospRadius(rad);
      }
    }).catch(() => { /* gunakan koordinat default jika API bermasalah */ });
  }, []);

  // ── Pemantauan GPS Terus Menerus (Real-time Watcher ramah iOS) ──────────────────────
  const { location: userCoords, gpsActive, loading: gpsLoading, refreshLocation } = useRealtimeGps();

  useEffect(() => {
    if (gpsLoading && !userCoords) {
      setGpsStatus('loading');
      return;
    }
    if (!gpsActive || !userCoords) {
      setGpsStatus('unavailable');
      return;
    }
    const dist = haversine(userCoords.lat, userCoords.lng, hospLat, hospLng);
    setGpsStatus(dist <= hospRadius ? 'in' : 'out');
  }, [userCoords, gpsActive, gpsLoading, hospLat, hospLng, hospRadius]);

  // Array nama hari & bulan bahasa Indonesia
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // Penyusunan teks string waktu & tanggal
  const dateStr = `${days[time.getDay()]}, ${time.getDate()} ${months[time.getMonth()]} ${time.getFullYear()}`;
  const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  /**
   * Menentukan kalimat sapaan sesuai waktu jam saat ini.
   */
  const getGreeting = () => {
    const hours = time.getHours();
    if (hours >= 4 && hours < 11) return 'Selamat Pagi';
    if (hours >= 11 && hours < 15) return 'Selamat Siang';
    if (hours >= 15 && hours < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // ── Helper tampilan shift ──────────────────────────────────────────────
  const shiftName       = todayShift ? (todayShift.name.toLowerCase().startsWith('shift') ? todayShift.name : `Shift ${todayShift.name}`) : todayShift === null ? 'Tidak Ada Shift' : 'Memuat…';
  const shiftStartTime  = fmtTime(todayShift?.start_time);
  const shiftEndTime    = fmtTime(todayShift?.end_time);
  const shiftRange      = todayShift ? `${shiftStartTime} – ${shiftEndTime} WIB` : todayShift === null ? 'Tidak ada jadwal hari ini' : '';

  // ── Stat card helpers ───────────────────────────────────────────────────
  // Menentukan apakah hari ini karyawan bebas tugas (libur / LJ / tidak ada shift ATAU berstatus cuti/izin/sakit)
  const isLiburJaga = todayShift?.name?.toLowerCase().includes('libur jaga') || todayShift?.name?.toUpperCase() === 'LJ';
  const isOffDuty   = todayShift === null || isLiburJaga || todayRecord?.status === 'cuti' || todayRecord?.status === 'izin' || todayRecord?.status === 'sakit';
  
  // Format string tipe izin/cuti/lj yang sedang aktif untuk label UI
  const leaveType = isLiburJaga ? 'Libur Jaga (LJ)' : todayRecord?.status === 'cuti' ? 'Cuti' : todayRecord?.status === 'izin' ? 'Izin' : todayRecord?.status === 'sakit' ? 'Sakit' : null;

  // Mendapatkan label utama penanda status kehadiran (misal: Hadir, Terlambat, Cuti, Libur)
  const getStatusLabel = () => {
    if (isOffDuty) return leaveType ?? 'Libur';
    if (!todayRecord) {
      if (todayShift === undefined) return 'Memuat…';
      return 'Belum Absen';
    }
    if (todayRecord.display_status === 'tidak_lengkap') return 'Tidak Lengkap';
    const statusMap: Record<string, string> = {
      hadir: 'Hadir',
      telat: 'Terlambat',
      alpha: 'Alpha',
    };
    return statusMap[todayRecord.status] ?? 'Sudah Absen';
  };

  // Mendapatkan label badge status kehadiran (misal: Bebas Tugas, Tepat Waktu, Sudah Pulang)
  const getStatusBadge = () => {
    if (isOffDuty) return 'Bebas Tugas';
    if (!todayRecord) return 'Belum Check-In';
    if (todayRecord.display_status === 'tidak_lengkap') return 'Tidak Lengkap';
    if (todayRecord.status === 'alpha') return 'Tidak Hadir';
    if (todayRecord.check_out) return 'Sudah Pulang';
    if (todayRecord.status === 'telat') return 'Terlambat';
    return 'Tepat Waktu';
  };

  // Mendapatkan kombinasi warna tema UI (teks dan background) sesuai status kehadiran
  const getStatusColor = () => {
    if (isOffDuty) {
      if (leaveType) return { color: '#7C3AED', bg: '#F5F3FF' }; // Ungu/Violet untuk cuti/izin/sakit
      return { color: '#4B5563', bg: '#F3F4F6' }; // Abu-abu untuk libur biasa
    }
    if (!todayRecord) return { color: '#6B7280', bg: '#F9FAFB' };
    if (todayRecord.display_status === 'tidak_lengkap') return { color: '#4B5563', bg: '#F3F4F6' }; // Abu-abu
    if (todayRecord.status === 'hadir') return { color: '#16A34A', bg: '#DCFCE7' };
    if (todayRecord.status === 'telat') return { color: '#D97706', bg: '#FEF3C7' };
    return { color: '#DC2626', bg: '#FEE2E2' };
  };

  const statusColor = getStatusColor();

  const stats = [
    {
      icon: CheckCircle2,
      label: 'Status Kehadiran',
      value: getStatusLabel(),
      sub: todayRecord?.check_out ? 'Absensi Selesai' : 'Hari ini',
      color: statusColor.color,
      bg: statusColor.bg + '30',
      badge: getStatusBadge(),
      badgeColor: statusColor.color,
      badgeBg: statusColor.bg,
    },
    {
      icon: Clock,
      label: 'Jam Masuk',
      value: todayRecord?.check_in ? todayRecord.check_in.substring(0, 5) : '--:--',
      sub: 'WIB',
      color: '#2563EB',
      bg: '#EFF6FF',
      badge: todayRecord?.check_in 
        ? (todayRecord.status === 'telat' ? 'Terlambat' : 'Tepat Waktu') 
        : (isOffDuty ? (leaveType ?? 'Libur') : 'Menunggu'),
      badgeColor: todayRecord?.check_in 
        ? (todayRecord.status === 'telat' ? '#D97706' : '#2563EB') 
        : (isOffDuty ? (leaveType ? '#7C3AED' : '#4B5563') : '#9CA3AF'),
      badgeBg: todayRecord?.check_in 
        ? (todayRecord.status === 'telat' ? '#FEF3C7' : '#DBEAFE') 
        : (isOffDuty ? (leaveType ? '#F5F3FF' : '#F3F4F6') : '#F3F4F6'),
    },
    {
      icon: Clock,
      label: 'Jam Keluar',
      value: todayRecord?.check_out ? todayRecord.check_out.substring(0, 5) : '--:--',
      sub: 'WIB',
      color: '#DC2626',
      bg: '#FFF1F2',
      badge: todayRecord?.check_out 
        ? 'Selesai' 
        : (todayRecord?.display_status === 'tidak_lengkap'
            ? 'Tidak Lengkap'
            : (todayRecord?.check_in 
                ? 'Belum Pulang' 
                : (isOffDuty ? (leaveType ?? 'Libur') : 'Belum Absen'))),
      badgeColor: todayRecord?.check_out 
        ? '#16A34A' 
        : (todayRecord?.display_status === 'tidak_lengkap'
            ? '#4B5563'
            : (todayRecord?.check_in 
                ? '#EA580C' 
                : (isOffDuty ? (leaveType ? '#7C3AED' : '#4B5563') : '#9CA3AF'))),
      badgeBg: todayRecord?.check_out 
        ? '#DCFCE7' 
        : (todayRecord?.display_status === 'tidak_lengkap'
            ? '#F3F4F6'
            : (todayRecord?.check_in 
                ? '#FFF7ED' 
                : (isOffDuty ? (leaveType ? '#F5F3FF' : '#F3F4F6') : '#F3F4F6'))),
    },
    {
      icon: Stethoscope,
      label: 'Shift Kerja',
      value: todayShift === undefined ? 'Memuat…' : (todayShift ? todayShift.name : 'Tidak Ada'),
      sub: todayShift ? `${shiftStartTime} – ${shiftEndTime}` : 'Hari ini',
      color: '#7C3AED',
      bg: '#F5F3FF',
      badge: todayShift ? 'Aktif' : (todayShift === null ? 'Libur' : '…'),
      badgeColor: todayShift ? '#7C3AED' : '#9CA3AF',
      badgeBg: todayShift ? '#EDE9FE' : '#F3F4F6',
    },
    {
      icon: MapPin,
      label: 'Status Lokasi',
      value: gpsStatus === 'loading' ? 'Memuat GPS…'
           : gpsStatus === 'in'      ? 'Dalam Area'
           : gpsStatus === 'out'     ? 'Luar Area'
           : 'GPS Nonaktif',
      sub: 'RSUCL (Klik untuk Refresh)',
      isGpsCard: true,
      color: gpsStatus === 'in'  ? '#16A34A'
           : gpsStatus === 'out' ? '#DC2626'
           : gpsStatus === 'unavailable' ? '#6B7280'
           : '#D97706',
      bg: gpsStatus === 'in'  ? '#DCFCE7'
        : gpsStatus === 'out' ? '#FEE2E2'
        : gpsStatus === 'unavailable' ? '#F9FAFB'
        : '#FEF3C7',
      badge: gpsStatus === 'loading'     ? 'GPS…'
           : gpsStatus === 'in'          ? 'GPS On'
           : gpsStatus === 'out'         ? 'GPS On'
           : 'GPS Off',
      badgeColor: gpsStatus === 'in'  ? '#16A34A'
                : gpsStatus === 'out' ? '#DC2626'
                : gpsStatus === 'unavailable' ? '#6B7280'
                : '#D97706',
      badgeBg: gpsStatus === 'in'  ? '#DCFCE7'
             : gpsStatus === 'out' ? '#FEE2E2'
             : gpsStatus === 'unavailable' ? '#F3F4F6'
             : '#FEF3C7',
    },
  ];

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[13px] text-gray-500 mb-0.5">{dateStr}</p>
          <h1 className="text-xl font-semibold text-gray-900">{getGreeting()}, <span className="text-[#16A34A]">{user?.name}</span> 👋</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{user?.position} · {user?.department}</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-2xl font-mono font-semibold text-black tracking-tight">{timeStr}</div>
          <div className="text-[12px] text-gray-400 mt-0.5">Waktu Indonesia Barat</div>
        </div>
      </div>

      {/* Hari Libur Banner */}
      {todayHoliday && (
        <div className={`mb-5 rounded-2xl border p-4.5 text-[13px] leading-relaxed transition-all shadow-sm ${
          todayHoliday.is_assigned
            ? 'border-purple-200 bg-purple-50 text-purple-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
              todayHoliday.is_assigned ? 'bg-purple-100/80 text-purple-700' : 'bg-red-100/80 text-red-655'
            }`}>
              <Calendar size={15} />
            </div>
            <div>
              <p className="font-bold text-[14px]">
                Hari Libur Nasional: {todayHoliday.name}
              </p>
              <p className="mt-1 text-gray-600">
                {todayHoliday.is_assigned ? (
                  <span>
                    Anda <strong className="text-purple-700">DITUGASKAN</strong> untuk piket hari ini. Aturan absensi normal berlaku dan kompensasi bonus/kerja hari libur akan otomatis terhitung.
                  </span>
                ) : (
                  <span>
                    Anda <strong className="text-red-700">TIDAK DITUGASKAN</strong> untuk masuk hari ini. Libur Anda tidak akan dianggap sebagai Alpa meskipun tidak melakukan absensi.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {stats.map((s, i) => (
          <div
            key={i}
            onClick={s.isGpsCard ? refreshLocation : undefined}
            className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm ${s.isGpsCard ? 'cursor-pointer hover:border-green-300 hover:shadow-md transition-all active:scale-[0.98] group' : ''}`}
            title={s.isGpsCard ? "Klik untuk memperbarui lokasi GPS secara realtime" : undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: s.badgeColor, background: s.badgeBg }}>
                {s.badge}
              </span>
            </div>
            <div className="text-[15px] font-semibold text-gray-900 flex items-center justify-between">
              <span>{s.value}</span>
              {s.isGpsCard && <RotateCw size={13} className="text-gray-400 group-hover:text-[#16A34A] transition-colors" />}
            </div>
            <div className="text-[11px] text-gray-400">{s.label}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shift Info */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#16A34A]" />
              <span className="text-[14px] font-semibold text-gray-800">Info Shift Hari Ini</span>
            </div>
            <span className="text-[12px] text-gray-400">{dateStr}</span>
          </div>
          <div className="p-5 space-y-4">
            {todayShiftsList.length > 0 ? (
              todayShiftsList.map((sItem: any, sIdx: number) => {
                const rItem = todayRecordsList.find((r: any) => r.schedule_id === sItem.id) || (sIdx === 0 ? todayRecord : null);
                const sName = sItem.name || 'Shift Regular';
                const sStart = sItem.start_time ? sItem.start_time.substring(0, 5) : '--:--';
                const sEnd = sItem.end_time ? sItem.end_time.substring(0, 5) : '--:--';
                const sColor = sItem.color || '#16A34A';

                return (
                  <div key={sItem.id || sIdx} className="space-y-3 p-3.5 rounded-2xl bg-slate-50/60 border border-slate-150">
                    <div className="flex items-center gap-3 p-3 rounded-xl border bg-white" style={{ borderColor: sColor + '30' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-[12px]" style={{ background: sColor }}>
                        #{sIdx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-gray-900">{sName}</p>
                          {sItem.is_emergency_callout && (
                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              🚨 Shift Dadakan
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-gray-500 mt-0.5">{shiftDay} · {sStart} – {sEnd} WIB</p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: sColor }}>
                        {rItem?.check_out ? 'Selesai' : rItem?.check_in ? 'Sudah Absen' : 'Aktif'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        {
                          label: 'Jam Masuk',
                          value: sStart,
                          sub: 'WIB',
                          color: '#000000',
                          bg: '#F0FDF4',
                        },
                        {
                          label: 'Check-In Aktual',
                          value: rItem?.check_in ? rItem.check_in.substring(0, 5) : '--:--',
                          sub: rItem?.check_in
                            ? (rItem.status === 'telat' ? 'Terlambat' : 'Tepat Waktu')
                            : (isOffDuty ? (leaveType ?? 'Bebas Tugas') : 'Belum Absen'),
                          color: rItem?.check_in ? '#000000' : '#9CA3AF',
                          bg: rItem?.check_in ? (rItem.status === 'telat' ? '#FFFBEB' : '#F0FDF4') : '#FFFFFF',
                        },
                        {
                          label: 'Jam Pulang',
                          value: sEnd,
                          sub: 'WIB',
                          color: '#000000',
                          bg: '#F0FDF4',
                        },
                      ].map((b, i) => (
                        <div key={i} className="rounded-xl p-2.5 text-center border border-slate-100" style={{ background: b.bg }}>
                          <p className="text-[10px] text-gray-400 mb-0.5">{b.label}</p>
                          <p className="text-[16px] font-bold font-mono" style={{ color: b.color }}>{b.value}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{b.sub}</p>
                        </div>
                      ))}
                    </div>

                    {rItem?.check_out && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-xl">
                        <span className="text-sm">✅</span>
                        <p className="text-[11.5px] text-green-700">
                          Check-out tercatat pukul <strong>{fmtTime(rItem.check_out)} WIB</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : todayShift === undefined ? (
              /* Status memuat */
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 animate-pulse">
                <div className="w-9 h-9 rounded-xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-200 rounded w-48" />
                </div>
              </div>
            ) : (
              /* Tidak ada jadwal shift */
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-gray-500">Tidak Ada Jadwal Shift</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{shiftDay} · Tidak ada shift yang ditugaskan</p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Libur</span>
              </div>
            )}

            {/* Catatan tidak ada shift */}
            {todayShift === null && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl">
                <span className="text-base">📋</span>
                <p className="text-[12px] text-gray-500">Belum ada shift yang ditugaskan untuk hari ini. Hubungi admin untuk pengaturan jadwal.</p>
              </div>
            )}
          </div>
        </div>

        {/* Kolom kanan */}
        <div className="space-y-4">
          {/* Aksi Cepat */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
              <Activity size={16} className="text-[#16A34A]" />
              <span className="text-[14px] font-semibold text-gray-800">Aksi Cepat</span>
            </div>
            <div className="p-3 space-y-1">
              {[
                { label: 'Absensi Check-Out', icon: Clock, tab: 'attendance' },
                { label: 'Riwayat Kehadiran', icon: TrendingUp, tab: 'history' },
                { label: 'Ajukan Cuti', icon: Calendar, tab: 'profile-leave' },
                { label: 'Profil Saya', icon: User, tab: 'profile' },
                { label: 'Panduan Penggunaan', icon: BookOpen, tab: 'guide' },
              ].map(({ label, icon: Icon, tab }, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(tab)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                      <Icon size={14} className="text-[#16A34A]" />
                    </div>
                    <span className="text-[13px] text-gray-700">{label}</span>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Pratinjau notifikasi */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-[#16A34A]" />
                <span className="text-[14px] font-semibold text-gray-800">Notifikasi</span>
              </div>
              {unreadNotifsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{unreadNotifsCount}</span>
              )}
            </div>
            <div className="p-3 space-y-1">
              {notifications.map((n, i) => (
                <div 
                  key={i} 
                  onClick={() => onNavigate('notifications')}
                  className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-green-50/60' : ''}`}
                >
                  <span className="text-lg mt-0.5">{n.type === 'leave' ? '📅' : n.type === 'attendance' ? '⏰' : '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] leading-tight ${!n.is_read ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{n.title}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{n.body}</p>
                  </div>
                  {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] mt-1.5 flex-shrink-0" />}
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-5 text-gray-300 text-[11px]">Belum ada notifikasi.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
