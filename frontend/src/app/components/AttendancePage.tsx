import { useState, useEffect } from 'react';
import { MapPin, Wifi, Navigation, Clock, CheckCircle2, AlertCircle, X, Target, Lock, Coffee, Moon, Sun, Sunset } from 'lucide-react';

// ──────────────────────────────────────────────
// JADWAL KERJA
// Senin–Jumat:
//   Absen dibuka: 08:00
//   Tepat waktu : 08:00 – 08:29
//   Terlambat   : 08:30 – 09:00 (tetap dianggap Hadir)
//   Setelah 09:00 → tidak bisa check-in (Alpha)
//   Check-out   : 17:00 – 18:00
//   Istirahat   : 12:30 – 13:30
// Sabtu: 08:00–09:00 check-in, check-out 13:00
// ──────────────────────────────────────────────

type AttendanceWindow =
  | 'sunday'      // Minggu libur
  | 'too_early'   // Sebelum 08:00
  | 'checkin'     // Jam check-in (08:00–09:00)
  | 'late_locked' // Setelah 09:00, belum check-in → tidak bisa absen
  | 'break'       // Istirahat 12:30–13:30
  | 'working'     // Sedang kerja, belum waktunya pulang (13:30–17:00)
  | 'checkout'    // Jam check-out (17:00–18:00)
  | 'ended';      // Setelah 18:00

function toMins(h: number, m: number) { return h * 60 + m; }

function getWindow(now: Date): AttendanceWindow {
  const day = now.getDay();
  const mins = toMins(now.getHours(), now.getMinutes());

  if (day === 0) return 'sunday';

  if (day >= 1 && day <= 5) {
    if (mins < toMins(8, 0))  return 'too_early';
    if (mins < toMins(9, 1))  return 'checkin';     // 08:00–09:00 bisa check-in
    if (mins < toMins(12, 30)) return 'late_locked'; // 09:01–12:29 sudah tutup check-in
    if (mins < toMins(13, 30)) return 'break';
    if (mins < toMins(17, 0))  return 'working';
    if (mins <= toMins(18, 0)) return 'checkout';
    return 'ended';
  }

  if (day === 6) {
    if (mins < toMins(8, 0))  return 'too_early';
    if (mins < toMins(9, 1))  return 'checkin';
    if (mins < toMins(13, 0)) return 'late_locked';
    if (mins <= toMins(13, 0)) return 'checkout';
    return 'ended';
  }

  return 'ended';
}

const SIM_TIMES = [
  { label: 'Terlalu Pagi (07:00)',       h: 7,  m: 0,  day: 3 },
  { label: 'Buka Absen – Tepat (08:00)', h: 8,  m: 0,  day: 3 },
  { label: 'Tepat Waktu (08:20)',         h: 8,  m: 20, day: 3 },
  { label: 'Terlambat – Hadir (08:45)',  h: 8,  m: 45, day: 3 },
  { label: 'Tutup Check-In (09:05)',      h: 9,  m: 5,  day: 3 },
  { label: 'Jam Kerja (10:00)',           h: 10, m: 0,  day: 3 },
  { label: 'Istirahat (12:30)',           h: 12, m: 30, day: 3 },
  { label: 'Habis Istirahat (13:30)',     h: 13, m: 30, day: 3 },
  { label: 'Jam Pulang (17:00)',          h: 17, m: 0,  day: 3 },
  { label: 'Lewat Batas (18:01)',         h: 18, m: 1,  day: 3 },
  { label: 'Sabtu – Buka (08:00)',        h: 8,  m: 0,  day: 6 },
  { label: 'Sabtu Pulang (13:00)',        h: 13, m: 0,  day: 6 },
  { label: 'Minggu Libur',               h: 10, m: 0,  day: 0 },
];

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function buildSimDate(h: number, m: number, day: number): Date {
  const d = new Date();
  const diff = day - d.getDay();
  d.setDate(d.getDate() + diff);
  d.setHours(h, m, 0, 0);
  return d;
}

const windowConfig: Record<AttendanceWindow, {
  icon: typeof Lock; iconColor: string; bg: string; border: string;
  title: string; desc: string; sub?: string;
}> = {
  sunday:      { icon: Moon,         iconColor: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', title: 'Hari Minggu – Libur',    desc: 'Tidak ada jadwal kerja hari ini.',               sub: 'Sampai jumpa Senin!' },
  too_early:   { icon: Sun,          iconColor: '#D97706', bg: '#FFFBEB', border: '#FDE68A', title: 'Belum Waktunya Absen',   desc: 'Absen dibuka mulai pukul 08:00 WIB.',           sub: 'Silakan kembali setelah pukul 08:00.' },
  checkin:     { icon: CheckCircle2, iconColor: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', title: 'Waktu Check-In',         desc: '08:00 – 08:29 Tepat Waktu · 08:30 – 09:00 Terlambat (tetap Hadir)', sub: '' },
  late_locked: { icon: Lock,         iconColor: '#DC2626', bg: '#FEF2F2', border: '#FECACA', title: 'Batas Check-In Terlewat', desc: 'Check-in sudah ditutup pukul 09:00 WIB.',        sub: 'Silakan hubungi admin jika ada kendala.' },
  break:       { icon: Coffee,       iconColor: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', title: 'Jam Istirahat',          desc: 'Absen dikunci 12:30 – 13:30 WIB.',              sub: '🍽️ Makan siang disediakan di kantor' },
  working:     { icon: Clock,        iconColor: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', title: 'Sedang Jam Kerja',       desc: 'Check-out dibuka pukul 17:00 WIB.',             sub: 'Tetap semangat bekerja!' },
  ended:       { icon: Lock,         iconColor: '#DC2626', bg: '#FEF2F2', border: '#FECACA', title: 'Waktu Absen Berakhir',   desc: 'Batas akhir check-out pukul 18:00 WIB.',        sub: 'Absensi hari ini sudah ditutup.' },
  checkout:    { icon: Sunset,       iconColor: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', title: 'Waktu Check-Out',        desc: 'Silakan lakukan check-out sekarang.',           sub: 'Terima kasih atas dedikasi Anda hari ini!' },
};

export function AttendancePage() {
  const [now, setNow] = useState(new Date());
  const [simIdx, setSimIdx] = useState<number | null>(null);
  const [showSim, setShowSim] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');

  useEffect(() => {
    if (simIdx !== null) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [simIdx]);

  const current = simIdx !== null
    ? buildSimDate(SIM_TIMES[simIdx].h, SIM_TIMES[simIdx].m, SIM_TIMES[simIdx].day)
    : now;

  const window = getWindow(current);
  const wc = windowConfig[window];
  const dayId = DAYS_ID[current.getDay()];
  const isSaturday = current.getDay() === 6;
  const timeStr = current.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = `${dayId}, ${current.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][current.getMonth()]} ${current.getFullYear()}`;

  // What action is possible right now?
  const canCheckIn  = window === 'checkin' && !checkedIn;
  const canCheckOut = window === 'checkout' && checkedIn && !checkedOut;
  const isLocked    = !canCheckIn && !canCheckOut && !checkedOut;

  // Status label shown in locked button
  const lockedLabel = () => {
    if (window === 'too_early') return 'Absen Dibuka Pukul 08:00';
    if (window === 'late_locked') return checkedIn ? 'Menunggu Jam Pulang (17:00)' : 'Batas Check-In Terlewat (09:00)';
    if (window === 'break') return 'Dikunci – Jam Istirahat';
    if (window === 'working') return checkedIn ? 'Check-Out Dibuka Pukul 17:00' : 'Waktu Absen Masuk Telah Lewat';
    if (window === 'ended') return 'Waktu Absen Telah Berakhir';
    if (window === 'sunday') return 'Hari Libur';
    return 'Absen Dikunci';
  };

  const handleAction = () => {
    if (canCheckIn || canCheckOut) setShowModal(true);
  };

  const confirmAction = () => {
    const t = current.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (canCheckIn) { setCheckInTime(t); setCheckedIn(true); }
    else { setCheckOutTime(t); setCheckedOut(true); }
    setShowModal(false);
  };

  // Calculate duration
  const getDuration = () => {
    if (!checkInTime || !checkOutTime) return '--';
    const [ih, im] = checkInTime.split(':').map(Number);
    const [oh, om] = checkOutTime.split(':').map(Number);
    const diff = (oh * 60 + om) - (ih * 60 + im) - (isSaturday ? 0 : 60); // minus 1h break weekday
    if (diff <= 0) return '0j 0m';
    return `${Math.floor(diff / 60)}j ${diff % 60}m`;
  };

  const getAttendStatus = () => {
    if (!checkInTime) return null;
    const [ih, im] = checkInTime.split(':').map(Number);
    const mins = ih * 60 + im;
    // 08:00–08:29 = Tepat Waktu
    if (mins < toMins(8, 30)) return { label: 'Tepat Waktu', color: '#16A34A', bg: '#DCFCE7' };
    // 08:30–09:00 = Terlambat, tapi tetap Hadir
    if (mins <= toMins(9, 0)) return { label: 'Terlambat', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'Hadir', color: '#16A34A', bg: '#DCFCE7' };
  };
  const attendStatus = getAttendStatus();

  // Schedule timeline
  const timelineItems = isSaturday ? [
    { time: '08:00', label: 'Check-In', phase: 'checkin' },
    { time: '13:00', label: 'Check-Out', phase: 'checkout' },
  ] : [
    { time: '08:00', label: 'Buka Absen', phase: 'checkin' },
    { time: '09:00', label: 'Tutup Absen', phase: 'late_locked' },
    { time: '12:30', label: 'Istirahat', phase: 'break' },
    { time: '13:30', label: 'Lanjut Kerja', phase: 'working' },
    { time: '17:00', label: 'Check-Out', phase: 'checkout' },
    { time: '18:00', label: 'Batas Akhir', phase: 'ended' },
  ];

  const phaseOrder: AttendanceWindow[] = ['too_early','checkin','late_locked','break','working','checkout','ended'];
  const currentPhaseIdx = phaseOrder.indexOf(window);

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Absensi</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{dateStr}</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-mono font-semibold text-gray-800 tracking-tight">{timeStr}</p>
          <p className="text-[10px] text-gray-400">WIB</p>
        </div>
      </div>

      {/* Demo mode banner */}
      <div className="mb-4">
        <button
          onClick={() => setShowSim(!showSim)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700 font-medium hover:bg-amber-100 transition-colors"
        >
          <span>🧪 Mode Simulasi Jam – klik untuk menguji jam berbeda</span>
          <span className={`transition-transform ${showSim ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {showSim && (
          <div className="mt-1.5 p-3 bg-amber-50 border border-amber-100 rounded-xl grid grid-cols-2 gap-1.5">
            <button
              onClick={() => { setSimIdx(null); setShowSim(false); }}
              className={`px-2.5 py-2 rounded-lg text-[11px] font-medium text-left transition-colors ${simIdx === null ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'}`}
            >
              ⏱ Waktu Nyata
            </button>
            {SIM_TIMES.map((s, i) => (
              <button
                key={i}
                onClick={() => { setSimIdx(i); setShowSim(false); setCheckedIn(false); setCheckedOut(false); setCheckInTime(''); setCheckOutTime(''); }}
                className={`px-2.5 py-2 rounded-lg text-[11px] font-medium text-left transition-colors ${simIdx === i ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-[#16A34A]" />
          <p className="text-[13px] font-semibold text-gray-800">
            Jadwal {isSaturday ? 'Sabtu' : 'Senin – Jumat'}
          </p>
          {!isSaturday && (
            <span className="ml-auto text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Coffee size={10} /> Istirahat 12:30–13:30
            </span>
          )}
        </div>

        <div className="flex items-center gap-0">
          {timelineItems.map((item, i) => {
            const phaseIdx = phaseOrder.indexOf(item.phase as AttendanceWindow);
            const isDone = phaseIdx < currentPhaseIdx;
            const isActive = item.phase === window || (window === 'checkin' && item.phase === 'checkin') || (window === 'checkout' && item.phase === 'checkout');
            return (
              <div key={i} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                    isActive ? 'bg-[#16A34A] border-[#16A34A] ring-2 ring-[#16A34A]/20' :
                    isDone   ? 'bg-[#16A34A] border-[#16A34A]' : 'bg-white border-gray-300'
                  }`} />
                  <p className="text-[9px] font-mono text-gray-500 mt-1 whitespace-nowrap">{item.time}</p>
                  <p className={`text-[9px] font-medium mt-0.5 whitespace-nowrap ${isActive ? 'text-[#16A34A]' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>{item.label}</p>
                </div>
                {i < timelineItems.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full ${isDone ? 'bg-[#16A34A]' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Banner */}
      {!checkedOut && (
        <div
          className="rounded-2xl border p-4 mb-4 flex items-start gap-3"
          style={{ background: wc.bg, borderColor: wc.border }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/60">
            <wc.icon size={18} style={{ color: wc.iconColor }} />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-gray-900">{wc.title}</p>
            <p className="text-[12px] text-gray-600 mt-0.5">{wc.desc}</p>
            {wc.sub && <p className="text-[11px] text-gray-500 mt-1">{wc.sub}</p>}
          </div>
          {isLocked && window !== 'checkin' && window !== 'checkout' && (
            <div className="flex-shrink-0">
              <Lock size={16} className="text-gray-400" />
            </div>
          )}
        </div>
      )}

      {/* Map Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-[#16A34A]" />
            <span className="text-[13px] font-semibold text-gray-800">Lokasi Saat Ini</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-[11px] text-[#16A34A] font-medium">GPS Aktif</span>
          </div>
        </div>
        {/* Mock Map */}
        <div className="relative h-44 bg-[#e8f4e8] overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
          }} />
          <div className="absolute top-[38%] left-0 right-0 h-4 bg-white/70" />
          <div className="absolute top-[68%] left-0 right-0 h-2.5 bg-white/50" />
          <div className="absolute left-[30%] top-0 bottom-0 w-3 bg-white/70" />
          <div className="absolute left-[65%] top-0 bottom-0 w-2 bg-white/50" />
          <div className="absolute top-[15%] left-[10%] w-14 h-10 bg-green-300/30 rounded-lg" />
          <div className="absolute bottom-[15%] right-[15%] w-12 h-8 bg-green-300/25 rounded-lg" />
          <div className="absolute" style={{ top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'110px',height:'110px',borderRadius:'50%',border:'2px dashed #16A34A',background:'rgba(22,163,74,0.08)' }} />
          <div className="absolute" style={{ top:'50%',left:'50%',transform:'translate(-50%,-100%)' }}>
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-[#16A34A] flex items-center justify-center shadow-lg shadow-green-400/40 border-2 border-white">
                <span className="text-white text-[10px] font-bold">RS</span>
              </div>
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#16A34A] -mt-px" />
            </div>
          </div>
          <div className="absolute" style={{ top:'52%',left:'54%',transform:'translate(-50%,-50%)' }}>
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 bg-blue-500 rounded-full border-2 border-white z-10 shadow-md" />
              <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-60" />
            </div>
          </div>
          <div className="absolute bottom-2 left-3 bg-white/80 rounded-md px-2 py-0.5 flex items-center gap-1">
            <div className="w-8 h-0.5 bg-gray-600" /><span className="text-[9px] text-gray-600">100m</span>
          </div>
          <div className="absolute bottom-2 right-3 bg-white/80 rounded-md px-2 py-0.5">
            <span className="text-[9px] text-gray-600">±5m</span>
          </div>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-gray-400">Lokasi</p>
            <p className="text-[12px] font-medium text-gray-800">Jl. Cempaka Lima No.15</p>
            <p className="text-[11px] text-gray-500">Jakarta Pusat</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">Status Geofence</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <p className="text-[12px] font-medium text-[#16A34A]">Di Area RS (~18m)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rekap if checked in */}
      {checkedIn && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-[12px] font-medium text-gray-500 mb-3">Rekap Absensi Hari Ini</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Jam Masuk', value: checkInTime || '--:--', color: '#2563EB' },
              { label: 'Jam Keluar', value: checkOutTime || '--:--', color: '#DC2626' },
              { label: 'Durasi', value: checkedOut ? getDuration() : '--', color: '#7C3AED' },
              { label: 'Status', value: attendStatus?.label || '--', color: attendStatus?.color || '#6B7280' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <p className="text-[10px] text-gray-400 mb-1">{item.label}</p>
                <p className="text-[12px] font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
          {!isSaturday && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-xl border border-purple-100">
              <Coffee size={12} className="text-purple-500 flex-shrink-0" />
              <p className="text-[11px] text-purple-700">Istirahat 12:30–13:30 · Makan siang disediakan di kantor</p>
            </div>
          )}
        </div>
      )}

      {/* Connection badges */}
      <div className="flex gap-2.5 mb-4">
        {[
          { icon: Wifi, label: 'WiFi RS', st: 'Terhubung', ok: true },
          { icon: Navigation, label: 'GPS', st: 'Aktif', ok: true },
          { icon: Target, label: 'Geofence', st: 'Terverifikasi', ok: true },
        ].map(({ icon: Icon, label, st, ok }, i) => (
          <div key={i} className="flex-1 bg-white rounded-xl border border-gray-100 p-2.5 flex items-center gap-2 shadow-sm">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${ok ? 'bg-green-50' : 'bg-red-50'}`}>
              <Icon size={12} className={ok ? 'text-[#16A34A]' : 'text-red-500'} />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 leading-none">{label}</p>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: ok ? '#16A34A' : '#DC2626' }}>{st}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      {checkedOut ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <CheckCircle2 size={32} className="text-[#16A34A] mx-auto mb-2" />
          <p className="text-[15px] font-semibold text-gray-800">Absensi Selesai</p>
          <p className="text-[13px] text-gray-500 mt-1">Terima kasih · Sampai jumpa besok!</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[10px] text-gray-400">Masuk</p><p className="text-[13px] font-bold text-blue-600">{checkInTime}</p></div>
            <div><p className="text-[10px] text-gray-400">Keluar</p><p className="text-[13px] font-bold text-red-500">{checkOutTime}</p></div>
            <div><p className="text-[10px] text-gray-400">Durasi</p><p className="text-[13px] font-bold text-purple-600">{getDuration()}</p></div>
          </div>
        </div>
      ) : canCheckIn ? (
        <button onClick={handleAction}
          className="w-full py-4 rounded-2xl bg-[#16A34A] hover:bg-[#0d9240] text-white font-semibold text-[16px] transition-all shadow-lg shadow-green-200/60 active:scale-[0.98] flex items-center justify-center gap-3">
          <CheckCircle2 size={20} /> CHECK IN
        </button>
      ) : canCheckOut ? (
        <button onClick={handleAction}
          className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold text-[16px] transition-all shadow-lg shadow-red-200/60 active:scale-[0.98] flex items-center justify-center gap-3">
          <Clock size={20} /> CHECK OUT
        </button>
      ) : (
        /* LOCKED STATE */
        <div className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 border-2 cursor-not-allowed
          ${window === 'break' ? 'bg-purple-50 border-purple-200 text-purple-400' :
            window === 'sunday' || window === 'ended' ? 'bg-gray-100 border-gray-200 text-gray-400' :
            window === 'too_early' ? 'bg-amber-50 border-amber-200 text-amber-400' :
            window === 'late_locked' ? 'bg-red-50 border-red-200 text-red-400' :
            'bg-blue-50 border-blue-200 text-blue-400'}`}
        >
          <Lock size={18} />
          <span className="text-[15px] font-semibold">{lockedLabel()}</span>
        </div>
      )}

      {/* Jadwal info footer */}
      <div className="mt-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-[11px] font-semibold text-gray-500 mb-2">Ketentuan Absensi RSUCL</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Buka absen (Sen–Jum & Sab)</span>
            <span className="font-medium text-[#16A34A]">08:00 WIB</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Tepat waktu</span>
            <span className="font-medium text-[#16A34A]">08:00 – 08:29 WIB</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Terlambat (tetap Hadir)</span>
            <span className="font-medium text-amber-600">08:30 – 09:00 WIB</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Tutup check-in</span>
            <span className="font-medium text-red-500">09:01 WIB → Alpha</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Istirahat (Sen–Jum)</span>
            <span className="font-medium text-purple-600">12:30 – 13:30 WIB</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Check-out / Jam pulang</span>
            <span className="font-medium text-gray-700">17:00 WIB (Sab: 13:00)</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Batas akhir check-out</span>
            <span className="font-medium text-red-500">18:00 WIB</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-2xl mx-0 sm:mx-4">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X size={16} className="text-gray-500" />
            </button>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto ${canCheckIn ? 'bg-green-50' : 'bg-red-50'}`}>
              {canCheckIn ? <CheckCircle2 size={28} className="text-[#16A34A]" /> : <AlertCircle size={28} className="text-red-500" />}
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">
              Konfirmasi {canCheckIn ? 'Check-In' : 'Check-Out'}
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-5">
              Pastikan data di bawah sudah benar sebelum melanjutkan.
            </p>
            <div className="bg-gray-50 rounded-xl p-3.5 mb-5 space-y-2">
              {[
                { label: 'Nama', value: 'Dr. Rina Kusumawati' },
                { label: 'NIP', value: '198501012010012001' },
                { label: 'Waktu', value: `${current.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` },
                { label: 'Jenis', value: canCheckIn ? 'Check-In Masuk' : 'Check-Out Pulang' },
                { label: 'Lokasi', value: 'RSUCL – Dalam Area' },
              ].map(({ label, value }, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[12px] text-gray-500">{label}</span>
                  <span className="text-[12px] font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
              <button onClick={confirmAction} className={`flex-1 py-3 rounded-xl text-[14px] font-semibold text-white transition-all ${canCheckIn ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-600'}`}>
                Ya, Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
