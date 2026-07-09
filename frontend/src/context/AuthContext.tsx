/**
 * Context Autentikasi — Sistem Absensi RSUCL
 * 
 * Mengelola state global autentikasi pengguna (user, token, status loading) 
 * dan logo rumah sakit dari pengaturan sistem, agar bisa diakses oleh seluruh komponen.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser, getToken, setToken, clearToken, settingApi } from '../services/api';

/**
 * Tipe data untuk value yang disediakan oleh AuthContext.
 */
interface AuthContextType {
  user: AuthUser | null;             // Profil pengguna yang sedang masuk
  token: string | null;              // Bearer Token Sanctum aktif
  loading: boolean;                  // Status memuat inisialisasi sesi di awal
  logoUrl: string | null;            // URL logo rumah sakit yang di-cache / didapatkan dari server
  login: (username: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshLogo: () => Promise<void>;
}

// Inisialisasi Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider Komponen untuk membungkus aplikasi React dan menyebarkan state auth.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(localStorage.getItem('hospital_logo'));

  /**
   * Mengambil logo rumah sakit terbaru dari pengaturan sistem di database.
   * Disimpan ke localStorage sebagai cache agar loading awal lebih cepat.
   */
  const refreshLogo = async () => {
    try {
      const res = await settingApi.get();
      if (res.success && res.data.logo_url) {
        setLogoUrl(res.data.logo_url);
        localStorage.setItem('hospital_logo', res.data.logo_url);
      } else {
        setLogoUrl(null);
        localStorage.removeItem('hospital_logo');
      }
    } catch {
      // Tetap simpan logo cache di localStorage jika terjadi kesalahan jaringan
    }
  };

  /**
   * Mengambil data profil user yang sedang login menggunakan token aktif.
   */
  const fetchProfile = async () => {
    try {
      const res = await authApi.me();
      if (res.success) {
        setUser(res.data);
      } else {
        handleLogoutLocal();
      }
    } catch (err: any) {
      console.error('Profile fetch failed:', err);
      // Hanya hapus sesi jika backend secara eksplisit menolak token (401/403)
      if (err?.status === 401 || err?.status === 403) {
        handleLogoutLocal();
      }
    }
  };

  // Efek inisialisasi sesi saat aplikasi pertama kali dimuat
  useEffect(() => {
    const initAuth = async () => {
      await refreshLogo();
      const storedToken = getToken();
      if (storedToken) {
        setTokenState(storedToken);
        await fetchProfile();
      }
      setLoading(false);
    };
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Menghapus sesi autentikasi dari state React dan penyimpanan lokal (cookie/localStorage).
   */
  const handleLogoutLocal = () => {
    setUser(null);
    setTokenState(null);
    clearToken();
  };

  /**
   * Melakukan proses masuk ke sistem.
   * 
   * @param username Kredensial username
   * @param pass Kredensial password
   */
  const login = async (username: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await authApi.login(username, pass);
      if (res.success && res.data.token) {
        setToken(res.data.token);
        setTokenState(res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: 'Username atau Password tidak sesuai.' };
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Gagal menghubungi server. Periksa koneksi internet Anda.';
      return { success: false, message: msg };
    }
  };

  /**
   * Melakukan proses keluar (logout) dengan memberi tahu backend dan membersihkan state lokal.
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout API error:', err);
    } finally {
      handleLogoutLocal();
    }
  };

  /**
   * Memperbarui informasi profil pengguna yang tersimpan di state.
   */
  const refreshUser = async () => {
    if (token) {
      await fetchProfile();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, logoUrl, login, logout, refreshUser, refreshLogo }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom Hook untuk mempermudah akses ke data autentikasi di seluruh komponen anak.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

