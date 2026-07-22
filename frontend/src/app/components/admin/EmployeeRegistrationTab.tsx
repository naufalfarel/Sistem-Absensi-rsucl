import { useState, useEffect, Fragment } from 'react';
import { Search, UserPlus, CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, Eye, Check, X, Shield, Copy, UserCheck, Lock } from 'lucide-react';
import { employeeRegistrationApi, EmployeeRegistration } from '../../../services/api';

export function EmployeeRegistrationTab() {
  const [registrations, setRegistrations] = useState<EmployeeRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'revision_required' | 'approved' | 'rejected'>('pending');
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');

  const [summary, setSummary] = useState({
    pending: 0,
    revision_required: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  // Action Modals
  const [approvingReg, setApprovingReg] = useState<EmployeeRegistration | null>(null);
  const [rejectingReg, setRejectingReg] = useState<EmployeeRegistration | null>(null);
  const [revisingReg, setRevisingReg] = useState<EmployeeRegistration | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Approval Result Modal (displays generated username & temp password)
  const [approvedResult, setApprovedResult] = useState<{ username: string; temp_password: string; name: string } | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [expandedRegId, setExpandedRegId] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchVal);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchVal]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await employeeRegistrationApi.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });

      if (res.success) {
        setRegistrations(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, search]);

  // Handle Approve Action
  const handleApproveSubmit = async () => {
    if (!approvingReg) return;
    setSubmittingAction(true);
    try {
      const res = await employeeRegistrationApi.approve(approvingReg.id, adminNote);
      if (res.success) {
        setApprovedResult({
          username: res.data.username,
          temp_password: res.data.temp_password,
          name: approvingReg.name,
        });
        setApprovingReg(null);
        setAdminNote('');
        loadData();
      }
    } catch (err: any) {
      alert(err?.data?.message ?? err?.message ?? 'Gagal menyetujui pengajuan pendaftaran.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Reject Action
  const handleRejectSubmit = async () => {
    if (!rejectingReg) return;
    if (!adminNote.trim()) {
      alert('Catatan/Alasan penolakan wajib diisi.');
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await employeeRegistrationApi.reject(rejectingReg.id, adminNote);
      if (res.success) {
        setRejectingReg(null);
        setAdminNote('');
        loadData();
      }
    } catch (err: any) {
      alert(err?.data?.message ?? err?.message ?? 'Gagal menolak pengajuan.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Revision Action
  const handleRevisionSubmit = async () => {
    if (!revisingReg) return;
    if (!adminNote.trim()) {
      alert('Catatan perbaikan/revisi wajib diisi.');
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await employeeRegistrationApi.requestRevision(revisingReg.id, adminNote);
      if (res.success) {
        setRevisingReg(null);
        setAdminNote('');
        loadData();
      }
    } catch (err: any) {
      alert(err?.data?.message ?? err?.message ?? 'Gagal meminta revisi.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} (${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')})`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Onboarding & Draf Registrasi Pegawai</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Tinjau, setujui, atau minta revisi berkas calon pegawai baru RSUCL</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Segarkan Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-left">
        {[
          { key: 'pending',           label: 'Menunggu Review', value: summary.pending, color: '#D97706', bg: '#FEF3C7', icon: Clock },
          { key: 'revision_required', label: 'Perlu Revisi',    value: summary.revision_required, color: '#2563EB', bg: '#EFF6FF', icon: AlertTriangle },
          { key: 'approved',          label: 'Disetujui',       value: summary.approved, color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle2 },
          { key: 'rejected',          label: 'Ditolak',          value: summary.rejected, color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
          { key: 'all',               label: 'Total Pengajuan', value: summary.total, color: '#374151', bg: '#F9FAFB', icon: UserPlus },
        ].map((s) => {
          const isActive = statusFilter === s.key;
          return (
            <div
              key={s.key}
              onClick={() => setStatusFilter(s.key as any)}
              className={`bg-white rounded-2xl border p-3.5 text-left cursor-pointer transition-all hover:shadow-md ${
                isActive ? 'border-2 shadow-md ring-4 scale-[1.02]' : 'border-gray-100 shadow-sm'
              }`}
              style={{
                borderLeft: `4px solid ${s.color}`,
                borderColor: isActive ? s.color : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[20px] font-bold text-gray-900">{s.value}</p>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                  <s.icon size={14} style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-[11px] font-bold text-gray-500 mt-1.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {(['all', 'pending', 'revision_required', 'approved', 'rejected'] as const).map((st) => {
            const labelMap = {
              all: 'Semua',
              pending: 'Menunggu',
              revision_required: 'Perlu Revisi',
              approved: 'Disetujui',
              rejected: 'Ditolak',
            };
            const isActive = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive ? 'bg-[#16A34A] text-white shadow-xs' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {labelMap[st]}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, NIK, email, no ref..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:bg-white transition-all font-medium"
          />
        </div>
      </div>

      {/* Main List Table / Cards */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">No. Referensi / Tanggal</th>
                <th className="px-4 py-3">Nama & NIK KTP</th>
                <th className="px-4 py-3">Kontak (Email / HP)</th>
                <th className="px-4 py-3">Departemen / Jabatan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[12.5px]">
              {loading && registrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#16A34A] border-t-transparent rounded-full animate-spin" />
                      <span>Memuat data pengajuan...</span>
                    </div>
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Tidak ada draf pengajuan calon pegawai untuk filter ini.
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => {
                  const isApproved = reg.status === 'approved';
                  const isRejected = reg.status === 'rejected';
                  const isPending = reg.status === 'pending';
                  const isRevision = reg.status === 'revision_required';
                  const isExpanded = expandedRegId === reg.id;

                  return (
                    <Fragment key={reg.id}>
                      <tr 
                        onClick={() => setExpandedRegId(isExpanded ? null : reg.id)}
                        className={`hover:bg-gray-50/60 transition-colors cursor-pointer ${isExpanded ? 'bg-green-50/10' : ''}`}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-gray-800 text-[12px] block">{reg.registration_number}</span>
                          <span className="text-[10.5px] text-gray-400">{formatDate(reg.created_at)}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-bold text-gray-900">{reg.name}</p>
                          <p className="font-mono text-[11px] text-gray-400">NIK: {reg.nik_ktp}</p>
                        </td>

                        <td className="px-4 py-3.5 text-[12px]">
                          <p className="text-gray-700 font-medium">{reg.email}</p>
                          <p className="text-gray-400 text-[11px] font-mono">{reg.phone}</p>
                        </td>

                        <td className="px-4 py-3.5 text-[12px]">
                          <p className="font-semibold text-gray-800">{reg.department?.name || '—'}</p>
                          <p className="text-[#16A34A] text-[11px] font-medium">{reg.position?.name || '—'}</p>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Menunggu Review
                            </span>
                          )}
                          {isRevision && (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Perlu Revisi
                            </span>
                          )}
                          {isApproved && (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Disetujui
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Ditolak
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {!isApproved && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => { setApprovingReg(reg); setAdminNote(''); }}
                                className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                                title="Setujui dan Buat Akun"
                              >
                                Setujui & Akun
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRevisingReg(reg); setAdminNote(''); }}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-[11px] font-bold border border-blue-200 transition-all cursor-pointer"
                                title="Minta Perbaikan Data"
                              >
                                Revisi
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRejectingReg(reg); setAdminNote(''); }}
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-[11px] font-bold border border-red-200 transition-all cursor-pointer"
                                title="Tolak Pengajuan"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                          {isApproved && (
                            <span className="text-[11px] text-gray-400 font-mono italic">
                              Akun Aktif ({reg.user?.username || '—'})
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={6} className="px-6 py-3 border-b border-gray-150">
                            <div className="flex flex-col gap-3 text-[12px] py-1">
                              {/* Plat Kendaraan */}
                              <div className="flex flex-wrap gap-x-8 gap-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Motor 1:</span>
                                  <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">{reg.motor_plate_1 || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Motor 2:</span>
                                  <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">{reg.motor_plate_2 || '—'}</span>
                                </div>
                                <div className="w-px bg-gray-200 hidden sm:block" />
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Mobil 1:</span>
                                  <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">{reg.car_plate_1 || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Mobil 2:</span>
                                  <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">{reg.car_plate_2 || '—'}</span>
                                </div>
                              </div>
                              {/* Sosial Media */}
                              <div className="flex flex-wrap gap-x-8 gap-y-2 pt-1 border-t border-gray-100/50">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Instagram:</span>
                                  <span className="text-gray-700 font-medium">{reg.instagram ? `@${reg.instagram}` : '—'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Facebook:</span>
                                  <span className="text-gray-700 font-medium">{reg.facebook || '—'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">TikTok:</span>
                                  <span className="text-gray-700 font-medium">{reg.tiktok ? `@${reg.tiktok}` : '—'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Approve Confirmation */}
      {approvingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setApprovingReg(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100 text-left animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-[15px] font-bold text-gray-900">Setujui Pengajuan & Generate Akun</h3>
              <button onClick={() => setApprovingReg(null)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 text-[12px] text-emerald-900 leading-relaxed font-medium">
                <p className="font-bold text-emerald-950">Konfirmasi Persetujuan Pegawai</p>
                <p className="mt-0.5">Sistem akan otomatis membuat <strong>Username</strong> (pola dot-separated) dan <strong>Password sementara 6 digit angka</strong> yang terenkripsi. Sampaikan password sementara ini kepada pegawai, dan minta segera diubah setelah login pertama.</p>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-[12px] space-y-2">
                <p><strong>Nama:</strong> {approvingReg.name}</p>
                <p><strong>NIK KTP:</strong> {approvingReg.nik_ktp}</p>
                <p><strong>Email:</strong> {approvingReg.email}</p>
                <p><strong>Departemen:</strong> {approvingReg.department?.name || '—'}</p>
                
                <div className="h-px bg-gray-200 my-1" />
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sosial Media</p>
                <p><strong>Instagram:</strong> {approvingReg.instagram ? `@${approvingReg.instagram}` : '—'}</p>
                <p><strong>Facebook:</strong> {approvingReg.facebook || '—'}</p>
                <p><strong>TikTok:</strong> {approvingReg.tiktok ? `@${approvingReg.tiktok}` : '—'}</p>

                <div className="h-px bg-gray-200 my-1" />
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Data Kendaraan</p>
                <p><strong>Motor:</strong> {approvingReg.motor_plate_1 || '—'}{approvingReg.motor_plate_2 ? `, ${approvingReg.motor_plate_2}` : ''}</p>
                <p><strong>Mobil:</strong> {approvingReg.car_plate_1 || '—'}{approvingReg.car_plate_2 ? `, ${approvingReg.car_plate_2}` : ''}</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Catatan Admin (Opsional)</label>
                <textarea
                  placeholder="Catatan persetujuan untuk calon pegawai..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] font-medium resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovingReg(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-[12px] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApproveSubmit}
                  disabled={submittingAction}
                  className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white font-bold rounded-xl text-[12px] shadow-sm transition-all disabled:opacity-70 cursor-pointer"
                >
                  {submittingAction ? 'Memproses...' : 'Setujui & Buat Akun'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Approval Result (Displays Username & Temp Password) */}
      {approvedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setApprovedResult(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100 text-left animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-[#16A34A]">
                <CheckCircle2 size={20} />
                <h3 className="text-[15px] font-bold text-gray-900">Akun Pegawai Berhasil Dibuat</h3>
              </div>
              <button onClick={() => setApprovedResult(null)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-[12.5px] text-gray-600">
                Akun untuk <strong>{approvedResult.name}</strong> telah aktif. Berikan kredensial berikut atau informasikan pegawai untuk melihatnya di Halaman Cek Status.
              </p>

              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Username Login</span>
                  <span className="text-emerald-400 font-bold text-[15px]">{approvedResult.username}</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Password Sementara</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white font-bold text-[16px] tracking-wider">{approvedResult.temp_password}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(approvedResult.temp_password)}
                      className="px-2.5 py-1 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {copiedPass ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedPass ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setApprovedResult(null)}
                className="w-full py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white font-bold rounded-xl text-[12.5px] transition-colors"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Revision */}
      {revisingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setRevisingReg(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100 text-left animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-[15px] font-bold text-gray-900">Minta Perbaikan / Revisi Data</h3>
              <button onClick={() => setRevisingReg(null)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[12px] text-gray-600">
                Pendaftar: <strong>{revisingReg.name}</strong> ({revisingReg.registration_number})
              </p>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Catatan Instuksi Perbaikan Data <span className="text-red-500">*</span></label>
                <textarea
                  required
                  placeholder="Contoh: Tolong perbaiki NIK KTP karena tidak valid..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-blue-500 font-medium resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevisingReg(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-[12px] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleRevisionSubmit}
                  disabled={submittingAction || !adminNote.trim()}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[12px] shadow-sm transition-all disabled:opacity-70 cursor-pointer"
                >
                  {submittingAction ? 'Memproses...' : 'Kirim Catatan Revisi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reject */}
      {rejectingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setRejectingReg(null)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-md border border-gray-100 text-left animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-[15px] font-bold text-gray-900">Tolak Pengajuan Pendaftaran</h3>
              <button onClick={() => setRejectingReg(null)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[12px] text-gray-600">
                Pendaftar: <strong>{rejectingReg.name}</strong> ({rejectingReg.registration_number})
              </p>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Alasan Penolakan <span className="text-red-500">*</span></label>
                <textarea
                  required
                  placeholder="Masukkan alasan penolakan..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-red-500 font-medium resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingReg(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-[12px] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleRejectSubmit}
                  disabled={submittingAction || !adminNote.trim()}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-[12px] shadow-sm transition-all disabled:opacity-70 cursor-pointer"
                >
                  {submittingAction ? 'Memproses...' : 'Tolak Pengajuan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
