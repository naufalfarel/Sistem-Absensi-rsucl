import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, Calendar, Users, AlertCircle, Briefcase, ChevronRight, UserPlus, Trash, RefreshCw } from 'lucide-react';
import { holidayApi, employeeApi, Holiday, HolidayWorkAssignment, Employee } from '../../../services/api';

/**
 * Komponen Tab Kalender Libur Admin (HolidaysTab) — Sistem Absensi RSUCL
 * 
 * Mengelola hari libur nasional Indonesia dan penugasan kerja khusus per tanggal merah.
 */
export function HolidaysTab() {
  const currentYear = new Date().getFullYear();

  // Hari Libur
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleSyncHolidays = async () => {
    setSyncing(true);
    setErrorMsg('');
    try {
      const res = await holidayApi.sync(selectedYear);
      if (res.success) {
        await loadHolidays();
        alert(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Gagal melakukan sinkronisasi otomatis.');
    } finally {
      setSyncing(false);
    }
  };

  // CRUD Hari Libur
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete' | 'assign' | null>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  // Penugasan (Assignments)
  const [assignments, setAssignments] = useState<HolidayWorkAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  const loadHolidays = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await holidayApi.list(selectedYear);
      if (res.success) {
        setHolidays(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Gagal memuat data hari libur.');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await employeeApi.list();
      if (res.success) {
        // filter active employees
        setEmployees(res.data.filter(e => e.status === 'active'));
      }
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [selectedYear]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const openAdd = () => {
    setFormDate('');
    setFormName('');
    setModalError('');
    setSelectedHoliday(null);
    setModalType('add');
  };

  const openEdit = (h: Holiday) => {
    setFormDate(h.date);
    setFormName(h.name);
    setModalError('');
    setSelectedHoliday(h);
    setModalType('edit');
  };

  const openDelete = (h: Holiday) => {
    setSelectedHoliday(h);
    setModalError('');
    setModalType('delete');
  };

  const openAssign = async (h: Holiday) => {
    setSelectedHoliday(h);
    setModalError('');
    setModalType('assign');
    setSelectedEmployeeId('');
    setAssignmentNote('');
    setEmpSearch('');
    setAssignments([]);
    
    setLoadingAssignments(true);
    try {
      const res = await holidayApi.listAssignments(h.id);
      if (res.success) {
        setAssignments(res.data);
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal memuat penugasan.');
    } finally {
      setLoadingAssignments(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedHoliday(null);
    setFormDate('');
    setFormName('');
    setModalError('');
    setEmpSearch('');
  };

  const handleSaveHoliday = async () => {
    if (!formDate || !formName.trim()) {
      setModalError('Semua kolom wajib diisi.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      if (modalType === 'add') {
        const res = await holidayApi.create({ date: formDate, name: formName.trim() });
        if (res.success) {
          setHolidays(prev => [...prev, res.data].sort((a, b) => a.date.localeCompare(b.date)));
          closeModal();
        }
      } else if (modalType === 'edit' && selectedHoliday) {
        const res = await holidayApi.update(selectedHoliday.id, { date: formDate, name: formName.trim() });
        if (res.success) {
          setHolidays(prev => prev.map(h => h.id === selectedHoliday.id ? res.data : h).sort((a, b) => a.date.localeCompare(b.date)));
          closeModal();
        }
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!selectedHoliday) return;
    setSaving(true);
    setModalError('');
    try {
      const res = await holidayApi.delete(selectedHoliday.id);
      if (res.success) {
        setHolidays(prev => prev.filter(h => h.id !== selectedHoliday.id));
        closeModal();
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal menghapus data.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedHoliday || !selectedEmployeeId) return;
    setSaving(true);
    setModalError('');
    try {
      const empId = Number(selectedEmployeeId);
      const res = await holidayApi.assign(selectedHoliday.id, [empId], assignmentNote.trim());
      if (res.success) {
        // Refresh assignments list
        const resList = await holidayApi.listAssignments(selectedHoliday.id);
        if (resList.success) {
          setAssignments(resList.data);
        }
        setSelectedEmployeeId('');
        setAssignmentNote('');
        setEmpSearch('');
        
        // Refresh holidays count
        setHolidays(prev => prev.map(h => h.id === selectedHoliday.id ? { ...h, assignments_count: (h.assignments_count ?? 0) + 1 } : h));
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal menugaskan pegawai.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (employeeId: number) => {
    if (!selectedHoliday) return;
    setModalError('');
    try {
      const res = await holidayApi.unassign(selectedHoliday.id, employeeId);
      if (res.success) {
        setAssignments(prev => prev.filter(a => a.employee_id !== employeeId));
        
        // Refresh holidays count
        setHolidays(prev => prev.map(h => h.id === selectedHoliday.id ? { ...h, assignments_count: Math.max(0, (h.assignments_count ?? 0) - 1) } : h));
      }
    } catch (err: any) {
      setModalError(err?.message ?? 'Gagal membatalkan penugasan.');
    }
  };

  const filtered = holidays.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) || h.date.includes(search)
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${dayNames[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Filter employees that are not already assigned to this holiday
  const availableEmployees = employees.filter(emp => 
    !assignments.some(assign => assign.employee_id === emp.id)
  );

  const searchedEmployees = availableEmployees.filter(emp =>
    emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.nip.toLowerCase().includes(empSearch.toLowerCase()) ||
    (emp.department && emp.department.toLowerCase().includes(empSearch.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Kalender Hari Libur & Penugasan</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Kelola tanggal merah nasional dan pegawai yang ditugaskan piket</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncHolidays}
            disabled={syncing || loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[12px] text-blue-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Menyinkronkan...' : 'Sinkronisasi Otomatis'}
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16A34A] rounded-xl text-[12px] text-white hover:bg-[#0d9240] transition-colors shadow-sm shadow-green-200 flex-shrink-0 font-semibold"
          >
            <Plus size={13} /> Tambah Hari Libur
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-[13px] text-red-600 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={loadHolidays} className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg font-semibold transition-all">Segarkan</button>
        </div>
      )}

      {/* Filters and search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama hari libur atau tanggal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
          />
        </div>
        
        {/* Year Filter */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
          {[2025, 2026, 2027, 2028].map(yr => (
            <button
              key={yr}
              onClick={() => setSelectedYear(yr)}
              className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
                selectedYear === yr
                  ? 'bg-green-50 text-[#16A34A] border border-green-200/50 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 border border-transparent'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {['Hari & Tanggal', 'Keterangan Libur', 'Penugasan Kerja', 'Aksi'].map((h, i) => (
                  <th key={i} className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 text-[12px]">Memuat data kalender libur...</td>
                </tr>
              )}
              {filtered.map(h => (
                <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Calendar size={14} className="text-red-500" />
                      </div>
                      <div>
                        <span className="text-[13px] font-medium text-gray-800">{formatDate(h.date)}</span>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{h.date}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-[13px] font-semibold text-gray-700">{h.name}</span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => openAssign(h)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                        (h.assignments_count ?? 0) > 0
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Users size={11} />
                      <span>{h.assignments_count ?? 0} Pegawai Piket</span>
                      <ChevronRight size={10} className="opacity-60" />
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(h)}
                        className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors text-blue-600"
                        title="Edit Hari Libur"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => openDelete(h)}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors text-red-600"
                        title="Hapus Hari Libur"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400 text-[12px]">Tidak ada data hari libur nasional untuk tahun ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
          <p className="text-[12px] text-gray-400">Menampilkan {filtered.length} dari {holidays.length} hari libur</p>
        </div>
      </div>

      {/* ── MODAL ADD / EDIT HARI LIBUR ── */}
      {(modalType === 'add' || modalType === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${modalType === 'add' ? 'bg-green-50 text-[#16A34A]' : 'bg-blue-50 text-blue-600'}`}>
                  {modalType === 'add' ? <Plus size={16} /> : <Edit2 size={15} />}
                </div>
                <p className="text-[15px] font-semibold text-gray-900">{modalType === 'add' ? 'Tambah Hari Libur' : 'Edit Hari Libur'}</p>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-[12px] px-4 py-2.5 rounded-xl flex items-start gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Tanggal <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">Nama Hari Libur <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Contoh: Hari Raya Idul Fitri 1447 H, Hari Kemerdekaan RI"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 px-6 pb-6 pt-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveHoliday}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors shadow-sm shadow-green-200 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : modalType === 'add' ? 'Tambah Libur' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DELETE HARI LIBUR ── */}
      {modalType === 'delete' && selectedHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 size={22} />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">Hapus Hari Libur?</h3>
            <p className="text-[13px] text-gray-500 text-center mb-1">Hari libur berikut beserta seluruh penugasannya akan dihapus:</p>
            <p className="text-[13px] font-semibold text-red-600 text-center mb-5">{selectedHoliday.name} ({selectedHoliday.date})</p>

            {modalError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl mb-4 flex items-start gap-2 text-left">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteHoliday}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
              >
                {saving ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL KELOLA PENUGASAN KERJA HARI LIBUR ── */}
      {modalType === 'assign' && selectedHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Briefcase size={15} />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">Kelola Penugasan Kerja</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{selectedHoliday.name} · {formatDate(selectedHoliday.date)}</p>
                </div>
              </div>
              <button onClick={closeModal} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[380px] overflow-y-auto">
              {modalError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl flex items-start gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Form Input Tambah Pegawai */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
                <p className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                  <UserPlus size={13} className="text-[#16A34A]" />
                  Tugaskan Pegawai Piket
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Nama Pegawai</label>
                    <div className="relative mb-1.5">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Cari nama / NIP / bagian..."
                        value={empSearch}
                        onChange={e => setEmpSearch(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-200 rounded-lg text-[11.5px] focus:outline-none focus:border-[#16A34A] text-gray-800 placeholder:text-gray-300 shadow-sm"
                      />
                      {empSearch && (
                        <button
                          onClick={() => setEmpSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[11px] font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <select
                      value={selectedEmployeeId}
                      onChange={e => setSelectedEmployeeId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[12px] focus:outline-none focus:border-[#16A34A] text-gray-700 cursor-pointer"
                    >
                      <option value="">-- Pilih Pegawai ({searchedEmployees.length}) --</option>
                      {searchedEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.department} - {emp.nip})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Catatan Tugas / Keterangan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Piket IGD, Shift Pagi, Backup ICU"
                      value={assignmentNote}
                      onChange={e => setAssignmentNote(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[12px] focus:outline-none focus:border-[#16A34A] text-gray-800 placeholder:text-gray-300"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddAssignment}
                  disabled={saving || !selectedEmployeeId}
                  className="w-full py-2 bg-[#16A34A] hover:bg-[#0d9240] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                >
                  <Plus size={12} /> Tugaskan Pegawai
                </button>
              </div>

              {/* List Assigned Employees */}
              <div className="space-y-2">
                <p className="text-[12px] font-bold text-gray-600 uppercase tracking-wider">Daftar Pegawai Bertugas ({assignments.length})</p>
                
                {loadingAssignments ? (
                  <p className="text-center py-4 text-gray-400 text-[12px] animate-pulse">Memuat penugasan...</p>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                    <Users size={20} className="text-gray-300 mx-auto mb-1.5" />
                    <p className="text-[11.5px] text-gray-400 font-medium">Belum ada pegawai ditugaskan</p>
                    <p className="text-[10px] text-gray-300">Semua pegawai reguler libur secara default</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {assignments.map(assign => (
                      <div key={assign.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors shadow-sm">
                        <div>
                          <p className="text-[12.5px] font-semibold text-gray-800 leading-tight">{assign.employee_name}</p>
                          <div className="flex gap-2 text-[10px] text-gray-400 mt-1 flex-wrap">
                            <span className="bg-gray-50 border border-gray-150 rounded px-1">{assign.nip}</span>
                            <span>{assign.department} · {assign.position}</span>
                          </div>
                          {assign.note && (
                            <p className="text-[10.5px] text-purple-600 bg-purple-50/50 border border-purple-100/50 rounded px-2 py-0.5 w-max mt-1.5">
                              📌 {assign.note}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(assign.employee_id)}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors"
                          title="Batalkan Penugasan"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/50 flex justify-end">
              <button
                onClick={closeModal}
                className="px-5 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-600 transition-colors shadow-sm"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
