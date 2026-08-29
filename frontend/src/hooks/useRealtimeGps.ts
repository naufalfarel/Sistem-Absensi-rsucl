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
  const bestLocationRef = useRef<LocationCoords | null>(null);

  const updatePosition = useCallback((pos: GeolocationPosition) => {
    const newCoords: LocationCoords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: Math.round(pos.coords.accuracy),
      timestamp: pos.timestamp || Date.now(),
    };

    const currentBest = bestLocationRef.current;
    const now = Date.now();

    // Logika pemilihan posisi paling presisi (Smart Accuracy Filter khusus iOS Safari & Android):
    // 1. Jika belum ada posisi -> terima posisi pertama
    // 2. Jika bacaan baru lebih presisi (akurasi dalam meter lebih kecil) -> terima
    // 3. Jika bacaan baru sangat presisi (akurasi <= 30m) -> terima
    // 4. Jika posisi tersimpan sudah usang (> 10 detik) -> terima untuk perbaruan data
    const isMoreAccurate = !currentBest || newCoords.accuracy <= currentBest.accuracy;
    const isHighlyAccurate = newCoords.accuracy <= 30;
    const isStale = currentBest ? (now - currentBest.timestamp > 10000) : false;

    if (isMoreAccurate || isHighlyAccurate || isStale) {
      bestLocationRef.current = newCoords;
      setLocation(newCoords);
      setGpsActive(true);
      setLoading(false);
      setErrorMsg(null);
    }
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    console.warn("GPS Warning/Error:", err.code, err.message);
    // Jika timeout (code 3) atau posisi sementara tidak tersedia (code 2), lakukan fallback cepat
    if (err.code === 3 || err.code === 2) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          updatePosition,
          (fallbackErr) => {
            console.warn("Fallback GPS error:", fallbackErr);
            if (!bestLocationRef.current) {
              setGpsActive(false);
              setLoading(false);
              if (fallbackErr.code === 1) {
                setErrorMsg("Izin akses lokasi (GPS) ditolak. Mohon izinkan lokasi di Pengaturan browser/HP Anda.");
              } else {
                setErrorMsg("Lokasi GPS tidak terbaca. Pastikan GPS HP aktif.");
              }
            }
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        );
        return;
      }
    }
    if (!bestLocationRef.current) {
      setGpsActive(false);
      setLoading(false);
      if (err.code === 1) {
        setErrorMsg("Izin akses lokasi (GPS) ditolak. Mohon izinkan lokasi di Pengaturan browser/HP Anda.");
      } else {
        setErrorMsg("Gagal membaca koordinat GPS. Pastikan fitur lokasi HP Anda aktif.");
      }
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
    // Paksa pembacaan GPS hardware segar (maximumAge: 0) ramah iPhone (iOS Safari) & Android
    navigator.geolocation.getCurrentPosition(
      updatePosition,
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Follow-up 1.2 detik untuk menangkap sinyal GPS hardware setelah pembukaan browser di iPhone
    setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          updatePosition,
          () => {},
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      }
    }, 1200);
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

    // 2. watchPosition dengan opsi maximumAge: 0 untuk merespons pergerakan realtime presisi
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    const watchId = navigator.geolocation.watchPosition(updatePosition, handleError, options);
    watchIdRef.current = watchId;

    // 3. Polling interval cadangan setiap 4 detik (mencegah watchPosition mengalami freeze di iOS Safari saat diam)
    const intervalId = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          updatePosition,
          () => {}, // abaikan error silent
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }, 4000);

    // 4. Update otomatis saat tab/app menjadi aktif kembali (misal setelah berpindah app / unlock di iPhone)
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
