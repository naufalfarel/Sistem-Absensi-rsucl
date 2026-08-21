import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin,
  Wifi,
  Navigation,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Target,
  Lock,
  Coffee,
  Moon,
  Sun,
  Sunset,
  Camera,
  Calendar,
  RotateCw,
  Info,
  Upload,
} from "lucide-react";
import { useRealtimeGps } from "../../hooks/useRealtimeGps";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "../../context/AuthContext";
import {
  attendanceApi,
  settingApi,
  scheduleApi,
  MyShiftSchedule,
} from "../../services/api";
import { Alert, AlertDescription } from "./ui/alert";


// Fix Leaflet default marker icon broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom hospital icon (green)
const hospIcon = L.divIcon({
  html: `<div style="background:#16A34A;border:2px solid #0d9240;border-radius:50% 50% 50% 0;width:28px;height:28px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(22,163,74,0.5)">
           <span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:bold">RS</span>
         </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
});

// Custom user icon (blue pulsing)
const userIcon = L.divIcon({
  html: `<div style="position:relative;width:20px;height:20px">
           <div style="position:absolute;inset:0;background:#3B82F6;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(59,130,246,0.6)"></div>
         </div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Helper component: re-center map when user location changes
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

// ── Time logic ─────────────────────────────────────────────────────────
type AttendanceWindow =
  | "sunday"
  | "too_early"
  | "checkin"
  | "late_locked"
  | "break"
  | "working"
  | "checkout"
  | "ended"
  | "no_shift";

function safeSubstr(str: any, start = 0, length = 5, fallback = ""): string {
  if (typeof str !== "string" || !str) return fallback;
  return str.substring(start, start + length);
}
function toMins(h: number, m: number) {
  return h * 60 + m;
}
function parseMins(t: string | undefined | null) {
  if (!t || typeof t !== "string") return 0;
  const [h, m] = t.split(":").map(Number);
  return toMins(h || 0, m || 0);
}
function addMins(hhmm: string, mins: number): string {
  const total = parseMins(hhmm) + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function subMins(hhmm: string, mins: number): string {
  let total = parseMins(hhmm) - mins;
  if (total < 0) total += 24 * 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface ShiftSettings {
  checkin_open: string; // '08:00'
  late_limit: string; // '08:30'
  close_checkin: string; // '09:00'
  break_start: string; // '12:30'
  break_end: string; // '13:30'
  checkout_open: string; // '17:00'
  checkout_close: string; // '18:00'
  sat_checkout_open: string; // '13:00'
  sat_checkout_close: string; // '14:00'
  hospital_lat: number;
  hospital_lng: number;
  gps_radius: number;
  enable_gps_validation?: boolean;
  isOvernight: boolean; // shift lintas tengah malam (mis. Malam 21:00-07:00)
  early_checkout_grace_minutes?: string;
  overtime_grace_minutes?: string;
}

const DEFAULT_SHIFT: ShiftSettings = {
  checkin_open: "08:00",
  late_limit: "08:30",
  close_checkin: "09:00",
  break_start: "12:30",
  break_end: "13:30",
  checkout_open: "17:00",
  checkout_close: "18:00",
  sat_checkout_open: "13:00",
  sat_checkout_close: "13:00",
  hospital_lat: 5.552740480177099,
  hospital_lng: 95.33486560781716,
  gps_radius: 100,
  enable_gps_validation: true,
  isOvernight: false,
  early_checkout_grace_minutes: "15",
  overtime_grace_minutes: "15",
};

function getWindow(
  now: Date,
  s: ShiftSettings = DEFAULT_SHIFT,
): AttendanceWindow {
  const day = now.getDay();
  const mins = toMins(now.getHours(), now.getMinutes());
  if (day === 0 && !s.isOvernight) return "sunday";

  const openMins = parseMins(s.checkin_open);
  const closeMins = parseMins(s.close_checkin);
  const checkoutOpen = parseMins(s.checkout_open);

  if (s.isOvernight) {
    if (openMins > closeMins) {
      if (mins >= openMins || mins <= closeMins) return "checkin";
    } else {
      if (mins >= openMins && mins <= closeMins) return "checkin";
    }
    if (mins <= checkoutOpen) return "working";
    return "checkout";
  }

  // Shift normal
  if (mins < openMins) return "too_early";
  if (mins <= closeMins) return "checkin";
  if (mins < checkoutOpen) return "working";
  return "checkout";
}

const DAYS_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const windowConfig: Record<
  AttendanceWindow,
  {
    icon: typeof Lock;
    iconColor: string;
    bg: string;
    border: string;
    title: string;
    desc: string;
    sub?: string;
  }
> = {
  sunday: {
    icon: Moon,
    iconColor: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    title: "Hari Minggu – Libur",
    desc: "Tidak ada jadwal kerja hari ini.",
    sub: "Sampai jumpa Senin!",
  },
  too_early: {
    icon: Sun,
    iconColor: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    title: "Belum Waktunya Absen",
    desc: "Absen dibuka mulai pukul 08:00 WIB.",
    sub: "Silakan kembali setelah pukul 08:00.",
  },
  checkin: {
    icon: CheckCircle2,
    iconColor: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    title: "Waktu Check-In",
    desc: "08:00 – 08:29 Tepat Waktu · 08:30 – 09:00 Terlambat (tetap Hadir)",
    sub: "",
  },
  late_locked: {
    icon: Lock,
    iconColor: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    title: "Batas Check-In Terlewat",
    desc: "Check-in sudah ditutup pukul 09:00 WIB.",
    sub: "Silakan hubungi admin jika ada kendala.",
  },
  break: {
    icon: Coffee,
    iconColor: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    title: "Jam Istirahat",
    desc: "Absen dikunci 12:30 – 13:30 WIB.",
    sub: "Silakan beristirahat sejenak.",
  },
  working: {
    icon: Clock,
    iconColor: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    title: "Sedang Jam Kerja",
    desc: "Check-out dibuka pukul 17:00 WIB.",
    sub: "Tetap semangat bekerja!",
  },
  ended: {
    icon: Lock,
    iconColor: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    title: "Waktu Absen Berakhir",
    desc: "Tidak ada jadwal absen aktif saat ini.",
    sub: "Silakan hubungi admin jika ada kendala.",
  },
  checkout: {
    icon: Sunset,
    iconColor: "#EA580C",
    bg: "#FFF7ED",
    border: "#FED7AA",
    title: "Waktu Check-Out (Fleksibel)",
    desc: "Dapat melakukan check-out kapan saja setelah jam kerja selesai.",
    sub: "Terima kasih atas dedikasi Anda hari ini!",
  },
  no_shift: {
    icon: Moon,
    iconColor: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    title: "Hari Libur / Tidak ada Shift",
    desc: "Anda tidak memiliki jadwal shift hari ini.",
    sub: "Selamat beristirahat!",
  },
};

// ── Face Verification ─────────────────────────────────────────────────
type FaceStep = "idle" | "scanning" | "captured" | "confirmed";

function FaceVerificationCard({
  faceStep,
  onCapture,
  onRetake,
  employeeName,
  employeeNikKtp,
  capturedImage,
  activeLeave,
}: {
  faceStep: FaceStep;
  onCapture: (image: string) => void;
  onRetake: () => void;
  employeeName: string;
  employeeNikKtp: string;
  capturedImage: string | null;
  activeLeave: { type: string; reason: string } | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
      } catch (err) {
        // Fallback constraint if facingMode: "user" fails on desktop/other devices
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError(
        "Kamera tidak dapat diakses. Silakan periksa dan aktifkan izin akses kamera pada browser/HP Anda.",
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (faceStep === "scanning") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [faceStep, startCamera, stopCamera]);

  const handleCaptureClick = async () => {
    let capturedDataUrl = "";
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;

      const maxDim = 640;
      let targetWidth = maxDim;
      let targetHeight = Math.round((videoHeight / videoWidth) * maxDim);
      if (videoHeight > videoWidth) {
        targetHeight = maxDim;
        targetWidth = Math.round((videoWidth / videoHeight) * maxDim);
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        capturedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
      }
    }

    if (!capturedDataUrl || capturedDataUrl.length < 100) {
      alert("Gagal mengambil foto dari kamera. Pastikan kamera menyala dan coba lagi.");
      return;
    }

    stopCamera();
    onCapture(capturedDataUrl);
  };

  if (activeLeave) {
    const leaveLabel =
      activeLeave.type === "cuti"
        ? "Cuti Tahunan"
        : activeLeave.type === "izin"
          ? "Izin"
          : "Sakit";
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <AlertCircle size={15} className="text-[#EA580C]" />
          <span className="text-[13px] font-semibold text-gray-800">
            Absensi Dikunci
          </span>
        </div>
        <div className="p-5 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-[#FFF7ED] border border-[#FFEDD5] rounded-full flex items-center justify-center">
            <AlertCircle size={28} className="text-[#EA580C]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">
              Sedang dalam Masa {leaveLabel}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[280px]">
              Hari ini Anda terdaftar sedang {leaveLabel} ("{activeLeave.reason}
              "). Absensi dinonaktifkan sementara.
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

  if (faceStep === "idle") {
    return (
      <div id="face-verification-card" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <Camera size={15} className="text-[#16A34A]" />
          <span className="text-[13px] font-semibold text-gray-800">
            Verifikasi Wajah
          </span>
          <span className="ml-auto text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            Diperlukan
          </span>
        </div>
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Custom SVG User Profile Scan Icon */}
            <svg viewBox="0 0 100 100" className="w-15 h-15 drop-shadow-sm">
              <defs>
                <linearGradient
                  id="userScanGradient"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#15A34A" />
                  <stop offset="100%" stopColor="#4ADE80" />
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
            {[
              ["top-2 left-2", "rounded-tl-lg border-t-2 border-l-2"],
              ["top-2 right-2", "rounded-tr-lg border-t-2 border-r-2"],
              ["bottom-2 left-2", "rounded-bl-lg border-b-2 border-l-2"],
              ["bottom-2 right-2", "rounded-br-lg border-b-2 border-r-2"],
            ].map(([pos, cls], i) => (
              <div
                key={i}
                className={`absolute ${pos} w-5 h-5 border-[#16A34A] ${cls}`}
              />
            ))}
          </div>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-gray-700">
              Foto Selfie Diperlukan
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Ambil foto diri Anda secara langsung menggunakan kamera untuk memverifikasi kehadiran
            </p>
          </div>
          <div className="w-full">
            <button
              onClick={() => onCapture("")}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm shadow-green-200 active:scale-[0.98]"
            >
              <Camera size={15} /> Buka Kamera Selfie
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (faceStep === "scanning") {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
          <Camera size={15} className="text-blue-500" />
          <span className="text-[13px] font-semibold text-gray-800">
            Kamera Aktif
          </span>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-blue-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />{" "}
            Live
          </span>
        </div>
        <div className="p-4">
          {cameraError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center mb-4">
              <AlertCircle size={24} className="text-red-500 mx-auto mb-2" />
              <p className="text-[12px] font-semibold text-red-700 mb-3">{cameraError}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={startCamera}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-[11px] font-bold"
                >
                  Coba Lagi Kamera
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={handleCaptureClick}
              className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3] flex items-center justify-center mb-4 cursor-pointer group"
              title="Klik di mana saja untuk mengambil foto"
            >
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Clean face frame overlay (pointer-events-none) */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 z-10">
                <div className="bg-black/50 backdrop-blur-xs text-white px-3 py-1 rounded-full text-[10px] font-medium border border-white/20 mt-1">
                  Klik pada kamera / tombol "Ambil Foto" di bawah
                </div>

                {/* Interactive shutter icon feedback */}
                <div className="w-16 h-16 rounded-full border-2 border-white/90 bg-black/30 backdrop-blur-xs flex items-center justify-center group-hover:scale-110 group-hover:bg-[#16A34A]/40 transition-all shadow-xl">
                  <Camera size={26} className="text-white drop-shadow-md" />
                </div>

                <div className="text-white/80 text-[10px] bg-black/40 px-2 py-0.5 rounded-md">
                  Posisikan wajah di tengah
                </div>
              </div>

              {/* Corner guide brackets */}
              {[
                ["top-3 left-3", "border-t-2 border-l-2 rounded-tl-lg"],
                ["top-3 right-3", "border-t-2 border-r-2 rounded-tr-lg"],
                ["bottom-3 left-3", "border-b-2 border-l-2 rounded-bl-lg"],
                ["bottom-3 right-3", "border-b-2 border-r-2 rounded-br-lg"],
              ].map(([pos, cls], i) => (
                <div
                  key={i}
                  className={`absolute ${pos} w-8 h-8 border-[#16A34A] pointer-events-none z-10 ${cls}`}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onRetake}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <X size={14} /> Tutup
            </button>
            <button
              onClick={handleCaptureClick}
              disabled={!!cameraError}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-semibold transition-all active:scale-95 shadow-sm shadow-green-200 disabled:opacity-50"
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
        <span className="text-[13px] font-semibold text-green-800">
          Wajah Terverifikasi ✅
        </span>
      </div>
      <div className="p-4 flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full bg-gray-200 border-4 border-white shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden">
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Selfie"
              className="w-full h-full object-cover"
            />
          ) : (
            <Camera size={22} className="text-gray-400" />
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#16A34A] rounded-full border border-white flex items-center justify-center">
            <CheckCircle2 size={10} className="text-white" />
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-green-800">
            {employeeName}
          </p>
          <p className="text-[11px] text-gray-500">NIK KTP: {employeeNikKtp}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            <span className="text-[11px] text-[#16A34A] font-medium">
              Identitas dikonfirmasi
            </span>
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
  isDinasLuar = false,
  isGpsDisabledByAdmin = false,
  onRefreshLocation,
}: {
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  gpsActive: boolean;
  inGeofence: boolean;
  distance: number | null;
  hospLat: number;
  hospLng: number;
  hospRadius: number;
  isDinasLuar?: boolean;
  isGpsDisabledByAdmin?: boolean;
  onRefreshLocation?: () => void;
}) {
  // Kekuatan sinyal diukur dari akurasi GPS (di bawah 15 meter dianggap sangat bagus)
  const signalBars = gpsActive
    ? userLocation && userLocation.accuracy <= 15
      ? 4
      : 3
    : 0;

  const mapCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [hospLat, hospLng];

  // Susunan metadata GPS untuk pratinjau informasi di bawah peta
  const gpsData = [
    {
      label: "Latitude",
      value: userLocation ? `${userLocation.lat.toFixed(7)}°` : "Mencari...",
    },
    {
      label: "Longitude",
      value: userLocation ? `${userLocation.lng.toFixed(7)}°` : "Mencari...",
    },
    {
      label: "Akurasi",
      value: userLocation ? `±${userLocation.accuracy} meter` : "—",
    },
    { label: "Status GPS", value: gpsActive ? "Aktif" : "Mencari..." },
    {
      label: "Status",
      value: isDinasLuar
        ? "Dinas Luar (Bebas)"
        : inGeofence
          ? "Dalam Area"
          : "Luar Area",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <MapPin size={15} className="text-[#16A34A]" />
          <span className="text-[13px] font-semibold text-gray-800">
            Lokasi GPS
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {onRefreshLocation && (
            <button
              type="button"
              onClick={onRefreshLocation}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#16A34A] bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl hover:bg-green-100 transition-all active:scale-95 cursor-pointer"
              title="Muat ulang GPS realtime"
            >
              <RotateCw size={12} />
              <span>Refresh GPS</span>
            </button>
          )}
          {/* Signal bars */}
          <div className="flex items-end gap-[3px]">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={`w-1 rounded-sm transition-all ${bar <= signalBars ? "bg-[#16A34A]" : "bg-gray-200"}`}
                style={{ height: `${bar * 3 + 4}px` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${gpsActive ? "bg-[#16A34A] animate-pulse" : "bg-red-500"}`}
            />
            <span
              className={`text-[11px] font-medium ${gpsActive ? "text-[#16A34A]" : "text-red-500"}`}
            >
              {gpsActive ? "GPS Aktif" : "GPS Mati"}
            </span>
          </div>
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="h-56 w-full relative" style={{ isolation: "isolate" }}>
        {/* Floating Refresh Location Button on Map Overlay */}
        {onRefreshLocation && (
          <button
            type="button"
            onClick={onRefreshLocation}
            className="absolute top-3 right-3 z-[1000] bg-white/95 hover:bg-white text-gray-800 border border-gray-200 shadow-lg rounded-xl px-3 py-1.5 text-[11.5px] font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer backdrop-blur-xs"
            title="Muat Ulang Koordinat GPS Realtime"
          >
            <RotateCw size={13} className="text-[#16A34A] animate-spin-once" />
            <span>Refresh Maps GPS</span>
          </button>
        )}

        {/* Searching Overlay if Location is not yet acquired */}
        {!userLocation && (
          <div className="absolute inset-0 z-[999] bg-slate-900/40 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <MapPin size={24} className="text-white animate-bounce mb-1.5" />
            <p className="text-white text-[12.5px] font-bold">Membaca Koordinat GPS Realtime...</p>
            <p className="text-slate-200 text-[11px] mt-0.5 mb-3">Pastikan izin lokasi (GPS) pada browser/HP diizinkan.</p>
            {onRefreshLocation && (
              <button
                type="button"
                onClick={onRefreshLocation}
                className="bg-[#16A34A] hover:bg-[#0d9240] text-white px-4 py-2 rounded-xl text-[12px] font-bold shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCw size={14} />
                <span>Refresh & Dapatkan Lokasi Saya</span>
              </button>
            )}
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={17}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Geofence radius circle */}
          <Circle
            center={[hospLat, hospLng]}
            radius={hospRadius}
            pathOptions={{
              color: inGeofence ? "#16A34A" : "#DC2626",
              fillColor: inGeofence ? "#16A34A" : "#DC2626",
              fillOpacity: 0.08,
              weight: 2,
              dashArray: "6 4",
            }}
          />

          {/* Hospital marker */}
          <Marker position={[hospLat, hospLng]} icon={hospIcon}>
            <Popup>
              <span className="text-[12px] font-semibold">
                RSUCL
                <br />
                <span className="font-normal text-gray-500">
                  Jl. Politeknik Aceh No.23
                </span>
              </span>
            </Popup>
          </Marker>

          {/* User location marker */}
          {userLocation && (
            <>
              <Marker
                position={[userLocation.lat, userLocation.lng]}
                icon={userIcon}
              >
                <Popup>
                  <span className="text-[12px]">
                    Lokasi Anda saat ini
                    <br />±{userLocation.accuracy}m akurasi
                  </span>
                </Popup>
              </Marker>
              <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />
            </>
          )}
        </MapContainer>
      </div>

      {/* GPS Data grid */}
      <div className="px-4 py-3 border-t border-gray-50">
        <div className="grid grid-cols-3 gap-3 mb-3">
          {gpsData.slice(0, 3).map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-2.5">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                {label}
              </p>
              <p className="text-[11px] font-bold text-gray-800 font-mono">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {gpsData.slice(3).map(({ label, value }) => {
            const isOk =
              (label === "Status" && (inGeofence || isDinasLuar)) ||
              (label === "Status GPS" && gpsActive);
            return (
              <div
                key={label}
                className={`rounded-xl p-2.5 ${isOk ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}
              >
                <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                  {label}
                </p>
                <p
                  className={`text-[11px] font-bold ${isOk ? "text-[#16A34A]" : "text-red-500"} font-mono`}
                >
                  {value}
                </p>
              </div>
            );
          })}
        </div>
        {/* In-range indicator */}
        <div
          className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border ${inGeofence ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}
        >
          <Target
            size={13}
            className={
              inGeofence
                ? "text-[#16A34A] flex-shrink-0"
                : "text-red-500 flex-shrink-0"
            }
          />
          <div className="flex-1">
            <p
              className={`text-[11px] font-semibold ${inGeofence ? "text-green-800" : "text-red-800"}`}
            >
              {isGpsDisabledByAdmin
                ? "Validasi GPS Nonaktif oleh Admin (Bisa Absen)"
                : isDinasLuar
                  ? "Dinas Luar: Validasi Radius GPS Dikecualikan"
                  : inGeofence
                    ? `Di dalam area RS (~${Math.round(distance ?? 0)} meter)`
                    : distance !== null
                      ? `Di luar area RS (~${Math.round(distance)} meter)`
                      : "Menunggu lokasi GPS..."}
            </p>
            <p
              className={`text-[10px] ${inGeofence ? "text-green-600" : "text-red-600"} truncate`}
            >
              {userLocation
                ? `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`
                : "Memuat lokasi..."}
            </p>
          </div>
          <div
            className={`w-2 h-2 rounded-full ${inGeofence ? "bg-[#16A34A] animate-pulse" : "bg-red-500"}`}
          />
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
function SuccessAnimation({
  action,
  time,
  onDone,
}: {
  action: string;
  time: string;
  onDone: () => void;
}) {
  const { user } = useAuth();

  // State mengontrol opasitas modal
  const [visible, setVisible] = useState(true);

  // Menutup otomatis modal popup setelah 3.5 detik dan memicu callback onDone
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 500);
    }, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-500 cursor-pointer ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Efek riak gelombang hijau */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#16A34A] opacity-0"
              style={{
                width: "128px",
                height: "128px",
                animation: `ripple 2s ease-out ${i * 0.4}s infinite`,
              }}
            />
          ))}
          <div className="relative z-10 w-20 h-20 rounded-full bg-[#16A34A] flex items-center justify-center shadow-2xl shadow-green-400/50">
            <CheckCircle2 size={40} className="text-white" />
          </div>
        </div>
        <div className="bg-white rounded-2xl px-8 py-5 shadow-2xl text-center min-w-[220px]">
          <p className="text-[18px] font-bold text-gray-900">
            {action} Berhasil!
          </p>
          <p className="text-[13px] text-gray-500 mt-1">{user?.name}</p>
          <div className="mt-3 px-4 py-2 bg-green-50 rounded-xl">
            <p className="text-[22px] font-mono font-bold text-[#16A34A]">
              {time}
            </p>
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

  // State menyimpan pesan kesalahan (error message) absensi
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State status konektivitas internet perangkat karyawan
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Memantau event perubahan status koneksi internet (online/offline)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);



  // State jam sistem yang berjalan secara realtime
  const [now, setNow] = useState(new Date());

  // Penanda apakah karyawan sudah absen masuk (check-in) hari ini
  const [checkedIn, setCheckedIn] = useState(false);

  // Penanda apakah karyawan sudah absen pulang (check-out) hari ini
  const [checkedOut, setCheckedOut] = useState(false);

  // Keterangan detail lokasi presisi (mis. Lobby RS, Poli Anak...)
  const [locationNote, setLocationNote] = useState("Gedung RSUCL / Area RS");

  // Status overtime (lembur)
  const [keteranganLembur, setKeteranganLembur] = useState("");

  // Alasan pulang cepat (early checkout)
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState("");

  // Status ketepatan absen masuk
  const [checkinPunctuality, setCheckinPunctuality] = useState<
    "tepat_waktu" | "toleransi" | "terlambat" | null
  >(null);

  // Pengontrol tampilan dialog konfirmasi submit absensi
  const [showModal, setShowModal] = useState(false);

  // Menyimpan jam check-in aktual dari backend
  const [checkInTime, setCheckInTime] = useState("");

  // Menyimpan jam check-out aktual dari backend
  const [checkOutTime, setCheckOutTime] = useState("");

  // Indikator status loading saat absensi sedang diposting ke API
  const [submitting, setSubmitting] = useState(false);

  // Status state machine untuk verifikasi wajah ('idle', 'scanning', 'captured', 'confirmed')
  const [faceStep, setFaceStep] = useState<FaceStep>("idle");

  // Menampung data pengajuan cuti/izin/sakit yang sedang aktif hari ini (jika ada)
  const [activeLeave, setActiveLeave] = useState<{
    type: string;
    reason: string;
  } | null>(null);

  // Menampung informasi hari libur nasional hari ini
  const [todayHoliday, setTodayHoliday] = useState<{
    name: string;
    is_assigned: boolean;
  } | null>(null);

  // Status bebas GPS / dinas luar hari ini
  const [isExemptFromGps, setIsExemptFromGps] = useState(false);
  const [dinasReasonToday, setDinasReasonToday] = useState<string | null>(null);

  // Pengendali parameter tampilan popup SuccessAnimation
  const [successAction, setSuccessAction] = useState("");
  const [successTime, setSuccessTime] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Pengaturan jam kerja absensi dinamis (geofence radius, jam buka/tutup absensi)
  const [shiftSettings, setShiftSettings] =
    useState<ShiftSettings>(DEFAULT_SHIFT);

  // Shift kerja karyawan yang aktif hari ini
  const [todayShift, setTodayShift] = useState<
    MyShiftSchedule | null | undefined
  >(undefined);
  const [todayShiftsList, setTodayShiftsList] = useState<any[]>([]);
  const [todayRecordsList, setTodayRecordsList] = useState<any[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);

  // Shift khusus hari Sabtu jika ada
  const [saturdayShift, setSaturdayShift] = useState<MyShiftSchedule | null>(
    null,
  );

  // GPS state
  const HOSP_LAT = shiftSettings.hospital_lat;
  const HOSP_LNG = shiftSettings.hospital_lng;
  const HOSP_RADIUS = shiftSettings.gps_radius;

  // Realtime GPS pelacakan presisi (Ramah iOS / iPhone)
  const {
    location: userLocation,
    gpsActive,
    refreshLocation,
  } = useRealtimeGps();

  // Load shift settings + jadwal shift karyawan dari API
  useEffect(() => {
    Promise.allSettled([settingApi.get(), scheduleApi.mySchedule()])
      .then(([settingRes, shiftRes]) => {
        let base: ShiftSettings = { ...DEFAULT_SHIFT };
        if (settingRes.status === "fulfilled" && settingRes.value.success) {
          const d = settingRes.value.data as unknown as Record<string, string>;
          base = {
            ...base,
            checkin_open: d.checkin_open ?? "0",
            late_limit: d.late_limit ?? "30",
            close_checkin: d.close_checkin ?? "60",
            break_start: d.break_start ?? "12:30",
            break_end: d.break_end ?? "13:30",
            checkout_open: d.checkout_open ?? "0",
            checkout_close: d.checkout_close ?? "60",
            sat_checkout_open: d.sat_checkout_open ?? "0",
            sat_checkout_close: d.sat_checkout_close ?? "60",
            hospital_lat: d.hospital_latitude
              ? Number(d.hospital_latitude)
              : d.hospital_lat
                ? Number(d.hospital_lat)
                : 5.552740480177099,
            hospital_lng: d.hospital_longitude
              ? Number(d.hospital_longitude)
              : d.hospital_lng
                ? Number(d.hospital_lng)
                : 95.33486560781716,
            gps_radius: d.attendance_radius_meters
              ? Number(d.attendance_radius_meters)
              : d.gps_radius
                ? Number(d.gps_radius)
                : 100,
            enable_gps_validation:
              d.enable_gps_validation !== undefined
                ? d.enable_gps_validation === "1"
                : true,
            early_checkout_grace_minutes:
              d.early_checkout_grace_minutes ?? "15",
            overtime_grace_minutes: d.overtime_grace_minutes ?? "15",
          };
        }

        const shift =
          shiftRes.status === "fulfilled" && shiftRes.value.success
            ? shiftRes.value.data
            : null;
        setTodayShift(shift);
        const satShift =
          shiftRes.status === "fulfilled" && shiftRes.value.success
            ? (shiftRes.value.saturday_shift ?? null)
            : null;
        setSaturdayShift(satShift);
        setShiftSettings(base);
      })
      .catch((err) => {
        console.error(err);
        setTodayShift(null);
      });
  }, []);

  // Dynamically update shiftSettings whenever todayShift or saturdayShift changes
  useEffect(() => {
    const startTime = todayShift?.start_time || "08:30:00";
    const endTime = todayShift?.end_time || "17:00:00";

    const startHHmm = safeSubstr(startTime, 0, 5, "08:30");
    const endHHmm = safeSubstr(endTime, 0, 5, "17:00");
    const startMins = parseMins(startHHmm);
    const endMins = parseMins(endHHmm);
    const overnight = endMins <= startMins;

    const satEndTime = saturdayShift?.end_time || "13:00:00";
    const satEndHHmm = safeSubstr(satEndTime, 0, 5, "13:00");

    const openHHmm = subMins(startHHmm, 150); // 2.5 jam sebelum shift
    const lateHHmm = addMins(startHHmm, 10);  // Toleransi 10 menit
    const closeHHmm = endHHmm;

    setShiftSettings((prev) => ({
      ...prev,
      checkin_open: openHHmm,
      late_limit: lateHHmm,
      close_checkin: closeHHmm,
      checkout_open: endHHmm,
      checkout_close: addMins(endHHmm, 60),
      sat_checkout_open: satEndHHmm,
      sat_checkout_close: addMins(satEndHHmm, 60),
      isOvernight: overnight,
    }));
  }, [todayShift, saturdayShift]);

  // Load today's record on mount
  useEffect(() => {
    const loadTodayRecord = async () => {
      try {
        const res = await attendanceApi.today();
        if (res.success) {
          if (res.today_shifts && res.today_shifts.length > 0) {
            setTodayShiftsList(res.today_shifts);
          }
          if (res.records) {
            setTodayRecordsList(res.records);
          }
          if (res.data) {
            if (res.data.check_in) {
              setCheckInTime(safeSubstr(res.data.check_in, 0, 5, ""));
              setCheckedIn(true);
            }
            if (res.data.check_out) {
              setCheckOutTime(safeSubstr(res.data.check_out, 0, 5, ""));
              setCheckedOut(true);
            }
            if (res.data.checkin_punctuality) {
              setCheckinPunctuality(res.data.checkin_punctuality);
            }
          }
          if (res.active_leave) {
            setActiveLeave(res.active_leave);
          }
          if (res.holiday) {
            setTodayHoliday(res.holiday);
          }
          if (res.is_exempt_from_gps) {
            setIsExemptFromGps(true);
          }
          if (res.dinas_reason) {
            setDinasReasonToday(res.dinas_reason);
          }
        }
      } catch (err) {
        console.error("Error fetching today record:", err);
      }
    };
    loadTodayRecord();
  }, []);

  // Geolocation sudah ditangani secara realtime & otomatis oleh useRealtimeGps hook

  const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  };

  const distance = userLocation
    ? getDistance(userLocation.lat, userLocation.lng, HOSP_LAT, HOSP_LNG)
    : null;

  const isGpsDisabledByAdmin = shiftSettings.enable_gps_validation === false;
  const isDinasLuar =
    todayShift?.shift_type === "dinas_luar" || isExemptFromGps || isGpsDisabledByAdmin;

  const inGeofence = isDinasLuar
    ? true
    : distance !== null
      ? distance <= HOSP_RADIUS
      : false;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const current = now;

  const isLiburShift = todayShift
    ? (() => {
        const u = todayShift.name.toUpperCase();
        return u.includes("LIBUR") || u.includes("OFF") || u === "LJ";
      })()
    : false;

  const attendanceWindow =
    (todayShift === null || isLiburShift) ? "no_shift" : getWindow(current, shiftSettings);
  const wc = (!checkedIn && (attendanceWindow === "working" || attendanceWindow === "checkout" || attendanceWindow === "late_locked" || attendanceWindow === "break"))
    ? {
        icon: AlertCircle,
        iconColor: "#D97706",
        bg: "#FFFBEB",
        border: "#FDE68A",
        title: "Check-In Terlambat",
        desc: "Waktu shift telah berjalan. Anda tetap dapat melakukan Check-In (dicatat Terlambat).",
        sub: "Silakan lengkapi verifikasi foto wajah untuk submit Check-In.",
      }
    : windowConfig[attendanceWindow];
  const dayId = DAYS_ID[current.getDay()];
  const isSaturday = current.getDay() === 6;
  const timeStr = current.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = `${dayId}, ${current.getDate()} ${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][current.getMonth()]} ${current.getFullYear()}`;

  // Karyawan dapat check-in selama belum check-in hari ini dan bukan hari libur/off/terlalu awal
  const canCheckIn = !checkedIn && attendanceWindow !== "no_shift" && attendanceWindow !== "sunday" && attendanceWindow !== "too_early";
  // Karyawan dapat check-out kapan saja setelah check-in dan belum check-out
  const canCheckOut = checkedIn && !checkedOut;

  const faceVerified = faceStep === "confirmed";

  const getExpectedCheckoutTime = () => {
    const expected = new Date(current);
    const endTimeStr = todayShift?.end_time || "17:00:00";
    const [hh, mm] = safeSubstr(endTimeStr, 0, 5, "17:00").split(":").map(Number);
    expected.setHours(hh || 17, mm || 0, 0, 0);

    const startTimeStr = todayShift?.start_time || "08:00:00";
    const [sh, sm] = safeSubstr(startTimeStr, 0, 5, "08:00").split(":").map(Number);
    const startMins = (sh || 8) * 60 + (sm || 0);
    const endMins = (hh || 17) * 60 + (mm || 0);
    if (endMins <= startMins) {
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
    const grace =
      parseInt(shiftSettings.early_checkout_grace_minutes || "15") || 0;
    const threshold = new Date(expected.getTime() - grace * 60 * 1000);
    return current < threshold;
  };

  const checkIfOvertime = () => {
    if (!canCheckOut) return false;
    const expected = getExpectedCheckoutTime();
    const grace = parseInt(shiftSettings.overtime_grace_minutes || "15") || 0;
    const threshold = new Date(expected.getTime() + grace * 60 * 1000);
    return current > threshold;
  };

  const getOvertimeDurationMins = () => {
    if (!canCheckOut) return 0;
    const expected = getExpectedCheckoutTime();
    const diffMs = current.getTime() - expected.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const lockedLabel = () => {
    // Sudah check-in tapi belum check-out dan waktu sudah lewat
    if (checkedIn && !checkedOut) return "Batas Waktu Check-Out Sudah Lewat";
    // Sudah selesai keduanya — seharusnya tidak masuk blok ini, tapi sebagai fallback
    if (checkedIn && checkedOut) return "Absensi Hari Ini Selesai";
    if (attendanceWindow === "no_shift")
      return "Tidak ada jadwal shift hari ini";
    if (attendanceWindow === "too_early")
      return `Absen Dibuka Pukul ${shiftSettings.checkin_open}`;
    if (attendanceWindow === "late_locked")
      return `Batas Check-In Terlewat (${shiftSettings.close_checkin})`;
    if (attendanceWindow === "break") return "Dikunci – Jam Istirahat";
    if (attendanceWindow === "working") return "Waktu Absen Masuk Telah Lewat";
    if (attendanceWindow === "ended") return "Waktu Absen Telah Berakhir";
    if (attendanceWindow === "sunday") return "Hari Libur";
    return "Absen Dikunci";
  };

  const handleAction = () => {
    setErrorMsg(null);
    if (!faceVerified) {
      setFaceStep("scanning");
      const card = document.getElementById("face-verification-card");
      if (card) {
        card.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    if (!inGeofence && !isGpsDisabledByAdmin && !isDinasLuar) {
      refreshLocation();
      setErrorMsg("Sistem sedang memperbarui lokasi GPS Anda. Silakan pastikan GPS HP aktif di area RSUCL dan coba lagi.");
      return;
    }
    setShowModal(true);
  };

  const confirmAction = async (earlyReason?: any) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const latVal = userLocation?.lat ?? HOSP_LAT;
      const lngVal = userLocation?.lng ?? HOSP_LNG;
      const accVal = userLocation?.accuracy ?? undefined;

      const earlyReasonStr =
        typeof earlyReason === "string" && earlyReason.trim()
          ? earlyReason.trim()
          : earlyCheckoutReason.trim() || "Pulang kerja (sesuai jam dinas)";

      // Helper to convert base64 dataurl to Blob for file upload safely
      const dataURLtoBlob = (dataurl: string) => {
        try {
          if (!dataurl || typeof dataurl !== "string" || !dataurl.includes(",")) {
            return undefined;
          }
          const arr = dataurl.split(",");
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new Blob([u8arr], { type: mime });
        } catch (e) {
          console.error("Error converting base64 image to Blob:", e);
          return undefined;
        }
      };

      const photoFile = capturedImage
        ? dataURLtoBlob(capturedImage)
        : undefined;

      if (!canCheckIn && !canCheckOut) {
        alert("Batas waktu absensi telah ditutup.");
        setShowModal(false);
        setSubmitting(false);
        return;
      }

      const noteFinal = locationNote.trim() || "Gedung RSUCL / Area RS";

      if (canCheckIn) {
        const res = await attendanceApi.checkIn(
          latVal,
          lngVal,
          accVal,
          photoFile,
          noteFinal,
        );
        if (res.success) {
          const rawCheckIn = res.data?.check_in || current.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
          const t = safeSubstr(rawCheckIn, 0, 5, "08:00");
          setCheckInTime(t);
          if (res.data?.checkin_punctuality) {
            setCheckinPunctuality(res.data.checkin_punctuality);
          }
          setCheckedIn(true);
          setShowModal(false);
          setSuccessAction("Check-In");
          setSuccessTime(t);
          setShowSuccess(true);
          // Reset foto selfie agar checkout meminta foto baru jika diperlukan
          setCapturedImage(null);
          setFaceStep("idle");
        }
      } else if (canCheckOut) {
        const res = await attendanceApi.checkOut(
          latVal,
          lngVal,
          accVal,
          photoFile,
          noteFinal,
          earlyReasonStr,
          undefined,
          undefined,
        );
        if (res.success) {
          const rawCheckOut = res.data?.check_out || current.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
          const t = safeSubstr(rawCheckOut, 0, 5, "17:00");
          setCheckOutTime(t);
          setCheckedOut(true);
          setShowModal(false);
          setSuccessAction("Check-Out");
          setSuccessTime(t);
          setShowSuccess(true);
          setKeteranganLembur("");
          setCapturedImage(null);
          setFaceStep("idle");
        }
      }
    } catch (err: any) {
      // Backend menolak karena lembur tapi keterangan belum diisi
      const responseData = err?.data;
      const message =
        responseData?.message ??
        err?.message ??
        "Terjadi kesalahan. Silakan coba lagi.";

      if (responseData?.requires_keterangan_lembur) {
        setErrorMsg(
          "Anda terdeteksi lembur. Mohon isi alasan lembur sebelum checkout.",
        );
      } else {
        let friendlyMsg = "Terjadi kesalahan. Silakan coba lagi.";
        if (err && typeof err === "object") {
          if (
            responseData &&
            typeof responseData === "object" &&
            responseData.message
          ) {
            friendlyMsg = responseData.message;
          } else if (err.message && typeof err.message === "string") {
            if (
              !err.message.includes("SQLSTATE") &&
              !err.message.includes("syntax error") &&
              !err.message.includes("exception")
            ) {
              friendlyMsg = err.message;
            }
          }
        }
        setErrorMsg(friendlyMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getDuration = () => {
    if (!checkInTime || !checkOutTime) return "--";
    const [ih, im] = checkInTime.split(":").map(Number);
    const [oh, om] = checkOutTime.split(":").map(Number);
    const inMins = ih * 60 + im;
    let outMins = oh * 60 + om;
    if (outMins <= inMins) {
      outMins += 24 * 60;
    }
    const diff = outMins - inMins - (isSaturday ? 0 : 60);
    if (diff <= 0) return "0j 0m";
    return `${Math.floor(diff / 60)}j ${diff % 60}m`;
  };

  const getAttendStatus = () => {
    if (!checkInTime) return null;
    if (checkinPunctuality === "tepat_waktu") {
      return { label: "Tepat Waktu", color: "#16A34A", bg: "#DCFCE7" };
    }
    if (checkinPunctuality === "toleransi") {
      return { label: "Toleransi", color: "#D97706", bg: "#FEF3C7" };
    }
    if (checkinPunctuality === "terlambat") {
      return { label: "Terlambat", color: "#DC2626", bg: "#FEE2E2" };
    }

    // Fallback hitung manual jika status kosong dari database
    const mins = parseMins(checkInTime);
    const startHHmm = todayShift?.start_time
      ? safeSubstr(todayShift.start_time, 0, 5, "08:30")
      : "08:30";
    const startMins = parseMins(startHHmm);
    const toleranceMins = startMins + 10; // Toleransi 10 menit

    if (mins <= startMins) {
      return { label: "Tepat Waktu", color: "#16A34A", bg: "#DCFCE7" };
    }
    if (mins <= toleranceMins) {
      return { label: "Toleransi", color: "#D97706", bg: "#FEF3C7" };
    }
    return { label: "Terlambat", color: "#DC2626", bg: "#FEE2E2" };
  };
  const attendStatus = getAttendStatus();

  const timelineItems = isSaturday
    ? [
        {
          time: shiftSettings.checkin_open,
          label: "Check-In",
          phase: "checkin",
        },
        {
          time: shiftSettings.sat_checkout_open,
          label: "Check-Out",
          phase: "checkout",
        },
      ]
    : [
        {
          time: shiftSettings.checkin_open,
          label: "Buka Absen",
          phase: "checkin",
        },
        {
          time: shiftSettings.close_checkin,
          label: "Tutup Absen",
          phase: "late_locked",
        },
        ...(shiftSettings.break_start !== shiftSettings.checkout_open
          ? [
              {
                time: shiftSettings.break_start,
                label: "Istirahat",
                phase: "break",
              },
              {
                time: shiftSettings.break_end,
                label: "Lanjut Kerja",
                phase: "working",
              },
            ]
          : []),
        {
          time: shiftSettings.checkout_open,
          label: "Check-Out",
          phase: "checkout",
        },
        {
          time: shiftSettings.checkout_close,
          label: "Batas Akhir",
          phase: "ended",
        },
      ];

  const phaseOrder: AttendanceWindow[] = [
    "too_early",
    "checkin",
    "late_locked",
    "break",
    "working",
    "checkout",
    "ended",
  ];
  const currentPhaseIdx = phaseOrder.indexOf(attendanceWindow);

  const handleFaceCapture = (image: string) => {
    if (faceStep === "idle") {
      setFaceStep("scanning");
    } else if (faceStep === "scanning") {
      setCapturedImage(image);
      setFaceStep("confirmed");
    }
  };
  const handleFaceRetake = () => {
    setCapturedImage(null);
    setFaceStep("idle");
  };

  // Camera helpers and handlers

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      <style>{RIPPLE_STYLE}</style>

      {errorMsg && !showModal && (
        <Alert
          variant="destructive"
          className="mb-4 border-red-200 bg-red-50 text-red-700"
        >
          <AlertCircle className="h-4 w-4 text-red-650" />
          <AlertDescription className="text-[12px]">
            {errorMsg}
          </AlertDescription>
        </Alert>
      )}



      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Absensi</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{dateStr}</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-mono font-semibold text-black tracking-tight">
            {timeStr}
          </p>
          <p className="text-[10px] text-gray-400">WIB</p>
        </div>
      </div>

      {/* Hari Libur Banner */}
      {todayHoliday && (
        <div
          className={`mb-4 rounded-2xl border p-4.5 text-[13px] leading-relaxed transition-all shadow-sm ${
            todayHoliday.is_assigned
              ? "border-purple-200 bg-purple-50 text-purple-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                todayHoliday.is_assigned
                  ? "bg-purple-100/80 text-purple-700"
                  : "bg-red-100/80 text-red-650"
              }`}
            >
              <Calendar size={15} />
            </div>
            <div>
              <p className="font-bold text-[14px]">
                Hari Libur Nasional: {todayHoliday.name}
              </p>
              <p className="mt-1 text-gray-600">
                {todayHoliday.is_assigned ? (
                  <span>
                    Anda <strong className="text-purple-700">DITUGASKAN</strong>{" "}
                    untuk piket hari ini. Aturan absensi normal berlaku dan
                    kompensasi bonus/kerja hari libur akan otomatis terhitung.
                  </span>
                ) : (
                  <span>
                    Anda{" "}
                    <strong className="text-red-700">TIDAK DITUGASKAN</strong>{" "}
                    untuk masuk hari ini. Libur Anda tidak akan dianggap sebagai
                    Alpa meskipun tidak melakukan absensi.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Shift Selector Banner */}
      {todayShiftsList.length > 1 && (
        <div className="mb-4 p-3.5 bg-gradient-to-r from-emerald-50 to-green-50/80 border border-emerald-200 rounded-2xl space-y-2.5 font-sans shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="text-[12px] font-bold text-emerald-950 flex items-center gap-1.5">
              <span>⚡</span> Multi-Shift Hari Ini ({todayShiftsList.length} Shift Terdaftar)
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold">Pilih shift untuk melakukan absensi</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {todayShiftsList.map((s, idx) => {
              const isSel = (selectedShiftId ?? todayShift?.id) === s.id;
              const rec = todayRecordsList.find(r => r.schedule_id === s.id);
              const statusLbl = rec?.check_out ? 'Selesai' : rec?.check_in ? 'Sudah Absen' : 'Belum Absen';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedShiftId(s.id);
                    setTodayShift(s);
                    if (rec) {
                      setCheckInTime(rec.check_in ? rec.check_in.substring(0, 5) : '');
                      setCheckedIn(!!rec.check_in);
                      setCheckOutTime(rec.check_out ? rec.check_out.substring(0, 5) : '');
                      setCheckedOut(!!rec.check_out);
                    } else {
                      setCheckInTime('');
                      setCheckedIn(false);
                      setCheckOutTime('');
                      setCheckedOut(false);
                    }
                  }}
                  className={`px-3.5 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                    isSel
                      ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-md shadow-green-200/60 scale-[1.01]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-200'
                  }`}
                >
                  <span>Shift {idx + 1}: {s.name} ({safeSubstr(s.start_time, 0, 5, "--:--")}–{safeSubstr(s.end_time, 0, 5, "--:--")})</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSel ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {statusLbl}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Shift Hari Ini / Libur Jaga Banner */}
      {todayShift !== undefined && (
        isLiburShift ? (
          <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50/80 p-4.5 text-[12.5px] leading-relaxed shadow-sm font-sans">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-700">
                <Moon size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[14px] text-purple-950">Jadwal Hari Ini: {todayShift?.name || 'Libur Jaga (LJ)'}</p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-purple-200 text-purple-800 rounded-full border border-purple-300">
                    Libur Jaga / OFF
                  </span>
                </div>
                <p className="mt-1 text-purple-800 text-[11.5px] leading-relaxed">
                  ✨ Hari ini Anda sedang dalam jadwal <strong>Libur Jaga (LJ)</strong>. 
                  Anda <strong>TIDAK PERLU ABSEN Presensi</strong> (masuk maupun pulang). Status kehadiran Anda tidak akan dihitung Alpa / Tanpa Keterangan.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-[12px] font-medium ${
              todayShift
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-gray-200 bg-gray-50 text-gray-500"
            }`}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: todayShift ? todayShift.color : "#E5E7EB" }}
            >
              <Clock size={13} className="text-white" />
            </div>
            <div className="flex-1">
              {todayShift ? (
                <>
                  <span className="font-semibold">Shift {todayShift.name}</span>
                  <span className="text-green-600 ml-2">
                    {safeSubstr(todayShift.start_time, 0, 5, "--:--")} –{" "}
                    {safeSubstr(todayShift.end_time, 0, 5, "--:--")} WIB
                  </span>
                </>
              ) : (
                <span>Tidak ada jadwal shift hari ini</span>
              )}
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                todayShift
                  ? "bg-green-200 text-green-800"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {todayShift ? "Aktif" : "Libur"}
            </span>
          </div>
        )
      )}

      {/* Sedang Dinas Banner */}
      {isDinasLuar && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-[12px] font-medium border-amber-250 bg-amber-50 text-amber-800">
          <div className="w-7 h-7 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0 text-amber-800">
            <Navigation size={13} className="animate-pulse" />
          </div>
          <div className="flex-1">
            <span className="font-bold block text-amber-900">
              Status: Sedang Dinas
            </span>
            <span className="text-amber-750 text-[11px]">
              {dinasReasonToday ||
                "Dinas Luar (Validasi radius GPS dinonaktifkan untuk hari ini)"}
            </span>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-amber-200 text-amber-850 rounded-full border border-amber-300">
            GPS Bebas
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
                ? "Memuat Jadwal..."
                : todayShift
                  ? `Jadwal Shift: ${todayShift.name}` // Menampilkan nama shift secara dinamis
                  : "Jadwal Absensi"}
            </p>
          </div>
          {/* Lencana Istirahat: Hanya dirender jika hari ini ada shift aktif & ada jam istirahat di dalam rentang shift */}
          {todayShift &&
            shiftSettings.break_start !== shiftSettings.checkout_open && (
              <span className="text-[10.5px] font-medium text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-100/50">
                <Coffee size={10.5} className="flex-shrink-0" /> Istirahat{" "}
                {shiftSettings.break_start}–{shiftSettings.break_end}
              </span>
            )}
        </div>

        {todayShift === undefined ? (
          // State loading data
          <div className="text-center py-6 text-gray-400 text-[12px] animate-pulse">
            Memuat jadwal shift hari ini...
          </div>
        ) : todayShift ? (
          <>
            {/* TAMPILAN DESKTOP: Render alur horizontal mendatar jika lebar layar >= sm */}
            <div className="hidden sm:flex items-center gap-0">
              {timelineItems.map((item, i) => {
                const phaseIdx = phaseOrder.indexOf(
                  item.phase as AttendanceWindow,
                );
                const isDone = phaseIdx < currentPhaseIdx;
                const isActive =
                  item.phase === attendanceWindow ||
                  (attendanceWindow === "checkin" &&
                    item.phase === "checkin") ||
                  (attendanceWindow === "checkout" &&
                    item.phase === "checkout");
                return (
                  <div key={i} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className={`w-3 h-3 rounded-full border-2 transition-all ${isActive ? "bg-[#16A34A] border-[#16A34A] ring-2 ring-[#16A34A]/20" : isDone ? "bg-[#16A34A] border-[#16A34A]" : "bg-white border-gray-300"}`}
                      />
                      <p className="text-[9px] font-mono text-gray-500 mt-1 whitespace-nowrap">
                        {item.time}
                      </p>
                      <p
                        className={`text-[9px] font-medium mt-0.5 whitespace-nowrap ${isActive ? "text-[#16A34A]" : isDone ? "text-gray-400" : "text-gray-300"}`}
                      >
                        {item.label}
                      </p>
                    </div>
                    {i < timelineItems.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-1 -mt-4 transition-all ${isDone ? "bg-[#16A34A]" : "bg-gray-150"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* TAMPILAN MOBILE: Render alur vertikal ke bawah jika lebar layar < sm (layar HP) */}
            <div className="sm:hidden space-y-3.5 pl-2.5 relative before:absolute before:left-4 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-gray-100">
              {timelineItems.map((item, i) => {
                const phaseIdx = phaseOrder.indexOf(
                  item.phase as AttendanceWindow,
                );
                const isDone = phaseIdx < currentPhaseIdx;
                const isActive =
                  item.phase === attendanceWindow ||
                  (attendanceWindow === "checkin" &&
                    item.phase === "checkin") ||
                  (attendanceWindow === "checkout" &&
                    item.phase === "checkout");
                return (
                  <div key={i} className="flex items-center gap-4 relative">
                    {/* Lingkaran Status: glowing hijau jika aktif, hijau solid jika selesai, abu-abu jika belum mulai */}
                    <div
                      className={`w-3 h-3 rounded-full border-2 z-10 flex items-center justify-center transition-all ${
                        isActive
                          ? "bg-[#16A34A] border-[#16A34A] ring-4 ring-[#16A34A]/15"
                          : isDone
                            ? "bg-[#16A34A] border-[#16A34A]"
                            : "bg-white border-gray-300"
                      }`}
                    />
                    <div className="flex items-center justify-between flex-1 min-w-0 pr-1">
                      <span
                        className={`text-[12px] font-medium ${isActive ? "text-[#16A34A] font-bold" : isDone ? "text-gray-600" : "text-gray-400"}`}
                      >
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
          // STATE HARI LIBUR / LIBUR JAGA
          <div className="text-center py-6 px-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <Moon size={22} className="text-slate-400 mx-auto mb-2" />
            <p className="text-[12.5px] text-gray-700 font-bold">
              {(todayShift as any)?.name?.toLowerCase().includes('libur jaga') || (todayShift as any)?.name?.toUpperCase() === 'LJ'
                ? 'Libur Jaga (LJ) — Bebas Tugas'
                : 'Tidak Ada Jadwal Absensi'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
              {(todayShift as any)?.name?.toLowerCase().includes('libur jaga') || (todayShift as any)?.name?.toUpperCase() === 'LJ'
                ? 'Hari ini Anda mendapat Libur Jaga setelah menyelesaikan tugas dinas. Tidak diperlukan absensi.'
                : 'Hari ini adalah hari libur Anda. Jadwal absensi harian akan otomatis mengikuti jadwal shift dinas.'}
            </p>
          </div>
        )}
      </div>

      {/* Face Verification viewfinder */}
      <FaceVerificationCard
        faceStep={faceStep}
        onCapture={handleFaceCapture}
        onRetake={handleFaceRetake}
        employeeName={user?.name ?? "Dr. Rina Kusumawati"}
        employeeNikKtp={user?.nik_ktp ?? "198501012010012001"}
        capturedImage={capturedImage}
        activeLeave={activeLeave}
      />

      {/* CTA Button (Dipindahkan ke Atas Map GPS) */}
      <div className="mb-4">
        {checkedOut ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <CheckCircle2 size={32} className="text-[#16A34A] mx-auto mb-2" />
            <p className="text-[15px] font-semibold text-gray-800">
              Absensi Selesai
            </p>
            <p className="text-[13px] text-gray-500 mt-1">
              Terima kasih · Sampai jumpa besok!
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-gray-400">Masuk</p>
                <p className="text-[13px] font-bold text-black">{checkInTime}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Keluar</p>
                <p className="text-[13px] font-bold text-black">{checkOutTime}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Durasi</p>
                <p className="text-[13px] font-bold text-black">
                  {getDuration()}
                </p>
              </div>
            </div>
          </div>
        ) : canCheckIn ? (
          <div className="space-y-2">
            {(!faceVerified || !inGeofence) && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-[12px] text-amber-700">
                  {!faceVerified
                    ? "Selesaikan verifikasi wajah terlebih dahulu"
                    : "Anda harus berada di dalam area geofence RSUCL"}
                </p>
              </div>
            )}
            <button
              onClick={handleAction}
              disabled={!faceVerified || !inGeofence}
              className={`w-full py-4 rounded-2xl font-semibold text-[16px] transition-all flex items-center justify-center gap-3 ${
                faceVerified && inGeofence
                  ? "bg-[#16A34A] hover:bg-[#0d9240] text-white shadow-lg shadow-green-200/60 active:scale-[0.98]"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed border-2 border-dashed border-gray-200"
              }`}
            >
              {faceVerified && inGeofence ? (
                <CheckCircle2 size={20} />
              ) : (
                <Lock size={18} />
              )}
              {faceVerified && inGeofence
                ? "CHECK IN"
                : !inGeofence
                  ? "Di Luar Area Geofence"
                  : "Verifikasi Wajah Diperlukan"}
            </button>
          </div>
        ) : canCheckOut ? (
          <div className="space-y-2">
            {(!faceVerified || !inGeofence) && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-[12px] text-amber-700">
                  {!faceVerified
                    ? "Ambil foto selfie di atas terlebih dahulu untuk check-out"
                    : "Sistem sedang memverifikasi lokasi GPS Anda (pastikan di area RSUCL)"}
                </p>
              </div>
            )}
            <button
              onClick={handleAction}
              disabled={submitting}
              className={`w-full py-4 rounded-2xl font-semibold text-[16px] transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
                faceVerified && inGeofence
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200/60"
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200/60"
              }`}
            >
              {faceVerified && inGeofence ? (
                <Clock size={20} />
              ) : !faceVerified ? (
                <Camera size={20} />
              ) : (
                <MapPin size={20} />
              )}
              {faceVerified && inGeofence
                ? "CHECK OUT"
                : !faceVerified
                  ? "AMBIL FOTO UNTUK CHECK OUT"
                  : "UPDATE LOKASI & CHECK OUT"}
            </button>
          </div>
        ) : (
          <div
            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 border-2 cursor-not-allowed
              ${
                attendanceWindow === "break"
                  ? "bg-purple-50 border-purple-200 text-purple-400"
                  : attendanceWindow === "sunday" ||
                      attendanceWindow === "no_shift" ||
                      attendanceWindow === "ended"
                    ? "bg-gray-100 border-gray-200 text-gray-400"
                    : attendanceWindow === "too_early"
                      ? "bg-amber-50 border-amber-200 text-amber-400"
                      : attendanceWindow === "late_locked"
                        ? "bg-red-50 border-red-200 text-red-400"
                        : "bg-blue-50 border-blue-200 text-blue-400"
              }`}
          >
            <Lock size={18} />
            <span className="text-[15px] font-semibold">{lockedLabel()}</span>
          </div>
        )}
      </div>

      {/* GPS Map Geofence Card */}
      <GPSCard
        userLocation={userLocation}
        gpsActive={gpsActive}
        inGeofence={inGeofence}
        distance={distance}
        hospLat={HOSP_LAT}
        hospLng={HOSP_LNG}
        hospRadius={HOSP_RADIUS}
        isDinasLuar={isDinasLuar}
        isGpsDisabledByAdmin={isGpsDisabledByAdmin}
        onRefreshLocation={refreshLocation}
      />

      {/* Rekap if checked in */}
      {checkedIn && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-[12px] font-bold text-gray-700 mb-3">
            Rekap Absensi Hari Ini
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 font-semibold leading-none mb-1">
                  Jam Masuk
                </p>
                <p className="text-[12.5px] font-bold text-gray-900 leading-tight">
                  {checkInTime || "--:--"}
                </p>
              </div>
            </div>

            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 font-semibold leading-none mb-1">
                  Jam Keluar
                </p>
                <p className="text-[12.5px] font-bold text-gray-900 leading-tight">
                  {checkOutTime || "--:--"}
                </p>
              </div>
            </div>

            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                <Clock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 font-semibold leading-none mb-1">
                  Durasi Kerja
                </p>
                <p className="text-[12.5px] font-bold text-gray-900 leading-tight">
                  {checkedOut ? getDuration() : "--"}
                </p>
              </div>
            </div>

            <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100/50 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-gray-400 font-semibold leading-none mb-1">
                  Status
                </p>
                {attendStatus ? (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5"
                    style={{
                      color: attendStatus.color,
                      backgroundColor: attendStatus.bg,
                    }}
                  >
                    {attendStatus.label}
                  </span>
                ) : (
                  <p className="text-[12.5px] font-bold text-gray-900 leading-tight">
                    --
                  </p>
                )}
              </div>
            </div>
          </div>
          {!isSaturday && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-xl border border-purple-100">
              <Coffee size={12} className="text-purple-500 flex-shrink-0" />
              <p className="text-[11px] text-purple-700">
                Istirahat 12:30–13:30
              </p>
            </div>
          )}
        </div>
      )}

      {/* Connection badges */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          {
            icon: Wifi,
            label: "WiFi/Jaringan",
            st: isOnline ? "Terhubung" : "Terputus",
            ok: isOnline,
          },
          {
            icon: Navigation,
            label: "GPS",
            st: gpsActive ? "Aktif" : "Nonaktif",
            ok: gpsActive,
          },
          {
            icon: Target,
            label: "Geofence",
            st: isDinasLuar
              ? "Dinas Luar (Bebas)"
              : inGeofence
                ? "Terverifikasi"
                : "Di Luar Area",
            ok: isDinasLuar ? true : inGeofence,
          },
        ].map(({ icon: Icon, label, st, ok }, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-100 p-2 flex items-center gap-1.5 shadow-sm min-w-0"
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? "bg-green-50" : "bg-red-50"}`}
            >
              <Icon
                size={12}
                className={ok ? "text-[#16A34A]" : "text-red-500"}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[8.5px] text-gray-400 leading-none truncate">
                {label}
              </p>
              <p
                className="text-[9.5px] font-semibold mt-0.5 truncate"
                style={{ color: ok ? "#16A34A" : "#DC2626" }}
              >
                {st}
              </p>
            </div>
          </div>
        ))}
      </div>



      {/* Ketentuan Absensi RSUCL Card */}
      <div className="mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 shadow-2xs font-sans space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Info size={14} />
            </div>
            <p className="text-[12px] font-bold text-slate-800 tracking-wide">
              Ketentuan Absensi RSUCL
            </p>
          </div>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Shift Hari Ini
          </span>
        </div>

        <div className="space-y-2 text-[11.5px]">
          {/* Shift Aktif */}
          <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-150 shadow-2xs">
            <span className="text-slate-500 font-medium">Jadwal Shift:</span>
            <span className="font-bold text-emerald-800 text-right">
              {todayShift
                ? (() => {
                    const nameHasTime = todayShift.name.includes(":") || todayShift.name.includes("00");
                    const timeRange = `${safeSubstr(todayShift.start_time, 0, 5, "--:--")} – ${safeSubstr(todayShift.end_time, 0, 5, "--:--")} WIB`;
                    return nameHasTime ? `${todayShift.name}` : `${todayShift.name} (${timeRange})`;
                  })()
                : "Libur / Tidak Ada Shift"}
            </span>
          </div>

          {/* Pintu Check-in */}
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-slate-500">Pintu Check-In Dibuka:</span>
            <span className="font-semibold text-slate-800">
              {shiftSettings.checkin_open} WIB <span className="text-[10px] text-slate-400 font-normal">(2.5 Jam Sebelum Shift)</span>
            </span>
          </div>

          {/* Rentang Tepat Waktu */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-emerald-50/50 rounded-xl border border-emerald-150/60">
            <span className="text-emerald-800 font-medium">Tepat Waktu (Hadir):</span>
            <span className="font-bold text-emerald-700">
              {shiftSettings.checkin_open} – {shiftSettings.late_limit} WIB
            </span>
          </div>

          {/* Status Terlambat */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-amber-50/50 rounded-xl border border-amber-150/60">
            <span className="text-amber-800 font-medium">Status Terlambat:</span>
            <span className="font-bold text-amber-700">
              Lewat {shiftSettings.late_limit} WIB <span className="text-[10px] text-amber-600 font-normal">(Tetap Bisa Absen)</span>
            </span>
          </div>

          {/* Waktu Check-Out */}
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <span className="text-slate-500">Waktu Check-Out (Pulang):</span>
            <span className="font-semibold text-slate-800">
              {shiftSettings.checkout_open} WIB
              {saturdayShift ? ` (Sabtu: ${shiftSettings.sat_checkout_open} WIB)` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              setShowModal(false);
              setErrorMsg(null);
            }}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-2xl mx-0 sm:mx-4">
            <button
              onClick={() => {
                setShowModal(false);
                setErrorMsg(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X size={16} className="text-gray-500" />
            </button>
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto ${canCheckIn ? "bg-green-50" : "bg-red-50"}`}
            >
              {canCheckIn ? (
                <CheckCircle2 size={28} className="text-[#16A34A]" />
              ) : (
                <AlertCircle size={28} className="text-red-500" />
              )}
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">
              Konfirmasi {canCheckIn ? "Check-In" : "Check-Out"}
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-4">
              Apakah Anda yakin ingin melakukan absensi?
            </p>

            {/* Peringatan integritas checkout — hanya muncul saat Check-Out */}
            {canCheckOut && (
              <div className="mb-4 flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl">
                <AlertCircle
                  size={16}
                  className="text-amber-500 flex-shrink-0 mt-0.5"
                />
                <p className="text-[11.5px] text-amber-800 leading-relaxed font-medium">
                  <span className="block font-bold text-amber-900 mb-0.5">
                    ⚠️ Perhatian!
                  </span>
                  Pastikan Anda melakukan checkout sesuai dengan waktu
                  kepulangan yang sebenarnya.{" "}
                  <span className="text-red-700 font-semibold">
                    Manipulasi waktu absensi akan dikenakan sanksi.
                  </span>
                </p>
              </div>
            )}

            {errorMsg && (
              <Alert
                variant="destructive"
                className="mb-4 border-red-200 bg-red-50 text-red-700"
              >
                <AlertCircle className="h-4 w-4 text-red-650" />
                <AlertDescription className="text-[12px]">
                  {errorMsg}
                </AlertDescription>
              </Alert>
            )}
            <div className="bg-gray-50 rounded-xl p-3.5 mb-5 space-y-2">
              {[
                { label: "Nama", value: user?.name ?? "Dr. Rina Kusumawati" },
                {
                  label: "NIK KTP",
                  value: user?.nik_ktp ?? "198501012010012001",
                },
                {
                  label: "Waktu",
                  value: `${current.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`,
                },
                {
                  label: "Jenis",
                  value: canCheckIn
                    ? "Check-In Masuk"
                    : canCheckOut
                      ? "Check-Out Pulang"
                      : "Ditutup",
                },
                {
                  label: "Lokasi GPS",
                  value: inGeofence
                    ? `Dalam Area (~${Math.round(distance ?? 0)}m)`
                    : `Luar Area (~${Math.round(distance ?? 0)}m)`,
                },
                { label: "Verifikasi Wajah", value: "✅ Terverifikasi" },
              ].map(({ label, value }, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[12px] text-gray-500">{label}</span>
                  <span className="text-[12px] font-medium text-gray-800">
                    {value}
                  </span>
                </div>
              ))}

              {!canCheckIn && !canCheckOut && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[11px] font-semibold text-center mt-2 leading-relaxed">
                  ⚠️ Batas waktu absensi telah ditutup. Anda tidak dapat
                  melakukan absensi saat ini.
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 mt-2">
                <label className="block text-[11px] font-medium text-gray-500 mb-1">
                  Keterangan Detail Lokasi{" "}
                  <span className="text-red-500">*</span>
                </label>
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
                  <label className="block text-[11px] font-medium text-red-500 mb-1">
                    Alasan Pulang Cepat <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={earlyCheckoutReason}
                    onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                    placeholder="Jelaskan alasan Anda harus pulang cepat..."
                    rows={2}
                    className="w-full px-3 py-2 border border-red-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/25 placeholder:text-gray-400 resize-none"
                  />
                </div>
              )}

              {canCheckOut && checkIfOvertime() && (
                <div className="pt-2 border-t border-gray-200 mt-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-55 rounded-xl border border-gray-150">
                    <Clock size={13} className="text-gray-400 flex-shrink-0" />
                    <p className="text-[10.5px] text-gray-500 leading-normal font-medium">
                      Kamu melewati batas jam checkout (tetapi tetap dapat absen
                      pulang).
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowModal(false);
                  setErrorMsg(null);
                }}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const finalEarlyReason = earlyCheckoutReason.trim() || "Pulang kerja (sesuai jam dinas)";
                  confirmAction(finalEarlyReason);
                }}
                disabled={submitting || (!canCheckIn && !canCheckOut)}
                className={`flex-1 py-3 rounded-xl text-[14px] font-semibold text-white transition-all ${
                  canCheckIn
                    ? "bg-[#16A34A] hover:bg-[#0d9240]"
                    : "bg-red-500 hover:bg-red-600"
                } ${
                  submitting || (!canCheckIn && !canCheckOut)
                    ? "opacity-50 cursor-not-allowed"
                    : "shadow-md active:scale-[0.98]"
                }`}
              >
                {submitting
                  ? "Memproses..."
                  : canCheckIn
                    ? "Ya, Submit Check-In"
                    : "Ya, Submit Check-Out"}
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
