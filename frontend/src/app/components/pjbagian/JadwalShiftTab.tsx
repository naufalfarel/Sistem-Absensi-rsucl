import { useState, useEffect } from 'react';
import { Sun, Sunset, Moon, Star, Zap, Users, Plus, X, Calendar as CalendarIcon, Trash2, Edit2, Check, AlertCircle } from 'lucide-react';
import { scheduleApi, employeeApi, ShiftSchedule, EmployeeWeeklySchedule } from '../../../services/api';
import { Calendar } from '../ui/calendar';

interface JadwalShiftTabProps {
  user: {
    id: number;
    name: string;
    username: string;
    nik_ktp: string;
    pj_bagian_department?: string;
    pj_bagian_department_id?: number;
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

// ── Add Shift Modal ────────────────────────────────────────────────────
function AddShiftModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: ShiftSchedule) => void }) {
  const [name, setName]       = useState('');
  const [start, setStart]     = useState('07:00');
  const [end, setEnd]         = useState('15:00');
  const [windowEnd, setWindowEnd] = useState('');
  const [icon, setIcon]       = useState<IconKey>('sun');
  const [colorId, setColorId] = useState('green');
  const [shiftType, setShiftType] = useState<'normal' | 'dinas_luar'>('normal');

  const preset = COLOR_PRESETS.find(c => c.id === colorId)!;
  const IconComp = ICON_MAP[icon].component;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      const res = await scheduleApi.create({
        name: name.trim(),
        start_time: start,
        end_time: end,
        checkin_window_end_time: windowEnd || null,
        color: preset.color,
        icon,
        shift_type: shiftType,
      } as any);
      if (res.success) {
        onAdd(res.data);
        onClose();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal membuat shift baru.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto z-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">Tambah Shift Baru</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">Isi detail shift dan lihat preview-nya</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Live Preview */}
        <div className="mb-5 p-4 rounded-2xl border-2 transition-all" style={{ background: preset.bg, borderColor: preset.border }}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border-2" style={{ background: 'white', borderColor: preset.border }}>
              <IconComp size={20} style={{ color: preset.color }} />
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: preset.color }}>{name || 'Nama Shift'}</p>
              <p className="text-[11px] text-gray-500">{ICON_MAP[icon].label}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 text-center py-2 bg-white/70 rounded-xl border" style={{ borderColor: preset.border }}>
              <p className="text-[9px] text-gray-400">Masuk</p>
              <p className="text-[16px] font-bold font-mono text-black">{start}</p>
            </div>
            <span className="self-center text-gray-300 font-bold">–</span>
            <div className="flex-1 text-center py-2 bg-white/70 rounded-xl border" style={{ borderColor: preset.border }}>
              <p className="text-[9px] text-gray-400">Pulang</p>
              <p className="text-[16px] font-bold font-mono text-black">{end}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Nama Shift</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Shift Pagi Unit"
              maxLength={40}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Jam Masuk</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Jam Pulang</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-2">Pilih Ikon</label>
            <div className="flex gap-2">
              {(Object.entries(ICON_MAP) as [IconKey, typeof ICON_MAP[IconKey]][]).map(([key, { component: Ic, emoji, label }]) => (
                <button
                  key={key}
                  onClick={() => setIcon(key)}
                  title={label}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${icon === key ? 'border-[#16A34A] bg-green-50 shadow-sm' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                >
                  <Ic size={16} style={{ color: icon === key ? preset.color : '#9CA3AF' }} />
                  <span className="text-[9px] text-gray-500">{emoji}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-2">Pilih Warna</label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setColorId(c.id)}
                  title={c.label}
                  className={`relative w-full aspect-square rounded-xl border-2 transition-all ${colorId === c.id ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c.color }}
                >
                  {colorId === c.id && (
                    <Check size={12} className="absolute inset-0 m-auto text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white transition-all bg-[#16A34A] hover:bg-[#0d9240] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus size={15} /> Tambah Shift
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ──────────────────────────────────────────
function DeleteModal({ shift, onClose, onConfirm }: { shift: ShiftSchedule; onClose: () => void; onConfirm: () => void }) {
  const pr = getPresetByHex(shift.color);
  const IconComp = ICON_MAP[shift.icon as IconKey]?.component ?? Sun;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl mx-4 z-10">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
          <Trash2 size={26} className="text-red-500" />
        </div>
        <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">Hapus Shift?</h3>
        <p className="text-[12px] text-gray-500 text-center mb-4">Shift berikut akan dihapus permanen dari sistem.</p>
        <div className="flex items-center gap-3 p-3 rounded-xl mb-5 border" style={{ background: pr.bg, borderColor: pr.border }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/70">
            <IconComp size={15} style={{ color: shift.color }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: shift.color }}>{shift.name}</p>
            <p className="text-[11px] text-gray-500">{shift.start_time.substring(0, 5)} – {shift.end_time.substring(0, 5)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors">
            Ya, Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Employee Shift Calendar Modal ────────────────────────────────
interface AssignEmployeeModalProps {
  shifts: ShiftSchedule[];
  onClose: () => void;
  onRefresh: () => void;
  pjBagianDeptId: number;
}

function AssignEmployeeCalendarModal({ shifts, onClose, onRefresh, pjBagianDeptId }: AssignEmployeeModalProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [searchEmp, setSearchEmp] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<number | 'libur'>('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await employeeApi.list();
        if (res.success) {
          // Hanya tampilkan pegawai yang didepartemennya
          const filtered = res.data.filter(e => Number(e.department_id) === Number(pjBagianDeptId));
          setEmployees(filtered);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchEmployees();
  }, [pjBagianDeptId]);

  const toggleEmployee = (id: number) => {
    setSelectedEmpIds(prev =>
      prev.includes(id) ? prev.filter(empId => empId !== id) : [...prev, id]
    );
  };

  const selectAllEmployees = () => {
    if (selectedEmpIds.length === filteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredEmployees.map(e => e.id));
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchEmp.toLowerCase())
  );

  const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const handleSubmit = async () => {
    if (selectedEmpIds.length === 0) {
      alert('Pilih minimal satu karyawan.');
      return;
    }
    if (selectedChildId === '') {
      alert('Pilih shift kerja atau Libur.');
      return;
    }
    if (selectedDates.length === 0) {
      alert('Pilih minimal satu tanggal pada kalender.');
      return;
    }

    setLoading(true);
    try {
      const targetSchedId = selectedChildId === 'libur' ? null : Number(selectedChildId);

      for (const empId of selectedEmpIds) {
        for (const d of selectedDates) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const dayVal = String(d.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${dayVal}`;

          await scheduleApi.assignEmployeeSchedule({
            employee_id: empId,
            date: dateStr,
            schedule_id: targetSchedId
          });
        }
      }

      alert('Jadwal shift berhasil ditugaskan langsung!');
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menetapkan jadwal shift.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-4xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col md:flex-row gap-6 z-10 font-sans">
        
        {/* Left Side: Employee & Shift Selector */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-bold text-gray-900">Penugasan Shift Kalender</h3>
            <button onClick={onClose} className="md:hidden p-1 hover:bg-gray-100 rounded-full">
              <X size={18} />
            </button>
          </div>

          {/* Employee search and checklist */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">1. Pilih Karyawan</label>
            <input
              type="text"
              placeholder="Cari karyawan..."
              value={searchEmp}
              onChange={e => setSearchEmp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-250 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all mb-2"
            />
            
            <div className="border border-gray-150 rounded-xl max-h-[160px] overflow-y-auto p-2 bg-white space-y-1.5">
              {filteredEmployees.length > 0 && (
                <label className="flex items-center gap-2 p-1.5 hover:bg-gray-55 rounded-lg cursor-pointer text-[12px] font-bold border-b border-gray-50 pb-2">
                  <input
                    type="checkbox"
                    checked={selectedEmpIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={selectAllEmployees}
                    className="rounded text-[#16A34A] focus:ring-[#16A34A]"
                  />
                  <span>Pilih Semua ({filteredEmployees.length})</span>
                </label>
              )}
              {filteredEmployees.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-[12px]">
                  <input
                    type="checkbox"
                    checked={selectedEmpIds.includes(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                    className="rounded text-[#16A34A] focus:ring-[#16A34A]"
                  />
                  <div>
                    <p className="font-semibold text-gray-800">{emp.name}</p>
                    <p className="text-[10px] text-gray-400">{emp.position || 'Staf'}</p>
                  </div>
                </label>
              ))}
              {filteredEmployees.length === 0 && (
                <p className="text-[11px] text-gray-450 italic text-center py-4">Tidak ada karyawan ditemukan.</p>
              )}
            </div>
            <p className="text-[10px] text-[#16A34A] font-bold mt-1">{selectedEmpIds.length} karyawan dipilih</p>
          </div>

          {/* Shift selector */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">2. Pilih Shift Kerja</label>
            <select
              value={selectedChildId}
              onChange={e => setSelectedChildId(e.target.value as any)}
              className="w-full px-3 py-2.5 border border-gray-250 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold"
            >
              <option value="">-- Pilih Shift --</option>
              <option value="libur" className="text-red-500 font-bold">Libur / OFF (-)</option>
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

          <div className="hidden md:block pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading || selectedEmpIds.length === 0 || selectedChildId === '' || selectedDates.length === 0}
              className="w-full py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-semibold rounded-xl transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Terapkan Penugasan'}
            </button>
          </div>
        </div>

        {/* Right Side: Calendar Date Picker */}
        <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 space-y-3">
          <label className="block text-[12px] font-semibold text-gray-750">3. Pilih Tanggal yang Berlaku</label>
          <p className="text-[11px] text-gray-400">Klik satu atau beberapa tanggal pada kalender di bawah untuk mengaktifkan jadwal shift.</p>
          
          <div className="flex justify-center bg-gray-50/50 p-2.5 rounded-2xl border border-gray-100">
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={dates => setSelectedDates(dates || [])}
              className="rounded-xl bg-white shadow-xs max-w-fit mx-auto border"
            />
          </div>

          {selectedDates.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
              <p className="text-[11px] font-bold text-green-800">Hari Kerja Terpilih:</p>
              <p className="text-[11px] text-green-700 mt-0.5">
                {Array.from(new Set(selectedDates.map(d => DAYS_INDO[d.getDay()]))).join(', ')}
              </p>
            </div>
          )}

          <div className="block md:hidden pt-2">
            <button
              onClick={handleSubmit}
              disabled={loading || selectedEmpIds.length === 0 || selectedChildId === '' || selectedDates.length === 0}
              className="w-full py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-semibold rounded-xl transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Terapkan Penugasan'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main JadwalShiftTab Component ──────────────────────────────────────
export function JadwalShiftTab({ user }: JadwalShiftTabProps) {
  const [shifts, setShifts]           = useState<ShiftSchedule[]>([]);
  const [employeeSchedules, setEmployeeSchedules] = useState<EmployeeWeeklySchedule[]>([]);
  const [loading, setLoading]         = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Clone Notification Modal
  const [cloneInfo, setCloneInfo]     = useState<string | null>(null);

  // Week selection states
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('');
  const [weekDates, setWeekDates] = useState<Record<string, string>>({});

  // CRUD States
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<ShiftSchedule | null>(null);
  
  // Inline edit states
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editName, setEditName]       = useState('');
  const [editStart, setEditStart]     = useState('');
  const [editEnd, setEditEnd]         = useState('');
  const [editShiftType, setEditShiftType] = useState<'normal' | 'dinas_luar'>('normal');
  const [editChildren, setEditChildren] = useState<Array<{ id?: number; name: string; start_time: string; end_time: string; checkin_window_end_time?: string }>>([]);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);

  // Popover cell assignment
  const [activeAssignCell, setActiveAssignCell] = useState<{ empId: number; date: string } | null>(null);

  const loadData = async (weekStart?: string) => {
    setLoading(true);
    try {
      const sRes = await scheduleApi.list();
      if (sRes.success) setShifts(sRes.data);

      const eRes = await scheduleApi.getEmployeeSchedules(weekStart);
      if (eRes.success) {
        setEmployeeSchedules(eRes.data);
        setCurrentWeekStart(eRes.start_date);
        setWeekDates(eRes.dates);
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

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!currentWeekStart) return;
    const date = new Date(currentWeekStart);
    if (direction === 'prev') {
      date.setDate(date.getDate() - 7);
    } else {
      date.setDate(date.getDate() + 7);
    }
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    const nextWeekStr = localDate.toISOString().split('T')[0];
    loadData(nextWeekStr);
  };

  const formattedWeekLabel = () => {
    if (!currentWeekStart) return '';
    const date = new Date(currentWeekStart);
    const end = new Date(date);
    end.setDate(end.getDate() + 6);
    
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${date.toLocaleDateString('id-ID', options)} – ${end.toLocaleDateString('id-ID', options)}`;
  };

  const handleAdd = (newShift: ShiftSchedule) => {
    setShifts(prev => [...prev, newShift]);
    loadData(); // Reload schedules mapping
  };

  const startEdit = (shift: ShiftSchedule) => {
    setEditingId(shift.id);
    setEditName(shift.name);
    setEditStart(shift.start_time ? shift.start_time.substring(0, 5) : '');
    setEditEnd(shift.end_time ? shift.end_time.substring(0, 5) : '');
    setEditShiftType(shift.shift_type ?? 'normal');
    setEditChildren(
      shift.children?.map(c => ({
        id: c.id,
        name: c.name,
        start_time: c.start_time.substring(0, 5),
        end_time: c.end_time.substring(0, 5),
        checkin_window_end_time: c.checkin_window_end_time ? c.checkin_window_end_time.substring(0, 5) : '',
      })) ?? []
    );
  };

  const handleAddEditChild = () => {
    setEditChildren(prev => [
      ...prev,
      { name: 'Sub Shift Baru', start_time: '08:00', end_time: '14:00', checkin_window_end_time: '' }
    ]);
  };

  const handleRemoveEditChild = (index: number) => {
    setEditChildren(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateEditChild = (index: number, field: 'name' | 'start_time' | 'end_time' | 'checkin_window_end_time', value: string) => {
    setEditChildren(prev =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const saveEdit = async (id: number) => {
    try {
      const payload: any = { 
        name: editName, 
        shift_type: editShiftType,
        children: editChildren
      };
      if (editStart) payload.start_time = editStart;
      if (editEnd) payload.end_time = editEnd;
      
      const res = await scheduleApi.update(id, payload);
      if (res.success) {
        // Cek apakah diduplikasi/clone
        if ((res as any).cloned) {
          setCloneInfo((res as any).message);
          // Reload all data karena ada shift baru dan mapping pegawai sudah berpindah
          loadData();
        } else {
          setShifts(prev => prev.map(s => s.id === id ? res.data : s));
          loadData();
        }
        setEditingId(null);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memperbarui shift.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await scheduleApi.delete(id);
      if (res.success) {
        setShifts(prev => prev.filter(s => s.id !== id));
        setDeleteTarget(null);
        loadData();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus shift.');
    }
  };

  const handleAssign = async (employeeId: number, dateStr: string, scheduleId: number | null) => {
    try {
      const res = await scheduleApi.assignEmployeeSchedule({
        employee_id: employeeId,
        date: dateStr,
        schedule_id: scheduleId
      });
      if (res.success) {
        loadData(currentWeekStart);
        setActiveAssignCell(null);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menugaskan shift.');
    }
  };

  const handleRemoveEmployeeFromShift = async (employeeId: number, dates: string[]) => {
    if (!confirm('Apakah Anda yakin ingin menghapus penugasan shift untuk karyawan ini?')) return;
    try {
      for (const dateStr of dates) {
        await scheduleApi.assignEmployeeSchedule({
          employee_id: employeeId,
          date: dateStr,
          schedule_id: null
        });
      }
      loadData(currentWeekStart);
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus penugasan.');
    }
  };


  const totalDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const filteredShifts = shifts.filter(shift => {
    if (!searchQuery.trim()) return true;
    return shift.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredEmployeeSchedules = employeeSchedules.filter(row => {
    if (!searchQuery.trim()) return true;
    return row.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getShiftInitials = (name: string) => name.trim().charAt(0).toUpperCase();

  const getShiftColors = (colorHex: string) => {
    const pr = COLOR_PRESETS.find(c => c.color.toLowerCase() === colorHex.toLowerCase());
    if (pr) return { bg: pr.bg, text: pr.color };
    return { bg: `${colorHex}15`, text: colorHex };
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 font-sans">
      {activeAssignCell && (
        <div className="fixed inset-0 z-20" onClick={() => setActiveAssignCell(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Pengelolaan Jadwal Shift Unit</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Atur jadwal shift dan penugasan karyawan Departemen {user.pj_bagian_department || 'Unit Kerja'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-green-50 border border-green-200 hover:bg-green-100 text-[#16A34A] text-[13px] font-semibold rounded-xl transition-all shadow-xs active:scale-95 whitespace-nowrap"
          >
            <CalendarIcon size={15} /> Tugaskan per Kalender
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-semibold rounded-xl transition-all shadow-sm shadow-green-200 active:scale-95"
          >
            <Plus size={15} /> Tambah Shift Baru
          </button>
        </div>
      </div>

      {/* Clone Warning Banner */}
      {cloneInfo && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-xs">
          <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[12.5px] font-bold text-amber-800">Perhatian: Shift Diduplikasi Otomatis</p>
            <p className="text-[11.5px] text-amber-700 mt-0.5">{cloneInfo}</p>
          </div>
          <button onClick={() => setCloneInfo(null)} className="text-amber-550 hover:text-amber-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search Filter */}
      <div className="relative">
        <input
          type="text"
          placeholder="Cari shift atau nama pegawai..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[12px] font-semibold"
          >
            Batal
          </button>
        )}
      </div>

      {/* Shift Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && shifts.length === 0 && (
          <div className="col-span-2 text-center py-5 text-gray-400 text-[12px]">Memuat template shift...</div>
        )}
        {!loading && filteredShifts.length === 0 && (
          <div className="col-span-2 text-center py-8 text-gray-400 text-[12px] bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            Belum ada shift diatur untuk departemen Anda.
          </div>
        )}

        {filteredShifts.map(shift => {
          const IconComp = ICON_MAP[shift.icon as IconKey]?.component ?? Sun;
          const pr = getPresetByHex(shift.color);
          const isExpanded = expandedShift === shift.id;
          const isOwned = shift.owner_department_id !== null;

          return (
            <div key={shift.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group">
              <div className="p-4 border-b border-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: pr.bg, border: `1.5px solid ${pr.border}` }}>
                      <IconComp size={17} style={{ color: shift.color }} />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-gray-800 leading-tight">{shift.name}</p>
                      <div className="flex gap-1.5 mt-1 items-center">
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${shift.shift_type === 'dinas_luar' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {shift.shift_type === 'dinas_luar' ? 'Dinas Luar' : 'Normal'}
                        </span>
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${isOwned ? 'bg-green-150 text-green-800' : 'bg-gray-150 text-gray-500'}`}>
                          {isOwned ? 'Khusus Unit' : 'Umum'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Only editable/deletable if owned by this dept OR general template which will be cloned on edit) */}
                  <div className="flex items-center gap-1">
                    {/* Delete button (Only if owned by this department) */}
                    {editingId !== shift.id && shift.owner_department_id === user.pj_bagian_department_id && (
                      <button
                        onClick={() => setDeleteTarget(shift)}
                        className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                        title="Hapus shift unit"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    )}
                    {/* Edit / Save-Cancel buttons */}
                    {editingId !== shift.id ? (
                      <button onClick={() => startEdit(shift)} className="w-7 h-7 rounded-lg bg-gray-55 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors">
                        <Edit2 size={13} className="text-gray-400" />
                      </button>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => saveEdit(shift.id)} className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center hover:bg-green-100 transition-colors">
                          <Check size={13} className="text-[#16A34A]" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors">
                          <X size={13} className="text-gray-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {editingId === shift.id ? (
                  <div className="space-y-3 font-sans">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Nama Shift Utama</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all" />
                    </div>


                    <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Sub-Waktu Kerja</span>
                        <button
                          type="button"
                          onClick={handleAddEditChild}
                          className="px-2 py-1 bg-green-50 border border-green-100 hover:bg-green-100 text-[#16A34A] text-[10px] font-bold rounded-lg transition-all"
                        >
                          + Tambah Waktu
                        </button>
                      </div>

                      {editChildren.map((child, index) => (
                        <div key={index} className="flex flex-col gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200/50">
                          <div className="flex gap-2 items-center">
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                placeholder="Nama sub-shift"
                                value={child.name}
                                onChange={e => handleUpdateEditChild(index, 'name', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-200 rounded-lg text-[11.5px] bg-white focus:outline-none focus:border-[#16A34A]"
                              />
                            </div>
                            <div className="flex gap-1 items-center">
                              <input
                                type="time"
                                value={child.start_time}
                                onChange={e => handleUpdateEditChild(index, 'start_time', e.target.value)}
                                className="px-1.5 py-1 border border-gray-200 rounded-lg text-[11.5px] font-mono bg-white focus:outline-none focus:border-[#16A34A]"
                              />
                              <span className="text-gray-400 text-[10px]">-</span>
                              <input
                                type="time"
                                value={child.end_time}
                                onChange={e => handleUpdateEditChild(index, 'end_time', e.target.value)}
                                className="px-1.5 py-1 border border-gray-200 rounded-lg text-[11.5px] font-mono bg-white focus:outline-none focus:border-[#16A34A]"
                              />
                            </div>
                            {editChildren.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveEditChild(index)}
                                className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                                title="Hapus sub-shift"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 mt-1 font-sans">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Daftar Sub-Waktu</p>
                    {shift.children && shift.children.length > 0 ? (
                      shift.children.map(child => (
                        <div key={child.id} className="flex justify-between items-center text-[12px] py-1.5 px-3 rounded-xl bg-gray-50 border border-gray-100/50 font-medium">
                          <span className="text-gray-600 text-[11px] truncate max-w-[150px]">{child.name}</span>
                          <span className="font-mono text-black font-semibold bg-white border border-gray-100 px-2 py-0.5 rounded-lg text-[11px]">
                            {child.start_time.substring(0, 5)} – {child.end_time.substring(0, 5)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Belum ada sub-waktu diatur.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Employees Assigned */}
              <button onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-gray-400" />
                  <span className="text-[12px] text-gray-550">{shift.employees_count || 0} karyawan ditugaskan</span>
                </div>
                <span className="text-[11px] text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div className="p-4 bg-gray-50/50 space-y-3 font-sans">
                  <div className="space-y-2">
                    {(() => {
                      const distinctEmployees = Array.from(
                        new Map(
                          shift.children?.flatMap(child => child.employees ?? [])?.map(emp => [emp.id, emp]) ?? []
                        ).values()
                      );

                      if (distinctEmployees.length === 0) {
                        return <p className="text-[11px] text-gray-400 text-center py-2">Belum ada karyawan ditugaskan di shift ini.</p>;
                      }

                      return distinctEmployees.map(emp => {
                        const days = shift.children?.flatMap(child => 
                          child.employees
                            ?.filter(e => e.id === emp.id && (e.pivot?.date || e.pivot?.day_of_week))
                            .map(e => {
                              const label = e.pivot?.date ? e.pivot.date : e.pivot?.day_of_week;
                              return `${label} (${child.name.split(' ')[0]})`;
                            }) ?? []
                        ) ?? [];

                        const removeTargets = shift.children?.flatMap(child => 
                          child.employees
                            ?.filter(e => e.id === emp.id)
                            .map(e => e.pivot?.date || (e.pivot?.day_of_week as string)) ?? []
                        ) ?? [];

                        return (
                          <div key={emp.id} className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-gray-100 shadow-xs">
                            <div>
                              <p className="text-[12.5px] font-bold text-gray-800">{emp.user?.name}</p>
                              <p className="text-[10px] text-gray-450">{days.join(', ')}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveEmployeeFromShift(emp.id, removeTargets)}
                              className="text-[11px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Lepas
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Employee Weekly Matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/10">
          <div>
            <p className="text-[14px] font-semibold text-gray-800">Matriks Jadwal Mingguan Staf</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Klik sel hari kerja staf untuk mengubah atau menetapkan jadwal shift kerja dinas.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-1 px-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-gray-600 bg-white text-[13px] font-bold"
              title="Minggu Sebelumnya"
            >
              &larr;
            </button>
            <span className="text-[12.5px] font-bold text-gray-700 bg-gray-50 border px-3.5 py-1.5 rounded-xl font-mono">
              {formattedWeekLabel()}
            </span>
            <button
              onClick={() => navigateWeek('next')}
              className="p-1 px-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-gray-600 bg-white text-[13px] font-bold"
              title="Minggu Berikutnya"
            >
              &rarr;
            </button>
          </div>
        </div>
        <div className="overflow-x-auto pb-4">
          <table className="w-full text-[13px] font-sans">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Karyawan</th>
                {totalDays.map(d => {
                  const dateVal = weekDates[d];
                  let dateLabel = '';
                  if (dateVal) {
                    const parts = dateVal.split('-');
                    dateLabel = `${parts[2]}/${parts[1]}`;
                  }
                  return (
                    <th key={d} className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <div className="flex flex-col">
                        <span>{d}</span>
                        {dateLabel && <span className="text-[9px] text-gray-400 font-mono font-medium mt-0.5">{dateLabel}</span>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredEmployeeSchedules.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-gray-800 whitespace-nowrap">{row.name}</td>
                  {totalDays.map((d, j) => {
                    const dateVal = weekDates[d] || d;
                    const assigned = row.schedules[dateVal];
                    const sc = assigned ? getShiftColors(assigned.color) : { bg: '#F9FAFB', text: '#9CA3AF' };
                    const initial = assigned ? getShiftInitials(assigned.name) : '-';
                    const active = activeAssignCell?.empId === row.employee_id && activeAssignCell?.date === dateVal;

                    return (
                      <td key={j} className="px-3 py-3 text-center relative">
                        <button
                          onClick={() => setActiveAssignCell(active ? null : { empId: row.employee_id, date: dateVal })}
                          className="inline-block text-[11px] font-bold px-3 py-1 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-xs border border-transparent hover:border-gray-200"
                          style={{ background: sc.bg, color: sc.text }}
                          title={assigned ? `${assigned.name} (Klik untuk ganti)` : 'Libur (Klik untuk set)'}
                        >
                          {initial}
                        </button>

                        {active && (
                          <div className={`absolute left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 min-w-[170px] text-left max-h-[300px] overflow-y-auto ${
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
                                    onClick={() => handleAssign(row.employee_id, dateVal, child.id)}
                                    className="w-full text-left px-4 py-1.5 text-[10.5px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <span className="w-2 h-2 rounded-full border border-gray-100" style={{ background: child.color }} />
                                    <span className="truncate">{child.name}</span>
                                  </button>
                                ))}
                              </div>
                            ))}
                            <div className="h-px bg-gray-100 my-1" />
                            <button
                              onClick={() => handleAssign(row.employee_id, dateVal, null)}
                              className="w-full text-left px-3 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                              Libur (-)
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredEmployeeSchedules.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-gray-450 italic">Tidak ada karyawan di unit Anda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && <AddShiftModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} />}
      {showAssignModal && user.pj_bagian_department_id && (
        <AssignEmployeeCalendarModal
          shifts={shifts}
          pjBagianDeptId={user.pj_bagian_department_id}
          onClose={() => setShowAssignModal(false)}
          onRefresh={loadData}
        />
      )}
      {deleteTarget && <DeleteModal shift={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => handleDelete(deleteTarget.id)} />}
    </div>
  );
}
