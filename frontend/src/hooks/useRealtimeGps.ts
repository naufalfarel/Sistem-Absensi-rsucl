import { useState, useEffect, useCallback, useRef } from 'react';

export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export function useRealtimeGps() {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  const updatePosition = useCallback((pos: GeolocationPosition) => {
    setLocation({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      timestamp: pos.timestamp,
    });
    setGpsActive(true);
    setLoading(false);
    setErrorMsg(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn("GPS Warning/Error:", err.code, err.message);
    // Jika timeout (code 3) atau posisi sementara tidak tersedia (code 2), lakukan fallback cepat ke low accuracy
    if (err.code === 3 || err.code === 2) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          updatePosition,
          (fallbackErr) => {
            console.warn("Fallback GPS error:", fallbackErr);
            setGpsActive(false);
            setLoading(false);
            if (fallbackErr.code === 1) {
              setErrorMsg("Izin akses lokasi (GPS) ditolak. Mohon izinkan lokasi di Pengaturan browser/HP Anda.");
            } else {
              setErrorMsg("Lokasi GPS tidak terbaca. Pastikan GPS HP aktif.");
            }
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
        return;
      }
    }
    setGpsActive(false);
    setLoading(false);
    if (err.code === 1) {
      setErrorMsg("Izin akses lokasi (GPS) ditolak. Mohon izinkan lokasi di Pengaturan browser/HP Anda.");
    } else {
      setErrorMsg("Gagal membaca koordinat GPS.");
    }
  }, [updatePosition]);

  const refreshLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsActive(false);
      setLoading(false);
      setErrorMsg("Browser tidak mendukung Geolocation.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      updatePosition,
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  }, [updatePosition, handleError]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsActive(false);
      setLoading(false);
      setErrorMsg("Browser tidak mendukung Geolocation.");
      return;
    }

    // 1. Ambil lokasi langsung saat mounting
    refreshLocation();

    // 2. watchPosition dengan opsi yang stabil untuk iOS Safari & Android
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000, // Memungkinkan iOS menggunakan bacaan presisi terbaru tanpa mengalami timeout
    };

    const watchId = navigator.geolocation.watchPosition(updatePosition, handleError, options);
    watchIdRef.current = watchId;

    // 3. Polling interval cadangan setiap 5 detik (mencegah watchPosition mengalami freeze di iOS Safari saat diam)
    const intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          updatePosition,
          () => {}, // abaikan error silent
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
      }
    }, 5000);

    // 4. Update otomatis saat tab/app menjadi aktif kembali (misal setelah berpindah app di iPhone)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshLocation();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [refreshLocation, updatePosition, handleError]);

  return { location, gpsActive, loading, errorMsg, refreshLocation };
}
