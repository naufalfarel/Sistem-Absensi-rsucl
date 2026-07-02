import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Wifi, Navigation, Clock, CheckCircle2, AlertCircle, X,
  Target, Lock, Coffee, Moon, Sun, Sunset, Camera, RefreshCw,
  Signal, Crosshair,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi } from '../../services/api';

// ── Time logic ─────────────────────────────────────────────────────────
type AttendanceWindow = 'sunday' | 'too_early' | 'checkin' | 'late_locked' | 'break' | 'working' | 'checkout' | 'ended';

function toMins(h: number, m: number) { return h * 60 + m; }

function getWindow(now: Date): AttendanceWindow {
  const day  = now.getDay();
  const mins = toMins(now.getHours(), now.getMinutes());
  if (day === 0) return 'sunday';
  if (day >= 1 && day <= 5) {
    if (mins < toMins(8, 0))  return 'too_early';
    if (mins < toMins(9, 1))  return 'checkin';
    if (mins < toMins(12,30)) return 'late_locked';
    if (mins < toMins(13,30)) return 'break';
    if (mins < toMins(17, 0)) return 'working';
    if (mins <= toMins(18,0)) return 'checkout';
    return 'ended';
  }
  if (day === 6) {
    if (mins < toMins(8, 0))  return 'too_early';
    if (mins < toMins(9, 1))  return 'checkin';
    if (mins < toMins(13, 0)) return 'late_locked';
    if (mins <= toMins(13,0)) return 'checkout';
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
  const d = new Date(); const diff = day - d.getDay();
  d.setDate(d.getDate() + diff); d.setHours(h, m, 0, 0); return d;
}

const windowConfig: Record<AttendanceWindow, { icon: typeof Lock; iconColor: string; bg: string; border: string; title: string; desc: string; sub?: string }> = {
  sunday:      { icon: Moon,         iconColor: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', title: 'Hari Minggu – Libur',    desc: 'Tidak ada jadwal kerja hari ini.',               sub: 'Sampai jumpa Senin!' },
  too_early:   { icon: Sun,          iconColor: '#D97706', bg: '#FFFBEB', border: '#FDE68A', title: 'Belum Waktunya Absen',   desc: 'Absen dibuka mulai pukul 08:00 WIB.',           sub: 'Silakan kembali setelah pukul 08:00.' },
  checkin:     { icon: CheckCircle2, iconColor: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', title: 'Waktu Check-In',         desc: '08:00 – 08:29 Tepat Waktu · 08:30 – 09:00 Terlambat (tetap Hadir)', sub: '' },
  late_locked: { icon: Lock,         iconColor: '#DC2626', bg: '#FEF2F2', border: '#FECACA', title: 'Batas Check-In Terlewat', desc: 'Check-in sudah ditutup pukul 09:00 WIB.',       sub: 'Silakan hubungi admin jika ada kendala.' },
  break:       { icon: Coffee,       iconColor: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', title: 'Jam Istirahat',          desc: 'Absen dikunci 12:30 – 13:30 WIB.',              sub: '🍽️ Makan siang disediakan di kantor' },
  working:     { icon: Clock,        iconColor: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', title: 'Sedang Jam Kerja',       desc: 'Check-out dibuka pukul 17:00 WIB.',             sub: 'Tetap semangat bekerja!' },
  ended:       { icon: Lock,         iconColor: '#DC2626', bg: '#FEF2F2', border: '#FECACA', title: 'Waktu Absen Berakhir',   desc: 'Batas akhir check-out pukul 18:00 WIB.',        sub: 'Absensi hari ini sudah ditutup.' },
  checkout:    { icon: Sunset,       iconColor: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', title: 'Waktu Check-Out',        desc: 'Silakan lakukan check-out sekarang.',           sub: 'Terima kasih atas dedikasi Anda hari ini!' },
};

// ── Face Verification ─────────────────────────────────────────────────
type FaceStep = 'idle' | 'scanning' | 'captured' | 'confirmed';

// ── Captured sub-component (needs its own useEffect) ─────────────────
function CapturedStep({ onConfirmed }: { onConfirmed: () => void }) {
  const [countdown, setCountdown] = useState(3);
  useEffect(() => {
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    const timeout  = setTimeout(onConfirmed, 3000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
        <Camera size={15} className="text-amber-500" />
        <span className="text-[13px] font-semibold text-gray-800">Memverifikasi Wajah…</span>
      </div>
      <div className="p-5 flex flex-col items-center gap-4">
        <div className="relative w-28 h-28 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-md flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-300 to-gray-400" />
          <Camera size={32} className="text-white/70 relative z-10" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#16A34A] animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-semibold text-gray-700">Mencocokkan wajah...</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Mohon tunggu sebentar ({countdown}s)</p>
        </div>
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i < (3 - countdown) ? 'bg-[#16A34A]' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FaceVerificationCard({
  faceStep, onCapture, onRetake,
}: { faceStep: FaceStep; onCapture: () => void; onRetake: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera when scanning
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      // Camera unavailable — simulation mode still works
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (faceStep === 'scanning') { startCamera(); }
    else stopCamera();
    return () => stopCamera();
  }, [faceStep, startCamera, stopCamera]);

  // Step 1: viewfinder
  if (faceStep === 'idle') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <Camera size={15} className="text-[#16A34A]" />
          <span className="text-[13px] font-semibold text-gray-800">Verifikasi Wajah</span>
          <span className="ml-auto text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Diperlukan</span>
        </div>
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="relative w-32 h-32 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
            <Camera size={36} className="text-gray-300" />
            {/* Corner brackets */}
            {[['top-2 left-2', 'rounded-tl-lg border-t-2 border-l-2'], ['top-2 right-2', 'rounded-tr-lg border-t-2 border-r-2'], ['bottom-2 left-2', 'rounded-bl-lg border-b-2 border-l-2'], ['bottom-2 right-2', 'rounded-br-lg border-b-2 border-r-2']].map(([pos, cls], i) => (
              <div key={i} className={`absolute ${pos} w-5 h-5 border-[#16A34A] ${cls}`} />
            ))}
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-gray-700">Selfie diperlukan</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Ambil foto wajah Anda untuk memverifikasi identitas sebelum absen</p>
          </div>
          <button
            onClick={() => { onCapture(); }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm shadow-green-200 active:scale-[0.98]"
          >
            <Camera size={15} /> Buka Kamera
          </button>
        </div>
      </div>
    );
  }

  // Step 2: scanning / viewfinder active
  if (faceStep === 'scanning') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <Camera size={15} className="text-blue-500" />
          <span className="text-[13px] font-semibold text-gray-800">Kamera Aktif</span>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-blue-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" /> Live
          </span>
        </div>
        <div className="p-4">
          {/* Viewfinder */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3] flex items-center justify-center mb-4">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            {/* Overlay when camera not available */}
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 text-center">
              <div>
                <div className="w-16 h-16 rounded-full border-2 border-white/60 flex items-center justify-center mx-auto mb-2">
                  <Camera size={28} className="text-white/80" />
                </div>
                <p className="text-white/70 text-[11px]">Posisikan wajah di tengah</p>
              </div>
            </div>
            {/* Corner brackets */}
            {[['top-3 left-3', 'border-t-2 border-l-2 rounded-tl-lg'], ['top-3 right-3', 'border-t-2 border-r-2 rounded-tr-lg'], ['bottom-3 left-3', 'border-b-2 border-l-2 rounded-bl-lg'], ['bottom-3 right-3', 'border-b-2 border-r-2 rounded-br-lg']].map(([pos, cls], i) => (
              <div key={i} className={`absolute ${pos} w-8 h-8 border-[#16A34A] ${cls}`} />
            ))}
            {/* Scan line */}
            <div className="absolute left-0 right-0 h-0.5 bg-[#16A34A]/60 animate-[scan_2s_ease-in-out_infinite]" style={{ top: '50%' }} />
          </div>
          <div className="flex gap-2">
            <button onClick={onRetake} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <X size={14} /> Tutup
            </button>
            <button
              onClick={() => { stopCamera(); onCapture(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-semibold transition-all active:scale-95 shadow-sm shadow-green-200"
            >
              <Camera size={14} /> Ambil Foto
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: captured — delegate to CapturedStep
  if (faceStep === 'captured') {
    return <CapturedStep onConfirmed={onCapture} />;
  }

  // Step 4: confirmed ✅
  return (
    <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden mb-4 bg-green-50/30">
      <div className="px-5 py-3.5 border-b border-green-100 flex items-center gap-2">
        <CheckCircle2 size={15} className="text-[#16A34A]" />
        <span className="text-[13px] font-semibold text-green-800">Wajah Terverifikasi ✅</span>
      </div>
      <div className="p-4 flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-b from-gray-300 to-gray-400 border-4 border-white shadow-md flex items-center justify-center flex-shrink-0">
          <Camera size={22} className="text-white/70" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#16A34A] rounded-full border-2 border-white flex items-center justify-center">
            <CheckCircle2 size={12} className="text-white" />
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-green-800">Dr. Rina Kusumawati</p>
          <p className="text-[11px] text-gray-500">NIP: 198501012010012001</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            <span className="text-[11px] text-[#16A34A] font-medium">Identitas dikonfirmasi</span>
          </div>
        </div>
        <button onClick={onRetake} className="ml-auto text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors" title="Ulangi">
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
}

// ── GPS Card ──────────────────────────────────────────────────────────
function GPSCard() {
  const [signalBars] = useState(4);

  const gpsData = [
    { label: 'Latitude',       value: '-6.176497°' },
    { label: 'Longitude',      value: '106.827537°' },
    { label: 'Akurasi',        value: '±5 meter' },
    { label: 'Radius RS',      value: '100 meter' },
    { label: 'Status GPS',     value: 'Aktif' },
    { label: 'Status Geofence',value: 'Dalam Area' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-[#16A34A]" />
          <span className="text-[13px] font-semibold text-gray-800">Lokasi GPS</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Signal bars */}
          <div className="flex items-end gap-[3px]">
            {[1,2,3,4].map(bar => (
              <div key={bar} className={`w-1 rounded-sm transition-all ${bar <= signalBars ? 'bg-[#16A34A]' : 'bg-gray-200'}`} style={{ height: `${bar * 3 + 4}px` }} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-[11px] text-[#16A34A] font-medium">GPS Aktif</span>
          </div>
        </div>
      </div>

      {/* Map area — Google Maps style */}
      <div className="relative h-52 bg-[#e8f4e8] overflow-hidden">
        {/* Road grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
        }} />
        {/* Roads */}
        <div className="absolute top-[40%] left-0 right-0 h-5 bg-white/80 shadow-sm" />
        <div className="absolute top-[70%] left-0 right-0 h-3 bg-white/60" />
        <div className="absolute left-[28%] top-0 bottom-0 w-4 bg-white/80 shadow-sm" />
        <div className="absolute left-[66%] top-0 bottom-0 w-2.5 bg-white/60" />
        {/* Buildings */}
        <div className="absolute top-[12%] left-[8%] w-16 h-12 bg-green-300/30 rounded-lg border border-green-200/50" />
        <div className="absolute bottom-[12%] right-[12%] w-14 h-10 bg-green-300/25 rounded-lg border border-green-200/40" />
        <div className="absolute top-[55%] right-[30%] w-10 h-8 bg-blue-300/20 rounded border border-blue-200/40" />

        {/* Geofence radius circle */}
        <div className="absolute" style={{
          top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width: '120px', height: '120px', borderRadius: '50%',
          border: '2px dashed rgba(22,163,74,0.5)',
          background: 'rgba(22,163,74,0.07)',
        }} />
        {/* Outer ring pulse */}
        <div className="absolute animate-ping" style={{
          top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:'130px', height:'130px', borderRadius:'50%',
          border:'1px solid rgba(22,163,74,0.2)',
          animationDuration: '3s',
        }} />

        {/* RS Marker */}
        <div className="absolute" style={{ top:'50%', left:'50%', transform:'translate(-50%,-100%)' }}>
          <div className="flex flex-col items-center">
            <div className="px-2.5 py-1 bg-[#16A34A] rounded-lg shadow-lg shadow-green-400/50 border border-green-600 flex items-center gap-1.5">
              <span className="text-white text-[10px] font-bold">RS</span>
              <span className="text-green-100 text-[9px]">RSUCL</span>
            </div>
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#16A34A] -mt-px" />
          </div>
        </div>

        {/* User location — pulsing dot */}
        <div className="absolute" style={{ top:'54%', left:'55%', transform:'translate(-50%,-50%)' }}>
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 bg-blue-500 rounded-full border-2 border-white shadow-lg shadow-blue-400/60 z-10" />
            <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-70" style={{ animationDuration:'1.5s' }} />
            <div className="absolute -inset-2 bg-blue-300 rounded-full animate-ping opacity-30" style={{ animationDuration:'2s' }} />
          </div>
        </div>

        {/* Corner brackets (Google Maps style) */}
        {[['top-2 left-2','border-t-2 border-l-2 rounded-tl'], ['top-2 right-2','border-t-2 border-r-2 rounded-tr'], ['bottom-2 left-2','border-b-2 border-l-2 rounded-bl'], ['bottom-2 right-2','border-b-2 border-r-2 rounded-br']].map(([pos, cls], i) => (
          <div key={i} className={`absolute ${pos} w-5 h-5 border-gray-500/40 ${cls}`} />
        ))}

        {/* Scale bar */}
        <div className="absolute bottom-2 left-3 bg-white/85 rounded-md px-2 py-1 flex items-center gap-1 shadow-sm">
          <div className="w-8 h-0.5 bg-gray-700 relative">
            <div className="absolute left-0 -top-0.5 w-0.5 h-1.5 bg-gray-700" />
            <div className="absolute right-0 -top-0.5 w-0.5 h-1.5 bg-gray-700" />
          </div>
          <span className="text-[9px] text-gray-600 font-medium">100m</span>
        </div>
        {/* Accuracy badge */}
        <div className="absolute bottom-2 right-3 bg-white/85 rounded-md px-2 py-1 shadow-sm">
          <span className="text-[9px] text-gray-600 font-medium">Akurasi ±5m</span>
        </div>
        {/* Map watermark */}
        <div className="absolute top-2 right-2 bg-white/70 rounded px-1.5 py-0.5">
          <span className="text-[8px] text-gray-400">Peta RSUCL</span>
        </div>
      </div>

      {/* GPS Data grid */}
      <div className="px-4 py-3 border-t border-gray-50">
        <div className="grid grid-cols-3 gap-3 mb-3">
          {gpsData.slice(0,3).map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-[11px] font-bold text-gray-800 font-mono">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {gpsData.slice(3).map(({ label, value }) => (
            <div key={label} className={`rounded-xl p-2.5 ${label === 'Status Geofence' ? 'bg-green-50 border border-green-100' : label === 'Status GPS' ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
              <p className={`text-[11px] font-bold ${label.startsWith('Status') ? 'text-[#16A34A]' : 'text-gray-800'} font-mono`}>{value}</p>
            </div>
          ))}
        </div>
        {/* In-range indicator */}
        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-100">
          <Crosshair size={13} className="text-[#16A34A] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-green-800">Di dalam area RS (~18 meter)</p>
            <p className="text-[10px] text-green-600">Jl. Cempaka Lima No.15, Jakarta Pusat</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ── Success Animation ─────────────────────────────────────────────────
function SuccessAnimation({ action, time, onDone }: { action: string; time: string; onDone: () => void }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 500); }, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-4">
        {/* Ripple circles */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {[0,1,2].map(i => (
            <div key={i} className="absolute rounded-full bg-[#16A34A] opacity-0"
              style={{
                width: '128px', height: '128px',
                animation: `ripple 2s ease-out ${i * 0.4}s infinite`,
              }}
            />
          ))}
          <div className="relative z-10 w-20 h-20 rounded-full bg-[#16A34A] flex items-center justify-center shadow-2xl shadow-green-400/50">
            <CheckCircle2 size={40} className="text-white" />
          </div>
        </div>
        {/* Card */}
        <div className="bg-white rounded-2xl px-8 py-5 shadow-2xl text-center min-w-[220px]">
          <p className="text-[18px] font-bold text-gray-900">{action} Berhasil!</p>
          <p className="text-[13px] text-gray-500 mt-1">{user?.name}</p>
          <div className="mt-3 px-4 py-2 bg-green-50 rounded-xl">
            <p className="text-[22px] font-mono font-bold text-[#16A34A]">{time}</p>
            <p className="text-[10px] text-gray-400">WIB</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ripple keyframes injected once ────────────────────────────────────
const RIPPLE_STYLE = `
@keyframes ripple {
  0%   { transform: scale(0.5); opacity: 0.4; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes scan {
  0%, 100% { transform: translateY(-80px); opacity: 0.8; }
  50%       { transform: translateY(80px); opacity: 0.8; }
}
`;

// ── Main AttendancePage ───────────────────────────────────────────────
export function AttendancePage() {
  const { user } = useAuth();
  const [now, setNow]               = useState(new Date());
  const [simIdx, setSimIdx]         = useState<number | null>(null);
  const [showSim, setShowSim]       = useState(false);
  const [checkedIn, setCheckedIn]   = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [checkInTime, setCheckInTime]   = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');

  // Face verification state machine
  // idle → scanning → captured → confirmed
  const [faceStep, setFaceStep] = useState<FaceStep>('idle');

  // Success animation
  const [successAction, setSuccessAction] = useState('');
  const [successTime, setSuccessTime]     = useState('');
  const [showSuccess, setShowSuccess]     = useState(false);

  // Load today's record on mount
  useEffect(() => {
    const loadTodayRecord = async () => {
      try {
        const res = await attendanceApi.today();
        if (res.success && res.data) {
          if (res.data.check_in) {
            setCheckInTime(res.data.check_in.substring(0, 5));
            setCheckedIn(true);
          }
          if (res.data.check_out) {
            setCheckOutTime(res.data.check_out.substring(0, 5));
            setCheckedOut(true);
          }
        }
      } catch (err) {
        console.error('Error fetching today record:', err);
      }
    };
    loadTodayRecord();
  }, []);

  useEffect(() => {
    if (simIdx !== null) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [simIdx]);

  const current = simIdx !== null
    ? buildSimDate(SIM_TIMES[simIdx].h, SIM_TIMES[simIdx].m, SIM_TIMES[simIdx].day)
    : now;

  const window   = getWindow(current);
  const wc       = windowConfig[window];
  const dayId    = DAYS_ID[current.getDay()];
  const isSaturday = current.getDay() === 6;
  const timeStr  = current.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr  = `${dayId}, ${current.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][current.getMonth()]} ${current.getFullYear()}`;

  const canCheckIn  = window === 'checkin'  && !checkedIn;
  const canCheckOut = window === 'checkout' && checkedIn && !checkedOut;

  const faceVerified = faceStep === 'confirmed';

  const lockedLabel = () => {
    if (window === 'too_early')  return 'Absen Dibuka Pukul 08:00';
    if (window === 'late_locked') return checkedIn ? 'Menunggu Jam Pulang (17:00)' : 'Batas Check-In Terlewat (09:00)';
    if (window === 'break')      return 'Dikunci – Jam Istirahat';
    if (window === 'working')    return checkedIn ? 'Check-Out Dibuka Pukul 17:00' : 'Waktu Absen Masuk Telah Lewat';
    if (window === 'ended')      return 'Waktu Absen Telah Berakhir';
    if (window === 'sunday')     return 'Hari Libur';
    return 'Absen Dikunci';
  };

  const handleAction = () => {
    if ((canCheckIn || canCheckOut) && faceVerified) setShowModal(true);
  };

  const confirmAction = async () => {
    try {
      if (canCheckIn) {
        const res = await attendanceApi.checkIn(5.5503, 95.3182); // RSUCL coordinates
        if (res.success && res.data.check_in) {
          const t = res.data.check_in.substring(0, 5);
          setCheckInTime(t);
          setCheckedIn(true);
          setShowModal(false);
          setSuccessAction('Check-In');
          setSuccessTime(t);
          setShowSuccess(true);
        }
      } else if (canCheckOut) {
        const res = await attendanceApi.checkOut(5.5503, 95.3182);
        if (res.success && res.data.check_out) {
          const t = res.data.check_out.substring(0, 5);
          setCheckOutTime(t);
          setCheckedOut(true);
          setShowModal(false);
          setSuccessAction('Check-Out');
          setSuccessTime(t);
          setShowSuccess(true);
        }
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal melakukan absensi.');
    }
  };

  const getDuration = () => {
    if (!checkInTime || !checkOutTime) return '--';
    const [ih, im] = checkInTime.split(':').map(Number);
    const [oh, om] = checkOutTime.split(':').map(Number);
    const diff = (oh * 60 + om) - (ih * 60 + im) - (isSaturday ? 0 : 60);
    if (diff <= 0) return '0j 0m';
    return `${Math.floor(diff / 60)}j ${diff % 60}m`;
  };

  const getAttendStatus = () => {
    if (!checkInTime) return null;
    const [ih, im] = checkInTime.split(':').map(Number);
    const mins = ih * 60 + im;
    if (mins < toMins(8, 30)) return { label: 'Tepat Waktu', color: '#16A34A', bg: '#DCFCE7' };
    if (mins <= toMins(9, 0)) return { label: 'Terlambat', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'Hadir', color: '#16A34A', bg: '#DCFCE7' };
  };
  const attendStatus = getAttendStatus();

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

  // Face step handlers
  const handleFaceCapture = () => {
    if (faceStep === 'idle')     { setFaceStep('scanning'); return; }
    if (faceStep === 'scanning') { setFaceStep('captured'); return; }
    if (faceStep === 'captured') { setFaceStep('confirmed'); }
  };
  const handleFaceRetake = () => {
    if (faceStep === 'scanning') { setFaceStep('idle'); return; }
    setFaceStep('idle');
  };

  const resetSim = (idx: number | null) => {
    setSimIdx(idx); setShowSim(false);
    setCheckedIn(false); setCheckedOut(false);
    setCheckInTime(''); setCheckOutTime('');
    setFaceStep('idle');
  };

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      {/* Inject keyframes */}
      <style>{RIPPLE_STYLE}</style>

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
        <button onClick={() => setShowSim(!showSim)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700 font-medium hover:bg-amber-100 transition-colors">
          <span>🧪 Mode Simulasi Jam – klik untuk menguji jam berbeda</span>
          <span className={`transition-transform ${showSim ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {showSim && (
          <div className="mt-1.5 p-3 bg-amber-50 border border-amber-100 rounded-xl grid grid-cols-2 gap-1.5">
            <button onClick={() => resetSim(null)}
              className={`px-2.5 py-2 rounded-lg text-[11px] font-medium text-left transition-colors ${simIdx === null ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'}`}>
              ⏱ Waktu Nyata
            </button>
            {SIM_TIMES.map((s, i) => (
              <button key={i} onClick={() => resetSim(i)}
                className={`px-2.5 py-2 rounded-lg text-[11px] font-medium text-left transition-colors ${simIdx === i ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'}`}>
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
          <p className="text-[13px] font-semibold text-gray-800">Jadwal {isSaturday ? 'Sabtu' : 'Senin – Jumat'}</p>
          {!isSaturday && (
            <span className="ml-auto text-[11px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Coffee size={10} /> Istirahat 12:30–13:30
            </span>
          )}
        </div>
        <div className="flex items-center gap-0">
          {timelineItems.map((item, i) => {
            const phaseIdx = phaseOrder.indexOf(item.phase as AttendanceWindow);
            const isDone   = phaseIdx < currentPhaseIdx;
            const isActive = item.phase === window || (window === 'checkin' && item.phase === 'checkin') || (window === 'checkout' && item.phase === 'checkout');
            return (
              <div key={i} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full border-2 transition-all ${isActive ? 'bg-[#16A34A] border-[#16A34A] ring-2 ring-[#16A34A]/20' : isDone ? 'bg-[#16A34A] border-[#16A34A]' : 'bg-white border-gray-300'}`} />
                  <p className="text-[9px] font-mono text-gray-500 mt-1 whitespace-nowrap">{item.time}</p>
                  <p className={`text-[9px] font-medium mt-0.5 whitespace-nowrap ${isActive ? 'text-[#16A34A]' : isDone ? 'text-gray-400' : 'text-gray-300'}`}>{item.label}</p>
                </div>
                {i < timelineItems.length - 1 && <div className={`flex-1 h-0.5 mx-1 rounded-full ${isDone ? 'bg-[#16A34A]' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Banner */}
      {!checkedOut && (
        <div className="rounded-2xl border p-4 mb-4 flex items-start gap-3" style={{ background: wc.bg, borderColor: wc.border }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/60">
            <wc.icon size={18} style={{ color: wc.iconColor }} />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-gray-900">{wc.title}</p>
            <p className="text-[12px] text-gray-600 mt-0.5">{wc.desc}</p>
            {wc.sub && <p className="text-[11px] text-gray-500 mt-1">{wc.sub}</p>}
          </div>
        </div>
      )}

      {/* GPS Card */}
      <GPSCard />

      {/* Face Verification — only show when check-in/out time is active */}
      {(canCheckIn || canCheckOut || faceStep !== 'idle') && !checkedOut && (
        <FaceVerificationCard faceStep={faceStep} onCapture={handleFaceCapture} onRetake={handleFaceRetake} />
      )}

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
          { icon: Wifi,       label: 'WiFi RS',  st: 'Terhubung',    ok: true },
          { icon: Navigation, label: 'GPS',       st: 'Aktif',        ok: true },
          { icon: Signal,     label: 'Sinyal',    st: 'Kuat (4/4)',   ok: true },
          { icon: Target,     label: 'Geofence',  st: 'Terverifikasi',ok: true },
        ].map(({ icon: Icon, label, st, ok }, i) => (
          <div key={i} className="flex-1 bg-white rounded-xl border border-gray-100 p-2 flex items-center gap-1.5 shadow-sm">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${ok ? 'bg-green-50' : 'bg-red-50'}`}>
              <Icon size={12} className={ok ? 'text-[#16A34A]' : 'text-red-500'} />
            </div>
            <div>
              <p className="text-[9px] text-gray-400 leading-none">{label}</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: ok ? '#16A34A' : '#DC2626' }}>{st}</p>
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
        <div className="space-y-2">
          {!faceVerified && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-700">Selesaikan verifikasi wajah terlebih dahulu</p>
            </div>
          )}
          <button onClick={handleAction} disabled={!faceVerified}
            className={`w-full py-4 rounded-2xl font-semibold text-[16px] transition-all flex items-center justify-center gap-3 ${
              faceVerified
                ? 'bg-[#16A34A] hover:bg-[#0d9240] text-white shadow-lg shadow-green-200/60 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed border-2 border-dashed border-gray-200'
            }`}
          >
            {faceVerified ? <CheckCircle2 size={20} /> : <Lock size={18} />}
            {faceVerified ? 'CHECK IN' : 'Verifikasi Wajah Diperlukan'}
          </button>
        </div>
      ) : canCheckOut ? (
        <div className="space-y-2">
          {!faceVerified && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-700">Selesaikan verifikasi wajah untuk check-out</p>
            </div>
          )}
          <button onClick={handleAction} disabled={!faceVerified}
            className={`w-full py-4 rounded-2xl font-semibold text-[16px] transition-all flex items-center justify-center gap-3 ${
              faceVerified
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200/60 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed border-2 border-dashed border-gray-200'
            }`}
          >
            {faceVerified ? <Clock size={20} /> : <Lock size={18} />}
            {faceVerified ? 'CHECK OUT' : 'Verifikasi Wajah Diperlukan'}
          </button>
        </div>
      ) : (
        <div className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 border-2 cursor-not-allowed
          ${window === 'break' ? 'bg-purple-50 border-purple-200 text-purple-400' :
            window === 'sunday' || window === 'ended' ? 'bg-gray-100 border-gray-200 text-gray-400' :
            window === 'too_early' ? 'bg-amber-50 border-amber-200 text-amber-400' :
            window === 'late_locked' ? 'bg-red-50 border-red-200 text-red-400' :
            'bg-blue-50 border-blue-200 text-blue-400'}`}>
          <Lock size={18} />
          <span className="text-[15px] font-semibold">{lockedLabel()}</span>
        </div>
      )}

      {/* Rules footer */}
      <div className="mt-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-[11px] font-semibold text-gray-500 mb-2">Ketentuan Absensi RSUCL</p>
        <div className="space-y-1.5">
          {[
            ['Buka absen (Sen–Jum & Sab)', '08:00 WIB', 'text-[#16A34A]'],
            ['Tepat waktu', '08:00 – 08:29 WIB', 'text-[#16A34A]'],
            ['Terlambat (tetap Hadir)', '08:30 – 09:00 WIB', 'text-amber-600'],
            ['Tutup check-in', '09:01 WIB → Alpha', 'text-red-500'],
            ['Istirahat (Sen–Jum)', '12:30 – 13:30 WIB', 'text-purple-600'],
            ['Check-out / Jam pulang', '17:00 WIB (Sab: 13:00)', 'text-gray-700'],
            ['Batas akhir check-out', '18:00 WIB', 'text-red-500'],
          ].map(([label, value, cls], i) => (
            <div key={i} className="flex justify-between text-[11px]">
              <span className="text-gray-500">{label}</span>
              <span className={`font-medium ${cls}`}>{value}</span>
            </div>
          ))}
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
            <p className="text-[13px] text-gray-500 text-center mb-5">Apakah Anda yakin ingin melakukan absensi?</p>
            <div className="bg-gray-50 rounded-xl p-3.5 mb-5 space-y-2">
              {[
                { label: 'Nama',             value: user?.name ?? 'Dr. Rina Kusumawati' },
                { label: 'NIP',              value: user?.nip ?? '198501012010012001' },
                { label: 'Waktu',            value: `${current.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` },
                { label: 'Jenis',            value: canCheckIn ? 'Check-In Masuk' : 'Check-Out Pulang' },
                { label: 'Lokasi',           value: 'RSUCL – Dalam Area (~18m)' },
                { label: 'Verifikasi Wajah', value: '✅ Terverifikasi' },
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

      {/* Success Animation */}
      {showSuccess && (
        <SuccessAnimation
          action={successAction}
          time={successTime}
          onDone={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
}
