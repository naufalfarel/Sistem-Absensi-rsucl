import { useState, useEffect, useCallback, useRef } from "react";

export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export const GPS_PREFERRED_ACCURACY_METERS = 50;
export const GPS_MAX_ACCURACY_METERS = 100;
export const GPS_MAX_LOCATION_AGE_MS = 15_000;

const GPS_ACQUISITION_TIMEOUT_MS = 20_000;

function positionToCoords(pos: GeolocationPosition): LocationCoords | null {
  const lat = Number(pos.coords.latitude);
  const lng = Number(pos.coords.longitude);
  const accuracy = Math.ceil(Number(pos.coords.accuracy));
  const timestamp = Number(pos.timestamp);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(accuracy) ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0 ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    accuracy <= 0
  ) {
    return null;
  }

  return { lat, lng, accuracy, timestamp };
}

export function isLocationUsable(
  coords: LocationCoords | null,
  now = Date.now(),
) {
  if (!coords) return false;

  const age = now - coords.timestamp;
  return (
    coords.accuracy <= GPS_MAX_ACCURACY_METERS &&
    age >= -1_000 &&
    age <= GPS_MAX_LOCATION_AGE_MS
  );
}

function distanceBetween(a: LocationCoords, b: LocationCoords) {
  const earthRadius = 6_371_000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function geolocationErrorMessage(err: GeolocationPositionError) {
  if (err.code === 1) {
    return "Izin lokasi ditolak. Izinkan Lokasi Presisi untuk browser ini melalui Pengaturan HP.";
  }
  if (err.code === 2) {
    return "Sinyal GPS belum tersedia. Aktifkan GPS, Wi-Fi/data, lalu coba di dekat jendela atau area terbuka.";
  }
  return "GPS belum mendapat lokasi yang cukup akurat. Tunggu beberapa saat lalu coba kembali.";
}

export function useRealtimeGps() {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [freshnessClock, setFreshnessClock] = useState(Date.now());

  const bestLocationRef = useRef<LocationCoords | null>(null);
  const pendingOutlierRef = useRef<LocationCoords | null>(null);
  const acquisitionPromiseRef = useRef<Promise<LocationCoords> | null>(null);
  const acquisitionCleanupRef = useRef<(() => void) | null>(null);
  const freshnessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const scheduleFreshnessExpiry = useCallback((coords: LocationCoords) => {
    if (freshnessTimeoutRef.current !== null) {
      clearTimeout(freshnessTimeoutRef.current);
    }

    const remaining = Math.max(
      0,
      coords.timestamp + GPS_MAX_LOCATION_AGE_MS - Date.now(),
    );
    freshnessTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setFreshnessClock(Date.now());
    }, remaining + 50);
  }, []);

  const updatePosition = useCallback((pos: GeolocationPosition): LocationCoords | null => {
    const candidate = positionToCoords(pos);
    if (!candidate) return null;

    const now = Date.now();
    const age = now - candidate.timestamp;
    if (age > GPS_MAX_LOCATION_AGE_MS || age < -1_000) return null;

    if (mountedRef.current) {
      setGpsActive(true);
      setLoading(false);
    }

    const current = bestLocationRef.current;
    let accepted = !current;

    if (current) {
      const currentAge = now - current.timestamp;
      const movement = distanceBetween(current, candidate);
      const plausibleMovement = Math.max(
        40,
        Math.min(100, (current.accuracy + candidate.accuracy) / 2 + 20),
      );

      const needsOutlierConfirmation =
        isLocationUsable(current, now) &&
        candidate.accuracy <= GPS_MAX_ACCURACY_METERS &&
        movement > plausibleMovement;

      if (needsOutlierConfirmation) {
        // Bahkan fix yang mengaku lebih akurat dapat sesekali meloncat jauh.
        // Marker baru berpindah setelah area baru dikonfirmasi bacaan berikutnya.
        const pending = pendingOutlierRef.current;
        if (
          pending &&
          Date.now() - pending.timestamp <= 8_000 &&
          distanceBetween(pending, candidate) <= plausibleMovement
        ) {
          accepted = true;
        } else {
          pendingOutlierRef.current = candidate;
        }
      } else if (candidate.accuracy < current.accuracy) {
        accepted = true;
      } else if (
        candidate.accuracy <= GPS_MAX_ACCURACY_METERS &&
        currentAge > GPS_MAX_LOCATION_AGE_MS
      ) {
        accepted = true;
      } else if (
        candidate.accuracy <= GPS_MAX_ACCURACY_METERS &&
        candidate.timestamp > current.timestamp &&
        movement <= plausibleMovement
      ) {
        // Posisi berkualitas serupa tetap diperbarui jika pergerakannya masuk akal.
        accepted = true;
      }
    }

    if (!accepted) return null;

    pendingOutlierRef.current = null;
    bestLocationRef.current = candidate;
    if (mountedRef.current) {
      setLocation(candidate);
      setFreshnessClock(now);
      scheduleFreshnessExpiry(candidate);
      setErrorMsg(
        candidate.accuracy <= GPS_MAX_ACCURACY_METERS
          ? null
          : `Akurasi GPS masih rendah (±${candidate.accuracy} m). Menunggu sinyal yang lebih presisi.`,
      );
    }
    return candidate;
  }, [scheduleFreshnessExpiry]);

  const acquireFreshPosition = useCallback((): Promise<LocationCoords> => {
    if (acquisitionPromiseRef.current) {
      return acquisitionPromiseRef.current;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const message = "Browser tidak mendukung pembacaan lokasi GPS.";
      if (mountedRef.current) {
        setGpsActive(false);
        setLoading(false);
        setErrorMsg(message);
      }
      return Promise.reject(new Error(message));
    }

    if (mountedRef.current) {
      setIsStabilizing(true);
      setLoading(true);
      setErrorMsg(null);
    }

    let bestCandidate: LocationCoords | null = null;
    let preferredCandidate: LocationCoords | null = null;
    let temporaryWatchId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let singleFixTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const promise = new Promise<LocationCoords>((resolve, reject) => {
      const cleanup = () => {
        if (temporaryWatchId !== null) {
          navigator.geolocation.clearWatch(temporaryWatchId);
          temporaryWatchId = null;
        }
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (singleFixTimeoutId !== null) {
          clearTimeout(singleFixTimeoutId);
          singleFixTimeoutId = null;
        }
        acquisitionCleanupRef.current = null;
      };

      const finish = (coords?: LocationCoords, message?: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        acquisitionPromiseRef.current = null;

        if (mountedRef.current) {
          setIsStabilizing(false);
          setLoading(false);
        }

        const usableCoords = message
          ? null
          : coords && isLocationUsable(coords)
            ? coords
            : bestCandidate && isLocationUsable(bestCandidate)
              ? bestCandidate
              : null;

        if (usableCoords) {
          bestLocationRef.current = usableCoords;
          pendingOutlierRef.current = null;
          if (mountedRef.current) {
            setLocation(usableCoords);
            setGpsActive(true);
            setFreshnessClock(Date.now());
            scheduleFreshnessExpiry(usableCoords);
            setErrorMsg(null);
          }
          resolve(usableCoords);
          return;
        }

        const finalMessage =
          message ??
          (bestCandidate
            ? `Akurasi GPS baru ±${bestCandidate.accuracy} m. Diperlukan maksimal ±${GPS_MAX_ACCURACY_METERS} m; coba dekat jendela atau area terbuka.`
            : "Lokasi GPS belum terbaca. Pastikan GPS dan Lokasi Presisi aktif, lalu coba kembali.");
        if (mountedRef.current) {
          setGpsActive(false);
          setErrorMsg(finalMessage);
        }
        reject(new Error(finalMessage));
      };

      acquisitionCleanupRef.current = () => finish(
        undefined,
        "Pengambilan lokasi dibatalkan karena halaman ditutup.",
      );

      temporaryWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const candidate = updatePosition(position);
          if (!candidate) return;

          if (
            !bestCandidate ||
            !isLocationUsable(bestCandidate) ||
            candidate.accuracy < bestCandidate.accuracy ||
            (candidate.accuracy === bestCandidate.accuracy &&
              candidate.timestamp > bestCandidate.timestamp)
          ) {
            bestCandidate = candidate;
          }

          // Beberapa versi Safari/iOS hanya mengirim satu pembacaan meskipun
          // watchPosition masih aktif. Beri kesempatan 5 detik untuk sampel
          // kedua; setelah itu gunakan fix tunggal terbaik bila tetap segar dan
          // memenuhi batas akurasi. Ini mencegah iPhone selalu menunggu 20 detik
          // lalu kehilangan fix pertama karena sudah kedaluwarsa.
          if (
            candidate.accuracy <= GPS_MAX_ACCURACY_METERS &&
            singleFixTimeoutId === null
          ) {
            singleFixTimeoutId = setTimeout(() => {
              singleFixTimeoutId = null;
              if (bestCandidate && isLocationUsable(bestCandidate)) {
                finish(bestCandidate);
              }
            }, 5_000);
          }

          // Konfirmasi fix presisi dengan bacaan kedua yang konsisten agar satu
          // lonjakan GPS tidak langsung dipakai untuk absensi. Jika perangkat
          // hanya memberi satu fix (umum pada iOS), fix terbaik tetap dapat
          // digunakan ketika batas waktu berakhir.
          if (candidate.accuracy <= GPS_PREFERRED_ACCURACY_METERS) {
            if (preferredCandidate && isLocationUsable(preferredCandidate)) {
              const consistencyRadius = Math.max(
                25,
                (preferredCandidate.accuracy + candidate.accuracy) / 2 + 10,
              );
              if (
                distanceBetween(preferredCandidate, candidate) <=
                consistencyRadius
              ) {
                finish(
                  candidate.accuracy <= preferredCandidate.accuracy
                    ? candidate
                    : preferredCandidate,
                );
                return;
              }
            }
            preferredCandidate = candidate;
          }
        },
        (err) => {
          if (err.code === 1) {
            finish(undefined, geolocationErrorMessage(err));
          }
          // Timeout/position unavailable ditangani oleh timer agar bacaan terbaik
          // yang sudah terkumpul masih dapat digunakan.
        },
        {
          enableHighAccuracy: true,
          timeout: GPS_ACQUISITION_TIMEOUT_MS,
          maximumAge: 0,
        },
      );

      timeoutId = setTimeout(() => {
          finish(bestCandidate ?? undefined);
      }, GPS_ACQUISITION_TIMEOUT_MS);
    });

    acquisitionPromiseRef.current = promise;
    return promise;
  }, [scheduleFreshnessExpiry, updatePosition]);

  // Pertahankan kontrak lama sebagai aksi fire-and-forget untuk kartu dashboard.
  // Alur absensi yang perlu menunggu hasil memakai acquireFreshPosition().
  const refreshLocation = useCallback(() => {
    void acquireFreshPosition().catch(() => undefined);
  }, [acquireFreshPosition]);

  useEffect(() => {
    mountedRef.current = true;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsActive(false);
      setLoading(false);
      setErrorMsg("Browser tidak mendukung pembacaan lokasi GPS.");
      return;
    }

    // Selalu mulai dengan pembacaan baru. maximumAge: 0 mencegah cache lokasi
    // lama dipakai sebagai bukti absensi.
    void acquireFreshPosition().catch(() => undefined);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void acquireFreshPosition().catch(() => undefined);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      mountedRef.current = false;
      acquisitionCleanupRef.current?.();
      acquisitionPromiseRef.current = null;
      if (freshnessTimeoutRef.current !== null) {
        clearTimeout(freshnessTimeoutRef.current);
        freshnessTimeoutRef.current = null;
      }
      window.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [acquireFreshPosition]);

  const locationAgeMs = location
    ? Math.max(0, freshnessClock - location.timestamp)
    : null;
  const isLocationAccurate = Boolean(
    location && location.accuracy <= GPS_MAX_ACCURACY_METERS,
  );
  const isLocationFresh = Boolean(
    location &&
      locationAgeMs !== null &&
      locationAgeMs <= GPS_MAX_LOCATION_AGE_MS,
  );
  const isLocationReady = Boolean(
    gpsActive && !isStabilizing && isLocationAccurate && isLocationFresh,
  );

  return {
    location,
    gpsActive,
    loading,
    isStabilizing,
    isLocationReady,
    isLocationAccurate,
    isLocationFresh,
    locationAgeMs,
    errorMsg,
    refreshLocation,
    acquireFreshPosition,
  };
}
