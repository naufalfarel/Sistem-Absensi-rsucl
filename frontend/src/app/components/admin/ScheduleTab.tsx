import { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Sunset, Moon, Edit2, Check, X, Plus, Users, Trash2, Star, Zap, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, Save, Coffee, FileText } from 'lucide-react';
import { scheduleApi, employeeApi, ShiftSchedule, EmployeeWeeklySchedule, EmployeeMonthlySchedule } from '../../../services/api';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import rsLogoImg from '../../../imports/rsucl_wide_logo.png';
import logoRsucl2019 from '../../../imports/logo_rsucl_2019.png';
import { useAuth } from '../../../context/AuthContext';

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
interface SubShiftEntry {
  id: string; // local temp key
  name: string;
  start: string;
  end: string;
}

function AddShiftModal({ onClose, onAdd, departments }: { onClose: () => void; onAdd: (s: ShiftSchedule) => void; departments: any[] }) {
  const [name, setName]       = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [icon, setIcon]       = useState<IconKey>('sun');
  const [colorId, setColorId] = useState('amber');
  const [shiftType, setShiftType] = useState<'normal' | 'dinas_luar'>('normal');
  const [ownerDeptId, setOwnerDeptId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  // Sub-shifts state — default 1 sub-shift terisi sebagai 'Normal'
  const [subShifts, setSubShifts] = useState<SubShiftEntry[]>([
    { id: 'initial', name: 'Normal', start: '08:00', end: '14:00' },
  ]);

  const addSubShift = () => {
    const lastSub = subShifts[subShifts.length - 1];
    const nextStart = lastSub ? lastSub.start : '08:00';
    const nextEnd = lastSub ? lastSub.end : '14:00';
    setSubShifts(prev => [...prev, { id: Date.now().toString(), name: '', start: nextStart, end: nextEnd }]);
  };
  const removeSubShift = (id: string) => {
    setSubShifts(prev => prev.filter(s => s.id !== id));
  };
  const updateSubShift = (id: string, field: keyof SubShiftEntry, value: string) => {
    setSubShifts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const preset = COLOR_PRESETS.find(c => c.id === colorId)!;
  const IconComp = ICON_MAP[icon].component;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (subShifts.length === 0) {
      alert("Harus ada minimal 1 sub-waktu shift.");
      return;
    }
    const hasEmptyName = subShifts.some(s => !s.name.trim());
    if (hasEmptyName) {
      alert("Nama semua sub-waktu shift harus diisi.");
      return;
    }

    setLoading(true);
    try {
      const filledChildren = subShifts.map(s => ({
        name: s.name.trim(),
        start_time: s.start,
        end_time: s.end
      }));

      const res = await scheduleApi.create({
        name: name.trim(),
        start_time: subShifts[0].start,
        end_time: subShifts[0].end,
        checkin_window_end_time: windowEnd || null,
        color: preset.color,
        icon,
        shift_type: shiftType,
        owner_department_id: ownerDeptId === '' ? null : Number(ownerDeptId),
        children: filledChildren,
      } as any);
      if (res.success) {
        onAdd(res.data);
        onClose();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal membuat shift baru.');
    } finally {
      setLoading(false);
    }
  };

  const previewStart = subShifts[0]?.start ?? '08:00';
  const previewEnd = subShifts[0]?.end ?? '14:00';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
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
              <p className="text-[16px] font-bold font-mono text-black">{previewStart}</p>
            </div>
            <span className="self-center text-gray-300 font-bold">–</span>
            <div className="flex-1 text-center py-2 bg-white/70 rounded-xl border" style={{ borderColor: preset.border }}>
              <p className="text-[9px] text-gray-400">Pulang</p>
              <p className="text-[16px] font-bold font-mono text-black">{previewEnd}</p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Nama Shift (Template)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Shift Pagi"
              maxLength={40}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
            />
          </div>

          {/* ── Sub-Waktu Shift ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-[12px] font-semibold text-gray-700">Sub-Waktu Shift</label>
                <p className="text-[10px] text-gray-400 mt-0.5">Varian waktu yang dapat ditugaskan ke karyawan</p>
              </div>
              <button
                type="button"
                onClick={addSubShift}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg text-[11px] font-semibold text-[#16A34A] hover:bg-green-100 transition-colors"
              >
                <Plus size={12} /> Tambah
              </button>
            </div>

            <div className="space-y-2">
              {subShifts.map((ss, idx) => (
                <div
                  key={ss.id}
                  className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                >
                  <div className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-gray-200 text-[9px] font-bold text-gray-500 flex-shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={ss.name}
                    onChange={e => updateSubShift(ss.id, 'name', e.target.value)}
                    placeholder="Nama sub-shift"
                    maxLength={60}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-[12px] bg-white focus:outline-none focus:border-[#16A34A] min-w-0"
                  />
                  <input
                    type="time"
                    value={ss.start}
                    onChange={e => updateSubShift(ss.id, 'start', e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-mono bg-white focus:outline-none focus:border-[#16A34A] w-[90px]"
                  />
                  <span className="text-gray-300 text-[10px] flex-shrink-0">–</span>
                  <input
                    type="time"
                    value={ss.end}
                    onChange={e => updateSubShift(ss.id, 'end', e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-mono bg-white focus:outline-none focus:border-[#16A34A] w-[90px]"
                  />
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeSubShift(ss.id)}
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:bg-red-100 transition-colors flex-shrink-0"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              💡 Sub-waktu yang namanya dikosongkan tidak akan disimpan.
            </p>
          </div>

          {/* Tipe Shift */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Tipe Shift</label>
            <select
              value={shiftType}
              onChange={e => setShiftType(e.target.value as 'normal' | 'dinas_luar')}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all cursor-pointer"
            >
              <option value="normal">Normal (GPS Wajib)</option>
              <option value="dinas_luar">Dinas Luar (GPS Opsional)</option>
            </select>
          </div>

          {/* Unit Kerja Pemilik */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Unit Kerja Pemilik Shift</label>
            <select
              value={ownerDeptId}
              onChange={e => setOwnerDeptId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all cursor-pointer font-semibold"
            >
              <option value="">Office (Bisa Diakses Semua Unit)</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Batas Akhir Jendela Absen */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Batas Akhir Jendela Absen (Check-in Limit) - Opsional
            </label>
            <input
              type="time"
              value={windowEnd}
              onChange={e => setWindowEnd(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Batas akhir jam absensi check-in untuk shift ini. Jika dikosongkan, batas diset otomatis ke setengah durasi shift.
            </p>
          </div>

          {/* Icon Picker */}
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

          {/* Color Picker */}
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
            <p className="text-[11px] text-gray-400 mt-1.5">Dipilih: <span className="font-semibold" style={{ color: preset.color }}>{COLOR_PRESETS.find(c => c.id === colorId)?.label}</span></p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white transition-all bg-[#16A34A] hover:bg-[#0d9240] shadow-sm shadow-green-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {loading ? 'Menyimpan...' : 'Tambah Shift'}
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
      <div className="relative bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl mx-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
          <Trash2 size={26} className="text-red-500" />
        </div>
        <h3 className="text-[15px] font-bold text-gray-900 text-center mb-1">Hapus Shift?</h3>
        <p className="text-[12px] text-gray-500 text-center mb-4">Shift berikut akan dihapus permanen dari sistem.</p>
        {/* Shift preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl mb-5 border" style={{ background: pr.bg, borderColor: pr.border }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/70">
            <IconComp size={15} style={{ color: shift.color }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: shift.color }}>{shift.name}</p>
            <p className="text-[11px] text-gray-500">
              {shift.start_time ? shift.start_time.substring(0, 5) : "--:--"} – {shift.end_time ? shift.end_time.substring(0, 5) : "--:--"}
            </p>
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

// ── Add Employee To Shift Modal ─────────────────────────────────────────
function AddEmployeeToShiftModal({
  parentShift,
  onClose,
  onAssign,
}: {
  parentShift: ShiftSchedule;
  onClose: () => void;
  onAssign: (empId: number, day: string, childScheduleId: number) => Promise<void>;
}) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number | ''>('');
  const [selectedDay, setSelectedDay] = useState<string>('Senin');
  const [selectedChildId, setSelectedChildId] = useState<number>(
    parentShift.children?.[0]?.id ?? parentShift.id
  );
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await employeeApi.list();
        if (res.success) {
          setEmployees(res.data);
          if (res.data.length > 0) {
            setSelectedEmpId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchEmployees();
  }, []);

  const handleSubmit = async () => {
    if (selectedEmpId === '' || !selectedChildId) return;
    setLoading(true);
    try {
      if (selectedDay === 'Semua Hari') {
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        for (const day of days) {
          await onAssign(Number(selectedEmpId), day, selectedChildId);
        }
      } else if (selectedDay === 'Senin - Sabtu') {
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        for (const day of days) {
          await onAssign(Number(selectedEmpId), day, selectedChildId);
        }
      } else {
        await onAssign(Number(selectedEmpId), selectedDay, selectedChildId);
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
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h3 className="text-[15px] font-bold text-gray-900 mb-4 font-sans">Tambah Karyawan ke Shift</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5 font-sans">Pilih Karyawan</label>
            <select
              value={selectedEmpId}
              onChange={e => setSelectedEmpId(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all font-sans"
            >
              {employees.length === 0 && <option value="">Memuat data karyawan...</option>}
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.department || 'Tanpa Dept'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5 font-sans">Pilih Hari Kerja</label>
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all font-sans"
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
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5 font-sans">Pilih Sub-Waktu Shift</label>
            <select
              value={selectedChildId}
              onChange={e => setSelectedChildId(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all font-sans"
            >
              {parentShift.children?.map(child => (
                <option key={child.id} value={child.id}>
                  {child.name} ({child.start_time.substring(0, 5)} - {child.end_time.substring(0, 5)})
                </option>
              )) ?? <option value={parentShift.id}>{parentShift.name}</option>}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors font-sans"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedEmpId === ''}
            className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors font-sans"
          >
            {loading ? 'Menyimpan...' : 'Tambahkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Department Modal ─────────────────────────────────────────
function AssignDepartmentModal({
  shifts,
  onClose,
  onAssign,
}: {
  shifts: ShiftSchedule[];
  onClose: () => void;
  onAssign: (deptId: number, day: string, scheduleId: number | null) => Promise<void>;
}) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | ''>('');
  const [selectedDay, setSelectedDay] = useState<string>('Senin');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await fetch('/api/departments', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('rsucl-token') || ''}`
          }
        });
        const json = await res.json();
        if (json.success) {
          setDepartments(json.data);
          if (json.data.length > 0) {
            setSelectedDeptId(json.data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchDepts();
  }, []);

  const handleSubmit = async () => {
    if (selectedDeptId === '') return;
    setLoading(true);
    try {
      if (selectedScheduleId === 'lj') {
        let foundShift = shifts.find(s => s.name.toLowerCase().includes('libur jaga') || s.name.toUpperCase() === 'LJ');
        if (!foundShift) {
          const createRes = await scheduleApi.create({
            name: 'Libur Jaga (LJ)',
            start_time: '00:00',
            end_time: '00:00',
            color: '#475569',
            icon: 'moon',
            shift_type: 'normal',
          } as any);
          if (createRes.success) {
            foundShift = createRes.data;
          }
        }
        const schedId = foundShift ? foundShift.id : null;
        if (selectedDay === 'Semua Hari') {
          const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
          for (const day of days) { await onAssign(Number(selectedDeptId), day, schedId); }
        } else if (selectedDay === 'Senin - Sabtu') {
          const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          for (const day of days) { await onAssign(Number(selectedDeptId), day, schedId); }
        } else {
          await onAssign(Number(selectedDeptId), selectedDay, schedId);
        }
      } else {
        const schedId = selectedScheduleId === '' ? null : Number(selectedScheduleId);
        if (selectedDay === 'Semua Hari') {
          const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
          for (const day of days) {
            await onAssign(Number(selectedDeptId), day, schedId);
          }
        } else if (selectedDay === 'Senin - Sabtu') {
          const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          for (const day of days) {
            await onAssign(Number(selectedDeptId), day, schedId);
          }
        } else {
          await onAssign(Number(selectedDeptId), selectedDay, schedId);
        }
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
        <h3 className="text-[15px] font-bold text-gray-900 mb-4">Penugasan Shift Massal per Unit Kerja</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Pilih Unit Kerja</label>
            <select
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer"
            >
              {departments.length === 0 && <option value="">Memuat data unit kerja...</option>}
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Pilih Hari Kerja</label>
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer"
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
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Pilih Shift Kerja</label>
            <select
              value={selectedScheduleId}
              onChange={e => setSelectedScheduleId(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer"
            >
              <option value="">Libur (Off)</option>
              <option value="lj">Libur Jaga (LJ)</option>
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

        <div className="flex gap-2 mt-6 font-sans">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedDeptId === ''}
            className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors"
          >
            {loading ? 'Menyimpan...' : 'Tugaskan Massal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ScheduleTab ───────────────────────────────────────────────────
/**
 * Komponen Tab Penjadwalan Admin (ScheduleTab) — Sistem Absensi RSUCL
 * 
 * Halaman modul pengelolaan jadwal kerja shift karyawan RSUCL.
 * Dilengkapi dengan alur pembuatan shift kerja baru (custom nama, jam mulai/selesai, ikon lucide, dan warna preset),
 * visualisasi tabel matriks mingguan (Senin-Minggu) status shift karyawan, dan popover untuk mengubah/libur shift secara langsung.
 */
export function ScheduleTab() {
  const { logoUrl } = useAuth();
  // Daftar shift yang terdaftar di database
  const [shifts, setShifts]           = useState<ShiftSchedule[]>([]);
  
  // Data rekap jadwal mingguan per karyawan
  const [employeeSchedules, setEmployeeSchedules] = useState<EmployeeWeeklySchedule[]>([]);
  
  // Id shift yang sedang diedit sebaris (inline editing)
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editName, setEditName]       = useState('');
  const [editStart, setEditStart]     = useState('');
  const [editEnd, setEditEnd]         = useState('');
  const [editShiftType, setEditShiftType] = useState<'normal' | 'dinas_luar'>('normal');
  const [editOwnerDeptId, setEditOwnerDeptId] = useState<number | ''>('');
  
  // State untuk menyimpan daftar sub-shift (children) yang sedang diedit
  const [editChildren, setEditChildren] = useState<Array<{ id?: number; name: string; start_time: string; end_time: string; checkin_window_end_time?: string }>>([]);
  
  // Id shift yang dibuka daftar detail karyawannya
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  
  // Pengontrol dialog tambah shift baru
  const [showAddModal, setShowAddModal]   = useState(false);
  // Pengontrol dialog penugasan massal per departemen
  const [showDeptModal, setShowDeptModal] = useState(false);
  
  // Objek shift yang ditargetkan untuk dihapus
  const [deleteTarget, setDeleteTarget]   = useState<ShiftSchedule | null>(null);
  
  // Indikator loading memuat API
  const [loading, setLoading]         = useState(false);

  // States untuk modal menambah karyawan ke dalam penugasan shift
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [assigningShiftId, setAssigningShiftId] = useState<number | null>(null);

  // Sel koordinat (karyawan, hari) penugasan shift popover yang sedang aktif
  const [activeAssignCell, setActiveAssignCell] = useState<{ empId: number; day: string } | null>(null);

  // State untuk pencarian/filter kartu shift
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // ── Kalender Bulanan ────────────────────────────────────────────────
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [daysInMonth, setDaysInMonth] = useState(0);
  const [monthlyData, setMonthlyData] = useState<EmployeeMonthlySchedule[]>([]);
  const [calDeptFilter, setCalDeptFilter] = useState<string>('all');
  const [calLoading, setCalLoading] = useState(false);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [calPendingChanges, setCalPendingChanges] = useState<Record<string, { employee_id: number; work_date: string; schedule_id: number | null }>>({});
  const [calSavingAll, setCalSavingAll] = useState(false);
  const [calSuccessMsg, setCalSuccessMsg] = useState('');
  const [calPopover, setCalPopover] = useState<{ empId: number; dateStr: string; x: number; y: number } | null>(null);
  const calTableRef = useRef<HTMLDivElement>(null);

  const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const DAY_ABBR = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

  const today_str = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  /**
   * Menarik seluruh daftar template shift dari API.
   */
  const loadShifts = async () => {
    setLoading(true);
    try {
      const res = await scheduleApi.list();
      if (res.success) {
        setShifts(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Menarik data penugasan mingguan lengkap per karyawan dari API.
   */
  const loadEmployeeSchedules = async () => {
    try {
      const res = await scheduleApi.getEmployeeSchedules();
      if (res.success) {
        setEmployeeSchedules(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await fetch('/api/departments', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('rsucl_token') || localStorage.getItem('rsucl-token') || ''}`
        }
      });
      const json = await res.json();
      if (json.success) {
        setDepartments(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Muat shift dan penugasan saat halaman terpasang di DOM
  useEffect(() => {
    loadShifts();
    loadEmployeeSchedules();
    loadDepartments();
  }, []);

  // Load kalender bulanan saat bulan/tahun/dept berubah
  const loadMonthlyCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const deptId = calDeptFilter !== 'all' ? Number(calDeptFilter) : undefined;
      const res = await scheduleApi.getMonthlySchedule(viewYear, viewMonth, deptId);
      if (res.success) {
        setMonthlyData(res.data);
        setDaysInMonth(res.days);
        setHolidays(res.holidays || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalLoading(false);
    }
  }, [viewYear, viewMonth, calDeptFilter]);

  useEffect(() => { loadMonthlyCalendar(); }, [loadMonthlyCalendar]);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  const getDayHeaderStyle = (dow: number, isHoliday?: boolean) => {
    if (dow === 0 || isHoliday) return { color: '#E11D48', fontWeight: 700 };
    return { color: '#374151', fontWeight: 500 };
  };

  const handleCalCellClick = (e: React.MouseEvent, empId: number, dateStr: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCalPopover({ empId, dateStr, x: rect.left, y: rect.bottom + 4 });
  };

  // Simpan pilihan ke draft pending changes (tanpa auto save instan)
  const handleCalAssign = (scheduleId: number | null) => {
    if (!calPopover) return;
    const { empId, dateStr } = calPopover;
    setCalPopover(null);

    const changeKey = `${empId}-${dateStr}`;
    setCalPendingChanges(prev => ({
      ...prev,
      [changeKey]: { employee_id: empId, work_date: dateStr, schedule_id: scheduleId }
    }));

    // Optimistic update
    setMonthlyData(prev => prev.map(row => {
      if (row.employee_id !== empId) return row;
      const newDates = { ...row.dates };
      if (scheduleId === null) {
        delete newDates[dateStr];
      } else {
        let schedInfo: any = null;
        for (const s of shifts) {
          if (s.id === scheduleId) { schedInfo = s; break; }
          for (const c of (s.children ?? [])) {
            if (c.id === scheduleId) { schedInfo = c; break; }
          }
          if (schedInfo) break;
        }
        if (schedInfo) {
          newDates[dateStr] = { schedule_id: scheduleId, name: schedInfo.name, color: schedInfo.color, icon: schedInfo.icon, shift_type: schedInfo.shift_type, start_time: schedInfo.start_time?.substring(0,5), end_time: schedInfo.end_time?.substring(0,5) };
        }
      }
      return { ...row, dates: newDates };
    }));
  };

  // Simpan seluruh draft perubahan sekaligus ke backend
  const handleCalSaveAllPending = async () => {
    const assignments = Object.values(calPendingChanges);
    if (assignments.length === 0) return;
    setCalSavingAll(true);
    try {
      const res = await scheduleApi.assignBulkByDate(assignments);
      if (res.success) {
        setCalPendingChanges({});
        setCalSuccessMsg(`Berhasil menyimpan ${assignments.length} perubahan jadwal shift!`);
        setTimeout(() => setCalSuccessMsg(''), 4000);
        loadMonthlyCalendar();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menyimpan perubahan jadwal.');
    } finally {
      setCalSavingAll(false);
    }
  };

  // Batal seluruh draft perubahan
  const handleCalCancelPending = () => {
    setCalPendingChanges({});
    loadMonthlyCalendar();
  };

  const getShiftBadge = (name: string) => {
    const u = name.toUpperCase();
    if (u.includes('LIBUR JAGA') || u === 'LJ') return 'LJ';
    if (u.includes('CUTI')) return 'C';
    if (u.includes('SAKIT')) return 'SK';
    if (u.includes('DINAS') || u.includes('TUGAS')) return 'DL';
    if (u.includes('IZIN')) return 'IZ';
    if (u.includes('PAGI')) return 'P';
    if (u.includes('SIANG')) return 'S';
    if (u.includes('MALAM')) return 'M';
    if (u.includes('SORE')) return 'Sr';
    return name.trim().charAt(0).toUpperCase();
  };

  const startEdit = (shift: ShiftSchedule) => {
    setEditingId(shift.id);
    setEditName(shift.name);
    setEditStart(shift.start_time ? shift.start_time.substring(0, 5) : '');
    setEditEnd(shift.end_time ? shift.end_time.substring(0, 5) : '');
    setEditShiftType(shift.shift_type ?? 'normal');
    setEditOwnerDeptId(shift.owner_department_id ?? '');
    
    // Inisialisasi daftar sub-shift untuk proses edit
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

  const saveEdit  = async (id: number) => {
    try {
      const payload: any = { 
        name: editName, 
        shift_type: editShiftType,
        owner_department_id: editOwnerDeptId === '' ? null : Number(editOwnerDeptId),
        children: editChildren
      };
      if (editStart) payload.start_time = editStart;
      if (editEnd) payload.end_time = editEnd;
      
      const res = await scheduleApi.update(id, payload);
      if (res.success) {
        setShifts(prev => prev.map(s => s.id === id ? res.data : s));
        setEditingId(null);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memperbarui shift.');
    }
  };

  const handleAdd = (shift: ShiftSchedule) => {
    setShifts(prev => [...prev, shift]);
    loadEmployeeSchedules();
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await scheduleApi.delete(id);
      if (res.success) {
        setShifts(prev => prev.filter(s => s.id !== id));
        setDeleteTarget(null);
        loadEmployeeSchedules();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus shift.');
    }
  };

  const handleAssign = async (employeeId: number, day: string, scheduleId: number | null) => {
    try {
      const res = await scheduleApi.assignEmployeeSchedule(employeeId, day, scheduleId);
      if (res.success) {
        loadEmployeeSchedules();
        loadShifts(); // Update counters on cards
        setActiveAssignCell(null);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menugaskan shift.');
    }
  };

  const handleAssignDepartment = async (departmentId: number, day: string, scheduleId: number | null) => {
    try {
      const res = await scheduleApi.assignDepartmentSchedule(departmentId, day, scheduleId);
      if (res.success) {
        loadEmployeeSchedules();
        loadShifts(); // Update counters on cards
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menugaskan shift per unit kerja.');
    }
  };

  const handleRemoveEmployeeFromShift = async (employeeId: number, days: string[]) => {
    if (!confirm('Apakah Anda yakin ingin menghapus penugasan shift untuk karyawan ini?')) return;
    try {
      for (const day of days) {
        await scheduleApi.assignEmployeeSchedule(employeeId, day, null);
      }
      loadShifts();
      loadEmployeeSchedules();
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus penugasan.');
    }
  };

  const totalDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  // Logic untuk menyaring data shift berdasarkan search query (Nama atau Departemen) dan filter departemen pemilik
  const filteredShifts = shifts.filter(shift => {
    if (selectedDeptFilter !== 'all') {
      if (selectedDeptFilter === 'umum') {
        if (shift.owner_department_id !== null) return false;
      } else {
        if (Number(shift.owner_department_id) !== Number(selectedDeptFilter)) return false;
      }
    }

    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    const nameMatch = shift.name.toLowerCase().includes(query);
    const deptMatch = shift.children?.some(child => 
      child.employees?.some(emp => 
        emp.department?.name?.toLowerCase().includes(query)
      )
    ) ?? false;
    
    return nameMatch || deptMatch;
  });

  const getShiftInitials = (name: string) => {
    return name.trim().charAt(0).toUpperCase();
  };

  const getShiftColors = (colorHex: string) => {
    const pr = COLOR_PRESETS.find(c => c.color.toLowerCase() === colorHex.toLowerCase());
    if (pr) return { bg: pr.bg, text: pr.color };
    return { bg: `${colorHex}15`, text: colorHex };
  };

  const getBase64Image = async (imgUrl: string): Promise<string> => {
    try {
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error(err);
      return "";
    }
  };

  const handlePrintPDF = async () => {
    if (monthlyData.length === 0) {
      alert("Tidak ada data jadwal untuk dicetak.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Mohon izinkan popup blocker untuk mencetak laporan.");
      return;
    }

    try {
      const logoPath = logoRsucl2019;
      let base64Logo = "";
      if (logoPath) {
        try {
          base64Logo = await getBase64Image(logoPath);
        } catch (e) {
          console.error("Failed to load base64 logo", e);
        }
      }

      const shortDays = ['MG', 'SN', 'SL', 'RB', 'KM', 'JM', 'SB'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const monthLabel = months[viewMonth - 1];
      const currentDeptObj = departments.find(d => String(d.id) === String(calDeptFilter));
      const deptName = currentDeptObj ? currentDeptObj.name : 'Semua Unit Kerja';

      // Generate table header columns
      let dateColsHtml = "";
      let dayColsHtml = "";
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(viewYear, viewMonth - 1, d);
        const dayName = shortDays[dateObj.getDay()];
        const isSunday = dateObj.getDay() === 0;
        
        const colStyle = isSunday 
          ? 'color: #DC2626; font-weight: bold; background-color: #FEF2F2;' 
          : '';

        dateColsHtml += `<th style="text-align: center; font-size: 9px; padding: 4px 2px; border: 1px solid #000; min-width: 22px; ${colStyle}">${d}</th>`;
        dayColsHtml += `<th style="text-align: center; font-size: 8px; padding: 4px 2px; border: 1px solid #000; min-width: 22px; ${colStyle}">${dayName}</th>`;
      }

      // Generate table rows
      let rowsHtml = "";
      monthlyData.forEach((row, idx) => {
        let cellsHtml = "";
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const assign = row.dates[dateStr];
          
          const dateObj = new Date(viewYear, viewMonth - 1, d);
          const isSunday = dateObj.getDay() === 0;
          
          let code = "–";
          let cellBg = isSunday ? "#FEF2F2" : "#FFFFFF";
          let cellColor = isSunday ? "#DC2626" : "#000000";
          let isBold = false;

          if (assign) {
            const nameLower = assign.name.toLowerCase();
            isBold = true;
            if (nameLower.includes("pagi")) {
              code = "P";
              cellBg = "#E6F4EA";
              cellColor = "#137333";
            } else if (nameLower.includes("siang")) {
              code = "S";
              cellBg = "#E8F0FE";
              cellColor = "#1A73E8";
            } else if (nameLower.includes("malam")) {
              code = "M";
              cellBg = "#F3E8FF";
              cellColor = "#681DA8";
            } else if (nameLower.includes("normal") || nameLower.includes("reguler")) {
              code = "N";
              cellBg = "#FFFFFF";
              cellColor = "#374151";
            } else if (nameLower.includes("cuti")) {
              code = "C";
              cellBg = "#FCE8E6";
              cellColor = "#C5221F";
            } else if (nameLower.includes("sakit")) {
              code = "Skt";
              cellBg = "#FEF7E0";
              cellColor = "#B06000";
            } else if (nameLower.includes("libur")) {
              code = "L";
              cellBg = "#F1F3F4";
              cellColor = "#5F6368";
            } else {
              code = assign.name.split(" ").map(w => w[0]).join("").toUpperCase().substring(0, 3);
              cellBg = assign.color || "#F1F3F4";
              cellColor = "#000000";
            }
          }

          cellsHtml += `
            <td style="text-align: center; font-size: 9px; font-weight: ${isBold ? 'bold' : 'normal'}; padding: 4px 2px; border: 1px solid #000000; background-color: ${cellBg}; color: ${cellColor};">
              ${code}
            </td>
          `;
        }

        const roleBadge = row.role === 'pj_bagian' 
          ? `<span style="font-size: 7px; font-weight: bold; background-color: #FEF3C7; color: #D97706; padding: 1px 3px; border-radius: 3px; margin-left: 4px; border: 1px solid #FDE68A;">PJ</span>` 
          : '';

        rowsHtml += `
          <tr style="border: 1px solid #000000;">
            <td style="font-size: 9px; font-weight: bold; padding: 5px 8px; border: 1px solid #000000; color: #000000; white-space: nowrap;">
              ${idx + 1}. ${row.name} ${roleBadge}
            </td>
            ${cellsHtml}
          </tr>
        `;
      });

      const titleLabel = `JADWAL JAGA ${deptName.toUpperCase()} RUMAH SAKIT UMUM CEMPAKA LIMA`;

      const content = `
        <html>
        <head>
          <title>${titleLabel}</title>
          <style>
            body { font-family: 'Arial', sans-serif; color: #000000; padding: 20px; margin: 0; }
            .header-table { width: 100%; border-bottom: 2px solid #000000; padding-bottom: 6px; margin-bottom: 15px; }
            .company-name { font-size: 11px; font-weight: bold; color: #15803D; margin: 0 0 1px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .hospital-name { font-size: 16px; font-weight: bold; color: #DC2626; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .hospital-sub { font-size: 9px; color: #15803D; margin: 2px 0 0 0; font-weight: 500; line-height: 1.3; }
            .company-city { font-size: 10px; font-weight: bold; color: #15803D; margin: 2px 0 0 0; text-transform: uppercase; }
            .title { font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 15px 0 15px 0; text-align: center; letter-spacing: 0.5px; text-decoration: underline; }
            .data-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; }
            .data-table th { background-color: #F1F3F4; color: #000000; font-weight: bold; padding: 4px; border: 1px solid #000000; font-size: 9px; text-transform: uppercase; }
            @media print {
              @page { size: landscape; margin: 0.4cm; }
              body { padding: 0; margin: 0; }
            }
          </style>
        </head>
        <body>
          <table class="header-table" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 160px; text-align: left; vertical-align: middle; padding: 0;">
                <img src="${base64Logo || logoPath}" style="height: 42px; width: auto; object-fit: contain; display: block;" />
              </td>
              <td style="text-align: center; vertical-align: middle; padding: 0;">
                <p class="company-name" style="margin: 0; font-size: 11px; font-weight: bold; color: #15803D; text-transform: uppercase; letter-spacing: 0.5px;">PT. CEMPAKA LIMA UTAMA</p>
                <h1 class="hospital-name" style="margin: 2px 0; font-size: 15px; font-weight: bold; color: #DC2626; text-transform: uppercase; letter-spacing: 0.5px;">RUMAH SAKIT UMUM CEMPAKA LIMA</h1>
                <p class="hospital-sub" style="margin: 1px 0; font-size: 8.5px; color: #15803D; font-weight: 550; line-height: 1.3;">Jln. Politeknik, Gp. Beurawe, Kecamatan Kuta Alam, Kode Pos 23124, Telp. (0651)3619999,</p>
                <p class="hospital-sub" style="margin: 1px 0; font-size: 8.5px; color: #15803D; font-weight: 550; line-height: 1.3;">Fax. (0651)3619999, email: rsu@cempakalima.co.id</p>
                <p class="company-city" style="margin: 2px 0 0 0; font-size: 9.5px; font-weight: bold; color: #15803D; text-transform: uppercase; letter-spacing: 0.5px;">BANDA ACEH</p>
              </td>
              <td style="width: 160px; padding: 0;"></td>
            </tr>
          </table>
          
          <h2 class="title">${titleLabel} <br/> PERIODE ${monthLabel.toUpperCase()} ${viewYear}</h2>

          <table class="data-table">
            <thead>
              <tr>
                <th rowspan="2" style="text-align: left; padding-left: 8px; border: 1px solid #000000; font-size: 9px;">NAMA PEGAWAI</th>
                <th colspan="${daysInMonth}" style="border: 1px solid #000000; font-size: 9px; letter-spacing: 1px;">TANGGAL</th>
              </tr>
              <tr>
                ${dateColsHtml}
              </tr>
              <tr>
                <th style="text-align: left; padding-left: 8px; border: 1px solid #000000; font-size: 9px;">HARI</th>
                ${dayColsHtml}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <div style="font-size: 9px; color: #000000; margin-top: 15px; display: flex; gap: 15px; font-weight: bold; border-top: 1px solid #E5E7EB; padding-top: 8px;">
            <span>Keterangan Shift:</span>
            <span>[P] Pagi</span>
            <span>[S] Siang</span>
            <span>[M] Malam</span>
            <span>[N] Normal / Kantor</span>
            <span>[C] Cuti</span>
            <span>[Skt] Sakit</span>
            <span>[–] Libur / OFF</span>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(content);
      printWindow.document.close();
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mencetak PDF.");
      printWindow.close();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-32">
      {/* Background click handler to close popovers */}
      {activeAssignCell && (
        <div className="fixed inset-0 z-20" onClick={() => setActiveAssignCell(null)} />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">Jadwal Shift</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">Kelola jadwal shift dan penugasan karyawan</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-semibold rounded-xl transition-all shadow-sm shadow-green-200 active:scale-95"
        >
          <Plus size={15} /> Tambah Shift
        </button>
      </div>

      {/* Search Bar & Bulk Assign Button */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Cari shift berdasarkan nama shift atau unit kerja..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all shadow-sm font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 text-[12px] font-semibold font-sans"
            >
              Batal
            </button>
          )}
        </div>

        {/* Filter Unit Kerja Pemilik */}
        <div className="min-w-[200px]">
          <select
            value={selectedDeptFilter}
            onChange={e => setSelectedDeptFilter(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold"
          >
            <option value="all">Semua Pemilik Shift</option>
            <option value="umum">Office (Tidak Ada Pemilik)</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowDeptModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-600 text-[13px] font-semibold rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap font-sans"
        >
          <Users size={15} /> Tugaskan per Unit Kerja
        </button>
      </div>

      {/* Shift cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && (
          <div className="col-span-2 text-center py-5 text-gray-400 text-[12px]">Memuat data shift...</div>
        )}
        {!loading && filteredShifts.length === 0 && (
          <div className="col-span-2 text-center py-8 text-gray-400 text-[12px] bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            Tidak ada shift yang cocok dengan pencarian Anda.
          </div>
        )}
        {filteredShifts.map(shift => {
          const IconComp = ICON_MAP[shift.icon as IconKey]?.component ?? Sun;
          const pr = getPresetByHex(shift.color);
          const isExpanded = expandedShift === shift.id;

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
                      <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full ${shift.shift_type === 'dinas_luar' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {shift.shift_type === 'dinas_luar' ? 'Dinas Luar' : 'Normal'}
                        </span>
                        {shift.owner_department_name ? (
                          <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            Unit: {shift.owner_department_name}
                          </span>
                        ) : (
                          <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                            Office
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Delete button */}
                    {editingId !== shift.id && (
                      <button
                        onClick={() => setDeleteTarget(shift)}
                        className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                        title="Hapus shift"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    )}
                    {/* Edit / Save-Cancel buttons */}
                    {editingId !== shift.id ? (
                      <button onClick={() => startEdit(shift)} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors">
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
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Tipe Shift</label>
                      <select value={editShiftType} onChange={e => setEditShiftType(e.target.value as 'normal' | 'dinas_luar')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer">
                        <option value="normal">Normal (GPS Wajib)</option>
                        <option value="dinas_luar">Dinas Luar (GPS Opsional)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Unit Kerja Pemilik</label>
                      <select
                        value={editOwnerDeptId}
                        onChange={e => setEditOwnerDeptId(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold"
                      >
                        <option value="">Office (Bisa Diakses Semua Unit)</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
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
                                placeholder="Nama sub-shift (misal: Pagi)"
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
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400 font-semibold uppercase">Limit Absen:</span>
                            <input
                              type="time"
                              value={child.checkin_window_end_time || ''}
                              onChange={e => handleUpdateEditChild(index, 'checkin_window_end_time', e.target.value)}
                              className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-mono bg-white focus:outline-none focus:border-[#16A34A] w-24"
                            />
                            {!child.checkin_window_end_time && (
                              <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                                Fallback aktif
                              </span>
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
                      shift.children.map(child => {
                        const hasNoWindow = !child.checkin_window_end_time;
                        const fallbackVal = (() => {
                          if (!hasNoWindow) return '';
                          try {
                            const [sh, sm] = child.start_time.split(':').map(Number);
                            const [eh, em] = child.end_time.split(':').map(Number);
                            let startM = sh * 60 + sm;
                            let endM = eh * 60 + em;
                            if (endM < startM) endM += 1440;
                            const dur = endM - startM;
                            const half = Math.floor(dur / 2);
                            const fallM = (startM + half) % 1440;
                            const hh = String(Math.floor(fallM / 60)).padStart(2, '0');
                            const mm = String(fallM % 60).padStart(2, '0');
                            return `${hh}:${mm}`;
                          } catch {
                            return '--:--';
                          }
                        })();

                        return (
                          <div key={child.id} className="flex flex-col gap-1 w-full border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center text-[12px] py-1.5 px-3 rounded-xl bg-gray-50 border border-gray-100/50 font-medium">
                              <span className="text-gray-600 text-[11px] truncate max-w-[150px]">{child.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-black font-semibold bg-white border border-gray-100 px-2 py-0.5 rounded-lg text-[11px]">
                                  {child.start_time.substring(0, 5)} – {child.end_time.substring(0, 5)}
                                </span>
                                {child.checkin_window_end_time ? (
                                  <span className="text-[10px] text-gray-500 font-mono bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-lg" title="Batas absen masuk">
                                    Batas: {child.checkin_window_end_time.substring(0, 5)}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-600 font-bold font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-lg" title="Menggunakan batas bawaan/sementara">
                                    Batas: {fallbackVal}*
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[11px] text-gray-400 italic">Belum ada sub-waktu diatur.</p>
                    )}
                  </div>
                )}

                {/* Audit details */}
                {(shift.created_by_name || shift.updated_by_name) && (
                  <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                    {shift.created_by_name && (
                      <span>Dibuat: <strong className="text-gray-600 font-semibold">{shift.created_by_name}</strong></span>
                    )}
                    {shift.updated_by_name && (
                      <span>Diubah: <strong className="text-gray-600 font-semibold">{shift.updated_by_name}</strong></span>
                    )}
                  </div>
                )}
              </div>

              {/* Employee list toggle */}
              <button onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-gray-400" />
                  <span className="text-[12px] text-gray-500">{shift.employees_count || 0} karyawan</span>
                </div>
                <span className="text-[11px] text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded Employee List */}
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
                            ?.filter(e => e.id === emp.id && ((e.pivot as any)?.day_of_week || (e.pivot as any)?.work_date))
                            .map(e => {
                              const subName = child.name.split(' ')[0];
                              const p = e.pivot as any;
                              if (p?.day_of_week) return `${p.day_of_week} (${subName})`;
                              if (p?.work_date) {
                                try {
                                  const formattedDate = new Date(p.work_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                                  return `${formattedDate} (${subName})`;
                                } catch {
                                  return `${p.work_date} (${subName})`;
                                }
                              }
                              return `(${subName})`;
                            }) ?? []
                        ) ?? [];

                        const daysLabel = days.length > 0 ? ` · ${days.join(', ')}` : '';

                        return (
                          <div key={emp.id} className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                            <div>
                              <p className="text-[12.5px] font-bold text-gray-800">{emp.user?.name}</p>
                              <p className="text-[10px] text-gray-400">{emp.department?.name || 'Tanpa Dept'}{daysLabel}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveEmployeeFromShift(emp.id, shift.children?.flatMap(c => c.employees?.filter(e => e.id === emp.id).map(e => e.pivot?.day_of_week as string) ?? []) ?? [])}
                              className="text-[11px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Hapus
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <button
                    onClick={() => {
                      setAssigningShiftId(shift.id);
                      setShowAddEmpModal(true);
                    }}
                    className="w-full py-2 border border-dashed border-gray-200 hover:border-[#16A34A] rounded-xl text-[12px] font-semibold text-gray-500 hover:text-[#16A34A] bg-white hover:bg-green-50/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={13} /> Tambah Karyawan
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Placeholder "Add shift" card */}
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 shadow-none flex flex-col items-center justify-center gap-3 p-8 hover:border-[#16A34A] hover:bg-green-50/30 transition-all group min-h-[140px]"
        >
          <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center group-hover:bg-[#16A34A] group-hover:border-[#16A34A] transition-all shadow-sm">
            <Plus size={20} className="text-gray-300 group-hover:text-white transition-colors" />
          </div>
          <div className="text-center font-sans">
            <p className="text-[13px] font-semibold text-gray-400 group-hover:text-[#16A34A] transition-colors">Tambah Shift Baru</p>
            <p className="text-[11px] text-gray-300 mt-0.5">Klik untuk membuat shift baru</p>
          </div>
        </button>
      </div>

      {/* ── KALENDER BULANAN (WADAH TUNGGAL TERPADU) ─────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden font-sans">
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            height: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #CBD5E1;
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94A3B8;
          }
        `}</style>

        {/* Header Filter Terpadu */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/20">
          <MonthYearDeptFilter
            month={viewMonth}
            year={viewYear}
            deptId={calDeptFilter}
            departments={departments}
            showAllMonthsOption={false}
            embedded={true}
            onMonthChange={setViewMonth}
            onYearChange={setViewYear}
            onDeptChange={setCalDeptFilter}
          />
        </div>

        {/* Calendar Title Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-150 bg-gradient-to-r from-green-50/50 to-white flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CalendarIcon size={18} className="text-[#16A34A]" />
            <div>
              <p className="text-[14.5px] font-bold text-gray-900">
                Kalender Jadwal — {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </p>
              <p className="text-[11px] text-gray-400">{daysInMonth} hari · Klik sel karyawan untuk mengatur penugasan shift kerja</p>
            </div>
          </div>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-700 transition-colors shadow-2xs active:scale-95 cursor-pointer"
          >
            <FileText size={13} /> Cetak Jadwal Bulanan
          </button>
        </div>

        {/* Grid Table */}
        {calLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#16A34A]" />
            <span className="text-[13px] font-medium">Memuat data kalender...</span>
          </div>
        ) : (
          <div ref={calTableRef} className="overflow-x-auto custom-scrollbar pb-1">
            <table className="text-[11px] border-collapse" style={{ minWidth: `${Math.max(900, 150 + daysInMonth * 44)}px` }}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="sticky left-0 z-20 bg-[#F8FAFC] text-left px-5 py-4 min-w-[150px] font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-r border-slate-200/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-slate-400" />
                      Karyawan
                    </div>
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const dateStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const dow = new Date(viewYear, viewMonth - 1, day).getDay();
                    const isToday = dateStr === today_str;
                    const isHoliday = holidays.includes(dateStr);
                    const isSunday = dow === 0;
                    return (
                      <th key={day} className={`text-center py-2 px-1 font-semibold text-[10px] ${isToday ? 'bg-green-50/50' : ''}`}
                        style={{ minWidth: '42px', ...getDayHeaderStyle(dow, isHoliday) }}>
                        <div className="flex flex-col items-center">
                          <span className={`text-[9px] uppercase tracking-wider font-semibold ${isSunday || isHoliday ? 'text-red-500/80' : 'opacity-75'}`}>{DAY_ABBR[dow]}</span>
                          <span className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[10.5px] font-extrabold ${
                            isToday ? 'bg-[#16A34A] text-white shadow-xs shadow-green-150' : isSunday || isHoliday ? 'text-red-600' : 'text-slate-700'
                          }`}>{day}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {monthlyData.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="text-center py-14 text-slate-400 text-[12px] italic">
                      Belum ada data karyawan. Pilih unit kerja untuk melihat jadwal.
                    </td>
                  </tr>
                ) : (
                  monthlyData.map((row, ri) => (
                    <tr key={row.employee_id}
                      className="border-b border-slate-50 group hover:bg-slate-50/30 transition-colors">
                      <td className={`sticky left-0 z-20 ${ri % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]/60'} group-hover:bg-[#F0FDF4] px-5 py-3 border-r border-slate-200/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.04)] transition-colors`}>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 whitespace-nowrap text-[12.5px] tracking-wide">{row.name}</p>
                          {row.role === 'pj_bagian' && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-250/50 uppercase tracking-wider">
                              PJ {row.pj_department_name || 'Bagian'}
                            </span>
                          )}
                        </div>
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                        const dateStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        const assigned = row.dates[dateStr];
                        const dow = new Date(viewYear, viewMonth - 1, day).getDay();
                        const isToday = dateStr === today_str;
                        const isPending = !!calPendingChanges[`${row.employee_id}-${dateStr}`];
                        const pr = assigned ? getPresetByHex(assigned.color) : null;
                        const badge = assigned ? getShiftBadge(assigned.name) : null;
                        const isSunday = dow === 0;
                        const isHoliday = holidays.includes(dateStr);

                        return (
                          <td key={day} className={`text-center py-2 px-0.5 border-r border-slate-100 relative ${
                            isToday ? 'bg-green-50/20' : ''
                          } ${isSunday || isHoliday ? 'bg-red-50/10' : ''}`}>
                            <div className="relative inline-block">
                              <button onClick={e => handleCalCellClick(e, row.employee_id, dateStr)}
                                className={`w-8 h-7 mx-auto rounded-lg text-[10px] font-extrabold transition-all hover:scale-110 active:scale-95 border flex items-center justify-center ${
                                  isPending
                                    ? 'ring-2 ring-blue-500 border-blue-400 shadow-md animate-pulse'
                                    : assigned
                                      ? 'shadow-sm hover:shadow-md'
                                      : 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100'
                                }`}
                                style={assigned && pr ? { background: pr.bg, borderColor: isPending ? '#3B82F6' : pr.border, color: assigned.color } : {}}
                                title={isPending
                                  ? `[BELUM DISIMPAN] ${assigned ? assigned.name : 'Libur'}\nKlik lagi untuk ubah.`
                                  : assigned
                                    ? `${assigned.name}\n${assigned.start_time ?? ''}–${assigned.end_time ?? ''}\nKlik untuk ubah`
                                    : isHoliday
                                      ? `Tgl ${day} (Hari Libur) — kosong. Klik untuk atur.`
                                      : `Tgl ${day} — kosong. Klik untuk atur.`}>
                                {badge ?? '·'}
                              </button>
                              {isPending && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border border-white flex items-center justify-center shadow-xs" title="Perubahan Belum Disimpan" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Success Banner */}
      {calSuccessMsg && (
        <div className="p-3.5 bg-green-500 text-white rounded-2xl shadow-lg flex items-center gap-2.5 text-[13px] font-bold animate-bounce max-w-md mx-auto">
          <Check size={18} />
          <span>{calSuccessMsg}</span>
        </div>
      )}

      {/* Floating Save Bar */}
      {Object.keys(calPendingChanges).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 border border-gray-700 animate-slide-up font-sans">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <p className="text-[12.5px] font-bold">
              {Object.keys(calPendingChanges).length} Perubahan Shift Belum Disimpan
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCalCancelPending}
              disabled={calSavingAll}
              className="px-3 py-1.5 text-[12px] font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleCalSaveAllPending}
              disabled={calSavingAll}
              className="px-4 py-1.5 text-[12.5px] font-bold text-white bg-[#16A34A] hover:bg-[#0d9240] rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {calSavingAll ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {calSavingAll ? 'Menyimpan...' : 'Simpan Perubahan Jadwal'}
            </button>
          </div>
        </div>
      )}

      {/* Cal Popover */}
      {calPopover && (
        <div className="fixed inset-0 z-30" onClick={() => setCalPopover(null)}>
          <div
            className="absolute bg-white rounded-2xl border border-gray-200 shadow-2xl py-2 min-w-[200px] max-h-[320px] overflow-y-auto z-40"
            style={{ top: calPopover.y, left: Math.min(calPopover.x, window.innerWidth - 220) }}
            onClick={e => e.stopPropagation()}>
            <p className="text-[9px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider border-b border-gray-100 mb-1">Pilih Shift</p>
            <button onClick={() => handleCalAssign(null)}
              className="w-full text-left px-3 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-50 flex items-center gap-2">
              <Coffee size={13} className="text-gray-400" /> Libur / OFF
            </button>
            <button onClick={async () => {
              let foundShift = shifts.find(s => s.name.toLowerCase().includes('libur jaga') || s.name.toUpperCase() === 'LJ');
              if (!foundShift) {
                try {
                  const createRes = await scheduleApi.create({
                    name: 'Libur Jaga (LJ)',
                    start_time: '00:00',
                    end_time: '00:00',
                    color: '#475569',
                    icon: 'moon',
                    shift_type: 'normal',
                  } as any);
                  if (createRes.success) {
                    foundShift = createRes.data;
                    setShifts(prev => [...prev, createRes.data]);
                  }
                } catch (err) {
                  console.error(err);
                }
              }
              if (foundShift) {
                await handleCalAssign(foundShift.id);
              }
            }}
              className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600 flex-shrink-0" /> Libur Jaga (LJ)
            </button>
            <div className="h-px bg-gray-100 my-1" />
            {shifts.map(parent => (
              <div key={parent.id}>
                <p className="text-[9px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">{parent.name}</p>
                {parent.children && parent.children.length > 0
                  ? parent.children.map(child => {
                      const pr = getPresetByHex(child.color);
                      const cur = monthlyData.find(r => r.employee_id === calPopover.empId)?.dates[calPopover.dateStr]?.schedule_id;
                      return (
                        <button key={child.id} onClick={() => handleCalAssign(child.id)}
                          className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: child.color }} />
                          <span className="font-medium text-gray-700 truncate">{child.name}</span>
                          <span className="ml-auto text-[10px] text-gray-400 font-mono flex-shrink-0">{child.start_time?.substring(0,5)}–{child.end_time?.substring(0,5)}</span>
                          {cur === child.id && <Check size={12} className="ml-1 text-[#16A34A]" />}
                        </button>
                      );
                    })
                  : (
                    <button onClick={() => handleCalAssign(parent.id)}
                      className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: parent.color }} />
                      <span className="font-medium text-gray-700 truncate">{parent.name}</span>
                      <span className="ml-auto text-[10px] text-gray-400 font-mono flex-shrink-0">{parent.start_time?.substring(0,5)}–{parent.end_time?.substring(0,5)}</span>
                    </button>
                  )
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddShiftModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} departments={departments} />}
      {showDeptModal && <AssignDepartmentModal shifts={shifts} onClose={() => setShowDeptModal(false)} onAssign={handleAssignDepartment} />}
      {deleteTarget && <DeleteModal shift={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => handleDelete(deleteTarget.id)} />}
      
      {showAddEmpModal && assigningShiftId !== null && (
        <AddEmployeeToShiftModal
          parentShift={shifts.find(s => s.id === assigningShiftId)!}
          onClose={() => {
            setShowAddEmpModal(false);
            setAssigningShiftId(null);
          }}
          onAssign={async (empId, day, childScheduleId) => {
            await handleAssign(empId, day, childScheduleId);
          }}
        />
      )}
    </div>
  );
}
