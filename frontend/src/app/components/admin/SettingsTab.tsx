import { useState, useRef } from 'react';
import {
  User, Mail, Lock, Eye, EyeOff, CheckCircle2, Save, Shield, MapPin, Clock,
  Bell, ToggleLeft, ToggleRight, Power, Upload, RotateCcw, AlertTriangle, ImageIcon,
} from 'lucide-react';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';

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
export function SettingsTab() {
  // ── Account ──
  const [name, setName]               = useState('Super Admin');
  const [email, setEmail]             = useState('admin@rsucl.id');
  const [oldPass, setOldPass]         = useState('');
  const [newPass, setNewPass]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showOld, setShowOld]         = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [passSaved, setPassSaved]     = useState(false);
  const [passError, setPassError]     = useState('');

  // ── Notifications ──
  const [notifEmail, setNotifEmail]   = useState(true);
  const [notifLate, setNotifLate]     = useState(true);
  const [notifLeave, setNotifLeave]   = useState(true);
  const [notifSystem, setNotifSystem] = useState(false);

  // ── System Config ──
  const [radius, setRadius]   = useState('100');
  const [maxLate, setMaxLate] = useState('09:00');

  // ── System Status ──
  const [systemActive, setSystemActive]         = useState(true);
  const [showStatusModal, setShowStatusModal]   = useState(false);

  // ── Logo ──
  const [logoPreview, setLogoPreview] = useState<string>(logoImg);
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [logoSaved, setLogoSaved]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Handlers ──
  const saveProfile = () => { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000); };

  const savePassword = () => {
    setPassError('');
    if (!oldPass || !newPass || !confirmPass) { setPassError('Semua field wajib diisi.'); return; }
    if (newPass !== confirmPass) { setPassError('Password baru tidak cocok.'); return; }
    if (newPass.length < 8) { setPassError('Password minimal 8 karakter.'); return; }
    if (oldPass !== 'RSUCL@2025') { setPassError('Password lama tidak sesuai.'); return; }
    setOldPass(''); setNewPass(''); setConfirmPass('');
    setPassSaved(true); setTimeout(() => setPassSaved(false), 3000);
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

  const saveLogo = () => {
    setLogoSaved(true); setTimeout(() => setLogoSaved(false), 3000);
  };

  const resetLogo = () => {
    setLogoPreview(logoImg); setLogoFile(null); setLogoSaved(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmStatusToggle = () => { setSystemActive(prev => !prev); setShowStatusModal(false); };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-[16px] font-bold text-gray-900">Pengaturan</h2>
        <p className="text-[12px] text-gray-400 mt-0.5">Kelola akun dan konfigurasi sistem RSUCL</p>
      </div>

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
              <img src={logoPreview} alt="Logo RS" className="w-20 h-20 object-contain rounded-xl" />
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
                  {logoFile ? logoFile.name : 'Logo bawaan RSUCL'}
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
                <button
                  onClick={saveLogo}
                  disabled={!logoFile && !logoSaved}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all ${
                    logoSaved
                      ? 'bg-green-50 text-[#16A34A] border border-green-200'
                      : logoFile
                      ? 'bg-[#16A34A] text-white hover:bg-[#0d9240] shadow-sm shadow-green-200'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {logoSaved ? <><CheckCircle2 size={13} /> Tersimpan!</> : <><Save size={13} /> Simpan Logo</>}
                </button>
                <button
                  onClick={resetLogo}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all"
                >
                  <RotateCcw size={13} /> Reset
                </button>
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
              <img src={logoPreview} alt="Admin" className="w-12 h-12 object-contain" />
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
            <p className="text-[11px] text-blue-600">Password minimal 8 karakter dan mengandung huruf kapital, angka, dan simbol.</p>
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
              <input type="number" value={radius} onChange={e => setRadius(e.target.value)} min="50" max="500"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Karyawan hanya dapat absen dalam radius {radius}m dari RSUCL</p>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Batas Maksimal Check-In</label>
            <div className="relative">
              <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="time" value={maxLate} onChange={e => setMaxLate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Setelah pukul {maxLate} karyawan tidak dapat melakukan check-in</p>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white rounded-xl text-[13px] font-semibold hover:bg-[#0d9240] transition-all shadow-sm shadow-green-200">
            <Save size={14} /> Simpan Konfigurasi
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
