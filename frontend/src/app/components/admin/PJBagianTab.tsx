import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Plus, Trash2, Search, CheckCircle2, UserCheck, RefreshCw } from 'lucide-react';
import { 
  pjBagianApi, 
  employeeApi, 
  departmentApi, 
  PjBagianUser, 
  Employee, 
  DepartmentModel 
} from '../../../services/api';

export function PJBagianTab() {
  const [pjList, setPjList] = useState<PjBagianUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DepartmentModel[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const pjRes = await pjBagianApi.list();
      if (pjRes.success) setPjList(pjRes.data);

      const empRes = await employeeApi.list();
      if (empRes.success) setEmployees(empRes.data);

      const deptRes = await departmentApi.list();
      if (deptRes.success) setDepartments(deptRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedEmployeeId || !selectedDepartmentId) {
      setErrorMsg('Semua kolom penugasan wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      // Find employee to get their name
      const targetEmp = employees.find(e => e.id === Number(selectedEmployeeId));
      const targetDept = departments.find(d => d.id === Number(selectedDepartmentId));
      
      const existing = pjList.find(pj => pj.pj_bagian_department_id === Number(selectedDepartmentId));
      if (existing) {
        const confirmChange = window.confirm(
          `Departemen ${targetDept?.name} sudah dipimpin oleh ${existing.name}. Menugaskan ${targetEmp?.name} akan secara otomatis mencabut wewenang ${existing.name}. Lanjutkan?`
        );
        if (!confirmChange) {
          setSubmitting(false);
          return;
        }
      }

      const res = await pjBagianApi.assign(Number(selectedEmployeeId), Number(selectedDepartmentId));
      if (res.success) {
        setIsAssignModalOpen(false);
        setSelectedEmployeeId('');
        setSelectedDepartmentId('');
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Gagal menugaskan PJ Bagian.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (pj: PjBagianUser) => {
    if (!pj.employee_id) return;
    const confirmRevoke = window.confirm(
      `Apakah Anda yakin ingin mencabut status PJ Bagian dari ${pj.name}? Dia akan kembali menjadi staf biasa.`
    );
    if (!confirmRevoke) return;

    try {
      const res = await pjBagianApi.revoke(pj.employee_id);
      if (res.success) {
        loadData();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal mencabut wewenang.');
    }
  };

  const filtered = pjList.filter(pj => 
    pj.name.toLowerCase().includes(search.toLowerCase()) ||
    pj.nik_ktp.includes(search) ||
    pj.pj_bagian_department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto px-2 sm:px-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Kelola Penanggung Jawab (PJ) Bagian</h2>
          <p className="text-[11px] text-gray-400">Atur hak akses supervisor per departemen rumah sakit</p>
        </div>
        
        <button
          onClick={() => setIsAssignModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] hover:bg-[#15803d] text-white rounded-xl text-[11px] font-bold transition-all shadow-xs active:scale-95 w-full sm:w-auto justify-center"
        >
          <Plus size={14} /> Tugaskan PJ Baru
        </button>
      </div>

      {/* Info Warning */}
      <div className="p-3 bg-green-50 border border-green-200 text-[11px] rounded-xl text-green-800 flex items-start gap-2">
        <ShieldAlert size={14} className="mt-0.5 flex-shrink-0 text-[#16A34A]" />
        <span>
          <strong>Kebijakan Akses:</strong> Satu departemen hanya boleh diawasi oleh <strong>satu PJ Bagian aktif</strong>. 
          Menugaskan PJ baru pada departemen yang sudah memiliki PJ akan menonaktifkan PJ sebelumnya secara otomatis.
        </span>
      </div>

      {/* Search and Table/Cards */}
      <div className="bg-white rounded-xl border border-gray-150 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            placeholder="Cari PJ, NIK KTP, atau departemen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-[11px] w-full focus:outline-none placeholder-gray-400 bg-transparent"
          />
          <button onClick={loadData} className="text-gray-400 hover:text-gray-600" title="Refresh">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                <th className="py-2.5 px-4">Nama / NIK KTP</th>
                <th className="py-2.5 px-4">Jabatan</th>
                <th className="py-2.5 px-4">Departemen yang Diawasi</th>
                <th className="py-2.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(pj => (
                <tr key={pj.user_id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-[#16A34A] font-bold">
                        {pj.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{pj.name}</p>
                        <p className="text-[10px] text-gray-400">{pj.nik_ktp}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 font-medium">{pj.position || 'Staf'}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-50 text-[#16A34A] font-semibold">
                      <Shield size={10} /> {pj.pj_bagian_department}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRevoke(pj)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] text-red-650 bg-red-50 hover:bg-red-650 hover:text-white border border-red-200/50 rounded-xl font-bold transition-all active:scale-95 shadow-xs"
                    >
                      <Trash2 size={12} className="flex-shrink-0" /> Cabut Wewenang
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400">
                    Tidak ada PJ Bagian terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="block md:hidden divide-y divide-gray-100">
          {filtered.map(pj => (
            <div key={pj.user_id} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-[#16A34A] font-bold text-[12px] flex-shrink-0">
                  {pj.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-800 text-[12px] truncate">{pj.name}</p>
                  <p className="text-[10px] text-gray-400">{pj.nik_ktp} • {pj.position || 'Staf'}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-[#16A34A] font-semibold text-[10px]">
                  <Shield size={9} /> {pj.pj_bagian_department}
                </span>
                
                <button
                  onClick={() => handleRevoke(pj)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-red-650 bg-red-50 hover:bg-red-650 hover:text-white border border-red-200/50 rounded-xl font-bold transition-all text-[10.5px] active:scale-95 shadow-xs"
                >
                  <Trash2 size={11} className="flex-shrink-0" /> Cabut
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-[11px]">
              Tidak ada PJ Bagian terdaftar.
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsAssignModalOpen(false)} />
          <div className="relative bg-white rounded-xl p-5 shadow-xl w-full max-w-sm z-10">
            <h3 className="text-[13px] font-bold text-gray-900 mb-1 flex items-center gap-1.5">
              <UserCheck size={16} className="text-[#16A34A]" /> Tugaskan PJ Bagian
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">Pilih karyawan dan unit departemen yang akan dipimpin</p>

            {errorMsg && (
              <div className="mb-3 p-2 bg-red-50 border border-red-100 rounded-lg text-[10px] text-red-600">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">Pilih Karyawan</label>
                <select
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[11px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all font-semibold text-gray-700"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.filter(e => e.role !== 'admin').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.nik_ktp}) - {emp.department}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">Departemen Kerja</label>
                <select
                  value={selectedDepartmentId}
                  onChange={e => setSelectedDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[11px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all font-semibold text-gray-700"
                >
                  <option value="">-- Pilih Departemen --</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-[#16A34A] hover:bg-[#15803d] text-white rounded-lg text-[11px] font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Tugaskan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
