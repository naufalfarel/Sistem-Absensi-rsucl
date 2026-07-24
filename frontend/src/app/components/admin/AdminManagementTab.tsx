import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Search, 
  Edit2, 
  Trash2, 
  KeyRound, 
  Mail, 
  User, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  ShieldAlert,
  Building2,
  Crown
} from 'lucide-react';
import { adminManagementApi, AuthUser } from '../../../services/api';

export function AdminManagementTab() {
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AuthUser | null>(null);
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AuthUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formNikKtp, setFormNikKtp] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'super_admin'>('admin');

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminManagementApi.list();
      if (res.success) {
        setAdmins(res.data);
      }
    } catch (err: any) {
      console.error('Gagal mengambil daftar admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const openAddModal = () => {
    setEditingAdmin(null);
    setFormName('');
    setFormUsername('');
    setFormEmail('');
    setFormPassword('');
    setFormNikKtp('');
    setFormRole('admin');
    setErrorMsg('');
    setShowModal(true);
  };

  const openEditModal = (adm: AuthUser) => {
    setEditingAdmin(adm);
    setFormName(adm.name);
    setFormUsername(adm.username);
    setFormEmail(adm.email);
    setFormPassword('');
    setFormNikKtp(adm.nik_ktp || '');
    setFormRole(adm.role === 'super_admin' ? 'super_admin' : 'admin');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!formName.trim() || !formUsername.trim() || !formEmail.trim()) {
      setErrorMsg('Nama lengkap, username, dan email wajib diisi.');
      return;
    }

    if (!editingAdmin && !formPassword) {
      setErrorMsg('Password wajib diisi untuk pembuatan akun admin baru (minimal 6 angka/karakter).');
      return;
    }

    if (formPassword && formPassword.length < 6) {
      setErrorMsg('Password minimal harus 6 angka/karakter.');
      return;
    }

    if (editingAdmin?.role === 'super_admin' && formRole !== 'super_admin') {
      setErrorMsg('Role Super Admin (Direktur RSUCL) terkunci dan tidak dapat diturunkan ke Admin biasa.');
      return;
    }

    if (formRole === 'admin' && (!editingAdmin || editingAdmin.role !== 'admin') && regularAdminCount >= 4) {
      setErrorMsg('Batas maksimal administrator biasa adalah 4 orang. Anda tidak dapat membuat akun admin baru lagi.');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    try {
      if (editingAdmin) {
        const res = await adminManagementApi.update(editingAdmin.id, {
          name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          password: formPassword || undefined,
          nik_ktp: formNikKtp.trim() || undefined,
          role: formRole,
        });

        if (res.success) {
          setSuccessMsg('Akun Admin berhasil diperbarui.');
          setShowModal(false);
          fetchAdmins();
          setTimeout(() => setSuccessMsg(''), 3000);
        }
      } else {
        const res = await adminManagementApi.create({
          name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          password: formPassword,
          nik_ktp: formNikKtp.trim() || undefined,
          role: formRole,
        });

        if (res.success) {
          setSuccessMsg('Akun Admin baru berhasil ditambahkan.');
          setShowModal(false);
          fetchAdmins();
          setTimeout(() => setSuccessMsg(''), 3000);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Gagal menyimpan data akun admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAdminTarget) return;
    setSubmitting(true);
    try {
      const res = await adminManagementApi.delete(deleteAdminTarget.id);
      if (res.success) {
        setSuccessMsg('Akun Admin berhasil dihapus.');
        setDeleteAdminTarget(null);
        fetchAdmins();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus akun admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAdmins = admins.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.username.toLowerCase().includes(search.toLowerCase()) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    (a.nik_ktp && a.nik_ktp.toLowerCase().includes(search.toLowerCase()))
  );

  const superAdminCount = admins.filter(a => a.role === 'super_admin').length;
  const regularAdminCount = admins.filter(a => a.role === 'admin').length;

  return (
    <div className="w-full space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header Panel Super Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-200 text-white">
              <Crown size={22} />
            </div>
            Manajemen Akun Administrator
          </h2>
          <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
            Hak Akses Khusus <strong>Direktur Rumah Sakit Umum Cempaka Lima</strong> — Tambah, Edit, dan Hapus Akun Administrator.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[13px] font-bold shadow-md shadow-green-150 hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <UserPlus size={16} /> Tambah Admin Baru
        </button>
      </div>

      {/* Alert Success */}
      {successMsg && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-2xl text-[12.5px] font-bold shadow-xs animate-fade-in">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Ringkasan Statistik KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Total Admin</p>
            <p className="text-[22px] font-black text-gray-900">{admins.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-amber-200 p-5 shadow-xs flex items-center gap-4 bg-gradient-to-tr from-amber-50/40 to-white">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Crown size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">Super Admin (Direktur)</p>
            <p className="text-[22px] font-black text-amber-900">{superAdminCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center font-bold">
            <User size={24} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Admin Kepegawaian</p>
            <p className="text-[22px] font-black text-gray-900">{regularAdminCount}</p>
          </div>
        </div>
      </div>

      {/* Main Table Card Container (1 Unified Container) */}
      <div className="bg-white rounded-3xl border border-gray-150 shadow-xs overflow-hidden">
        
        {/* Header Toolbar */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
          <div>
            <h3 className="text-[13px] font-extrabold text-gray-800 uppercase tracking-wider">Daftar Pengelola Administrator</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Kelola kredensial dan hak akses administrator RSU Cempaka Lima.</p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama / username..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] transition-all"
            />
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
            <p className="text-[11px] text-gray-400 font-medium">Memuat akun administrator...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-16 px-4">
            <ShieldAlert size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-[13px] font-bold text-gray-700">Tidak ada akun admin ditemukan</p>
            <p className="text-[11px] text-gray-400 mt-1">Coba kata kunci pencarian lain.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-[10px] uppercase tracking-wider font-extrabold text-gray-400">
                  <th className="py-3.5 px-5">Nama Admin</th>
                  <th className="py-3.5 px-4">Role / Otoritas</th>
                  <th className="py-3.5 px-4">Username</th>
                  <th className="py-3.5 px-4">Email & NIK KTP</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-[12.5px]">
                {filteredAdmins.map(adm => {
                  const isSuper = adm.role === 'super_admin';
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Nama */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-[13px] border ${
                            isSuper ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {isSuper ? <Crown size={16} /> : adm.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 leading-tight">{adm.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {isSuper ? 'Direktur Utama RSUCL' : 'Staf Administrator'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-4">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-250">
                            <Crown size={11} /> Super Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-150">
                            <ShieldCheck size={11} /> Admin
                          </span>
                        )}
                      </td>

                      {/* Username */}
                      <td className="py-4 px-4 font-mono font-bold text-gray-700">
                        @{adm.username}
                      </td>

                      {/* Email & NIK */}
                      <td className="py-4 px-4">
                        <p className="text-gray-700 font-medium">{adm.email}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">NIK: {adm.nik_ktp || '-'}</p>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(adm)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer border border-blue-100"
                            title="Edit Admin"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteAdminTarget(adm)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-100"
                            title="Hapus Admin"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM MODAL (TAMBAH / EDIT ADMIN) */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => !submitting && setShowModal(false)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md animate-scale-up z-10">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  {editingAdmin ? <Edit2 size={18} /> : <UserPlus size={18} />}
                </div>
                <div>
                  <h3 className="text-[14px] font-extrabold text-gray-900">
                    {editingAdmin ? 'Edit Data Admin' : 'Tambah Akun Admin Baru'}
                  </h3>
                  <p className="text-[10px] text-gray-400">Silakan isi rincian kredensial akun administrator.</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"
              >
                <X size={16} />
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 px-3.5 py-2.5 rounded-xl text-[11px] font-semibold mb-4">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Contoh: dr. Ahmad Subagyo, Sp.B"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A] font-semibold"
                  required
                />
              </div>

              <div className={`grid grid-cols-1 ${editingAdmin?.role === 'super_admin' ? '' : 'sm:grid-cols-2'} gap-3`}>
                <div className={editingAdmin?.role === 'super_admin' ? 'w-full' : ''}>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="Contoh: admin_medis"
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A] font-mono"
                    required
                  />
                </div>

                {editingAdmin?.role !== 'super_admin' && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Role Otoritas
                    </label>
                    <select
                      value={formRole}
                      onChange={e => setFormRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A] font-bold text-gray-800 cursor-pointer"
                    >
                      <option value="admin">Admin (Staf Admin)</option>
                      <option value="super_admin">Super Admin (Direktur)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Alamat Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="admin@rsucl.id"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Password {editingAdmin ? <span className="text-gray-400 font-normal">(Kosongkan jika tidak diganti)</span> : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value.replace(/\D/g, ''))}
                  placeholder={editingAdmin ? '••••••••' : 'Minimal 6 angka'}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A]"
                />
                <p className="text-[10px] text-amber-700 font-medium mt-1">Hanya angka saja (minimal 6 angka).</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  NIK KTP / NIP <span className="text-gray-400">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={formNikKtp}
                  onChange={e => setFormNikKtp(e.target.value)}
                  placeholder="3171000000000000"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-slate-50 focus:outline-none focus:border-[#16A34A] font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-bold transition-all shadow-md shadow-green-150 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Memproses...' : (editingAdmin ? 'Simpan Perubahan' : 'Buat Akun Admin')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteAdminTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs" onClick={() => setDeleteAdminTarget(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm animate-scale-up z-10 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-red-100">
              <Trash2 size={22} />
            </div>
            <h3 className="text-[14px] font-extrabold text-gray-900 mb-1">Hapus Akun Admin?</h3>
            <p className="text-[11.5px] text-gray-500 mb-5 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun <strong>"{deleteAdminTarget.name}"</strong> (@{deleteAdminTarget.username})? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteAdminTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[12px] font-bold text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[12px] font-bold shadow-md shadow-red-150 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Memproses...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
