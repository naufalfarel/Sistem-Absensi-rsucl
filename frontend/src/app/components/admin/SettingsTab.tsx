import { useState, useEffect, useRef } from 'react';
import {
  User, Mail, Lock, Eye, EyeOff, CheckCircle2, Save, Shield, MapPin, Clock,
  Bell, ToggleLeft, ToggleRight, Power, Upload, RotateCcw, AlertTriangle, ImageIcon, Trash2, Sparkles, Calendar
} from 'lucide-react';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { settingApi, profileApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

// ── System Status Modal ────────────────────────────────────────────────
function SystemStatusModal({
  isActive, onClose, onConfirm,
}: { isActive: boolean; onClose: () => void; onConfirm: () => void }) {
  const willActivate = !isActive;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl mx-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${willActivate ? 'bg-green-50' : 'bg-red-50'}`}>
          {willActivate ? (
            <Power size={26} className="text-[#16A34A]" />
          ) : (
            <AlertTriangle size={26} className="text-red-500" />
          )}
        </div>
        <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">
          {willActivate ? 'Aktifkan Sistem Absensi?' : 'Nonaktifkan Sistem Absensi?'}
        </h3>
        <p className="text-[12px] text-gray-500 text-center mb-5">
          {willActivate
            ? 'Karyawan akan dapat kembali melakukan check-in dan check-out.'
            : 'Seluruh karyawan tidak akan dapat melakukan absensi hingga sistem diaktifkan kembali.'}
        </p>
        {!willActivate && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
            <AlertTriangle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-red-600">Karyawan yang sedang dalam proses check-in akan dibatalkan secara otomatis.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors ${willActivate ? 'bg-[#16A34A] hover:bg-[#0d9240]' : 'bg-red-500 hover:bg-red-600'}`}
          >
            {willActivate ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toggle Helper ──────────────────────────────────────────────────────
const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
  <button onClick={onChange} className={`transition-all ${value ? 'text-[#16A34A]' : 'text-gray-300'}`}>
    {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
  </button>
);

// ── Main SettingsTab ───────────────────────────────────────────────────
/**
 * Komponen Tab Pengaturan Admin (SettingsTab) — Sistem Absensi RSUCL
 * 
 * Halaman kontrol panel utama bagi administrator untuk mengelola parameter sistem absensi RSUCL.
 * Fitur yang dicakup meliputi:
 * 1. Aktivasi/Nonaktivasi status sistem absensi global.
 * 2. Upload / Hapus / Kembalikan Logo resmi rumah sakit.
 * 3. Update profil biodata akun admin yang sedang login.
 * 4. Ubah password admin.
 * 5. Konfigurasi notifikasi email, keterlambatan, cuti, dan sistem.
 * 6. Pengaturan ketentuan waktu toleransi check-in (tepat waktu, telat, alpha) dan check-out (Senin-Sabtu) secara dinamis.
 * 7. Konfigurasi koordinat GPS RSUCL (Latitude & Longitude) beserta radius toleransi Geofence.
 */
export function SettingsTab() {
  const { user, logoUrl, refreshLogo, refreshUser } = useAuth();
  
  // ── States Pengaturan Akun Admin ──
  const [name, setName]               = useState('Super Admin');
  const [email, setEmail]             = useState('admin@rsucl.id');
  const [username, setUsername]       = useState('admin');
  const [oldPass, setOldPass]         = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showOld, setShowOld]         = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passSaved, setPassSaved]     = useState(false);
  const [passError, setPassError]     = useState('');

  // ── States Pengaturan Notifikasi Email & Peringatan ──
  const [notifEmail, setNotifEmail]   = useState(true);
  const [notifLate, setNotifLate]     = useState(true);
  const [notifLeave, setNotifLeave]   = useState(true);
  const [notifSystem, setNotifSystem] = useState(false);

  // ── States Konfigurasi Geofencing RSUCL ──
  const [radius, setRadius]   = useState('100');
  const [hospLat, setHospLat] = useState('5.552740480177099');
  const [hospLng, setHospLng] = useState('95.33486560781716');
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState('');

  // ── States Toleransi Waktu & Jadwal Absensi ──
  const [checkinOpen, setCheckinOpen]           = useState('0');
  const [lateLimit, setLateLimit]               = useState('30');
  const [closeCheckin, setCloseCheckin]         = useState('60');
  const [breakStart, setBreakStart]             = useState('12:30');
  const [breakEnd, setBreakEnd]                 = useState('13:30');
  const [checkoutOpen, setCheckoutOpen]         = useState('0');
  const [checkoutClose, setCheckoutClose]       = useState('60');
  const [satCheckoutOpen, setSatCheckoutOpen]   = useState('0');
  const [satCheckoutClose, setSatCheckoutClose] = useState('60');
  const [earlyCheckoutGrace, setEarlyCheckoutGrace] = useState('15');
  const [overtimeGrace, setOvertimeGrace]           = useState('15');

  // ── State Pengontrol Status Sistem Absensi & Modal Konfirmasi ──
  const [systemActive, setSystemActive]         = useState(true);
  const [showStatusModal, setShowStatusModal]   = useState(false);

  // ── States Kuota Cuti Tahunan ──
  const [leaveResetMonth, setLeaveResetMonth]           = useState('4');
  const [leaveResetDay, setLeaveResetDay]               = useState('1');
  const [annualLeaveQuotaDays, setAnnualLeaveQuotaDays] = useState('12');
  const [quotaSaved, setQuotaSaved]                     = useState(false);
  const [quotaError, setQuotaError]                     = useState('');

  // ── States Kategori Cuti Khusus ──
  const [categories, setCategories]                     = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName]           = useState('');
  const [categoryError, setCategoryError]               = useState('');
  const [categorySaved, setCategorySaved]               = useState(false);
  const [categoryLoading, setCategoryLoading]           = useState(false);

  // ── States Pengendali Preview & File Logo Rumah Sakit ──
  const [logoPreview, setLogoPreview] = useState<string>(logoImg);
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoSaved, setLogoSaved]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Efek memantau ketersediaan URL logo kustom
  useEffect(() => {
    if (logoUrl) {
      setLogoPreview(logoUrl);
    } else {
      setLogoPreview(logoImg);
    }
  }, [logoUrl]);

  // ── Load Settings from API ──
  const loadSettings = async () => {
    try {
      const res = await settingApi.get();
      if (res.success) {
        setSystemActive(res.data.system_active === '1');
        setRadius(res.data.gps_radius);
        if (res.data.hospital_lat) setHospLat(res.data.hospital_lat);
        if (res.data.hospital_lng) setHospLng(res.data.hospital_lng);
        if (res.data.notif_email !== undefined) setNotifEmail(res.data.notif_email === '1');
        if (res.data.notif_late !== undefined) setNotifLate(res.data.notif_late === '1');
        if (res.data.notif_leave !== undefined) setNotifLeave(res.data.notif_leave === '1');
        if (res.data.notif_system !== undefined) setNotifSystem(res.data.notif_system === '1');
        if (res.data.checkin_open !== undefined) setCheckinOpen(res.data.checkin_open);
        if (res.data.late_limit !== undefined) setLateLimit(res.data.late_limit);
        if (res.data.close_checkin !== undefined) setCloseCheckin(res.data.close_checkin);
        if (res.data.break_start) setBreakStart(res.data.break_start.substring(0, 5));
        if (res.data.break_end) setBreakEnd(res.data.break_end.substring(0, 5));
        if (res.data.checkout_open !== undefined) setCheckoutOpen(res.data.checkout_open);
        if (res.data.checkout_close !== undefined) setCheckoutClose(res.data.checkout_close);
        if (res.data.sat_checkout_open !== undefined) setSatCheckoutOpen(res.data.sat_checkout_open);
        if (res.data.sat_checkout_close !== undefined) setSatCheckoutClose(res.data.sat_checkout_close);
        if (res.data.early_checkout_grace_minutes !== undefined) setEarlyCheckoutGrace(res.data.early_checkout_grace_minutes);
        if (res.data.overtime_grace_minutes !== undefined) setOvertimeGrace(res.data.overtime_grace_minutes);
        // Kuota Cuti
        if (res.data.leave_reset_month) setLeaveResetMonth(res.data.leave_reset_month);
        if (res.data.leave_reset_day) setLeaveResetDay(res.data.leave_reset_day);
        if (res.data.annual_leave_quota_days) setAnnualLeaveQuotaDays(res.data.annual_leave_quota_days);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const { specialLeaveApi } = await import('../../../services/api');
      const res = await specialLeaveApi.listActive();
      if (res.success) {
        setCategories(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSettings();
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setUsername(user.username);
    }
    fetchCategories();
  }, [user]);

  // ── Handlers Kategori Cuti Khusus ──
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCategoryError('');
    setCategorySaved(false);
    setCategoryLoading(true);
    try {
      const { specialLeaveApi } = await import('../../../services/api');
      const res = await specialLeaveApi.create(newCategoryName.trim());
      if (res.success) {
        setNewCategoryName('');
        setCategorySaved(true);
        fetchCategories();
        setTimeout(() => setCategorySaved(false), 3000);
      }
    } catch (err: any) {
      setCategoryError(err?.message ?? 'Gagal menambahkan kategori.');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleToggleCategory = async (id: number, catName: string, currentActive: boolean) => {
    setCategoryError('');
    try {
      const { specialLeaveApi } = await import('../../../services/api');
      const res = await specialLeaveApi.update(id, catName, !currentActive);
      if (res.success) {
        fetchCategories();
      }
    } catch (err: any) {
      setCategoryError(err?.message ?? 'Gagal mengubah status kategori.');
    }
  };

  // ── Handlers ──
  const saveProfile = async () => {
    setProfileSaved(false);
    try {
      const res = await profileApi.update({ name, email, username });
      if (res.success) {
        setProfileSaved(true);
        await refreshUser();
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? 'Gagal memperbarui profil.');
    }
  };

  const savePassword = async () => {
    setPassError('');
    setPassSaved(false);
    if (!oldPass || !newPass || !confirmPass) { setPassError('Semua field wajib diisi.'); return; }
    if (newPass !== confirmPass) { setPassError('Password baru tidak cocok.'); return; }
    if (newPass.length < 6) { setPassError('Password minimal 6 karakter.'); return; }
    
    try {
      const res = await profileApi.update({ password: newPass, old_password: oldPass });
      if (res.success) {
        setOldPass('');
        setNewPass('');
        setConfirmPass('');
        setPassSaved(true);
        setTimeout(() => setPassSaved(false), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setPassError(err?.message ?? 'Gagal memperbarui password.');
    }
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) return;
    setLogoFile(file);
    setLogoSaved(false);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveLogo = async () => {
    if (!logoFile) return;
    try {
      const reader = new FileReader();
      reader.onload = async ev => {
        const base64 = ev.target?.result as string;
        const res = await settingApi.update({ logo_url: base64 });
        if (res.success) {
          setLogoSaved(true);
          setLogoFile(null);
          await refreshLogo();
          setTimeout(() => setLogoSaved(false), 3000);
        }
      };
      reader.readAsDataURL(logoFile);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan logo.');
    }
  };

  const deleteLogo = async () => {
    try {
      const res = await settingApi.update({ logo_url: 'none' });
      if (res.success) {
        setLogoPreview('none');
        setLogoFile(null);
        setLogoSaved(false);
        if (fileRef.current) fileRef.current.value = '';
        await refreshLogo();
      }
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus logo.');
    }
  };

  const restoreDefaultLogo = async () => {
    try {
      const res = await settingApi.update({ logo_url: '' });
      if (res.success) {
        setLogoPreview(logoImg);
        setLogoFile(null);
        setLogoSaved(false);
        if (fileRef.current) fileRef.current.value = '';
        await refreshLogo();
      }
    } catch (err) {
      console.error(err);
      alert('Gagal mengembalikan logo bawaan.');
    }
  };

  const confirmStatusToggle = async () => {
    const nextVal = !systemActive;
    try {
      const res = await settingApi.update({ system_active: nextVal ? '1' : '0' });
      if (res.success) {
        setSystemActive(nextVal);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setShowStatusModal(false);
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaved(false);
    setConfigError('');
    try {
      const res = await settingApi.update({
        gps_radius: radius,
        hospital_lat: hospLat,
        hospital_lng: hospLng,
        checkin_open: checkinOpen,
        late_limit: lateLimit,
        close_checkin: closeCheckin,
        break_start: breakStart,
        break_end: breakEnd,
        checkout_open: checkoutOpen,
        checkout_close: checkoutClose,
        sat_checkout_open: satCheckoutOpen,
        sat_checkout_close: satCheckoutClose,
        early_checkout_grace_minutes: earlyCheckoutGrace,
        overtime_grace_minutes: overtimeGrace,
      });
      if (res.success) {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 3000);
      }
    } catch (err: any) {
      console.error(err);
      const validationErrors = err?.data?.errors;
      if (validationErrors) {
        const msg = Object.values(validationErrors).flat().join(' ');
        setConfigError(msg);
      } else {
        setConfigError(err?.message ?? 'Gagal menyimpan konfigurasi.');
      }
    }
  };

  const [notifSaved, setNotifSaved] = useState(false);
  const [notifError, setNotifError] = useState('');

  const handleSaveNotifs = async () => {
    setNotifSaved(false);
    setNotifError('');
    try {
      const res = await settingApi.update({
        notif_email: notifEmail ? '1' : '0',
        notif_late: notifLate ? '1' : '0',
        notif_leave: notifLeave ? '1' : '0',
        notif_system: notifSystem ? '1' : '0',
      });
      if (res.success) {
        setNotifSaved(true);
        setTimeout(() => setNotifSaved(false), 3000);
      }
    } catch (err: any) {
      console.error(err);
      const validationErrors = err?.data?.errors;
      if (validationErrors) {
        const msg = Object.values(validationErrors).flat().join(' ');
        setNotifError(msg);
      } else {
        setNotifError(err?.message ?? 'Gagal menyimpan pengaturan notifikasi.');
      }
    }
  };

  const handleSaveQuota = async () => {
    setQuotaSaved(false);
    setQuotaError('');
    const month = parseInt(leaveResetMonth);
    const day   = parseInt(leaveResetDay);
    const quota = parseInt(annualLeaveQuotaDays);
    if (isNaN(month) || month < 1 || month > 12) { setQuotaError('Bulan reset harus antara 1–12.'); return; }
    if (isNaN(day)   || day < 1   || day > 31)   { setQuotaError('Tanggal reset harus antara 1–31.'); return; }
    if (isNaN(quota) || quota < 1 || quota > 365) { setQuotaError('Jumlah hari kuota harus antara 1–365.'); return; }
    try {
      const res = await settingApi.update({
        leave_reset_month:       leaveResetMonth,
        leave_reset_day:         leaveResetDay,
        annual_leave_quota_days: annualLeaveQuotaDays,
      });
      if (res.success) {
        setQuotaSaved(true);
        setTimeout(() => setQuotaSaved(false), 3000);
      }
    } catch (err: any) {
      console.error(err);
      const validationErrors = err?.data?.errors;
      if (validationErrors) {
        const msg = Object.values(validationErrors).flat().join(' ');
        setQuotaError(msg);
      } else {
        setQuotaError(err?.message ?? 'Gagal menyimpan pengaturan kuota cuti.');
      }
    }
  };

  // Nama bulan dalam bahasa Indonesia
  const monthNames = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  // Helper to calculate preview times dynamically in frontend
  const getPreviewTime = (baseTime: string, offsetMinsStr: string, op: 'add' | 'sub' = 'add') => {
    try {
      const [h, m] = baseTime.split(':').map(Number);
      const offset = parseInt(offsetMinsStr) || 0;
      let totalMinutes = h * 60 + m;
      if (op === 'add') {
        totalMinutes += offset;
      } else {
        totalMinutes -= offset;
      }
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
      }
      const newH = Math.floor(totalMinutes / 60) % 24;
      const newM = totalMinutes % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    } catch {
      return baseTime;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ── System Status Banner ── */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 transition-all ${systemActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${systemActive ? 'bg-[#16A34A]' : 'bg-red-500'}`}>
            <Power size={18} className="text-white" />
          </div>
          <div>
            <p className={`text-[13px] font-bold ${systemActive ? 'text-green-800' : 'text-red-800'}`}>
              Sistem Absensi {systemActive ? 'Aktif' : 'Nonaktif'}
            </p>
            <p className={`text-[11px] mt-0.5 ${systemActive ? 'text-green-600' : 'text-red-500'}`}>
              {systemActive
                ? 'Karyawan dapat melakukan check-in dan check-out saat ini.'
                : 'Karyawan tidak dapat melakukan absensi. Aktifkan kembali untuk mengizinkan.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowStatusModal(true)}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all ${systemActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#16A34A] hover:bg-[#0d9240] text-white'}`}
        >
          {systemActive ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </div>

      {/* ── Logo Section ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <ImageIcon size={15} className="text-[#16A34A]" />
          <p className="text-[14px] font-semibold text-gray-800">Ganti Logo Rumah Sakit</p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-5">
            {/* Preview */}
            <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0 overflow-hidden">
              {logoPreview === 'none' ? (
                <div className="flex flex-col items-center justify-center text-gray-300">
                  <ImageIcon size={24} />
                  <span className="text-[10px] text-gray-400 mt-1">Tanpa Logo</span>
                </div>
              ) : (
                <img src={logoPreview} alt="Logo RS" className="w-20 h-20 object-contain rounded-xl" />
              )}
              {logoFile && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-[#16A34A] rounded-full flex items-center justify-center">
                  <CheckCircle2 size={11} className="text-white" />
                </div>
              )}
            </div>
            {/* Controls */}
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[12px] font-medium text-gray-700 mb-0.5">Logo saat ini</p>
                <p className="text-[11px] text-gray-400">
                  {logoFile
                    ? logoFile.name
                    : logoUrl === 'none'
                    ? 'Tanpa Logo (Kosong)'
                    : logoUrl
                    ? 'Logo Kustom'
                    : 'Logo bawaan RSUCL'}
                </p>
                <p className="text-[10px] text-gray-300 mt-0.5">Format: PNG, JPG, WebP · Maks 2MB</p>
              </div>
              {/* Upload area */}
              <div
                className="relative border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-[#16A34A] hover:bg-green-50/30 transition-all cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={16} className="text-gray-400 flex-shrink-0" />
                <p className="text-[12px] text-gray-400">Klik untuk upload gambar baru</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleLogoFile}
                />
              </div>
               <div className="flex gap-2">
                {logoFile ? (
                  <>
                    <button
                      onClick={saveLogo}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-[#16A34A] text-white hover:bg-[#0d9240] transition-all shadow-sm shadow-green-200"
                    >
                      <Save size={13} /> Simpan Logo
                    </button>
                    <button
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(logoUrl || logoImg);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all"
                    >
                      Batal Pilihan
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-gray-100 text-gray-300 cursor-not-allowed"
                    >
                      <Save size={13} /> Simpan Logo
                    </button>
                    {logoUrl === 'none' ? (
                      <button
                        onClick={restoreDefaultLogo}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium text-gray-600 hover:bg-gray-50 border border-gray-200 transition-all"
                      >
                        <RotateCcw size={13} /> Kembalikan Bawaan
                      </button>
                    ) : (
                      <button
                        onClick={deleteLogo}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-all"
                      >
                        <Trash2 size={13} /> Hapus Logo
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <User size={15} className="text-[#16A34A]" />
          <p className="text-[14px] font-semibold text-gray-800">Pengaturan Akun</p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              <span className="text-lg font-bold text-[#16A34A]">{(name || 'U').charAt(0)}</span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-800">{name}</p>
              <p className="text-[12px] text-gray-400">Administrator RSUCL</p>
              <div className="flex items-center gap-1 mt-1">
                <Shield size={11} className="text-[#16A34A]" />
                <span className="text-[11px] text-[#16A34A] font-medium">Akses penuh</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Nama Admin</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Username Admin</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
              </div>
            </div>
            <button onClick={saveProfile}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shadow-sm ${profileSaved ? 'bg-green-50 text-[#16A34A] border border-green-200' : 'bg-[#16A34A] text-white hover:bg-[#0d9240] shadow-green-200'}`}>
              {profileSaved ? <><CheckCircle2 size={14} /> Tersimpan!</> : <><Save size={14} /> Simpan Perubahan</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Change Password ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Lock size={15} className="text-[#16A34A]" />
          <p className="text-[14px] font-semibold text-gray-800">Ubah Password</p>
        </div>
        <div className="p-5 space-y-4">
          {passError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl">
              <Shield size={13} /> {passError}
            </div>
          )}
          {[
            { label: 'Password Lama',            val: oldPass,     set: setOldPass,     show: showOld,     toggle: () => setShowOld(!showOld) },
            { label: 'Password Baru',             val: newPass,     set: setNewPass,     show: showNew,     toggle: () => setShowNew(!showNew) },
            { label: 'Konfirmasi Password Baru',  val: confirmPass, set: setConfirmPass, show: showConfirm, toggle: () => setShowConfirm(!showConfirm) },
          ].map(({ label, val, set, show, toggle }, i) => (
            <div key={i}>
              <label className="block text-[12px] font-medium text-gray-600 mb-1.5">{label}</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)} placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
                <button type="button" onClick={toggle} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] text-blue-600">Password minimal 6 karakter.</p>
          </div>
          <button onClick={savePassword}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shadow-sm ${passSaved ? 'bg-green-50 text-[#16A34A] border border-green-200' : 'bg-[#16A34A] text-white hover:bg-[#0d9240] shadow-green-200'}`}>
            {passSaved ? <><CheckCircle2 size={14} /> Password Diperbarui!</> : <><Lock size={14} /> Ubah Password</>}
          </button>
        </div>
      </div>

      {/* ── Notification settings ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Bell size={15} className="text-[#16A34A]" />
          <p className="text-[14px] font-semibold text-gray-800">Pengaturan Notifikasi</p>
        </div>
        <div className="p-5 space-y-1">
          {[
            { label: 'Notifikasi email',         desc: 'Terima ringkasan harian via email',             val: notifEmail,  toggle: () => setNotifEmail(!notifEmail) },
            { label: 'Peringatan keterlambatan', desc: 'Notifikasi saat karyawan terlambat',            val: notifLate,   toggle: () => setNotifLate(!notifLate) },
            { label: 'Pengajuan cuti & izin',   desc: 'Notifikasi pengajuan baru dari karyawan',       val: notifLeave,  toggle: () => setNotifLeave(!notifLeave) },
            { label: 'Notifikasi sistem',        desc: 'Backup, update, dan log sistem',               val: notifSystem, toggle: () => setNotifSystem(!notifSystem) },
          ].map(({ label, desc, val, toggle }, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-[13px] font-medium text-gray-800">{label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
              </div>
              <Toggle value={val} onChange={toggle} />
            </div>
          ))}
          {notifError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl mb-3">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span>{notifError}</span>
            </div>
          )}
          <div className="pt-4 mt-2">
            <button onClick={handleSaveNotifs}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shadow-sm ${notifSaved ? 'bg-green-50 text-[#16A34A] border border-green-200' : 'bg-[#16A34A] text-white hover:bg-[#0d9240] shadow-green-200'}`}>
              {notifSaved ? <><CheckCircle2 size={14} /> Tersimpan!</> : <><Save size={14} /> Simpan Pengaturan</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Kuota Cuti Tahunan ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Calendar size={15} className="text-[#16A34A]" />
          <p className="text-[14px] font-semibold text-gray-800">Kuota Cuti Tahunan</p>
        </div>
        <div className="p-5 space-y-5">
          {/* Live Preview */}
          <div className="p-4 bg-green-50/60 rounded-2xl border border-green-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Calendar size={16} className="text-[#16A34A]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-800">
                Reset pada <span className="text-[#16A34A]">{leaveResetDay} {monthNames[parseInt(leaveResetMonth)] ?? '?'}</span> setiap tahun
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Setiap karyawan mendapat kuota <span className="font-semibold text-gray-700">{annualLeaveQuotaDays} hari cuti</span> per tahun.
                Sisa kuota hangus saat reset (tidak carry-over ke periode berikutnya).
              </p>
            </div>
          </div>

          {/* Reset Date */}
          <div>
            <h4 className="text-[12px] font-bold text-gray-800 mb-3 border-l-2 border-[#16A34A] pl-2 uppercase tracking-wider">Tanggal Reset Kuota</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Bulan Reset</label>
                <select
                  value={leaveResetMonth}
                  onChange={e => setLeaveResetMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50 cursor-pointer"
                >
                  {monthNames.slice(1).map((name, i) => (
                    <option key={i + 1} value={String(i + 1)}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Tanggal Reset</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={leaveResetDay}
                  onChange={e => setLeaveResetDay(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          {/* Quota Days */}
          <div className="pt-2 border-t border-gray-50">
            <h4 className="text-[12px] font-bold text-gray-800 mb-3 border-l-2 border-[#16A34A] pl-2 uppercase tracking-wider">Jumlah Hari Kuota Per Tahun</h4>
            <div className="max-w-xs">
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Total Hari Cuti (untuk semua karyawan)</label>
              <input
                type="number"
                min="1"
                max="365"
                value={annualLeaveQuotaDays}
                onChange={e => setAnnualLeaveQuotaDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                placeholder="12"
              />
              <p className="text-[11px] text-gray-400 mt-1">Default: 12 hari. Berlaku untuk semua karyawan (tidak bisa dikustomisasi per-individu).</p>
            </div>
          </div>

          {quotaError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span>{quotaError}</span>
            </div>
          )}
          <button onClick={handleSaveQuota}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all shadow-sm ${quotaSaved ? 'bg-green-50 text-[#16A34A] border border-green-200' : 'bg-[#16A34A] text-white hover:bg-[#0d9240] shadow-green-200'}`}>
            {quotaSaved ? <><CheckCircle2 size={14} /> Tersimpan!</> : <><Save size={14} /> Simpan Kuota Cuti</>}
          </button>
        </div>
      </div>

      {/* ── Kategori Cuti Khusus ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Calendar size={15} className="text-[#EA580C]" />
          <p className="text-[14px] font-semibold text-gray-800">Kategori Cuti Khusus</p>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Daftar kategori pengajuan cuti khusus untuk karyawan. Pegawai wajib memilih salah satu kategori ini saat mengajukan cuti khusus.
          </p>

          {/* Form Tambah Kategori */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Tambah kategori baru (contoh: Menikah, Studi Banding)"
              className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-[#EA580C]/15 transition-all placeholder:text-gray-300"
            />
            <button
              onClick={handleAddCategory}
              disabled={categoryLoading || !newCategoryName.trim()}
              className="px-4 py-2.5 bg-[#EA580C] hover:bg-[#d44f0b] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-[12px] font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-orange-100"
            >
              {categoryLoading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Tambah
            </button>
          </div>

          {categoryError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-650 text-[11px] px-3.5 py-2 rounded-xl">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span>{categoryError}</span>
            </div>
          )}

          {categorySaved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 text-[#16A34A] text-[11px] px-3.5 py-2 rounded-xl">
              <CheckCircle2 size={13} className="flex-shrink-0" />
              <span>Kategori berhasil ditambahkan!</span>
            </div>
          )}

          {/* Daftar Kategori */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {categories.length === 0 ? (
              <div className="p-5 text-center text-gray-400 text-[11px]">Belum ada kategori yang ditambahkan.</div>
            ) : (
              categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 bg-gray-50/10 hover:bg-gray-50/30 transition-colors">
                  <div>
                    <span className={`text-[12px] font-semibold ${c.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {c.name}
                    </span>
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <Toggle value={c.is_active} onChange={() => handleToggleCategory(c.id, c.name, c.is_active)} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Ketentuan Waktu & Jadwal Absensi ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Clock size={15} className="text-[#16A34A]" />
          <p className="text-[14px] font-semibold text-gray-800">Ketentuan Waktu & Jadwal Absensi RSUCL (Dinamis per-Shift)</p>
        </div>
        <div className="p-5 space-y-5">
          {/* Live Preview Box */}
          <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100/50 space-y-2.5">
            <p className="text-[12px] font-bold text-gray-800 flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#16A34A] animate-pulse" /> 
              Peninjauan Ketentuan Waktu (Live Preview Shift Reguler: 08:00 - 17:00, Sabtu: 08:00 - 13:00)
            </p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Sistem akan otomatis menyesuaikan aturan ini untuk shift lainnya (Pagi, Siang, Malam, dll.) berdasarkan jam masuk dan jam pulang masing-masing shift secara dinamis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-[11px] text-gray-600 pt-1.5 border-t border-green-100/50">
              <div>
                <p className="font-bold text-gray-700 mb-1 flex items-center gap-1">⏱️ Absen Masuk (Check-in)</p>
                <div className="space-y-1 pl-3.5 border-l border-green-200">
                  <p>• Buka check-in mulai: <span className="font-mono text-gray-800 font-bold">{getPreviewTime('08:00', checkinOpen, 'sub')} WIB</span> <span className="text-gray-400">({checkinOpen || 0} menit sebelum shift)</span></p>
                  <p>• Tepat waktu: <span className="font-mono text-[#16A34A] font-bold">{getPreviewTime('08:00', '0')} - {getPreviewTime('08:00', lateLimit)} WIB</span> <span className="text-gray-400">({lateLimit || 0} menit pertama)</span></p>
                  <p>• Terlambat (tetap Hadir): <span className="font-mono text-amber-600 font-bold">{getPreviewTime('08:00', lateLimit)} - {getPreviewTime('08:00', closeCheckin)} WIB</span></p>
                  <p>• Tutup check-in / Alpha: <span className="font-mono text-red-600 font-bold">Lewat dari {getPreviewTime('08:00', closeCheckin)} WIB</span> <span className="text-gray-400">({closeCheckin || 0} menit setelah shift)</span></p>
                </div>
              </div>
              <div>
                <p className="font-bold text-gray-700 mb-1 flex items-center gap-1">🚪 Absen Pulang (Check-out)</p>
                <div className="space-y-1 pl-3.5 border-l border-green-200">
                  <p>• Buka check-out (Sen-Jum): <span className="font-mono text-gray-800 font-bold">{getPreviewTime('17:00', checkoutOpen, 'sub')} WIB</span> <span className="text-gray-400">({checkoutOpen || 0} menit sebelum selesai)</span></p>
                  <p>• Tutup check-out (Sen-Jum): <span className="font-mono text-gray-800 font-bold">{getPreviewTime('17:00', checkoutClose)} WIB</span> <span className="text-gray-400">({checkoutClose || 0} menit setelah selesai)</span></p>
                  <p>• Buka check-out (Sabtu): <span className="font-mono text-gray-800 font-bold">{getPreviewTime('13:00', satCheckoutOpen, 'sub')} WIB</span> <span className="text-gray-400">({satCheckoutOpen || 0} menit sebelum selesai)</span></p>
                  <p>• Tutup check-out (Sabtu): <span className="font-mono text-gray-800 font-bold">{getPreviewTime('13:00', satCheckoutClose)} WIB</span> <span className="text-gray-400">({satCheckoutClose || 0} menit setelah selesai)</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Check-in (Absen Masuk) */}
          <div className="pt-2">
            <h4 className="text-[12px] font-bold text-gray-800 mb-3 border-l-2 border-[#16A34A] pl-2 uppercase tracking-wider">Absen Masuk (Check-in)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Buka Absen (menit sebelum shift mulai)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={checkinOpen}
                  onChange={e => setCheckinOpen(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Batas Tepat Waktu (menit setelah shift mulai)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={lateLimit}
                  onChange={e => setLateLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Tutup Check-in / Alpha (menit setelah shift mulai)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={closeCheckin}
                  onChange={e => setCloseCheckin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Break (Istirahat) */}
          <div className="pt-4 border-t border-gray-50">
            <h4 className="text-[12px] font-bold text-gray-800 mb-3 border-l-2 border-[#16A34A] pl-2 uppercase tracking-wider">Waktu Istirahat Global (Sen-Jum)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Mulai Istirahat (Jam Absolut)</label>
                <input
                  type="time"
                  value={breakStart}
                  onChange={e => setBreakStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Selesai Istirahat (Jam Absolut)</label>
                <input
                  type="time"
                  value={breakEnd}
                  onChange={e => setBreakEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Check-out (Absen Pulang) */}
          <div className="pt-4 border-t border-gray-50">
            <h4 className="text-[12px] font-bold text-gray-800 mb-3 border-l-2 border-[#16A34A] pl-2 uppercase tracking-wider">Absen Pulang (Check-out)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Buka Pulang (menit sebelum shift selesai)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={checkoutOpen}
                  onChange={e => setCheckoutOpen(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Batas Akhir (menit setelah shift selesai)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={checkoutClose}
                  onChange={e => setCheckoutClose(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Buka Pulang Sabtu (menit sebelum selesai)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={satCheckoutOpen}
                  onChange={e => setSatCheckoutOpen(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Batas Akhir Sabtu (menit setelah selesai)</label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={satCheckoutClose}
                  onChange={e => setSatCheckoutClose(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all bg-gray-50/50"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Toleransi Pulang Cepat & Lembur */}
          <div className="pt-4 border-t border-gray-50">
            <h4 className="text-[12px] font-bold text-gray-800 mb-1 border-l-2 border-amber-400 pl-2 uppercase tracking-wider">Toleransi Pulang Cepat &amp; Lembur</h4>
            <p className="text-[11px] text-gray-400 mb-3 pl-2">Dibandingkan terhadap jam pulang shift masing-masing pegawai (bukan jam kerja global).</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Toleransi Pulang Cepat (menit)</label>
                <input
                  type="number"
                  min="0"
                  max="240"
                  value={earlyCheckoutGrace}
                  onChange={e => setEarlyCheckoutGrace(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 transition-all bg-gray-50/50"
                />
                <p className="text-[10px] text-gray-400 mt-1">Checkout sebelum jam pulang shift minus toleransi ini = ditandai <span className="font-semibold text-amber-600">Pulang Cepat</span>.</p>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Toleransi Lembur (menit)</label>
                <input
                  type="number"
                  min="0"
                  max="240"
                  value={overtimeGrace}
                  onChange={e => setOvertimeGrace(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 transition-all bg-gray-50/50"
                />
                <p className="text-[10px] text-gray-400 mt-1">Checkout setelah jam pulang shift plus toleransi ini = ditandai <span className="font-semibold text-blue-600">Lembur</span> otomatis.</p>
              </div>
            </div>
          </div>

          {configError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl mb-3.5">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span>{configError}</span>
            </div>
          )}
          <button onClick={handleSaveConfig} className="flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white rounded-xl text-[13px] font-semibold hover:bg-[#0d9240] transition-all shadow-sm shadow-green-200">
            {configSaved ? <><CheckCircle2 size={14} /> Tersimpan!</> : <><Save size={14} /> Simpan Konfigurasi</>}
          </button>
        </div>
      </div>


      {/* ── System config ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Shield size={15} className="text-[#16A34A]" />
          <p className="text-[14px] font-semibold text-gray-800">Konfigurasi Sistem Absensi</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Radius Geofence GPS (meter)</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" value={radius} onChange={e => setRadius(e.target.value)} min="10" max="1000"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Karyawan hanya dapat absen dalam radius {radius}m dari RSUCL</p>
          </div>

          {/* Koordinat RS */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[12px] font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
              <MapPin size={13} className="text-[#16A34A]" /> Koordinat Lokasi Rumah Sakit
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Latitude (Garis Lintang)</label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={hospLat}
                    onChange={e => setHospLat(e.target.value)}
                    placeholder="5.552740..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-[12px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Longitude (Garis Bujur)</label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={hospLng}
                    onChange={e => setHospLng(e.target.value)}
                    placeholder="95.334865..."
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-[12px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">Koordinat akan digunakan sebagai pusat lingkaran geofence oleh server</p>
          </div>

          {configError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl mb-3.5">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span>{configError}</span>
            </div>
          )}
          <button onClick={handleSaveConfig} className="flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white rounded-xl text-[13px] font-semibold hover:bg-[#0d9240] transition-all shadow-sm shadow-green-200">
            {configSaved ? <><CheckCircle2 size={14} /> Tersimpan!</> : <><Save size={14} /> Simpan Konfigurasi</>}
          </button>
        </div>
      </div>

      {/* Modal */}
      {showStatusModal && (
        <SystemStatusModal
          isActive={systemActive}
          onClose={() => setShowStatusModal(false)}
          onConfirm={confirmStatusToggle}
        />
      )}
    </div>
  );
}
