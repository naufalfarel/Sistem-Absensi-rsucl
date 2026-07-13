import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Wifi, Navigation, Clock, CheckCircle2, AlertCircle, X,
  Target, Lock, Coffee, Moon, Sun, Sunset, Camera, Signal,
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { attendanceApi, settingApi, scheduleApi, MyShiftSchedule } from '../../services/api';

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
type AttendanceWindow = 'sunday' | 'too_early' | 'checkin' | 'late_locked' | 'break' | 'working' | 'checkout' | 'ended' | 'no_shift';

function toMins(h: number, m: number) { return h * 60 + m; }
function parseMins(t: string) { const [h, m] = t.split(':').map(Number); return toMins(h, m); }
function addMins(hhmm: string, mins: number): string {
  const total = parseMins(hhmm) + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function subMins(hhmm: string, mins: number): string {
  let total = parseMins(hhmm) - mins;
  if (total < 0) total += 24 * 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

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
  isOvernight:    boolean; // shift lintas tengah malam (mis. Malam 21:00-07:00)
  early_checkout_grace_minutes?: string;
  overtime_grace_minutes?: string;
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
  isOvernight:    false,
  early_checkout_grace_minutes: '15',
  overtime_grace_minutes: '15',
};

function getWindow(now: Date, s: ShiftSettings = DEFAULT_SHIFT): AttendanceWindow {
  const day  = now.getDay();
  const mins = toMins(now.getHours(), now.getMinutes());
  if (day === 0) return 'sunday';

  const openMins     = parseMins(s.checkin_open);
  const closeMins    = parseMins(s.close_checkin);
  const breakSt      = parseMins(s.break_start);
  const breakEn      = parseMins(s.break_end);
  const checkoutOpen = parseMins(s.checkout_open);
  const checkoutCls  = parseMins(s.checkout_close);

  if (s.isOvernight) {
    // Shift lintas tengah malam (mis. Malam 21:00–07:00)
    // Sebelum jam mulai: too_early
    // Jam mulai hingga tutup check-in: checkin
    // Tutup check-in hingga tengah malam: late_locked
    // Tengah malam hingga jam selesai shift: late_locked atau checkout
    // Jam selesai shift hingga close_checkout: checkout
    if (mins >= openMins) {
      // Sisi malam: sebelum tengah malam
      if (mins < openMins)  return 'too_early';
      if (mins <= closeMins) return 'checkin';
      return 'late_locked'; // menunggu tengah malam untuk checkout
    } else {
      // Sisi pagi: setelah tengah malam (mis. 00:00–08:00)
      if (mins <= checkoutCls) return 'checkout';
      return 'ended';
    }
  }

  // Shift normal (tidak lintas tengah malam)
  if (day >= 1 && day <= 5) {
    if (mins <  openMins)    return 'too_early';
    if (mins <= closeMins)   return 'checkin';
    // Break hanya aktif jika waktunya berada di dalam rentang shift
    if (breakSt > closeMins && breakEn <= checkoutOpen) {
      if (mins < breakSt)   return 'late_locked';
      if (mins < breakEn)   return 'break';
      if (mins < checkoutOpen) return 'working';
    } else {
      // Break tidak relevan untuk shift ini → langsung ke working/checkout
      if (mins < checkoutOpen) return 'late_locked';
    }
    if (mins <= checkoutCls) return 'checkout';
    return 'ended';
  }
  if (day === 6) {
    if (mins < openMins)                          return 'too_early';
    if (mins <= closeMins)                        return 'checkin';
    if (mins < parseMins(s.sat_checkout_open))    return 'late_locked';
    if (mins <= parseMins(s.sat_checkout_close))  return 'checkout';
    return 'ended';
  }
  return 'ended';
}

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const windowConfig: Record<AttendanceWindow, { icon: typeof Lock; iconColor: string; bg: string; border: string; title: string; desc: string; sub?: string }> = {
  sunday:      { icon: Moon,         iconColor: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', title: 'Hari Minggu – Libur',    desc: 'Tidak ada jadwal kerja hari ini.',               sub: 'Sampai jumpa Senin!' },
  too_early:   { icon: Sun,          iconColor: '#D97706', bg: '#FFFBEB', border: '#FDE68A', title: 'Belum Waktunya Absen',   desc: 'Absen dibuka mulai pukul 08:00 WIB.',           sub: 'Silakan kembali setelah pukul 08:00.' },
  checkin:     { icon: CheckCircle2, iconColor: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', title: 'Waktu Check-In',         desc: '08:00 – 08:29 Tepat Waktu · 08:30 – 09:00 Terlambat (tetap Hadir)', sub: '' },
  late_locked: { icon: Lock,         iconColor: '#DC2626', bg: '#FEF2F2', border: '#FECACA', title: 'Batas Check-In Terlewat', desc: 'Check-in sudah ditutup pukul 09:00 WIB.',       sub: 'Silakan hubungi admin jika ada kendala.' },
  break:       { icon: Coffee,       iconColor: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', title: 'Jam Istirahat',          desc: 'Absen dikunci 12:30 – 13:30 WIB.',              sub: 'Silakan beristirahat sejenak.' },
  working:     { icon: Clock,        iconColor: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', title: 'Sedang Jam Kerja',       desc: 'Check-out dibuka pukul 17:00 WIB.',             sub: 'Tetap semangat bekerja!' },
  ended:       { icon: Lock,         iconColor: '#DC2626', bg: '#FEF2F2', border: '#FECACA', title: 'Waktu Absen Berakhir',   desc: 'Batas akhir check-out pukul 18:00 WIB.',        sub: 'Absensi hari ini sudah ditutup.' },
  checkout:    { icon: Sunset,       iconColor: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', title: 'Waktu Check-Out',        desc: 'Silakan lakukan check-out sekarang.',           sub: 'Terima kasih atas dedikasi Anda hari ini!' },
  no_shift:    { icon: Moon,         iconColor: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', title: 'Hari Libur / Tidak ada Shift', desc: 'Anda tidak memiliki jadwal shift hari ini.', sub: 'Selamat beristirahat!' },
};

// ── Face Verification ─────────────────────────────────────────────────
type FaceStep = 'idle' | 'scanning' | 'captured' | 'confirmed';

function FaceVerificationCard({
  faceStep, onCapture, onRetake, employeeName, employeeNip, capturedImage, activeLeave
}: { 
  faceStep: FaceStep; 
  onCapture: (image: string) => void; 
  onRetake: () => void; 
  employeeName: string; 
  employeeNip: string; 
  capturedImage: string | null;
  activeLeave: { type: string; reason: string } | null;
}) {
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

  if (activeLeave) {
    const leaveLabel = activeLeave.type === 'cuti' ? 'Cuti Tahunan' : activeLeave.type === 'izin' ? 'Izin' : 'Sakit';
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <AlertCircle size={15} className="text-[#EA580C]" />
          <span className="text-[13px] font-semibold text-gray-800">Absensi Dikunci</span>
        </div>
        <div className="p-5 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-[#FFF7ED] border border-[#FFEDD5] rounded-full flex items-center justify-center">
            <AlertCircle size={28} className="text-[#EA580C]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Sedang dalam Masa {leaveLabel}</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[280px]">
              Hari ini Anda terdaftar sedang {leaveLabel} ("{activeLeave.reason}"). Absensi dinonaktifkan sementara.
            </p>
          </div>
          <button
            disabled
            className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl text-[13px] font-semibold cursor-not-allowed"
          >
            Absen Dinonaktifkan
          </button>
        </div>
      </div>
    );
  }

  if (faceStep === 'idle') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <Camera size={15} className="text-[#16A34A]" />
          <span className="text-[13px] font-semibold text-gray-800">Verifikasi Wajah</span>
          <span className="ml-auto text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Diperlukan</span>
        </div>
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Custom SVG User Profile Scan Icon */}
            <svg viewBox="0 0 100 100" className="w-15 h-15 drop-shadow-sm">
              <defs>
                <linearGradient id="userScanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#15A34A" />
                  <stop offset="100%" stop-color="#4ADE80" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="38" r="16" fill="url(#userScanGradient)" />
              <path
                d="M 22,82 
                   C 22,66 32,58 50,58 
                   C 68,58 78,66 78,82 
                   C 78,85 75,88 72,88 
                   L 28,88 
                   C 25,88 22,85 22,82 
                   Z"
                fill="url(#userScanGradient)"
              />
            </svg>
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
/**
 * Komponen Kartu GPS (GPSCard)
 * 
 * Merender peta berbasis Leaflet untuk memetakan koordinat perangkat karyawan
 * dan radius geofence RSUCL. Dilengkapi indikator kekuatan sinyal akurasi GPS.
 */
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
  // Kekuatan sinyal diukur dari akurasi GPS (di bawah 15 meter dianggap sangat bagus)
  const signalBars = gpsActive ? (userLocation && userLocation.accuracy <= 15 ? 4 : 3) : 0;

  const mapCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [hospLat, hospLng];

  // Susunan metadata GPS untuk pratinjau informasi di bawah peta
  const gpsData = [
    { label: 'Latitude',       value: userLocation ? `${userLocation.lat.toFixed(7)}°` : 'Mencari...' },
    { label: 'Longitude',      value: userLocation ? `${userLocation.lng.toFixed(7)}°` : 'Mencari...' },
    { label: 'Akurasi',        value: userLocation ? `±${userLocation.accuracy} meter` : '—' },
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
      <div className="h-52 w-full relative" style={{ isolation: 'isolate' }}>
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
        <div className="grid grid-cols-2 gap-3">
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
/**
 * Komponen Animasi Sukses (SuccessAnimation)
 * 
 * Menampilkan modal popup transparan dengan efek riak gelombang (ripple) hijau 
 * dan jam detil ketika absen masuk (check-in) atau absen pulang (check-out) berhasil dikirim.
 */
function SuccessAnimation({ action, time, onDone }: { action: string; time: string; onDone: () => void }) {
  const { user } = useAuth();
  
  // State mengontrol opasitas modal
  const [visible, setVisible] = useState(true);

  // Menutup otomatis modal popup setelah 3.5 detik dan memicu callback onDone
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 500); }, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div onClick={onDone} className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 cursor-pointer ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Efek riak gelombang hijau */}
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
/**
 * Halaman Absensi Karyawan (AttendancePage) — Sistem Absensi RSUCL
 * 
 * Fitur inti untuk melakukan pencatatan kehadiran (absen masuk / absen pulang) bagi karyawan.
 * Mengintegrasikan pelacakan lokasi GPS geofencing, verifikasi wajah dengan kamera depan,
 * pengecekan koneksi internet, serta penyesuaian waktu shift (termasuk shift lintas malam dan hari Sabtu).
 */
export function AttendancePage() {
  const { user } = useAuth();
  
  // State menyimpan file base64 foto selfie wajah yang berhasil diambil
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  // State status konektivitas internet perangkat karyawan
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Memantau event perubahan status koneksi internet (online/offline)
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

  // State jam sistem yang berjalan secara realtime
  const [now, setNow]               = useState(new Date());
  
  // Penanda apakah karyawan sudah absen masuk (check-in) hari ini
  const [checkedIn, setCheckedIn]   = useState(false);
  
  // Penanda apakah karyawan sudah absen pulang (check-out) hari ini
  const [checkedOut, setCheckedOut] = useState(false);
  
  // Keterangan detail lokasi presisi (mis. Lobby RS, Poli Anak...)
  const [locationNote, setLocationNote] = useState('');

  // Status overtime (lembur)
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeNote, setOvertimeNote] = useState('');
  const [overtimeMinutesCalculated, setOvertimeMinutesCalculated] = useState(0);

  // Alasan pulang cepat (early checkout)
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState('');
  
  // Pengontrol tampilan dialog konfirmasi submit absensi
  const [showModal, setShowModal]   = useState(false);
  
  // Menyimpan jam check-in aktual dari backend
  const [checkInTime, setCheckInTime]   = useState('');
  
  // Menyimpan jam check-out aktual dari backend
  const [checkOutTime, setCheckOutTime] = useState('');
  
  // Indikator status loading saat absensi sedang diposting ke API
  const [submitting, setSubmitting]     = useState(false);

  // Status state machine untuk verifikasi wajah ('idle', 'scanning', 'captured', 'confirmed')
  const [faceStep, setFaceStep] = useState<FaceStep>('idle');

  // Menampung data pengajuan cuti/izin/sakit yang sedang aktif hari ini (jika ada)
  const [activeLeave, setActiveLeave] = useState<{ type: string; reason: string } | null>(null);

  // Pengendali parameter tampilan popup SuccessAnimation
  const [successAction, setSuccessAction] = useState('');
  const [successTime, setSuccessTime]     = useState('');
  const [showSuccess, setShowSuccess]     = useState(false);

  // Pengaturan jam kerja absensi dinamis (geofence radius, jam buka/tutup absensi)
  const [shiftSettings, setShiftSettings] = useState<ShiftSettings>(DEFAULT_SHIFT);
  
  // Shift kerja karyawan yang aktif hari ini
  const [todayShift, setTodayShift] = useState<MyShiftSchedule | null | undefined>(undefined);
  
  // Shift khusus hari Sabtu jika ada
  const [saturdayShift, setSaturdayShift] = useState<MyShiftSchedule | null>(null);

  // GPS state
  const HOSP_LAT    = shiftSettings.hospital_lat;
  const HOSP_LNG    = shiftSettings.hospital_lng;
  const HOSP_RADIUS = shiftSettings.gps_radius;
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsActive, setGpsActive]       = useState<boolean>(false);

  // Load shift settings + jadwal shift karyawan dari API
  useEffect(() => {
    Promise.allSettled([
      settingApi.get(),
      scheduleApi.mySchedule(),
    ]).then(([settingRes, shiftRes]) => {
      let base: ShiftSettings = { ...DEFAULT_SHIFT };
      if (settingRes.status === 'fulfilled' && settingRes.value.success) {
        const d = settingRes.value.data as unknown as Record<string, string>;
        base = {
          ...base,
          checkin_open:       d.checkin_open      ?? '0',
          late_limit:         d.late_limit        ?? '30',
          close_checkin:      d.close_checkin     ?? '60',
          break_start:        d.break_start       ?? '12:30',
          break_end:          d.break_end         ?? '13:30',
          checkout_open:      d.checkout_open     ?? '0',
          checkout_close:     d.checkout_close    ?? '60',
          sat_checkout_open:  d.sat_checkout_open  ?? '0',
          sat_checkout_close: d.sat_checkout_close ?? '60',
          hospital_lat:       d.hospital_lat ? Number(d.hospital_lat) : 5.552740480177099,
          hospital_lng:       d.hospital_lng ? Number(d.hospital_lng) : 95.33486560781716,
          gps_radius:         d.gps_radius ? Number(d.gps_radius) : 40,
          early_checkout_grace_minutes: d.early_checkout_grace_minutes ?? '15',
          overtime_grace_minutes:       d.overtime_grace_minutes       ?? '15',
        };
      }
      
      const shift = shiftRes.status === 'fulfilled' && shiftRes.value.success ? shiftRes.value.data : null;
      setTodayShift(shift);
      const satShift = shiftRes.status === 'fulfilled' && shiftRes.value.success ? (shiftRes.value.saturday_shift ?? null) : null;
      setSaturdayShift(satShift);

      // Gunakan shift kustom jika ada, jika tidak, gunakan default "08:00" - "17:00"
      const startTime = shift ? shift.start_time : '08:00:00';
      const endTime = shift ? shift.end_time : '17:00:00';

      const startHHmm  = startTime.substring(0, 5); // "HH:mm"
      const endHHmm    = endTime.substring(0, 5);   // "HH:mm"
      const startMins  = parseMins(startHHmm);
      const endMins    = parseMins(endHHmm);
      const overnight  = endMins < startMins; // shift lintas tengah malam

      // Sabtu Checkout menggunakan end_time dari shift Sabtu (default ke 13:00 jika tidak ada)
      const satEndTime = satShift ? satShift.end_time : '13:00:00';
      const satEndHHmm = satEndTime.substring(0, 5);

      const checkinOpenOffset  = parseInt(base.checkin_open) || 0;
      const lateLimitOffset    = parseInt(base.late_limit) || 0;
      const closeCheckinOffset = parseInt(base.close_checkin) || 0;
      const checkoutOpenOffset  = parseInt(base.checkout_open) || 0;
      const checkoutCloseOffset = parseInt(base.checkout_close) || 0;
      const satCheckoutOpenOffset  = parseInt(base.sat_checkout_open) || 0;
      const satCheckoutCloseOffset = parseInt(base.sat_checkout_close) || 0;

      // Jam buka check-in = jam mulai shift - checkinOpenOffset menit
      const openHHmm  = subMins(startHHmm, checkinOpenOffset);
      // Batas telat       = mulai + lateLimitOffset menit
      const lateHHmm  = addMins(startHHmm, lateLimitOffset);
      // Tutup check-in    = mulai + closeCheckinOffset menit
      const closeHHmm = addMins(startHHmm, closeCheckinOffset);

      // Checkout = jam selesai shift - checkoutOpenOffset; batas = selesai + checkoutCloseOffset
      const checkoutOpenHHmm  = subMins(endHHmm, checkoutOpenOffset);
      const checkoutCloseHHmm = addMins(endHHmm, checkoutCloseOffset);

      // Sabtu Checkout = Sabtu selesai - satCheckoutOpenOffset; batas = Sabtu selesai + satCheckoutCloseOffset
      const satCheckoutOpenHHmm  = subMins(satEndHHmm, satCheckoutOpenOffset);
      const satCheckoutCloseHHmm = addMins(satEndHHmm, satCheckoutCloseOffset);

      // Break hanya relevan jika jatuh di dalam rentang shift
      // Untuk shift non-reguler, nonaktifkan break (set = checkout_open)
      const globalBreakStart = parseMins(base.break_start);
      const globalBreakEnd   = parseMins(base.break_end);
      const breakInShift = !overnight
        && globalBreakStart > parseMins(closeHHmm)
        && globalBreakEnd   <= endMins;

      base.checkin_open   = openHHmm;
      base.late_limit     = lateHHmm;
      base.close_checkin  = closeHHmm;
      base.checkout_open  = checkoutOpenHHmm;
      base.checkout_close = checkoutCloseHHmm;
      base.sat_checkout_open  = satCheckoutOpenHHmm;
      base.sat_checkout_close = satCheckoutCloseHHmm;
      base.isOvernight    = overnight;

      if (!breakInShift) {
        // Nonaktifkan break (set ke waktu yang tidak pernah selesai)
        base.break_start = checkoutOpenHHmm;
        base.break_end   = checkoutOpenHHmm;
      }

      setShiftSettings(base);
    }).catch((err) => {
      console.error(err);
      setTodayShift(null);
    });
  }, []);

  // Load today's record on mount
  useEffect(() => {
    const loadTodayRecord = async () => {
      try {
        const res = await attendanceApi.today();
        if (res.success) {
          if (res.data) {
            if (res.data.check_in) {
              setCheckInTime(res.data.check_in.substring(0, 5));
              setCheckedIn(true);
            }
            if (res.data.check_out) {
              setCheckOutTime(res.data.check_out.substring(0, 5));
              setCheckedOut(true);
            }
          }
          if (res.active_leave) {
            setActiveLeave(res.active_leave);
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
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const current = now;

  const attendanceWindow = todayShift === null ? 'no_shift' : getWindow(current, shiftSettings);
  const wc               = windowConfig[attendanceWindow];
  const dayId    = DAYS_ID[current.getDay()];
  const isSaturday = current.getDay() === 6;
  const timeStr  = current.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr  = `${dayId}, ${current.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][current.getMonth()]} ${current.getFullYear()}`;

  const canCheckIn  = attendanceWindow === 'checkin' && !checkedIn;
  const canCheckOut = (attendanceWindow === 'checkout' || attendanceWindow === 'working' || attendanceWindow === 'late_locked') && checkedIn && !checkedOut;

  const faceVerified = faceStep === 'confirmed';

  const getExpectedCheckoutTime = () => {
    const expected = new Date(current);
    const endTimeStr = todayShift ? todayShift.end_time : '17:00:00';
    const [hh, mm] = endTimeStr.split(':').map(Number);
    expected.setHours(hh, mm, 0, 0);
    
    const startTimeStr = todayShift ? todayShift.start_time : '08:00:00';
    const [sh, sm] = startTimeStr.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = hh * 60 + mm;
    if (endMins < startMins) {
      const nowMins = current.getHours() * 60 + current.getMinutes();
      if (nowMins >= startMins) {
        expected.setDate(expected.getDate() + 1);
      }
    }
    return expected;
  };

  const checkIfEarlyCheckout = () => {
    if (!canCheckOut) return false;
    const expected = getExpectedCheckoutTime();
    const grace = parseInt(shiftSettings.early_checkout_grace_minutes || '15') || 0;
    const threshold = new Date(expected.getTime() - grace * 60 * 1000);
    return current < threshold;
  };

  const lockedLabel = () => {
    if (checkedIn)                          return 'Anda sudah melakukan absen';
    if (attendanceWindow === 'no_shift')    return 'Tidak ada jadwal shift hari ini';
    if (attendanceWindow === 'too_early')   return `Absen Dibuka Pukul ${shiftSettings.checkin_open}`;
    if (attendanceWindow === 'late_locked') return `Batas Check-In Terlewat (${shiftSettings.close_checkin})`;
    if (attendanceWindow === 'break')       return 'Dikunci – Jam Istirahat';
    if (attendanceWindow === 'working')     return 'Waktu Absen Masuk Telah Lewat';
    if (attendanceWindow === 'ended')       return 'Waktu Absen Telah Berakhir';
    if (attendanceWindow === 'sunday')      return 'Hari Libur';
    return 'Absen Dikunci';
  };

  const handleAction = () => {
    if ((canCheckIn || canCheckOut) && faceVerified && inGeofence) setShowModal(true);
  };


  const confirmAction = async (earlyReason?: any) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const latVal = userLocation?.lat ?? HOSP_LAT;
      const lngVal = userLocation?.lng ?? HOSP_LNG;
      const accVal = userLocation?.accuracy ?? undefined;
      
      const simulatedTime = undefined;
      const earlyReasonStr = typeof earlyReason === 'string' ? earlyReason : undefined;

      if (canCheckIn) {
        const res = await attendanceApi.checkIn(latVal, lngVal, accVal, capturedImage || undefined, simulatedTime, locationNote);
        if (res.success && res.data.check_in) {
          const t = res.data.check_in.substring(0, 5);
          setCheckInTime(t);
          setCheckedIn(true);
          setShowModal(false);
          setSuccessAction('Check-In');
          setSuccessTime(t);
          setShowSuccess(true);
          setLocationNote(''); // Kosongkan input setelah berhasil submit
        }
      } else if (canCheckOut) {
        const res = await attendanceApi.checkOut(latVal, lngVal, accVal, capturedImage || undefined, simulatedTime, locationNote, earlyReasonStr || undefined);
        if (res.success && res.data.check_out) {
          const t = res.data.check_out.substring(0, 5);
          setCheckOutTime(t);
          setCheckedOut(true);
          setShowModal(false);
          
          if (res.is_overtime) {
            setOvertimeMinutesCalculated(res.overtime_minutes || 0);
            setShowOvertimeModal(true);
          } else {
            setSuccessAction('Check-Out');
            setSuccessTime(t);
            setShowSuccess(true);
          }
          setLocationNote(''); // Kosongkan input setelah berhasil submit
        }
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal melakukan absensi.');
    } finally {
      setSubmitting(false);
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
    const mins = parseMins(checkInTime);
    const lateMins = parseMins(shiftSettings.late_limit);
    const closeMins = parseMins(shiftSettings.close_checkin);
    if (mins <= lateMins) return { label: 'Tepat Waktu', color: '#16A34A', bg: '#DCFCE7' };
    if (mins <= closeMins) return { label: 'Terlambat', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'Hadir', color: '#16A34A', bg: '#DCFCE7' };
  };
  const attendStatus = getAttendStatus();

  const timelineItems = isSaturday ? [
    { time: shiftSettings.checkin_open, label: 'Check-In', phase: 'checkin' },
    { time: shiftSettings.sat_checkout_open, label: 'Check-Out', phase: 'checkout' },
  ] : [
    { time: shiftSettings.checkin_open, label: 'Buka Absen', phase: 'checkin' },
    { time: shiftSettings.close_checkin, label: 'Tutup Absen', phase: 'late_locked' },
    ...(shiftSettings.break_start !== shiftSettings.checkout_open ? [
      { time: shiftSettings.break_start, label: 'Istirahat', phase: 'break' },
      { time: shiftSettings.break_end, label: 'Lanjut Kerja', phase: 'working' },
    ] : []),
    { time: shiftSettings.checkout_open, label: 'Check-Out', phase: 'checkout' },
    { time: shiftSettings.checkout_close, label: 'Batas Akhir', phase: 'ended' },
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

  // Camera helpers and handlers

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
          <p className="text-[22px] font-mono font-semibold text-black tracking-tight">{timeStr}</p>
          <p className="text-[10px] text-gray-400">WIB</p>
        </div>
      </div>

      {/* Info Shift Hari Ini */}
      {todayShift !== undefined && (
        <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-[12px] font-medium ${
          todayShift
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-gray-200 bg-gray-50 text-gray-500'
        }`}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: todayShift?.color ?? '#E5E7EB' }}>
            <Clock size={13} className="text-white" />
          </div>
          <div className="flex-1">
            {todayShift ? (
              <>
                <span className="font-semibold">Shift {todayShift.name}</span>
                <span className="text-green-600 ml-2">{todayShift.start_time.substring(0,5)} – {todayShift.end_time.substring(0,5)} WIB</span>
              </>
            ) : (
              <span>Tidak ada jadwal shift hari ini</span>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            todayShift ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
          }`}>
            {todayShift ? 'Aktif' : 'Libur'}
          </span>
        </div>
      )}



      {/* 
        ── SCHEDULE TIMELINE (JADWAL ABSENSI) ── 
        Membaca shiftSettings dan todayShift yang dimuat dari API.
        Jika pegawai memiliki shift aktif, alur milestone absensi digambar secara responsif.
        Jika pegawai libur, card akan menampilkan state informasi kosong (tidak ada alur).
      */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#16A34A]" />
            <p className="text-[13px] font-semibold text-gray-800">
              {todayShift === undefined 
                ? 'Memuat Jadwal...' 
                : todayShift 
                  ? `Jadwal Shift: ${todayShift.name}` // Menampilkan nama shift secara dinamis
                  : 'Jadwal Absensi'}
            </p>
          </div>
          {/* Lencana Istirahat: Hanya dirender jika hari ini ada shift aktif & ada jam istirahat di dalam rentang shift */}
          {todayShift && shiftSettings.break_start !== shiftSettings.checkout_open && (
            <span className="text-[10.5px] font-medium text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-100/50">
              <Coffee size={10.5} className="flex-shrink-0" /> Istirahat {shiftSettings.break_start}–{shiftSettings.break_end}
            </span>
          )}
        </div>

        {todayShift === undefined ? (
          // State loading data
          <div className="text-center py-6 text-gray-400 text-[12px] animate-pulse">Memuat jadwal shift hari ini...</div>
        ) : todayShift ? (
          <>
            {/* TAMPILAN DESKTOP: Render alur horizontal mendatar jika lebar layar >= sm */}
            <div className="hidden sm:flex items-center gap-0">
              {timelineItems.map((item, i) => {
                const phaseIdx = phaseOrder.indexOf(item.phase as AttendanceWindow);
                const isDone   = phaseIdx < currentPhaseIdx;
                const isActive = item.phase === attendanceWindow || (attendanceWindow === 'checkin' && item.phase === 'checkin') || (attendanceWindow === 'checkout' && item.phase === 'checkout');
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

            {/* TAMPILAN MOBILE: Render alur vertikal ke bawah jika lebar layar < sm (layar HP) */}
            <div className="sm:hidden space-y-3.5 pl-2.5 relative before:absolute before:left-4 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-gray-100">
              {timelineItems.map((item, i) => {
                const phaseIdx = phaseOrder.indexOf(item.phase as AttendanceWindow);
                const isDone   = phaseIdx < currentPhaseIdx;
                const isActive = item.phase === attendanceWindow || (attendanceWindow === 'checkin' && item.phase === 'checkin') || (attendanceWindow === 'checkout' && item.phase === 'checkout');
                return (
                  <div key={i} className="flex items-center gap-4 relative">
                    {/* Lingkaran Status: glowing hijau jika aktif, hijau solid jika selesai, abu-abu jika belum mulai */}
                    <div className={`w-3 h-3 rounded-full border-2 z-10 flex items-center justify-center transition-all ${
                      isActive 
                        ? 'bg-[#16A34A] border-[#16A34A] ring-4 ring-[#16A34A]/15' 
                        : isDone 
                          ? 'bg-[#16A34A] border-[#16A34A]' 
                          : 'bg-white border-gray-300'
                    }`} />
                    <div className="flex items-center justify-between flex-1 min-w-0 pr-1">
                      <span className={`text-[12px] font-medium ${isActive ? 'text-[#16A34A] font-bold' : isDone ? 'text-gray-600' : 'text-gray-400'}`}>
                        {item.label}
                      </span>
                      <span className="text-[12px] font-mono text-gray-500 flex-shrink-0">
                        {item.time} WIB
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // STATE HARI LIBUR: Pegawai tidak memiliki jadwal shift apa pun hari ini (todayShift === null)
          <div className="text-center py-6 px-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <Moon size={22} className="text-gray-300 mx-auto mb-2" />
            <p className="text-[12.5px] text-gray-600 font-semibold">Tidak Ada Jadwal Absensi</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
              Hari ini adalah hari libur Anda. Jadwal absensi harian akan otomatis mengikuti jadwal shift dinas yang ditentukan oleh Administrator.
            </p>
          </div>
        )}
      </div>

      {/* Face Verification viewfinder */}
      <FaceVerificationCard
        faceStep={faceStep}
        onCapture={handleFaceCapture}
        onRetake={handleFaceRetake}
        employeeName={user?.name ?? 'Dr. Rina Kusumawati'}
        employeeNip={user?.nip ?? '198501012010012001'}
        capturedImage={capturedImage}
        activeLeave={activeLeave}
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
              { label: 'Jam Masuk', value: checkInTime || '--:--', color: '#000000' },
              { label: 'Jam Keluar', value: checkOutTime || '--:--', color: '#000000' },
              { label: 'Durasi', value: checkedOut ? getDuration() : '--', color: '#000000' },
              { label: 'Status', value: attendStatus?.label || '--', color: '#000000' },
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
              <p className="text-[11px] text-purple-700">Istirahat 12:30–13:30</p>
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
            <div><p className="text-[10px] text-gray-400">Masuk</p><p className="text-[13px] font-bold text-black">{checkInTime}</p></div>
            <div><p className="text-[10px] text-gray-400">Keluar</p><p className="text-[13px] font-bold text-black">{checkOutTime}</p></div>
            <div><p className="text-[10px] text-gray-400">Durasi</p><p className="text-[13px] font-bold text-black">{getDuration()}</p></div>
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
          ${checkedIn ? 'bg-green-50 border-green-200 text-[#16A34A]' :
            attendanceWindow === 'break' ? 'bg-purple-50 border-purple-200 text-purple-400' :
            attendanceWindow === 'sunday' || attendanceWindow === 'no_shift' || attendanceWindow === 'ended' ? 'bg-gray-100 border-gray-200 text-gray-400' :
            attendanceWindow === 'too_early' ? 'bg-amber-50 border-amber-200 text-amber-400' :
            attendanceWindow === 'late_locked' ? 'bg-red-50 border-red-200 text-red-400' :
            'bg-blue-50 border-blue-200 text-blue-400'}`}>
          {checkedIn ? <CheckCircle2 size={18} /> : <Lock size={18} />}
          <span className="text-[15px] font-semibold">{lockedLabel()}</span>
        </div>
      )}

      {/* Rules footer */}
      <div className="mt-4 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-[11px] font-semibold text-gray-500 mb-2">Ketentuan Absensi RSUCL</p>
        <div className="space-y-1.5">
          {[
            ['Buka absen (Sen–Jum & Sab)', `${shiftSettings.checkin_open} WIB`, 'text-black'],
            ['Tepat waktu', `${shiftSettings.checkin_open} – ${shiftSettings.late_limit} WIB`, 'text-black'],
            ['Terlambat (tetap Hadir)', `${shiftSettings.late_limit} – ${shiftSettings.close_checkin} WIB`, 'text-black'],
            ['Tutup check-in', `${shiftSettings.close_checkin} WIB → Alpha`, 'text-black'],
            ['Istirahat (Sen–Jum)', `${shiftSettings.break_start} – ${shiftSettings.break_end} WIB`, 'text-black'],
            ['Check-out / Jam pulang', `${shiftSettings.checkout_open} WIB (Sab: ${shiftSettings.sat_checkout_open})`, 'text-black'],
            ['Batas akhir check-out', `${shiftSettings.checkout_close} WIB`, 'text-black'],
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
                { label: 'Lokasi GPS',       value: inGeofence ? `Dalam Area (~${Math.round(distance ?? 0)}m)` : `Luar Area (~${Math.round(distance ?? 0)}m)` },
                { label: 'Verifikasi Wajah', value: '✅ Terverifikasi' },
              ].map(({ label, value }, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[12px] text-gray-500">{label}</span>
                  <span className="text-[12px] font-medium text-gray-800">{value}</span>
                </div>
              ))}

              <div className="pt-2 border-t border-gray-200 mt-2">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Keterangan Detail Lokasi <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  placeholder="Contoh: Lobby RS, Poli Anak, IGD, Lantai 2..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]/25 placeholder:text-gray-400"
                />
              </div>

              {canCheckOut && checkIfEarlyCheckout() && (
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <label className="block text-[11px] font-medium text-red-500 mb-1">Alasan Pulang Cepat <span className="text-red-500">*</span></label>
                  <textarea
                    value={earlyCheckoutReason}
                    onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                    placeholder="Jelaskan alasan Anda harus pulang cepat..."
                    rows={2}
                    className="w-full px-3 py-2 border border-red-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/25 placeholder:text-gray-400 resize-none"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
              <button
                onClick={() => confirmAction(earlyCheckoutReason)}
                disabled={submitting || !locationNote.trim() || (canCheckOut && checkIfEarlyCheckout() && !earlyCheckoutReason.trim())}
                className={`flex-1 py-3 rounded-xl text-[14px] font-semibold text-white transition-all ${
                  canCheckIn ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-600'
                } ${submitting || !locationNote.trim() || (canCheckOut && checkIfEarlyCheckout() && !earlyCheckoutReason.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {submitting ? 'Memproses...' : 'Ya, Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overtime Modal */}
      {showOvertimeModal && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-2xl mx-0 sm:mx-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto bg-orange-50">
              <Clock size={28} className="text-orange-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">
              Keterangan Lembur
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-4">
              Anda terdeteksi lembur selama <strong className="text-orange-600">{overtimeMinutesCalculated} menit</strong>.
            </p>
            
            <div className="space-y-2 mb-5">
              <label className="block text-[12px] font-medium text-gray-600">Penyebab Lembur (Akibat Apa) <span className="text-red-500">*</span></label>
              <textarea
                value={overtimeNote}
                onChange={(e) => setOvertimeNote(e.target.value)}
                placeholder="Contoh: Menyelesaikan laporan rekam medis pasien IGD, atau operasi darurat..."
                rows={3}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 transition-all resize-none placeholder:text-gray-350"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowOvertimeModal(false);
                  setSuccessAction('Check-Out');
                  setSuccessTime(checkOutTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
                  setShowSuccess(true);
                }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Lewati
              </button>
              <button
                onClick={async () => {
                  if (!overtimeNote.trim()) return;
                  try {
                    await attendanceApi.updateOvertimeNote(overtimeNote);
                    setShowOvertimeModal(false);
                    setSuccessAction('Check-Out (Lembur)');
                    setSuccessTime(checkOutTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
                    setShowSuccess(true);
                  } catch (err: any) {
                    alert(err?.message ?? 'Gagal menyimpan catatan lembur.');
                  }
                }}
                disabled={!overtimeNote.trim()}
                className={`flex-1 py-3 rounded-xl text-[13px] font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-all ${
                  !overtimeNote.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Simpan
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
