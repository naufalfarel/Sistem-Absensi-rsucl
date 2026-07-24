import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sun, Sunset, Moon, Star, Zap, Plus, X, Calendar as CalendarIcon,
  Trash2, Edit2, Check, AlertCircle, ChevronLeft, ChevronRight,
  Users, Save, Loader2, Coffee, FileText, Search
} from 'lucide-react';
import {
  scheduleApi, employeeApi, ShiftSchedule, EmployeeMonthlySchedule
} from '../../../services/api';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';
import { useAuth } from '../../../context/AuthContext';
import logoImg from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import rsLogoImg from '../../../imports/rsucl_wide_logo.png';
import logoRsucl2019 from '../../../imports/logo_rsucl_2019.png';

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
  sun:    { component: Sun,    label: 'Pagi',    emoji: '☀️' },
  sunset: { component: Sunset, label: 'Sore',    emoji: '🌅' },
  moon:   { component: Moon,   label: 'Malam',   emoji: '🌙' },
  star:   { component: Star,   label: 'Bintang', emoji: '⭐' },
  zap:    { component: Zap,    label: 'Khusus',  emoji: '⚡' },
};

const COLOR_PRESETS = [
  { id: 'amber',  color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Kuning'    },
  { id: 'blue',   color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', label: 'Biru'      },
  { id: 'violet', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', label: 'Ungu'      },
  { id: 'green',  color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Hijau'     },
  { id: 'rose',   color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3', label: 'Merah'     },
  { id: 'cyan',   color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', label: 'Biru Muda' },
];

const MONTH_NAMES = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

const DAY_ABBR = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function getPresetByHex(hex: string) {
  return COLOR_PRESETS.find(c => c.color.toLowerCase() === hex.toLowerCase()) ?? COLOR_PRESETS[3];
}

// Warna label hari berdasarkan hari dalam seminggu (0=Sun, 6=Sat)
function getDayHeaderStyle(dayOfWeek: number, isHoliday?: boolean) {
  if (dayOfWeek === 0 || isHoliday) return { color: '#E11D48', fontWeight: 700 }; // Minggu/Libur - merah
  return { color: '#374151', fontWeight: 500 };
}

// ── Add Shift Modal ────────────────────────────────────────────────────
interface SubShiftEntry {
  id: string;
  name: string;
  start: string;
  end: string;
}

function AddShiftModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: ShiftSchedule) => void }) {
  const [name, setName]       = useState('');
  const [icon, setIcon]       = useState<IconKey>('sun');
  const [colorId, setColorId] = useState('green');
  const [shiftType, setShiftType] = useState<'normal' | 'dinas_luar'>('normal');
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
        color: preset.color,
        icon,
        shift_type: shiftType,
        children: filledChildren,
      } as any);
      if (res.success) { onAdd(res.data); onClose(); }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal membuat shift baru.');
    } finally { setLoading(false); }
  };

  const previewStart = subShifts[0]?.start ?? '08:00';
  const previewEnd = subShifts[0]?.end ?? '14:00';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto z-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[16px] font-bold text-gray-900">Tambah Shift Baru</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">Isi detail shift yang akan ditambahkan</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="mb-5 p-4 rounded-2xl border-2 transition-all" style={{ background: preset.bg, borderColor: preset.border }}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border-2" style={{ background: 'white', borderColor: preset.border }}>
              <IconComp size={20} style={{ color: preset.color }} />
            </div>
            <div>
              <p className="text-[14px] font-bold" style={{ color: preset.color }}>{name || 'Nama Shift'}</p>
              <p className="text-[11px] text-gray-500">{previewStart} – {previewEnd}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Nama Shift */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Nama Shift (Template)</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Shift Pagi, Shift Siang"
              maxLength={40}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
          </div>

          {/* ── Sub-Waktu Shift ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-dashed border-[#16A34A]/40 bg-green-50/30 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <p className="text-[12px] font-semibold text-gray-700">Sub-Waktu Shift</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Varian waktu yang dapat ditugaskan ke staf</p>
              </div>
              <button
                type="button"
                onClick={addSubShift}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#16A34A]/50 rounded-lg text-[11px] font-semibold text-[#16A34A] hover:bg-green-50 transition-colors shadow-xs"
              >
                <Plus size={12} /> Tambah
              </button>
            </div>

            <div className="space-y-2">
              {subShifts.map((ss, idx) => (
                <div
                  key={ss.id}
                  className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-xl shadow-xs"
                >
                  <div className="w-5 h-5 flex items-center justify-center rounded-full border border-[#16A34A]/30 text-[9px] font-bold text-[#16A34A] flex-shrink-0 bg-green-50">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={ss.name}
                    onChange={e => updateSubShift(ss.id, 'name', e.target.value)}
                    placeholder="Nama sub-shift (contoh: Pagi)"
                    maxLength={60}
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] min-w-0"
                  />
                  <input
                    type="time"
                    value={ss.start}
                    onChange={e => updateSubShift(ss.id, 'start', e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] w-[84px]"
                  />
                  <span className="text-gray-300 text-[10px] flex-shrink-0">–</span>
                  <input
                    type="time"
                    value={ss.end}
                    onChange={e => updateSubShift(ss.id, 'end', e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] w-[84px]"
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
              💡 Baris yang namanya kosong tidak akan disimpan.
            </p>
          </div>

          {/* Tipe Shift khusus diset normal secara default untuk PJ Bagian */}

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-2">Pilih Ikon</label>
            <div className="flex gap-2">
              {(Object.entries(ICON_MAP) as [IconKey, typeof ICON_MAP[IconKey]][]).map(([key, { component: Ic, emoji, label }]) => (
                <button key={key} onClick={() => setIcon(key)} title={label}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${icon === key ? 'border-[#16A34A] bg-green-50 shadow-sm' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
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
                <button key={c.id} onClick={() => setColorId(c.id)} title={c.label}
                  className={`relative w-full aspect-square rounded-xl border-2 transition-all ${colorId === c.id ? 'border-gray-800 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c.color }}>
                  {colorId === c.id && <Check size={12} className="absolute inset-0 m-auto text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
          <button onClick={handleSubmit} disabled={!name.trim() || loading}
            className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white transition-all bg-[#16A34A] hover:bg-[#0d9240] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
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
            <p className="text-[11px] text-gray-500">{shift.start_time ? shift.start_time.substring(0, 5) : "--:--"} – {shift.end_time ? shift.end_time.substring(0, 5) : "--:--"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors">Ya, Hapus</button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Assign Modal — pilih shift lalu klik rentang tanggal ──────────
interface BulkAssignModalProps {
  user: JadwalShiftTabProps['user'];
  shifts: ShiftSchedule[];
  employees: any[];
  year: number;
  month: number;
  daysInMonth: number;
  onClose: () => void;
  onSaved: () => void;
}

function BulkAssignModal({ user, shifts, employees, year, month, daysInMonth, onClose, onSaved }: BulkAssignModalProps) {
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | 'libur' | 'lj' | ''>('');
  const [selectedDates, setSelectedDates] = useState<number[]>([]); // day numbers 1..31
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const filteredEmps = employees.filter(
    e => e.name.toLowerCase().includes(search.toLowerCase()) &&
    e.id !== user.id &&
    e.name.toLowerCase().trim() !== user.name.toLowerCase().trim()
  );

  const toggleEmp = (id: number) => setSelectedEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleDate = (day: number) => setSelectedDates(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const handleSave = async () => {
    if (selectedEmpIds.length === 0) { alert('Pilih minimal satu karyawan.'); return; }
    if (selectedShiftId === '') { alert('Pilih shift atau Libur.'); return; }
    if (selectedDates.length === 0) { alert('Pilih minimal satu tanggal.'); return; }

    setLoading(true);
    try {
      let schedId: number | null = null;
      if (selectedShiftId === 'libur') {
        schedId = null;
      } else if (selectedShiftId === 'lj') {
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
        schedId = foundShift ? foundShift.id : null;
      } else {
        schedId = Number(selectedShiftId);
      }
      const assignments: Array<{ employee_id: number; work_date: string; schedule_id: number | null }> = [];

      for (const empId of selectedEmpIds) {
        for (const day of selectedDates) {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          assignments.push({ employee_id: empId, work_date: dateStr, schedule_id: schedId });
        }
      }

      await scheduleApi.assignBulkByDate(assignments);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menyimpan jadwal massal.');
    } finally {
      setLoading(false);
    }
  };

  // Render calendar-style date picker
  const days: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // Build weeks for calendar
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const calCells: (number | null)[] = Array(firstDayOfWeek).fill(null).concat(days);
  while (calCells.length % 7 !== 0) calCells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calCells.length; i += 7) weeks.push(calCells.slice(i, i + 7));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-y-auto z-10 flex flex-col md:flex-row">

        {/* LEFT: Karyawan & Shift */}
        <div className="flex-1 p-5 space-y-4 border-b md:border-b-0 md:border-r border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-gray-900">Penugasan Massal</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <X size={15} />
            </button>
          </div>

          {/* Pilih Karyawan */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              1. Pilih Karyawan
            </label>
            <input type="text" placeholder="Cari nama karyawan..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] mb-2" />
            <div className="border border-gray-200 rounded-xl max-h-[160px] overflow-y-auto p-2 space-y-1">
              {filteredEmps.length > 0 && (
                <label className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-[12px] font-bold border-b pb-2 border-gray-100">
                  <input type="checkbox"
                    checked={selectedEmpIds.length === filteredEmps.length && filteredEmps.length > 0}
                    onChange={() => {
                      if (selectedEmpIds.length === filteredEmps.length) setSelectedEmpIds([]);
                      else setSelectedEmpIds(filteredEmps.map(e => e.id));
                    }}
                    className="rounded text-[#16A34A]" />
                  Pilih Semua ({filteredEmps.length})
                </label>
              )}
              {filteredEmps.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-[12px]">
                  <input type="checkbox" checked={selectedEmpIds.includes(emp.id)} onChange={() => toggleEmp(emp.id)}
                    className="rounded text-[#16A34A]" />
                  <span className="font-medium text-gray-800">{emp.name}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-[#16A34A] font-bold mt-1">{selectedEmpIds.length} karyawan dipilih</p>
          </div>

          {/* Pilih Shift */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              2. Pilih Shift / Status
            </label>
            <select value={selectedShiftId} onChange={e => setSelectedShiftId(e.target.value as any)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] cursor-pointer font-semibold">
              <option value="">-- Pilih Shift --</option>
              <option value="libur" className="text-gray-500">⬜ Libur / OFF</option>
              <option value="lj" className="text-slate-700 font-semibold">🌙 Libur Jaga (LJ)</option>
              {shifts
                .filter(s => {
                  const n = s.name.toLowerCase();
                  return !n.includes('cuti') && !n.includes('sakit') && !n.includes('izin') && !n.includes('dinas luar') && !n.includes('libur jaga') && n !== 'lj';
                })
                .map(parent => (
                  <optgroup key={parent.id} label={parent.name}>
                    {parent.children && parent.children.length > 0
                      ? parent.children.map(child => (
                          <option key={child.id} value={child.id}>
                            {child.name} ({child.start_time?.substring(0, 5)} – {child.end_time?.substring(0, 5)})
                          </option>
                        ))
                      : <option value={parent.id}>{parent.name} ({parent.start_time?.substring(0, 5)} – {parent.end_time?.substring(0, 5)})</option>
                    }
                  </optgroup>
                ))}
            </select>
          </div>

          {/* Save button (desktop) */}
          <div className="hidden md:block pt-2">
            <button onClick={handleSave}
              disabled={loading || selectedEmpIds.length === 0 || selectedShiftId === '' || selectedDates.length === 0}
              className="w-full py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {loading ? 'Menyimpan...' : `Terapkan (${selectedDates.length} hari × ${selectedEmpIds.length} orang)`}
            </button>
          </div>
        </div>

        {/* RIGHT: Date Picker Calendar */}
        <div className="flex-1 p-5 space-y-3">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            3. Pilih Tanggal — {MONTH_NAMES[month - 1]} {year}
          </label>
          <p className="text-[11px] text-gray-400">Klik tanggal untuk memilih/membatalkan. Bisa pilih banyak.</p>

          {/* Quick select */}
          <div className="flex gap-2">
            <button onClick={() => setSelectedDates(days)} className="flex-1 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50">Pilih Semua</button>
            <button onClick={() => setSelectedDates([])} className="flex-1 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50">Hapus Pilihan</button>
          </div>

          {/* Calendar grid */}
          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_ABBR.map((d, i) => (
                <div key={d} className="text-center text-[10px] py-1" style={getDayHeaderStyle(i)}>
                  {d}
                </div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const dow = (firstDayOfWeek + day - 1) % 7;
                  const isSelected = selectedDates.includes(day);
                  const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
                  return (
                    <button key={di} onClick={() => toggleDate(day)}
                      className={`m-0.5 aspect-square rounded-xl text-[12px] font-semibold transition-all active:scale-90 ${
                        isSelected
                          ? 'bg-[#16A34A] text-white shadow-sm'
                          : isToday
                            ? 'bg-green-50 text-green-700 border border-green-300'
                            : dow === 0
                              ? 'text-red-500 hover:bg-red-50'
                              : dow === 6
                                ? 'text-blue-500 hover:bg-blue-50'
                                : 'text-gray-700 hover:bg-gray-200'
                      }`}
                      style={{ fontSize: '11px' }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {selectedDates.length > 0 && (
            <div className="p-2.5 bg-green-50 border border-green-100 rounded-xl">
              <p className="text-[11px] font-bold text-green-800">{selectedDates.length} tanggal dipilih:</p>
              <p className="text-[10px] text-green-700 mt-0.5">{selectedDates.sort((a,b)=>a-b).join(', ')}</p>
            </div>
          )}

          {/* Save button (mobile) */}
          <div className="block md:hidden">
            <button onClick={handleSave}
              disabled={loading || selectedEmpIds.length === 0 || selectedShiftId === '' || selectedDates.length === 0}
              className="w-full py-3 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {loading ? 'Menyimpan...' : 'Terapkan Jadwal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Popover Pilih Shift (untuk klik sel kalender) ─────────────────────
interface ShiftPopoverProps {
  shifts: ShiftSchedule[];
  currentScheduleId?: number;
  onSelect: (scheduleId: number | null) => void;
  onSelectSpecial: (type: 'lj') => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

function ShiftPopover({ shifts, currentScheduleId, onSelect, onSelectSpecial, onClose, style }: ShiftPopoverProps) {
  return (
    <div className="fixed inset-0 z-[9999]" onClick={onClose}>
      <div
        className="fixed bg-white rounded-2xl border border-gray-200 shadow-2xl py-2 w-64 max-h-[360px] overflow-y-auto z-[10000] animate-fade-in text-left font-sans"
        style={style}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Atur Shift & Status Staf</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={14} />
          </button>
        </div>

        {/* Section 1: Libur & Status Staf (Hanya Libur dan Libur Jaga) */}
        <p className="text-[9px] font-bold text-gray-400 px-3 pt-2 pb-1 uppercase tracking-wider">Status Libur Staf</p>
        
        {/* Libur */}
        <button
          onClick={() => onSelect(null)}
          className="w-full text-left px-3 py-1.5 text-[11.5px] font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="w-5 h-5 rounded-md bg-gray-100 border border-gray-200 text-gray-500 font-bold text-[10px] flex items-center justify-center">
            –
          </span>
          <span>Libur / OFF</span>
          {!currentScheduleId && <Check size={13} className="ml-auto text-[#16A34A]" />}
        </button>

        {/* Libur Jaga (LJ) */}
        <button
          onClick={() => onSelectSpecial('lj')}
          className="w-full text-left px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="w-5 h-5 rounded-md bg-slate-200 border border-slate-300 text-slate-800 font-bold text-[10px] flex items-center justify-center">
            LJ
          </span>
          <span>Libur Jaga (LJ)</span>
        </button>

        <div className="h-px bg-gray-100 my-1.5" />

        {/* Section 2: Master Shift Kerja */}
        <p className="text-[9px] font-bold text-gray-400 px-3 py-1 uppercase tracking-wider">Shift Jam Kerja</p>

        {shifts.map(parent => (
          <div key={parent.id}>
            {parent.children && parent.children.length > 0
              ? parent.children.map(child => {
                  const pr = getPresetByHex(child.color);
                  return (
                    <button key={child.id} onClick={() => onSelect(child.id)}
                      className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: child.color }} />
                      <span className="font-semibold text-gray-700 truncate">{child.name}</span>
                      <span className="ml-auto text-[10px] text-gray-400 font-mono flex-shrink-0">
                        {child.start_time?.substring(0, 5)}–{child.end_time?.substring(0, 5)}
                      </span>
                      {currentScheduleId === child.id && <Check size={12} className="ml-1 text-[#16A34A]" />}
                    </button>
                  );
                })
              : (
                <button onClick={() => onSelect(parent.id)}
                  className="w-full text-left px-3 py-2 text-[11px] hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: parent.color }} />
                  <span className="font-semibold text-gray-700 truncate">{parent.name}</span>
                  <span className="ml-auto text-[10px] text-gray-400 font-mono flex-shrink-0">
                    {parent.start_time?.substring(0, 5)}–{parent.end_time?.substring(0, 5)}
                  </span>
                  {currentScheduleId === parent.id && <Check size={12} className="ml-1 text-[#16A34A]" />}
                </button>
              )
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main JadwalShiftTab Component ──────────────────────────────────────
export function JadwalShiftTab({ user }: JadwalShiftTabProps) {
  const { logoUrl } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12
  const [daysInMonth, setDaysInMonth] = useState(0);

  const [shifts, setShifts]         = useState<ShiftSchedule[]>([]);
  const [monthlyData, setMonthlyData] = useState<EmployeeMonthlySchedule[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [saving, setSaving]         = useState<string | null>(null); // "empId-date" key being saved
  const [pendingChanges, setPendingChanges] = useState<Record<string, { employee_id: number; work_date: string; schedule_id: number | null }>>({});
  const [savingAll, setSavingAll]   = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const [showAddModal, setShowAddModal]     = useState(false);
  const [showBulkModal, setShowBulkModal]   = useState(false);
  const [deleteTarget, setDeleteTarget]     = useState<ShiftSchedule | null>(null);
  const [cloneInfo, setCloneInfo]           = useState<string | null>(null);

  // Popover state
  const [popover, setPopover] = useState<{ empId: number; dateStr: string; x: number; y: number } | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  const tableRef = useRef<HTMLDivElement>(null);

  // States untuk edit master shift
  const [expandedShift, setExpandedShift] = useState<number | null>(null);
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [editName, setEditName]           = useState('');
  const [editChildren, setEditChildren]   = useState<any[]>([]);

  const startEdit = (shift: ShiftSchedule) => {
    setEditingId(shift.id);
    setEditName(shift.name);
    setEditChildren(
      shift.children?.map(c => ({
        id: c.id,
        name: c.name,
        start_time: c.start_time.substring(0, 5),
        end_time: c.end_time.substring(0, 5),
        checkin_window_end_time: c.checkin_window_end_time ? c.checkin_window_end_time.substring(0, 5) : null,
      })) ?? []
    );
  };

  const handleAddEditChild = () => {
    setEditChildren(prev => [
      ...prev,
      { id: null, name: `Shift ${prev.length + 1}`, start_time: '08:00', end_time: '15:00', checkin_window_end_time: null }
    ]);
  };

  const handleRemoveEditChild = (index: number) => {
    setEditChildren(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateEditChild = (index: number, key: string, val: any) => {
    setEditChildren(prev => prev.map((item, i) => i === index ? { ...item, [key]: val } : item));
  };

  const saveEdit = async (id: number) => {
    if (!editName.trim()) return;
    try {
      const res = await scheduleApi.update(id, {
        name: editName.trim(),
        shift_type: 'normal', // Selalu 'normal' (GPS Wajib) untuk PJ Bagian
        owner_department_id: user.pj_bagian_department_id || null, // Otomatis ke departemen PJ Bagian
        children: editChildren.map(c => ({
          id: c.id,
          name: c.name,
          start_time: c.start_time,
          end_time: c.end_time,
          checkin_window_end_time: c.checkin_window_end_time || null,
          color: '#2563EB',
          icon: 'sun'
        }))
      });
      if (res.success) {
        setEditingId(null);
        loadData();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal memperbarui shift.');
    }
  };

  const handleRemoveEmployeeFromShift = async (empId: number, days: string[]) => {
    if (confirm('Apakah Anda yakin ingin menghapus karyawan dari shift ini untuk hari-hari terpilih?')) {
      try {
        const assignments = days.map(day => ({
          employee_id: empId,
          work_date: day,
          schedule_id: null
        }));
        await scheduleApi.assignBulkByDate(assignments);
        loadData();
      } catch (err: any) {
        alert(err?.message ?? 'Gagal menghapus penugasan.');
      }
    }
  };

  // Navigation
  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, mRes, eRes] = await Promise.all([
        scheduleApi.list(),
        scheduleApi.getMonthlySchedule(viewYear, viewMonth),
        employeeApi.list(),
      ]);
      if (sRes.success) setShifts(sRes.data);
      if (mRes.success) {
        setMonthlyData(mRes.data);
        setDaysInMonth(mRes.days);
        setHolidays(mRes.holidays || []);
      }
      if (eRes.success) {
        const filtered = eRes.data.filter((e: any) =>
          Number(e.department_id) === Number(user.pj_bagian_department_id)
        );
        setEmployees(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth, user.pj_bagian_department_id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = (newShift: ShiftSchedule) => {
    setShifts(prev => [...prev, newShift]);
    loadData();
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await scheduleApi.delete(id);
      if (res.success) {
        setShifts(prev => prev.filter(s => s.id !== id));
        setDeleteTarget(null);
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menghapus shift.');
    }
  };

  // Klik sel kalender → buka popover (posisi viewport aman dari sidebar)
  const handleCellClick = (e: React.MouseEvent, empId: number, dateStr: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const popoverWidth = 250;
    const popoverHeight = 360;

    // Hitung koordinat relatif terhadap layar (viewport)
    let x = rect.left + rect.width / 2 - popoverWidth / 2;
    // Jaga agar popover tidak menabrak sidebar navigasi (minimal 260px pada desktop)
    const minX = window.innerWidth > 768 ? 265 : 12;
    x = Math.max(minX, Math.min(x, window.innerWidth - popoverWidth - 12));

    let y = rect.bottom + 6;
    if (y + popoverHeight > window.innerHeight) {
      y = Math.max(12, rect.top - popoverHeight - 6);
    }

    setPopover({ empId, dateStr, x, y });
  };

  // Assign shift melalui popover -> SIMPAN KE DRAFT PENDING CHANGES
  const handleAssign = (scheduleId: number | null) => {
    if (!popover) return;
    const { empId, dateStr } = popover;
    setPopover(null);

    const changeKey = `${empId}-${dateStr}`;
    setPendingChanges(prev => ({
      ...prev,
      [changeKey]: { employee_id: empId, work_date: dateStr, schedule_id: scheduleId }
    }));

    // Optimistic update visual tabel secara langsung
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
          newDates[dateStr] = {
            schedule_id: scheduleId,
            name: schedInfo.name,
            color: schedInfo.color,
            icon: schedInfo.icon,
            shift_type: schedInfo.shift_type,
            start_time: schedInfo.start_time?.substring(0, 5),
            end_time: schedInfo.end_time?.substring(0, 5),
          };
        }
      }
      return { ...row, dates: newDates };
    }));
  };

  // Simpan seluruh draft perubahan sekaligus ke backend
  const handleSaveAllPending = async () => {
    const assignments = Object.values(pendingChanges);
    if (assignments.length === 0) return;
    setSavingAll(true);
    try {
      const res = await scheduleApi.assignBulkByDate(assignments);
      if (res.success) {
        setPendingChanges({});
        setSaveSuccessMsg(`Berhasil menyimpan ${assignments.length} perubahan jadwal shift!`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
        loadData();
      }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal menyimpan perubahan jadwal.');
    } finally {
      setSavingAll(false);
    }
  };

  // Batal seluruh draft perubahan
  const handleCancelPending = () => {
    setPendingChanges({});
    loadData();
  };

  // Assign status khusus (Hanya Libur Jaga (LJ))
  const handleAssignSpecial = async (type: 'lj') => {
    if (!popover) return;

    const specConfig: Record<string, { name: string; color: string; icon: string; shift_type: 'normal' | 'dinas_luar' }> = {
      lj: { name: 'Libur Jaga (LJ)', color: '#475569', icon: 'moon', shift_type: 'normal' },
    };

    const targetConfig = specConfig[type];
    if (!targetConfig) return;

    // Cari apakah master shift dengan nama ini sudah ada
    let foundShift = shifts.find(s => s.name.toLowerCase() === targetConfig.name.toLowerCase());

    if (!foundShift) {
      // Buat shift master baru secara otomatis jika belum tersedia
      try {
        const createRes = await scheduleApi.create({
          name: targetConfig.name,
          start_time: '08:00',
          end_time: '16:00',
          color: targetConfig.color,
          icon: targetConfig.icon,
          shift_type: targetConfig.shift_type,
        } as any);
        if (createRes.success) {
          foundShift = createRes.data;
          setShifts(prev => [...prev, createRes.data]);
        }
      } catch (err) {
        console.error('Gagal membuat shift status khusus:', err);
      }
    }

    if (foundShift) {
      await handleAssign(foundShift.id);
    }
  };

  // Build day columns
  const days: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const today_str = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const filteredMonthlyData = monthlyData.filter(row =>
    !searchQuery.trim() || row.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredShifts = shifts.filter(s =>
    !searchQuery.trim() || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get abbreviation for shift badge
  const getShiftBadge = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.includes('LIBUR JAGA') || upper === 'LJ') return 'LJ';
    if (upper.includes('CUTI')) return 'C';
    if (upper.includes('SAKIT')) return 'SK';
    if (upper.includes('DINAS') || upper.includes('TUGAS')) return 'DL';
    if (upper.includes('IZIN')) return 'IZ';
    if (upper.includes('PAGI') || upper === 'P') return 'P';
    if (upper.includes('SIANG') || upper === 'S') return 'S';
    if (upper.includes('MALAM') || upper === 'M') return 'M';
    if (upper.includes('LIBUR') || upper.includes('OFF')) return '-';
    return name.trim().charAt(0).toUpperCase();
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
    if (filteredMonthlyData.length === 0) {
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
      const deptName = user.pj_bagian_department || 'Bagian';

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
      filteredMonthlyData.forEach((row, idx) => {
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

        const isSelfPj =
          (row as any).employee_id && (user as any)?.employee_id
            ? Number((row as any).employee_id) === Number((user as any).employee_id)
            : false;

        const roleBadge = isSelfPj 
          ? `<span style="font-size: 7px; font-weight: bold; background-color: #FEF3C7; color: #D97706; padding: 1px 3px; border-radius: 3px; margin-left: 4px; border: 1px solid #FDE68A;">PJ</span>` 
          : '';

        rowsHtml += `
          <tr style="border: 1px solid #000000;">
            <td style="font-size: 9px; font-weight: bold; padding: 5px 8px; border: 1px solid #000000; color: #000000; white-space: nowrap; ${isSelfPj ? 'background-color: #E6F4EA;' : ''}">
              ${idx + 1}. ${row.name} ${isSelfPj ? '<b>(Anda)</b>' : ''} ${roleBadge}
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
    <div className="space-y-5 font-sans pb-32">
      {/* Clone Warning */}
      {cloneInfo && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[12.5px] font-bold text-amber-800">Shift Diduplikasi Otomatis</p>
            <p className="text-[11.5px] text-amber-700 mt-0.5">{cloneInfo}</p>
          </div>
          <button onClick={() => setCloneInfo(null)}><X size={16} className="text-amber-600" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-gray-900">Jadwal Shift Bulanan</h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Unit: <span className="font-semibold text-gray-600">{user.pj_bagian_department || 'Unit Kerja'}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[13px] font-semibold rounded-xl transition-all">
            <CalendarIcon size={15} /> Tugaskan Massal
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-semibold rounded-xl transition-all shadow-sm">
            <Plus size={15} /> Tambah Shift Baru
          </button>
        </div>
      </div>

      {/* Shift cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && (
          <div className="col-span-2 text-center py-5 text-gray-400 text-[12px]">Memuat data shift...</div>
        )}
        {!loading && shifts.length === 0 && (
          <div className="col-span-2 text-center py-8 text-gray-400 text-[12px] bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            Belum ada master shift untuk unit Anda. Klik "+ Tambah Shift Baru" untuk membuat.
          </div>
        )}
        {shifts
          .filter(s => {
            const n = s.name.toLowerCase();
            return !n.includes('cuti') && !n.includes('sakit') && !n.includes('izin') && !n.includes('dinas luar') && !n.includes('libur jaga') && n !== 'lj';
          })
          .map(shift => {
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
                        {shift.owner_department_id ? (
                          <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            Unit: {user.pj_bagian_department || 'Unit Kerja'}
                          </span>
                        ) : (
                          <span className="inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Shift Umum
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Delete button */}
                    {shift.owner_department_id && editingId !== shift.id && (
                      <button
                        onClick={() => setDeleteTarget(shift)}
                        className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                        title="Hapus shift"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    )}
                    {/* Edit / Save-Cancel buttons */}
                    {shift.owner_department_id && (
                      editingId !== shift.id ? (
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
                      )
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
                              onClick={() => handleRemoveEmployeeFromShift(emp.id, shift.children?.flatMap(c => c.employees?.filter(e => e.id === emp.id).map(e => ((e.pivot as any)?.day_of_week || (e.pivot as any)?.work_date) as string) ?? []) ?? [])}
                              className="text-[11px] text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Hapus
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

      {/* Calendar Section */}
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

        {/* Integration Header Filter */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/20">
          <MonthYearDeptFilter
            month={viewMonth}
            year={viewYear}
            showAllMonthsOption={false}
            embedded={true}
            onMonthChange={setViewMonth}
            onYearChange={setViewYear}
          />
        </div>

        {/* Calendar Title Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-150 bg-gradient-to-r from-green-50/50 to-white flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CalendarIcon size={18} className="text-[#16A34A]" />
            <div>
              <p className="text-[14.5px] font-bold text-gray-900">
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </p>
              <p className="text-[11px] text-gray-400">{daysInMonth} hari · Klik sel karyawan untuk mengubah shift kerja</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-[#16A34A] w-40 font-medium"
              />
            </div>
            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-1.5 px-4 py-1.8 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-700 transition-colors shadow-2xs cursor-pointer active:scale-95"
            >
              <FileText size={12} /> Cetak Jadwal
            </button>
          </div>
        </div>


        {/* Calendar Grid Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#16A34A]" />
            <span className="text-[13px] font-medium">Sinkronisasi jadwal kerja dinas...</span>
          </div>
        ) : (
          <div ref={tableRef} className="overflow-x-auto custom-scrollbar pb-1">
            <table className="text-[11px] border-collapse" style={{ minWidth: `${Math.max(800, 150 + daysInMonth * 44)}px` }}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="sticky left-0 z-20 bg-[#F8FAFC] text-left px-5 py-4 min-w-[150px] font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-r border-slate-200/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-slate-400" />
                      Karyawan
                    </div>
                  </th>
                  {days.map(day => {
                    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dow = new Date(viewYear, viewMonth - 1, day).getDay();
                    const isToday = dateStr === today_str;
                    const isHoliday = holidays.includes(dateStr);
                    const isSunday = dow === 0;
                    return (
                      <th key={day}
                        className={`text-center py-2 px-1 font-semibold text-[10px] ${isToday ? 'bg-green-50/50' : ''}`}
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
                {filteredMonthlyData.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="text-center py-14 text-slate-400 text-[12px] italic">
                      {searchQuery ? 'Karyawan tidak ditemukan.' : 'Belum ada karyawan di unit Anda.'}
                    </td>
                  </tr>
                ) : (
                  filteredMonthlyData.map((row, ri) => {
                    const isSelfPj =
                      row.employee_id && (user as any)?.employee_id
                        ? Number(row.employee_id) === Number((user as any).employee_id)
                        : false;

                    return (
                      <tr key={row.employee_id}
                        className="border-b border-slate-50 group hover:bg-slate-50/30 transition-colors">
                        <td className={`sticky left-0 z-20 ${
                          isSelfPj 
                            ? 'bg-[#F2FBF4]' 
                            : ri % 2 === 0 
                              ? 'bg-white' 
                              : 'bg-[#F8FAFC]/60'
                        } group-hover:bg-[#F0FDF4] px-5 py-3 border-r border-slate-200/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.04)] transition-colors`}>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 whitespace-nowrap text-[12.5px] tracking-wide">{row.name}</p>
                            {isSelfPj && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200/50 uppercase tracking-wider">
                                Anda (PJ)
                              </span>
                            )}
                          </div>
                        </td>
                        {days.map(day => {
                          const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const assigned = row.dates[dateStr];
                          const dow = new Date(viewYear, viewMonth - 1, day).getDay();
                          const isToday = dateStr === today_str;
                          const isSaving = saving === `${row.employee_id}-${dateStr}`;
                          const isPending = !!pendingChanges[`${row.employee_id}-${dateStr}`];
                          const pr = assigned ? getPresetByHex(assigned.color) : null;
                          const badge = assigned ? getShiftBadge(assigned.name) : null;
                          const isLeave = assigned && (
                            (assigned as any).is_approved_leave ||
                            ['cuti', 'sakit', 'izin', 'dinas', 'tugas'].some(keyword => assigned.name.toLowerCase().includes(keyword))
                          );

                          const isSunday = dow === 0;
                          const isHoliday = holidays.includes(dateStr);

                          return (
                            <td key={day} className={`text-center py-2 px-0.5 border-r border-slate-100 relative ${
                              isToday ? 'bg-green-50/20' : ''
                            } ${isSunday || isHoliday ? 'bg-red-50/10' : ''}`}>
                              {isSaving ? (
                                <div className="flex items-center justify-center h-7">
                                  <Loader2 size={12} className="animate-spin text-[#16A34A]" />
                                </div>
                              ) : isSelfPj ? (
                                /* Sel dikunci khusus untuk PJ Bagian (Otomatis Jam Kantor Reguler, KECUALI bila ada Cuti/Sakit/Dinas Luar yang disetujui) */
                                <div className="relative inline-block">
                                  <button
                                    disabled
                                    className={`w-8 h-7 mx-auto rounded-lg text-[10px] font-extrabold border flex items-center justify-center cursor-not-allowed opacity-90 ${
                                      assigned
                                        ? 'shadow-sm'
                                        : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A] shadow-2xs'
                                    }`}
                                    style={assigned && pr ? {
                                      background: pr.bg,
                                      borderColor: pr.border,
                                      color: assigned.color,
                                    } : {}}
                                    title={
                                      assigned
                                        ? `[DISETUJUI] ${assigned.name}`
                                        : "Jam Kantor Biasa (08:30 - 17:00). Akun PJ Bagian otomatis mengikuti Jam Kantor."
                                    }
                                  >
                                    {assigned ? badge : 'N'}
                                  </button>
                                </div>
                              ) : isLeave ? (
                                /* Sel dikunci karena merupakan Cuti / Sakit / Izin dari Admin */
                                <div className="relative inline-block">
                                  <button
                                    disabled
                                    className={`w-8 h-7 mx-auto rounded-lg text-[10px] font-extrabold border flex items-center justify-center cursor-not-allowed opacity-90 shadow-sm`}
                                    style={assigned && pr ? {
                                      background: pr.bg,
                                      borderColor: pr.border,
                                      color: assigned.color,
                                    } : {}}
                                    title={`[DIKUNCI ADMIN] ${assigned.name}\nHanya Admin yang dapat mengubah.`}
                                  >
                                    {badge}
                                  </button>
                                </div>
                              ) : (
                                <div className="relative inline-block">
                                  <button
                                    onClick={e => handleCellClick(e, row.employee_id, dateStr)}
                                    className={`w-8 h-7 mx-auto rounded-lg text-[10px] font-extrabold transition-all hover:scale-110 active:scale-95 border flex items-center justify-center ${
                                      isPending
                                        ? 'ring-2 ring-blue-500 border-blue-400 shadow-md animate-pulse'
                                        : assigned
                                          ? 'shadow-sm hover:shadow-md'
                                          : 'border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100'
                                    }`}
                                    style={assigned && pr ? {
                                      background: pr.bg,
                                      borderColor: isPending ? '#3B82F6' : pr.border,
                                      color: assigned.color,
                                    } : {}}
                                    title={isPending
                                      ? `[BELUM DISIMPAN] ${assigned ? assigned.name : 'Libur'}\nKlik lagi untuk ubah.`
                                      : assigned
                                        ? `${assigned.name} (${assigned.start_time ?? ''}–${assigned.end_time ?? ''})\nKlik untuk ubah`
                                        : `Tgl ${day} — belum ada shift. Klik untuk atur.`}
                                  >
                                    {badge ?? '·'}
                                  </button>
                                  {isPending && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border border-white flex items-center justify-center shadow-xs" title="Perubahan Belum Disimpan" />
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Success Banner */}
      {saveSuccessMsg && (
        <div className="p-3.5 bg-green-500 text-white rounded-2xl shadow-lg flex items-center gap-2.5 text-[13px] font-bold animate-bounce max-w-md mx-auto">
          <Check size={18} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Floating Save Bar */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 border border-gray-700 animate-slide-up font-sans">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <p className="text-[12.5px] font-bold">
              {Object.keys(pendingChanges).length} Perubahan Shift Belum Disimpan
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelPending}
              disabled={savingAll}
              className="px-3 py-1.5 text-[12px] font-semibold text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleSaveAllPending}
              disabled={savingAll}
              className="px-4 py-1.5 text-[12.5px] font-bold text-white bg-[#16A34A] hover:bg-[#0d9240] rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {savingAll ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {savingAll ? 'Menyimpan...' : 'Simpan Perubahan Jadwal'}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddShiftModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} />}
      {showBulkModal && (
        <BulkAssignModal
          user={user}
          shifts={shifts}
          employees={employees}
          year={viewYear}
          month={viewMonth}
          daysInMonth={daysInMonth}
          onClose={() => setShowBulkModal(false)}
          onSaved={loadData}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          shift={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}

      {/* Shift Popover */}
      {popover && (
        <ShiftPopover
          shifts={shifts}
          currentScheduleId={monthlyData.find(r => r.employee_id === popover.empId)?.dates[popover.dateStr]?.schedule_id}
          onSelect={handleAssign}
          onSelectSpecial={handleAssignSpecial}
          onClose={() => setPopover(null)}
          style={{ top: popover.y, left: popover.x }}
        />
      )}
    </div>
  );
}
