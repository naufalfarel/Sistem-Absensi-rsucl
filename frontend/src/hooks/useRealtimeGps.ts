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

    let acceptLocation = false;

    if (!currentBest) {
      // 1. Jika belum ada posisi, terima
      acceptLocation = true;
    } else if (newCoords.accuracy <= currentBest.accuracy) {
      // 2. Jika bacaan baru lebih presisi, selalu terima
      acceptLocation = true;
    } else if (newCoords.accuracy <= 30) {
      // 3. Jika bacaan baru sangat presisi (<= 30m), terima meskipun sedikit lebih buruk dari currentBest
      acceptLocation = true;
    } else {
      // 4. Jika bacaan baru lebih buruk, cek apakah bacaan lama sudah sangat usang
      const isVeryStale = (now - currentBest.timestamp) > 30000;
      
      // Jika data lama usang (> 30s), kita terima jika lonjakan akurasinya masih masuk akal (<= 150m)
      if (isVeryStale && newCoords.accuracy <= 150) {
        acceptLocation = true;
      } else if ((now - currentBest.timestamp) > 60000) {
        // Jika sudah lebih dari 1 menit tidak ada lokasi, terpaksa terima yang ada agar tidak nyangkut
        acceptLocation = true;
      }
    }

    if (acceptLocation) {
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
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 5000 }
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    // Follow-up 1.2 detik untuk menangkap sinyal GPS hardware setelah pembukaan browser di iPhone
    setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          updatePosition,
          () => {},
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
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

    // 2. watchPosition dengan opsi maximumAge: 5000 untuk merespons pergerakan tanpa memaksa restart sensor
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    };

    const watchId = navigator.geolocation.watchPosition(updatePosition, handleError, options);
    watchIdRef.current = watchId;

    // Polling interval agresif dihapus untuk mencegah tabrakan/freeze pada hardware GPS iPhone

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
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [refreshLocation, updatePosition, handleError]);

  return { location, gpsActive, loading, errorMsg, refreshLocation };
}
