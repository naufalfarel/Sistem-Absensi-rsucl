import { useState, useEffect } from 'react';
import { Sun, Sunset, Moon, Edit2, Check, X, Plus, Users, Trash2, Star, Zap } from 'lucide-react';
import { scheduleApi, employeeApi, ShiftSchedule, EmployeeWeeklySchedule } from '../../../services/api';

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
function AddShiftModal({ onClose, onAdd, departments }: { onClose: () => void; onAdd: (s: ShiftSchedule) => void; departments: any[] }) {
  const [name, setName]       = useState('');
  const [start, setStart]     = useState('07:00');
  const [end, setEnd]         = useState('15:00');
  const [windowEnd, setWindowEnd] = useState('');
  const [icon, setIcon]       = useState<IconKey>('sun');
  const [colorId, setColorId] = useState('amber');
  const [shiftType, setShiftType] = useState<'normal' | 'dinas_luar'>('normal');
  const [ownerDeptId, setOwnerDeptId] = useState<number | ''>('');

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
        owner_department_id: ownerDeptId === '' ? null : Number(ownerDeptId),
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
              <p className="text-[16px] font-bold font-mono text-black">{start}</p>
            </div>
            <span className="self-center text-gray-300 font-bold">–</span>
            <div className="flex-1 text-center py-2 bg-white/70 rounded-xl border" style={{ borderColor: preset.border }}>
              <p className="text-[9px] text-gray-400">Pulang</p>
              <p className="text-[16px] font-bold font-mono text-black">{end}</p>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Nama Shift</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Shift Pagi"
              maxLength={40}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
            />
          </div>

          {/* Time */}
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

          {/* Departemen Pemilik */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Departemen Pemilik Shift</label>
            <select
              value={ownerDeptId}
              onChange={e => setOwnerDeptId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all cursor-pointer font-semibold"
            >
              <option value="">Umum (Bisa Diakses Semua Unit)</option>
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
            disabled={!name.trim()}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white transition-all bg-[#16A34A] hover:bg-[#0d9240] shadow-sm shadow-green-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        <h3 className="text-[15px] font-bold text-gray-900 mb-4">Penugasan Shift Massal per Departemen</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Pilih Departemen</label>
            <select
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer"
            >
              {departments.length === 0 && <option value="">Memuat data departemen...</option>}
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
      alert(err?.message ?? 'Gagal menugaskan shift per departemen.');
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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
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
            placeholder="Cari shift berdasarkan nama shift atau departemen..."
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

        {/* Filter Departemen Pemilik */}
        <div className="min-w-[200px]">
          <select
            value={selectedDeptFilter}
            onChange={e => setSelectedDeptFilter(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold"
          >
            <option value="all">Semua Pemilik Shift</option>
            <option value="umum">Umum (Tidak Ada Pemilik)</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowDeptModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-600 text-[13px] font-semibold rounded-xl transition-all shadow-sm active:scale-95 whitespace-nowrap font-sans"
        >
          <Users size={15} /> Tugaskan per Departemen
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
                            Umum
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
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Departemen Pemilik</label>
                      <select
                        value={editOwnerDeptId}
                        onChange={e => setEditOwnerDeptId(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all cursor-pointer font-semibold"
                      >
                        <option value="">Umum (Bisa Diakses Semua Unit)</option>
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
                            ?.filter(e => e.id === emp.id && e.pivot?.day_of_week)
                            .map(e => `${e.pivot?.day_of_week} (${child.name.split(' ')[0]})`) ?? []
                        ) ?? [];

                        return (
                          <div key={emp.id} className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-gray-100 shadow-sm">
                            <div>
                              <p className="text-[12.5px] font-bold text-gray-800">{emp.user?.name}</p>
                              <p className="text-[10px] text-gray-400">{emp.department?.name || 'Tanpa Dept'} · {days.join(', ')}</p>
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

      {/* Dynamic Schedule matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 font-sans">
          <p className="text-[14px] font-semibold text-gray-800">Jadwal Mingguan Karyawan</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Klik pada sel hari kerja karyawan untuk menugaskan/mengubah shift secara mandiri.</p>
        </div>
        <div className="overflow-x-auto pb-4 font-sans">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Karyawan</th>
                {totalDays.map(d => (
                  <th key={d} className="text-center px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employeeSchedules.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-800 whitespace-nowrap">{row.name}</td>
                  {totalDays.map((d, j) => {
                    const assigned = row.schedules[d];
                    const sc = assigned ? getShiftColors(assigned.color) : { bg: '#F9FAFB', text: '#9CA3AF' };
                    const initial = assigned ? getShiftInitials(assigned.name) : '-';
                    const active = activeAssignCell?.empId === row.employee_id && activeAssignCell?.day === d;

                    return (
                      <td key={j} className="px-3 py-3 text-center relative">
                        <button
                          onClick={() => setActiveAssignCell(active ? null : { empId: row.employee_id, day: d })}
                          className="inline-block text-[11px] font-bold px-3 py-1 rounded-lg transition-all hover:scale-105 active:scale-95 shadow-sm border border-transparent hover:border-gray-200"
                          style={{ background: sc.bg, color: sc.text }}
                          title={assigned ? `${assigned.name} (Klik untuk ganti)` : 'Libur (Klik untuk set)'}
                        >
                          {initial}
                        </button>

                        {/* Popover choice selection */}
                        {active && (
                          <div className={`absolute left-1/2 -translate-x-1/2 z-30 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 min-w-[170px] text-left max-h-[300px] overflow-y-auto ${
                            employeeSchedules.length > 2 && i >= employeeSchedules.length - 2
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
                              onClick={() => handleAssign(row.employee_id, d, null)}
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
            </tbody>
          </table>
        </div>
      </div>

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
