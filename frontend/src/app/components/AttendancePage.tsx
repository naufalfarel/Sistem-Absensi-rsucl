import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Wifi, Navigation, Clock, CheckCircle2, AlertCircle, X,
  Target, Lock, Coffee, Moon, Sun, Sunset, Camera, Signal,
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi, settingApi } from '../../services/api';

// Fix Leaflet default marker icon broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom hospital icon (green)
const hospIcon = L.divIcon({
  html: `<div style="background:#16A34A;border:2px solid #0d9240;border-radius:50% 50% 50% 0;width:28px;height:28px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(22,163,74,0.5)">
           <span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:bold">RS</span>
         </div>`,
  className: '',
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
  popupAnchor:[0, -30],
});

// Custom user icon (blue pulsing)
const userIcon = L.divIcon({
  html: `<div style="position:relative;width:20px;height:20px">
           <div style="position:absolute;inset:0;background:#3B82F6;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(59,130,246,0.6)"></div>
         </div>`,
  className: '',
  iconSize:   [20, 20],
  iconAnchor: [10, 10],
});

// Helper component: re-center map when user location changes
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

// ── Time logic ─────────────────────────────────────────────────────────
type AttendanceWindow = 'sunday' | 'too_early' | 'checkin' | 'late_locked' | 'break' | 'working' | 'checkout' | 'ended';

function toMins(h: number, m: number) { return h * 60 + m; }
function parseMins(t: string) { const [h, m] = t.split(':').map(Number); return toMins(h, m); }

interface ShiftSettings {
  checkin_open:   string; // '08:00'
  late_limit:     string; // '08:30'
  close_checkin:  string; // '09:00'
  break_start:    string; // '12:30'
  break_end:      string; // '13:30'
  checkout_open:  string; // '17:00'
  checkout_close: string; // '18:00'
  sat_checkout_open:  string; // '13:00'
  sat_checkout_close: string; // '13:00'
  hospital_lat:   number;
  hospital_lng:   number;
  gps_radius:     number;
}

const DEFAULT_SHIFT: ShiftSettings = {
  checkin_open:   '08:00',
  late_limit:     '08:30',
  close_checkin:  '09:00',
  break_start:    '12:30',
  break_end:      '13:30',
  checkout_open:  '17:00',
  checkout_close: '18:00',
  sat_checkout_open:  '13:00',
  sat_checkout_close: '13:00',
  hospital_lat:   5.552740480177099,
  hospital_lng:   95.33486560781716,
  gps_radius:     40,
};

function getWindow(now: Date, s: ShiftSettings = DEFAULT_SHIFT): AttendanceWindow {
  const day  = now.getDay();
  const mins = toMins(now.getHours(), now.getMinutes());
  if (day === 0) return 'sunday';
  if (day >= 1 && day <= 5) {
    if (mins <  parseMins(s.checkin_open))  return 'too_early';
    if (mins <= parseMins(s.close_checkin)) return 'checkin';
    if (mins <  parseMins(s.break_start))  return 'late_locked';
    if (mins <  parseMins(s.break_end))    return 'break';
    if (mins <  parseMins(s.checkout_open)) return 'working';
    if (mins <= parseMins(s.checkout_close)) return 'checkout';
    return 'ended';
  }
  if (day === 6) {
    if (mins < parseMins(s.checkin_open))     return 'too_early';
    if (mins <= parseMins(s.close_checkin))   return 'checkin';
    if (mins < parseMins(s.sat_checkout_open)) return 'late_locked';
    if (mins <= parseMins(s.sat_checkout_close)) return 'checkout';
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
  { label: 'Absen Sore (17:01)',          h: 17, m: 1,  day: 3 },
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
  checkout:    { icon: Sunset,       iconColor: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', title: 'Waktu Check-Out',        desc: 'Silakan lakukan check-out sekarang.',           sub: 'Teria kasih atas dedikasi Anda hari ini!' },
};

// ── Face Verification ─────────────────────────────────────────────────
type FaceStep = 'idle' | 'scanning' | 'captured' | 'confirmed';

function FaceVerificationCard({
  faceStep, onCapture, onRetake, employeeName, employeeNip, capturedImage
}: { faceStep: FaceStep; onCapture: (image: string) => void; onRetake: () => void; employeeName: string; employeeNip: string; capturedImage: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      // Camera simulation fallback
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

  const handleCaptureClick = () => {
    let capturedDataUrl = '';
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 320;
      canvas.height = videoRef.current.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        capturedDataUrl = canvas.toDataURL('image/jpeg');
      }
    }
    // Fallback if video tag is empty or fails
    if (!capturedDataUrl) {
      capturedDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
    stopCamera();
    onCapture(capturedDataUrl);
  };

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
            {[['top-2 left-2', 'rounded-tl-lg border-t-2 border-l-2'], ['top-2 right-2', 'rounded-tr-lg border-t-2 border-r-2'], ['bottom-2 left-2', 'rounded-bl-lg border-b-2 border-l-2'], ['bottom-2 right-2', 'rounded-br-lg border-b-2 border-r-2']].map(([pos, cls], i) => (
              <div key={i} className={`absolute ${pos} w-5 h-5 border-[#16A34A] ${cls}`} />
            ))}
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-gray-700">Selfie diperlukan</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Ambil foto wajah Anda untuk memverifikasi identitas sebelum absen</p>
          </div>
          <button
            onClick={() => onCapture('')}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm shadow-green-200 active:scale-[0.98]"
          >
            <Camera size={15} /> Buka Kamera
          </button>
        </div>
      </div>
    );
  }

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
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3] flex items-center justify-center mb-4">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 text-center">
              <div>
                <div className="w-16 h-16 rounded-full border-2 border-white/60 flex items-center justify-center mx-auto mb-2">
                  <Camera size={28} className="text-white/80" />
                </div>
                <p className="text-white/70 text-[11px]">Posisikan wajah di tengah</p>
              </div>
            </div>
            {[['top-3 left-3', 'border-t-2 border-l-2 rounded-tl-lg'], ['top-3 right-3', 'border-t-2 border-r-2 rounded-tr-lg'], ['bottom-3 left-3', 'border-b-2 border-l-2 rounded-bl-lg'], ['bottom-3 right-3', 'border-b-2 border-r-2 rounded-br-lg']].map(([pos, cls], i) => (
              <div key={i} className={`absolute ${pos} w-8 h-8 border-[#16A34A] ${cls}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onRetake} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <X size={14} /> Tutup
            </button>
            <button
              onClick={handleCaptureClick}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-semibold transition-all active:scale-95 shadow-sm shadow-green-200"
            >
              <Camera size={14} /> Ambil Foto
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden mb-4 bg-green-50/30">
      <div className="px-5 py-3.5 border-b border-green-100 flex items-center gap-2">
        <CheckCircle2 size={15} className="text-[#16A34A]" />
        <span className="text-[13px] font-semibold text-green-800">Wajah Terverifikasi ✅</span>
      </div>
      <div className="p-4 flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full bg-gray-200 border-4 border-white shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden">
          {capturedImage ? (
            <img src={capturedImage} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <Camera size={22} className="text-gray-400" />
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#16A34A] rounded-full border border-white flex items-center justify-center">
            <CheckCircle2 size={10} className="text-white" />
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-green-800">{employeeName}</p>
          <p className="text-[11px] text-gray-500">NIP: {employeeNip}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            <span className="text-[11px] text-[#16A34A] font-medium">Identitas dikonfirmasi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GPS Card (Leaflet Real Map) ───────────────────────────────────────────
function GPSCard({
  userLocation,
  gpsActive,
  inGeofence,
  distance,
  hospLat,
  hospLng,
  hospRadius,
}: {
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  gpsActive: boolean;
  inGeofence: boolean;
  distance: number | null;
  hospLat: number;
  hospLng: number;
  hospRadius: number;
}) {
  const signalBars = gpsActive ? (userLocation && userLocation.accuracy <= 15 ? 4 : 3) : 0;

  const mapCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [hospLat, hospLng];

  const gpsData = [
    { label: 'Latitude',       value: userLocation ? `${userLocation.lat.toFixed(7)}°` : 'Mencari...' },
    { label: 'Longitude',      value: userLocation ? `${userLocation.lng.toFixed(7)}°` : 'Mencari...' },
    { label: 'Akurasi',        value: userLocation ? `±${userLocation.accuracy} meter` : '—' },
    { label: 'Radius RS',      value: `${hospRadius} meter` },
    { label: 'Status GPS',     value: gpsActive ? 'Aktif' : 'Mencari...' },
    { label: 'Status',         value: inGeofence ? 'Dalam Area' : 'Luar Area' },
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
            <div className={`w-1.5 h-1.5 rounded-full ${gpsActive ? 'bg-[#16A34A] animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-[11px] font-medium ${gpsActive ? 'text-[#16A34A]' : 'text-red-500'}`}>{gpsActive ? 'GPS Aktif' : 'GPS Mati'}</span>
          </div>
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="h-52 w-full relative">
        <MapContainer
          center={mapCenter}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Geofence radius circle */}
          <Circle
            center={[hospLat, hospLng]}
            radius={hospRadius}
            pathOptions={{
              color:       inGeofence ? '#16A34A' : '#DC2626',
              fillColor:   inGeofence ? '#16A34A' : '#DC2626',
              fillOpacity: 0.08,
              weight:      2,
              dashArray:   '6 4',
            }}
          />

          {/* Hospital marker */}
          <Marker position={[hospLat, hospLng]} icon={hospIcon}>
            <Popup><span className="text-[12px] font-semibold">RSUCL<br /><span className="font-normal text-gray-500">Jl. Politeknik Aceh No.23</span></span></Popup>
          </Marker>

          {/* User location marker */}
          {userLocation && (
            <>
              <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                <Popup><span className="text-[12px]">Lokasi Anda saat ini<br />±{userLocation.accuracy}m akurasi</span></Popup>
              </Marker>
              <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />
            </>
          )}
        </MapContainer>
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
          {gpsData.slice(3).map(({ label, value }) => {
            const isOk = (label === 'Status' && inGeofence) || (label === 'Status GPS' && gpsActive);
            return (
              <div key={label} className={`rounded-xl p-2.5 ${isOk ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className={`text-[11px] font-bold ${isOk ? 'text-[#16A34A]' : 'text-red-500'} font-mono`}>{value}</p>
              </div>
            );
          })}
        </div>
        {/* In-range indicator */}
        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border ${inGeofence ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <Target size={13} className={inGeofence ? 'text-[#16A34A] flex-shrink-0' : 'text-red-500 flex-shrink-0'} />
          <div className="flex-1">
            <p className={`text-[11px] font-semibold ${inGeofence ? 'text-green-800' : 'text-red-800'}`}>
              {inGeofence
                ? `Di dalam area RS (~${Math.round(distance ?? 0)} meter)`
                : distance !== null
                  ? `Di luar area RS (~${Math.round(distance)} meter)`
                  : 'Menunggu lokasi GPS...'}
            </p>
            <p className={`text-[10px] ${inGeofence ? 'text-green-600' : 'text-red-600'} truncate`}>
              {userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}` : 'Memuat lokasi...'}
            </p>
          </div>
          <div className={`w-2 h-2 rounded-full ${inGeofence ? 'bg-[#16A34A] animate-pulse' : 'bg-red-500'}`} />
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
    <div onClick={onDone} className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 cursor-pointer ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
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
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [now, setNow]               = useState(new Date());
  const [simIdx, setSimIdx]         = useState<number | null>(null);
  const [showSim, setShowSim]       = useState(false);
  const [checkedIn, setCheckedIn]   = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [checkInTime, setCheckInTime]   = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');

  // Face verification state machine
  const [faceStep, setFaceStep] = useState<FaceStep>('idle');

  // Success animation
  const [successAction, setSuccessAction] = useState('');
  const [successTime, setSuccessTime]     = useState('');
  const [showSuccess, setShowSuccess]     = useState(false);

  // Dynamic shift settings from backend
  const [shiftSettings, setShiftSettings] = useState<ShiftSettings>(DEFAULT_SHIFT);

  // GPS state
  const HOSP_LAT    = shiftSettings.hospital_lat;
  const HOSP_LNG    = shiftSettings.hospital_lng;
  const HOSP_RADIUS = shiftSettings.gps_radius;
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsActive, setGpsActive]       = useState<boolean>(false);

  // Load shift settings from API
  useEffect(() => {
    settingApi.get().then((res) => {
      if (res.success && res.data) {
        const d = res.data as Record<string, string>;
        setShiftSettings({
          checkin_open:       d.checkin_open      ?? '08:00',
          late_limit:         d.late_limit        ?? '08:30',
          close_checkin:      d.close_checkin     ?? '09:00',
          break_start:        d.break_start       ?? '12:30',
          break_end:          d.break_end         ?? '13:30',
          checkout_open:      d.checkout_open     ?? '17:00',
          checkout_close:     d.checkout_close    ?? '18:00',
          sat_checkout_open:  d.sat_checkout_open  ?? '13:00',
          sat_checkout_close: d.sat_checkout_close ?? '13:00',
          hospital_lat:       d.hospital_lat ? Number(d.hospital_lat) : 5.552740480177099,
          hospital_lng:       d.hospital_lng ? Number(d.hospital_lng) : 95.33486560781716,
          gps_radius:         d.gps_radius ? Number(d.gps_radius) : 40,
        });
      }
    }).catch(() => {/* keep defaults */});
  }, []);

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

  // Browser watch geolocation effect
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Browser Anda tidak mendukung Geolocation GPS.');
      setGpsActive(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsActive(true);
      },
      (err) => {
        console.warn(err);
        setGpsActive(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);


  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const distance = userLocation 
    ? getDistance(userLocation.lat, userLocation.lng, HOSP_LAT, HOSP_LNG)
    : null;

  const inGeofence = distance !== null ? distance <= HOSP_RADIUS : false;

  useEffect(() => {
    if (simIdx !== null) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [simIdx]);

  const current = simIdx !== null
    ? buildSimDate(SIM_TIMES[simIdx].h, SIM_TIMES[simIdx].m, SIM_TIMES[simIdx].day)
    : now;

  const attendanceWindow = getWindow(current, shiftSettings);
  const wc               = windowConfig[attendanceWindow];
  const dayId    = DAYS_ID[current.getDay()];
  const isSaturday = current.getDay() === 6;
  const timeStr  = current.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr  = `${dayId}, ${current.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][current.getMonth()]} ${current.getFullYear()}`;

  // canCheckIn: waktu check-in DAN belum check-in
  // canCheckOut: waktu check-out DAN (sudah check-in ATAU mode simulasi, karena backend sudah hapus+buat ulang)
  const canCheckIn  = attendanceWindow === 'checkin' && !checkedIn;
  const canCheckOut = attendanceWindow === 'checkout' && !checkedOut;

  const faceVerified = faceStep === 'confirmed';

  const lockedLabel = () => {
    if (attendanceWindow === 'too_early')   return `Absen Dibuka Pukul ${shiftSettings.checkin_open}`;
    if (attendanceWindow === 'late_locked') return checkedIn ? `Menunggu Jam Pulang (${shiftSettings.checkout_open})` : `Batas Check-In Terlewat (${shiftSettings.close_checkin})`;
    if (attendanceWindow === 'break')       return 'Dikunci – Jam Istirahat';
    if (attendanceWindow === 'working')     return checkedIn ? `Check-Out Dibuka Pukul ${shiftSettings.checkout_open}` : 'Waktu Absen Masuk Telah Lewat';
    if (attendanceWindow === 'ended')       return 'Waktu Absen Telah Berakhir';
    if (attendanceWindow === 'sunday')      return 'Hari Libur';
    return 'Absen Dikunci';
  };

  const handleAction = () => {
    if ((canCheckIn || canCheckOut) && faceVerified && inGeofence) setShowModal(true);
  };

  const confirmAction = async () => {
    try {
      const latVal = userLocation?.lat ?? HOSP_LAT;
      const lngVal = userLocation?.lng ?? HOSP_LNG;
      const accVal = userLocation?.accuracy ?? undefined;
      
      let simulatedTime: string | undefined = undefined;
      if (simIdx !== null) {
        // Gunakan jam dari pilihan simulasi, BUKAN jam real
        const simH = String(SIM_TIMES[simIdx].h).padStart(2, '0');
        const simM = String(SIM_TIMES[simIdx].m).padStart(2, '0');
        simulatedTime = `${simH}:${simM}:00`;
      }

      if (canCheckIn) {
        const res = await attendanceApi.checkIn(latVal, lngVal, accVal, capturedImage || undefined, simulatedTime);
        if (res.success && res.data.check_in) {
          const t = res.data.check_in.substring(0, 5);
          setCheckInTime(t);
          setCheckedIn(true);
          setShowModal(false);
          setSuccessAction('Check-In');
          setSuccessTime(t);
          setShowSuccess(true);
          // Jangan reset faceStep agar checkout tetap terverifikasi
        }
      } else if (canCheckOut) {
        const res = await attendanceApi.checkOut(latVal, lngVal, accVal, capturedImage || undefined, simulatedTime);
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
  const currentPhaseIdx = phaseOrder.indexOf(attendanceWindow);

  const handleFaceCapture = (image: string) => {
    if (faceStep === 'idle') {
      setFaceStep('scanning');
    } else if (faceStep === 'scanning') {
      setCapturedImage(image);
      setFaceStep('confirmed');
    }
  };
  const handleFaceRetake = () => {
    setCapturedImage(null);
    setFaceStep('idle');
  };

  const resetSim = (idx: number | null) => {
    setSimIdx(idx);
    setShowSim(false);
    // Reset absensi state saat kembali ke waktu nyata
    // tapi saat ganti jam simulasi, tetap pertahankan status check-in/face
    if (idx === null) {
      setCheckedIn(false); setCheckedOut(false);
      setCheckInTime(''); setCheckOutTime('');
      setFaceStep('idle');
      setCapturedImage(null);
    } else {
      // Saat ganti jam simulasi: reset checkedOut agar checkout bisa dicoba,
      // tapi pertahankan faceStep agar tidak perlu verifikasi wajah berulang
      setCheckedOut(false);
      setCheckOutTime('');
    }
  };

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
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

      {/* Demo / Simulation Mode Panel — Jam only */}
      <div className="mb-4 space-y-2">
        <button onClick={() => setShowSim(!showSim)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-700 font-medium hover:bg-amber-100 transition-colors">
          <span>🧪 Mode Simulasi Jam Absen</span>
          <span className={`transition-transform ${showSim ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {showSim && (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <p className="text-[11px] font-semibold text-amber-800 mb-1.5">Simulasikan Jam Absen</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
                {i < timelineItems.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 -mt-4 transition-all ${isDone ? 'bg-[#16A34A]' : 'bg-gray-150'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Face Verification viewfinder */}
      <FaceVerificationCard
        faceStep={faceStep}
        onCapture={handleFaceCapture}
        onRetake={handleFaceRetake}
        employeeName={user?.name ?? 'Dr. Rina Kusumawati'}
        employeeNip={user?.nip ?? '198501012010012001'}
        capturedImage={capturedImage}
      />

      {/* GPS Map Geofence Card */}
      <GPSCard
        userLocation={userLocation}
        gpsActive={gpsActive}
        inGeofence={inGeofence}
        distance={distance}
        hospLat={HOSP_LAT}
        hospLng={HOSP_LNG}
        hospRadius={HOSP_RADIUS}
      />

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
          { icon: Wifi,       label: 'WiFi/Jaringan', st: isOnline ? 'Terhubung' : 'Terputus', ok: isOnline },
          { icon: Navigation, label: 'GPS',           st: gpsActive ? 'Aktif' : 'Nonaktif',    ok: gpsActive },
          { icon: Signal,     label: 'Sinyal',        st: gpsActive && userLocation ? (userLocation.accuracy <= 15 ? 'Kuat (4/4)' : 'Sedang (3/4)') : 'Mencari...', ok: gpsActive },
          { icon: Target,     label: 'Geofence',      st: inGeofence ? 'Terverifikasi' : 'Di Luar Area', ok: inGeofence },
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
          {(!faceVerified || !inGeofence) && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-700">
                {!faceVerified 
                  ? 'Selesaikan verifikasi wajah terlebih dahulu'
                  : 'Anda harus berada di dalam area geofence RSUCL'}
              </p>
            </div>
          )}
          <button onClick={handleAction} disabled={!faceVerified || !inGeofence}
            className={`w-full py-4 rounded-2xl font-semibold text-[16px] transition-all flex items-center justify-center gap-3 ${
              (faceVerified && inGeofence)
                ? 'bg-[#16A34A] hover:bg-[#0d9240] text-white shadow-lg shadow-green-200/60 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed border-2 border-dashed border-gray-200'
            }`}
          >
            {faceVerified && inGeofence ? <CheckCircle2 size={20} /> : <Lock size={18} />}
            {faceVerified && inGeofence ? 'CHECK IN' : !inGeofence ? 'Di Luar Area Geofence' : 'Verifikasi Wajah Diperlukan'}
          </button>
        </div>
      ) : canCheckOut ? (
        <div className="space-y-2">
          {(!faceVerified || !inGeofence) && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-700">
                {!faceVerified 
                  ? 'Selesaikan verifikasi wajah untuk check-out'
                  : 'Anda harus berada di dalam area geofence RSUCL'}
              </p>
            </div>
          )}
          <button onClick={handleAction} disabled={!faceVerified || !inGeofence}
            className={`w-full py-4 rounded-2xl font-semibold text-[16px] transition-all flex items-center justify-center gap-3 ${
              (faceVerified && inGeofence)
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200/60 active:scale-[0.98]'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed border-2 border-dashed border-gray-200'
            }`}
          >
            {faceVerified && inGeofence ? <Clock size={20} /> : <Lock size={18} />}
            {faceVerified && inGeofence ? 'CHECK OUT' : !inGeofence ? 'Di Luar Area Geofence' : 'Verifikasi Wajah Diperlukan'}
          </button>
        </div>
      ) : (
        <div className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 border-2 cursor-not-allowed
          ${attendanceWindow === 'break' ? 'bg-purple-50 border-purple-200 text-purple-400' :
            attendanceWindow === 'sunday' || attendanceWindow === 'ended' ? 'bg-gray-100 border-gray-200 text-gray-400' :
            attendanceWindow === 'too_early' ? 'bg-amber-50 border-amber-200 text-amber-400' :
            attendanceWindow === 'late_locked' ? 'bg-red-50 border-red-200 text-red-400' :
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
            ['Buka absen (Sen–Jum & Sab)', `${shiftSettings.checkin_open} WIB`, 'text-[#16A34A]'],
            ['Tepat waktu', `${shiftSettings.checkin_open} – ${shiftSettings.late_limit} WIB`, 'text-[#16A34A]'],
            ['Terlambat (tetap Hadir)', `${shiftSettings.late_limit} – ${shiftSettings.close_checkin} WIB`, 'text-amber-600'],
            ['Tutup check-in', `${shiftSettings.close_checkin} WIB → Alpha`, 'text-red-500'],
            ['Istirahat (Sen–Jum)', `${shiftSettings.break_start} – ${shiftSettings.break_end} WIB`, 'text-purple-600'],
            ['Check-out / Jam pulang', `${shiftSettings.checkout_open} WIB (Sab: ${shiftSettings.sat_checkout_open})`, 'text-gray-700'],
            ['Batas akhir check-out', `${shiftSettings.checkout_close} WIB`, 'text-red-500'],
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
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
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
                { label: 'Lokasi',           value: inGeofence ? `Dalam Area (~${Math.round(distance ?? 0)}m)` : `Luar Area (~${Math.round(distance ?? 0)}m)` },
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
