import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Building,
  Calendar,
  Users,
  AlertCircle,
  Loader2,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { departmentApi, DepartmentModel, employeeApi } from "../../../services/api";

interface DepartmentsTabProps {
  onRefreshDepartments?: () => void;
}

/**
 * Komponen Tab Departemen Admin (DepartmentsTab) — Sistem Absensi RSUCL
 *
 * Fitur pengelolaan Master Data Departemen / Bagian rumah sakit secara dinamis.
 * Menyediakan alur CRUD (Create, Read, Update, Delete) untuk mendefinisikan unit penugasan karyawan
 * beserta kalkulasi jumlah pegawai terdaftar per departemen.
 */
export function DepartmentsTab({ onRefreshDepartments }: DepartmentsTabProps) {
  // Daftar departemen yang didapat dari server
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);

  // State pencarian teks nama departemen
  const [search, setSearch] = useState("");

  // Indikator loading memuat tabel
  const [loading, setLoading] = useState(false);

  // State menyimpan string error API utama jika ada
  const [errorMsg, setErrorMsg] = useState("");

  // ── States Pengendali Modal & Form CRUD ────────────────────────────────────
  const [modalType, setModalType] = useState<"add" | "edit" | "delete" | null>(
    null,
  );
  const [selectedDept, setSelectedDept] = useState<DepartmentModel | null>(
    null,
  );
  const [formName, setFormName] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  // States for Manage Employees Modal
  const [showManageModal, setShowManageModal] = useState(false);
  const [managedDept, setManagedDept] = useState<DepartmentModel | null>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeActionId, setEmployeeActionId] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"current" | "add">("current");

  const openManageEmployees = async (dept: DepartmentModel) => {
    setManagedDept(dept);
    setShowManageModal(true);
    setLoadingEmployees(true);
    setEmployeeSearch("");
    setActiveSubTab("current");
    try {
      const res = await employeeApi.list();
      if (res.success) {
        setAllEmployees(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat data pegawai:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAssignEmployee = async (employeeId: number) => {
    if (!managedDept) return;
    setEmployeeActionId(employeeId);
    try {
      const res = await employeeApi.update(employeeId, {
        department_id: managedDept.id
      });
      if (res.success) {
        setAllEmployees(prev =>
          prev.map(emp =>
            emp.id === employeeId ? { ...emp, department_id: managedDept.id, department: managedDept.name } : emp
          )
        );
        loadDepartments();
        if (onRefreshDepartments) onRefreshDepartments();
      }
    } catch (err: any) {
      alert(err?.message ?? "Gagal memindahkan pegawai.");
    } finally {
      setEmployeeActionId(null);
    }
  };

  const handleRemoveEmployee = async (employeeId: number) => {
    setEmployeeActionId(employeeId);
    try {
      const res = await employeeApi.update(employeeId, {
        department_id: null as any
      });
      if (res.success) {
        setAllEmployees(prev =>
          prev.map(emp =>
            emp.id === employeeId ? { ...emp, department_id: null, department: undefined } : emp
          )
        );
        loadDepartments();
        if (onRefreshDepartments) onRefreshDepartments();
      }
    } catch (err: any) {
      alert(err?.message ?? "Gagal mengeluarkan pegawai dari unit.");
    } finally {
      setEmployeeActionId(null);
    }
  };

  /**
   * Menarik daftar departemen lengkap dengan statistik dari API.
   */
  const loadDepartments = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await departmentApi.list();
      if (res.success) {
        setDepartments(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Gagal memuat data Unit kerja.");
    } finally {
      setLoading(false);
    }
  };

  // Muat data departemen saat komponen terpasang di DOM
  useEffect(() => {
    loadDepartments();
  }, []);

  const openAdd = () => {
    setFormName("");
    setModalError("");
    setSelectedDept(null);
    setModalType("add");
  };

  const openEdit = (dept: DepartmentModel) => {
    setFormName(dept.name);
    setModalError("");
    setSelectedDept(dept);
    setModalType("edit");
  };

  const openDelete = (dept: DepartmentModel) => {
    setSelectedDept(dept);
    setModalError("");
    setModalType("delete");
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedDept(null);
    setFormName("");
    setModalError("");
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setModalError("Nama Unit kerja wajib diisi.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      if (modalType === "add") {
        const res = await departmentApi.create({ name: formName.trim() });
        if (res.success) {
          setDepartments((prev) => [...prev, res.data]);
        }
      } else if (modalType === "edit" && selectedDept) {
        const res = await departmentApi.update(selectedDept.id, {
          name: formName.trim(),
        });
        if (res.success) {
          setDepartments((prev) =>
            prev.map((d) => (d.id === selectedDept.id ? res.data : d)),
          );
        }
      }
      closeModal();
      loadDepartments(); // reload for counts and sorting
      if (onRefreshDepartments) onRefreshDepartments();
    } catch (err: any) {
      setModalError(err?.message ?? "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDept) return;
    setSaving(true);
    setModalError("");
    try {
      const res = await departmentApi.delete(selectedDept.id);
      if (res.success) {
        setDepartments((prev) => prev.filter((d) => d.id !== selectedDept.id));
        closeModal();
        if (onRefreshDepartments) onRefreshDepartments();
      }
    } catch (err: any) {
      setModalError(err?.message ?? "Gagal menghapus data.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = departments
    .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">
            Master Data Unit kerja
          </h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Kelola data divisi, departemen, dan bagian dinamis rumah sakit
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16A34A] rounded-xl text-[12px] text-white hover:bg-[#0d9240] transition-colors shadow-sm shadow-green-200 flex-shrink-0"
        >
          <Plus size={13} /> Tambah Unit kerja
        </button>
      </div>

      {/* Error Message banner */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-[13px] text-red-600 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={loadDepartments}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg font-semibold transition-all"
          >
            Segarkan
          </button>
        </div>
      )}

      {/* Filters and search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Cari nama Unit kerja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {[
                  "Nama Unit kerja",
                  "Jumlah Pegawai",
                  "Tanggal Dibuat",
                  "Aksi",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-5 py-3.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-8 text-gray-400 text-[12px]"
                  >
                    Memuat data Unit kerja...
                  </td>
                </tr>
              )}
              {filtered.map((dept) => (
                <tr
                  key={dept.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Building size={14} className="text-[#16A34A]" />
                      </div>
                      <span className="text-[13px] font-medium text-gray-800">
                        {dept.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 cursor-pointer group/cell" onClick={() => openManageEmployees(dept)}>
                    <div className="flex items-center gap-1.5 text-[12px] text-gray-600 group-hover/cell:text-[#16A34A] group-hover/cell:underline transition-all">
                      <Users size={13} className="text-gray-400 group-hover/cell:text-[#16A34A]/80" />
                      <span>{dept.employees_count ?? 0} Pegawai</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                      <Calendar size={13} className="text-gray-300" />
                      <span>{formatDate(dept.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openManageEmployees(dept)}
                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center transition-colors text-[#16A34A]"
                        title="Atur Anggota Unit"
                      >
                        <Users size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(dept)}
                        className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors text-blue-600"
                        title="Edit Unit kerja"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => openDelete(dept)}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors text-red-600"
                        title="Hapus Unit kerja"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-10 text-gray-400 text-[12px]"
                  >
                    Tidak ada data Unit kerja ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
          <p className="text-[12px] text-gray-400">
            Menampilkan {filtered.length} dari {departments.length} data
          </p>
        </div>
      </div>

      {/* ── MODAL ADD / EDIT ── */}
      {(modalType === "add" || modalType === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${modalType === "add" ? "bg-green-50 text-[#16A34A]" : "bg-blue-50 text-blue-600"}`}
                >
                  {modalType === "add" ? (
                    <Plus size={16} />
                  ) : (
                    <Edit2 size={15} />
                  )}
                </div>
                <p className="text-[15px] font-semibold text-gray-900">
                  {modalType === "add"
                    ? "Tambah Unit kerja"
                    : "Edit Unit kerja"}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {modalError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-[12px] px-4 py-2.5 rounded-xl flex items-start gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                  Nama Unit kerja <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Unit IGD, Divisi Keuangan, Kepegawaian"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 px-6 pb-6 pt-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors shadow-sm shadow-green-200 disabled:opacity-50"
              >
                {saving
                  ? "Menyimpan..."
                  : modalType === "add"
                    ? "Tambah Data"
                    : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DELETE ── */}
      {modalType === "delete" && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
              <Trash2 size={22} />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">
              Hapus Unit kerja?
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-1">
              Departemen berikut akan dihapus permanen:
            </p>
            <p className="text-[13px] font-semibold text-gray-800 text-center mb-5">
              {selectedDept.name}
            </p>

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
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-50"
              >
                {saving ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── MODAL MANAGE EMPLOYEES ── */}
      {showManageModal && managedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowManageModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-50 text-[#16A34A]">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-gray-900 leading-tight">
                    Atur Anggota Unit Kerja
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-wider font-semibold">
                    {managedDept.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowManageModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-gray-100 px-6 bg-gray-50/50 flex-shrink-0">
              <button
                onClick={() => setActiveSubTab("current")}
                className={`py-3 px-4 text-[12px] font-semibold transition-all border-b-2 -mb-[2px] ${
                  activeSubTab === "current"
                    ? "border-[#16A34A] text-[#16A34A]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Anggota Aktif ({allEmployees.filter(e => e.department_id === managedDept.id).length})
              </button>
              <button
                onClick={() => setActiveSubTab("add")}
                className={`py-3 px-4 text-[12px] font-semibold transition-all border-b-2 -mb-[2px] ${
                  activeSubTab === "add"
                    ? "border-[#16A34A] text-[#16A34A]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Tugaskan / Pindahkan Pegawai
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIK pegawai..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-[12.5px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
            </div>

            {/* Content (Scrollable list) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gray-50/30">
              {loadingEmployees ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-450">
                  <Loader2 size={20} className="animate-spin text-[#16A34A]" />
                  <span className="text-[12px]">Memuat data kepegawaian...</span>
                </div>
              ) : (
                (() => {
                  const filteredList = allEmployees
                    .filter(emp => {
                      const matchesSearch =
                        emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                        emp.nik_ktp.toLowerCase().includes(employeeSearch.toLowerCase());

                      if (activeSubTab === "current") {
                        return matchesSearch && emp.department_id === managedDept.id;
                      } else {
                        return matchesSearch && emp.department_id !== managedDept.id;
                      }
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));

                  if (filteredList.length === 0) {
                    return (
                      <p className="text-center text-gray-400 text-[12px] italic py-8">
                        {employeeSearch ? "Pegawai tidak ditemukan." : activeSubTab === "current" ? "Belum ada anggota aktif di unit kerja ini." : "Semua pegawai telah ditugaskan ke unit kerja ini."}
                      </p>
                    );
                  }

                  return filteredList.map(emp => {
                    const isProcessing = employeeActionId === emp.id;
                    return (
                      <div
                        key={emp.id}
                        className="bg-white border border-gray-200/60 rounded-xl p-3.5 flex items-center justify-between shadow-xs transition-all hover:border-gray-250"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500 font-bold text-[12px] uppercase">
                            {emp.name.substring(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-gray-800 truncate">
                              {emp.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-gray-400 font-mono">
                                NIK: {emp.nik_ktp}
                              </span>
                              {activeSubTab === "add" && (
                                <span className={`text-[9px] font-semibold px-2 py-0.2 rounded-full border ${
                                  emp.department
                                    ? "bg-blue-50 text-blue-750 border-blue-150"
                                    : "bg-gray-50 text-gray-550 border-gray-200"
                                }`}>
                                  {emp.department ? `Unit: ${emp.department}` : "Belum ada unit"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          {activeSubTab === "current" ? (
                            <button
                              onClick={() => handleRemoveEmployee(emp.id)}
                              disabled={isProcessing}
                              className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-605 rounded-lg text-[11.5px] font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <UserMinus size={12} />
                              )}
                              Keluarkan
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAssignEmployee(emp.id)}
                              disabled={isProcessing}
                              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                emp.department_id
                                  ? "border border-blue-200 hover:bg-blue-50 text-blue-600"
                                  : "bg-[#16A34A] hover:bg-[#0d9240] text-white shadow-sm shadow-green-150"
                              }`}
                            >
                              {isProcessing ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <UserPlus size={12} />
                              )}
                              {emp.department_id ? "Pindahkan" : "Tugaskan"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4.5 border-t border-gray-100 flex justify-end flex-shrink-0 bg-white">
              <button
                onClick={() => setShowManageModal(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-250 text-gray-700 font-semibold rounded-xl text-[12.5px] transition-all cursor-pointer"
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
