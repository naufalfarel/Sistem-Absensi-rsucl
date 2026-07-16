import { useState, useEffect } from 'react';
import { Sun, Sunset, Moon, Star, Zap, Users, Plus, X, Calendar, AlertCircle } from 'lucide-react';
import { 
  scheduleApi, 
  shiftProposalApi, 
  ShiftSchedule, 
  EmployeeWeeklySchedule, 
  ShiftProposal 
} from '../../../services/api';

interface ShiftProposalTabProps {
  user: { 
    id: number; 
    name: string; 
    username: string; 
    nip: string; 
    pj_bagian_department?: string; 
    pj_bagian_department_id?: number 
  };
}

type IconKey = 'sun' | 'sunset' | 'moon' | 'star' | 'zap';

const ICON_MAP: Record<IconKey, { component: typeof Sun; label: string; emoji: string }> = {
  sun:    { component: Sun,    label: 'Matahari',  emoji: '☀️' },
  sunset: { component: Sunset, label: 'Senja',     emoji: '🌅' },
  moon:   { component: Moon,   label: 'Bulan',     emoji: '🌙' },
  star:   { component: Star,   label: 'Bintang',   emoji: '⭐' },
  zap:    { component: Zap,    label: 'Kilat',     emoji: '⚡' },
};

const COLOR_PRESETS = [
  { id: 'amber',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Kuning'  },
  { id: 'blue',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'Biru'    },
  { id: 'violet', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', label: 'Ungu'    },
  { id: 'green',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Hijau'   },
  { id: 'rose',   color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3', label: 'Merah'   },
  { id: 'cyan',   color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', label: 'Biru Muda'},
];

function getPresetByHex(hex: string) {
  return COLOR_PRESETS.find(c => c.color.toLowerCase() === hex.toLowerCase()) ?? COLOR_PRESETS[0];
}

function AssignDepartmentModal({
  shifts,
  departmentId,
  departmentName,
  onClose,
  onAssign,
}: {
  shifts: ShiftSchedule[];
  departmentId: number;
  departmentName: string;
  onClose: () => void;
  onAssign: (deptId: number, day: string, scheduleId: number | null) => Promise<void>;
}) {
  const [selectedDay, setSelectedDay] = useState<string>('Senin');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const schedId = selectedScheduleId === '' ? null : Number(selectedScheduleId);
      if (selectedDay === 'Semua Hari') {
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        for (const day of days) {
          await onAssign(departmentId, day, schedId);
        }
      } else if (selectedDay === 'Senin - Sabtu') {
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        for (const day of days) {
          await onAssign(departmentId, day, schedId);
        }
      } else {
        await onAssign(departmentId, selectedDay, schedId);
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl font-sans">
        <h3 className="text-[15px] font-bold text-gray-900 mb-4">Penugasan Shift Massal Departemen</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Departemen Anda</label>
            <input
              type="text"
              readOnly
              value={departmentName}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-100 font-semibold text-gray-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Pilih Hari Kerja</label>
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold"
            >
              <option value="Semua Hari">Senin - Minggu</option>
              <option value="Senin - Sabtu">Senin - Sabtu</option>
              <option value="Senin">Senin</option>
              <option value="Selasa">Selasa</option>
              <option value="Rabu">Rabu</option>
              <option value="Kamis">Kamis</option>
              <option value="Jumat">Jumat</option>
              <option value="Sabtu">Sabtu</option>
              <option value="Minggu">Minggu</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">Pilih Shift Kerja</label>
            <select
              value={selectedScheduleId}
              onChange={e => setSelectedScheduleId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold"
            >
              <option value="">Libur (Off)</option>
              {shifts.map(parent => (
                <optgroup key={parent.id} label={parent.name}>
                  {parent.children?.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.name} ({child.start_time.substring(0, 5)} - {child.end_time.substring(0, 5)})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors"
          >
            {loading ? 'Menyimpan...' : 'Tugaskan Massal'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShiftProposalTab({ user }: ShiftProposalTabProps) {
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [employeeSchedules, setEmployeeSchedules] = useState<EmployeeWeeklySchedule[]>([]);
  const [proposals, setProposals] = useState<ShiftProposal[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [activeAssignCell, setActiveAssignCell] = useState<{ empId: number; day: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load active schedules (shifts)
      const schedRes = await scheduleApi.list();
      if (schedRes.success) {
        setShifts(schedRes.data);
      }

      // 2. Load employee weekly schedules (automatically filtered for PJ Bagian department by backend)
      const empSchedRes = await scheduleApi.getEmployeeSchedules();
      if (empSchedRes.success) {
        setEmployeeSchedules(empSchedRes.data);
      }

      // 3. Load historical proposals
      const propRes = await shiftProposalApi.list();
      if (propRes.success) {
        setProposals(propRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (employeeId: number, day: string, scheduleId: number | null) => {
    try {
      const res = await shiftProposalApi.create({
        employee_id: employeeId,
        schedule_id: scheduleId,
        day_of_week: day,
      });
      if (res.success) {
        alert('Usulan shift berhasil dikirim ke Admin untuk ditinjau.');
        
        // Refresh proposals list
        const propRes = await shiftProposalApi.list();
        if (propRes.success) {
          setProposals(propRes.data);
        }
        
        setActiveAssignCell(null);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal mengajukan usulan shift.');
    }
  };

  const handleAssignDepartment = async (departmentId: number, day: string, scheduleId: number | null) => {
    try {
      let successCount = 0;
      let failCount = 0;
      for (const row of employeeSchedules) {
        try {
          const res = await shiftProposalApi.create({
            employee_id: row.employee_id,
            schedule_id: scheduleId,
            day_of_week: day,
          });
          if (res.success) {
            successCount++;
          }
        } catch {
          failCount++;
        }
      }
      
      alert(`Berhasil mengajukan usulan shift massal untuk ${successCount} pegawai. ${failCount > 0 ? `Sudah ada usulan pending untuk ${failCount} pegawai.` : ''}`);
      
      // Refresh proposals list
      const propRes = await shiftProposalApi.list();
      if (propRes.success) {
        setProposals(propRes.data);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal mengajukan usulan shift massal.');
    }
  };

  const totalDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const getShiftInitials = (name: string) => {
    return name.trim().charAt(0).toUpperCase();
  };

  const getShiftColors = (colorHex: string) => {
    const pr = COLOR_PRESETS.find(c => c.color.toLowerCase() === colorHex.toLowerCase());
    if (pr) return { bg: pr.bg, text: pr.color };
    return { bg: `${colorHex}15`, text: colorHex };
  };

  // Filter employees listed in the weekly schedule by search query
  const filteredEmployeeSchedules = employeeSchedules.filter(row => {
    if (!searchQuery.trim()) return true;
    return row.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* Background click handler to close popovers */}
      {activeAssignCell && (
        <div className="fixed inset-0 z-20" onClick={() => setActiveAssignCell(null)} />
      )}

      {/* Page header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Usulan Jadwal Shift Staf</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Ajukan usulan shift mingguan pegawai di Departemen {user.pj_bagian_department || 'Anda'} (membutuhkan persetujuan Admin)</p>
        </div>
        {user.pj_bagian_department_id && (
          <button
            onClick={() => setShowDeptModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 border border-green-100 hover:bg-green-100 text-green-600 text-[13px] font-semibold rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            <Users size={15} /> Tugaskan per Departemen
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Cari pegawai berdasarkan nama..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 text-[12px] font-semibold"
          >
            Batal
          </button>
        )}
      </div>

      {/* Weekly Matrix Grid */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[13px] font-bold text-gray-800">Matriks Penjadwalan Mingguan</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Klik sel hari kerja pegawai di bawah untuk mengusulkan penugasan atau perubahan shift dinas kepada Admin.</p>
        </div>
        <div className="overflow-x-auto pb-4">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pegawai</th>
                {totalDays.map(d => (
                  <th key={d} className="text-center px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && employeeSchedules.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 text-[12px]">Memuat jadwal mingguan...</td>
                </tr>
              )}
              {!loading && filteredEmployeeSchedules.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 text-[12px] italic">Tidak ada pegawai yang ditemukan.</td>
                </tr>
              )}
              {filteredEmployeeSchedules.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                  <td className="px-5 py-3 text-[12.5px] font-bold text-gray-800 whitespace-nowrap">{row.name}</td>
                  {totalDays.map((d, j) => {
                    const assigned = row.schedules[d];
                    const sc = assigned ? getShiftColors(assigned.color) : { bg: '#F9FAFB', text: '#9CA3AF' };
                    const initial = assigned ? getShiftInitials(assigned.name) : '-';
                    const active = activeAssignCell?.empId === row.employee_id && activeAssignCell?.day === d;

                    return (
                      <td key={j} className="px-3 py-3 text-center relative">
                        <button
                          onClick={() => setActiveAssignCell(active ? null : { empId: row.employee_id, day: d })}
                          className="inline-block text-[10.5px] font-extrabold px-3 py-1 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-xs border border-transparent hover:border-gray-200 min-w-[28px]"
                          style={{ background: sc.bg, color: sc.text }}
                          title={assigned ? `${assigned.name} (Klik untuk ganti)` : 'Libur (Klik untuk set)'}
                        >
                          {initial}
                        </button>

                        {/* Popover Shift Selection */}
                        {active && (
                          <div className={`absolute left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl border border-gray-200/80 shadow-2xl py-1.5 min-w-[170px] text-left max-h-[220px] overflow-y-auto ${
                            filteredEmployeeSchedules.length > 2 && i >= filteredEmployeeSchedules.length - 2
                              ? 'bottom-full mb-1.5'
                              : 'top-full mt-1.5'
                          }`}>
                            <p className="text-[9px] font-bold text-gray-400 px-3 py-1 uppercase border-b border-gray-50 mb-1">Set Shift ({d})</p>
                            {shifts.map(parent => (
                              <div key={parent.id} className="space-y-0.5 border-b border-gray-50 pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                                <p className="text-[8px] font-bold text-gray-400 px-3 py-0.5 uppercase tracking-wider">{parent.name}</p>
                                {parent.children?.map(child => (
                                  <button
                                    key={child.id}
                                    onClick={() => handleAssign(row.employee_id, d, child.id)}
                                    className="w-full text-left px-4 py-1.5 text-[10px] font-bold text-gray-705 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full border border-gray-100" style={{ background: child.color }} />
                                    <span className="truncate">{child.name}</span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            <div className="h-px bg-gray-100 my-1" />
                            <button
                              onClick={() => handleAssign(row.employee_id, d, null)}
                              className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                            >
                              <span className="w-2 h-2 rounded-full bg-gray-300" />
                              Libur (-)
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View-Only Shift Reference & Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Shift References */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-[13px] font-bold text-gray-800">Daftar Referensi Waktu Shift Kerja</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {shifts.map(shift => {
              const pr = getPresetByHex(shift.color);
              return (
                <div key={shift.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-xs">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: pr.bg, borderColor: pr.border }}>
                      <Calendar size={15} style={{ color: shift.color }} />
                    </div>
                    <div>
                      <h4 className="text-[12.5px] font-bold text-gray-800 leading-tight">{shift.name}</h4>
                      <span className="text-[9px] text-gray-400 font-semibold uppercase">{shift.shift_type === 'dinas_luar' ? 'Dinas Luar' : 'Normal'}</span>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2.5">
                    {shift.children?.map(child => (
                      <div key={child.id} className="flex justify-between items-center text-[11px] py-1 px-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-500 font-semibold">{child.name}</span>
                        <span className="font-mono text-black font-bold">
                          {child.start_time.substring(0, 5)} - {child.end_time.substring(0, 5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historical Shift Proposals */}
        <div className="md:col-span-1 space-y-3">
          <h3 className="text-[13px] font-bold text-gray-800">Riwayat Usulan Terkirim</h3>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {proposals.length === 0 && (
              <div className="text-center py-8 bg-white border border-gray-100 rounded-xl text-gray-400 text-[11px]">
                Belum ada data usulan terdahulu.
              </div>
            )}
            {proposals.map(prop => (
              <div key={prop.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-xs text-[11px]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-gray-800">{prop.employee.name}</span>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    prop.status === 'approved' ? 'bg-green-50 text-green-600' : prop.status === 'rejected' ? 'bg-red-50 text-red-650' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {prop.status === 'approved' ? 'Disetujui' : prop.status === 'rejected' ? 'Ditolak' : 'Menunggu'}
                  </span>
                </div>
                <p className="text-gray-500">Hari {prop.day_of_week} · {prop.schedule ? prop.schedule.name : 'Libur (Tidak Ada Shift)'}</p>
                {prop.admin_note && (
                  <p className="mt-1 text-[10px] text-gray-450 italic">Note: {prop.admin_note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assign Massal per Departemen Modal */}
      {showDeptModal && user.pj_bagian_department_id && (
        <AssignDepartmentModal
          shifts={shifts}
          departmentId={user.pj_bagian_department_id}
          departmentName={user.pj_bagian_department || 'Departemen Anda'}
          onClose={() => setShowDeptModal(false)}
          onAssign={handleAssignDepartment}
        />
      )}
    </div>
  );
}
