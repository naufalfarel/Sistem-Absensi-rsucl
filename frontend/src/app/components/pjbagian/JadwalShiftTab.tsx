import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sun, Sunset, Moon, Star, Zap, Plus, X, Calendar as CalendarIcon,
  Trash2, Edit2, Check, AlertCircle, ChevronLeft, ChevronRight,
  Users, Save, Loader2, Coffee
} from 'lucide-react';
import {
  scheduleApi, employeeApi, ShiftSchedule, EmployeeMonthlySchedule
} from '../../../services/api';
import { MonthYearDeptFilter } from '../ui/MonthYearDeptFilter';

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
function getDayHeaderStyle(dayOfWeek: number) {
  if (dayOfWeek === 0) return { color: '#E11D48', fontWeight: 700 }; // Minggu - merah
  if (dayOfWeek === 6) return { color: '#2563EB', fontWeight: 600 }; // Sabtu - biru
  return { color: '#374151', fontWeight: 500 };
}

// ── Add Shift Modal ────────────────────────────────────────────────────
function AddShiftModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: ShiftSchedule) => void }) {
  const [name, setName]       = useState('');
  const [start, setStart]     = useState('07:00');
  const [end, setEnd]         = useState('15:00');
  const [icon, setIcon]       = useState<IconKey>('sun');
  const [colorId, setColorId] = useState('green');
  const [shiftType, setShiftType] = useState<'normal' | 'dinas_luar'>('normal');
  const [loading, setLoading] = useState(false);

  const preset = COLOR_PRESETS.find(c => c.id === colorId)!;
  const IconComp = ICON_MAP[icon].component;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await scheduleApi.create({
        name: name.trim(),
        start_time: start,
        end_time: end,
        color: preset.color,
        icon,
        shift_type: shiftType,
      } as any);
      if (res.success) { onAdd(res.data); onClose(); }
    } catch (err: any) {
      alert(err?.message ?? 'Gagal membuat shift baru.');
    } finally { setLoading(false); }
  };

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
              <p className="text-[11px] text-gray-500">{start} – {end}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Nama Shift</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Shift Pagi, Shift Siang"
              maxLength={40}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Jam Masuk</label>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all" />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Jam Pulang</label>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all" />
            </div>
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
            <p className="text-[11px] text-gray-500">{shift.start_time?.substring(0, 5)} – {shift.end_time?.substring(0, 5)}</p>
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
  shifts: ShiftSchedule[];
  employees: any[];
  year: number;
  month: number;
  daysInMonth: number;
  onClose: () => void;
  onSaved: () => void;
}

function BulkAssignModal({ shifts, employees, year, month, daysInMonth, onClose, onSaved }: BulkAssignModalProps) {
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | 'libur' | ''>('');
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
            setShifts(prev => [...prev, createRes.data]);
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
              {shifts.map(parent => (
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
  onSelectSpecial: (type: 'cuti' | 'sakit' | 'dinas_luar' | 'izin' | 'lj') => void;
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

        {/* Section 1: Libur & Status Khusus (Cuti, Sakit, Dinas, Izin) */}
        <p className="text-[9px] font-bold text-gray-400 px-3 pt-2 pb-1 uppercase tracking-wider">Status & Izin Staf</p>
        
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

        {/* Cuti */}
        <button
          onClick={() => onSelectSpecial('cuti')}
          className="w-full text-left px-3 py-1.5 text-[11.5px] font-semibold text-orange-700 hover:bg-orange-50 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="w-5 h-5 rounded-md bg-orange-100 border border-orange-200 text-orange-700 font-bold text-[10px] flex items-center justify-center">
            C
          </span>
          <span>Cuti Tahunan (C)</span>
        </button>

        {/* Sakit */}
        <button
          onClick={() => onSelectSpecial('sakit')}
          className="w-full text-left px-3 py-1.5 text-[11.5px] font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-200 text-amber-800 font-bold text-[10px] flex items-center justify-center">
            SK
          </span>
          <span>Izin Sakit (SK)</span>
        </button>

        {/* Dinas Luar */}
        <button
          onClick={() => onSelectSpecial('dinas_luar')}
          className="w-full text-left px-3 py-1.5 text-[11.5px] font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="w-5 h-5 rounded-md bg-purple-100 border border-purple-200 text-purple-700 font-bold text-[10px] flex items-center justify-center">
            DL
          </span>
          <span>Dinas Luar (DL)</span>
        </button>

        {/* Izin */}
        <button
          onClick={() => onSelectSpecial('izin')}
          className="w-full text-left px-3 py-1.5 text-[11.5px] font-semibold text-cyan-700 hover:bg-cyan-50 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span className="w-5 h-5 rounded-md bg-cyan-100 border border-cyan-200 text-cyan-700 font-bold text-[10px] flex items-center justify-center">
            IZ
          </span>
          <span>Izin Resmi (IZ)</span>
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
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12
  const [daysInMonth, setDaysInMonth] = useState(0);

  const [shifts, setShifts]         = useState<ShiftSchedule[]>([]);
  const [monthlyData, setMonthlyData] = useState<EmployeeMonthlySchedule[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
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

  // Assign status khusus (Cuti, Sakit, Dinas Luar, Izin)
  const handleAssignSpecial = async (type: 'cuti' | 'sakit' | 'dinas_luar' | 'izin' | 'lj') => {
    if (!popover) return;

    const specConfig: Record<string, { name: string; color: string; icon: string; shift_type: 'normal' | 'dinas_luar' }> = {
      cuti:       { name: 'Cuti Tahunan', color: '#EA580C', icon: 'zap',  shift_type: 'normal' },
      sakit:      { name: 'Izin Sakit',   color: '#D97706', icon: 'zap',  shift_type: 'normal' },
      dinas_luar: { name: 'Dinas Luar',   color: '#7C3AED', icon: 'star', shift_type: 'dinas_luar' },
      izin:       { name: 'Izin Resmi',   color: '#0891B2', icon: 'zap',  shift_type: 'normal' },
      lj:         { name: 'Libur Jaga (LJ)', color: '#475569', icon: 'moon', shift_type: 'normal' },
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

  return (
    <div className="space-y-5 font-sans">
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

      {/* Calendar Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header Filter Terpadu */}
        <div className="p-4 border-b border-gray-100 bg-slate-50/30">
          <MonthYearDeptFilter
            month={viewMonth}
            year={viewYear}
            showAllMonthsOption={false}
            embedded={true}
            onMonthChange={setViewMonth}
            onYearChange={setViewYear}
          />
        </div>

        {/* Calendar Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center gap-3">
            <CalendarIcon size={18} className="text-[#16A34A]" />
            <div>
              <p className="text-[15px] font-bold text-gray-900">
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </p>
              <p className="text-[11px] text-gray-400">{daysInMonth} hari · Klik sel untuk atur shift</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <input type="text" placeholder="Cari karyawan..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="hidden sm:block px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-white focus:outline-none focus:border-[#16A34A] w-36" />
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-2 border-b border-gray-50 flex items-center gap-4 flex-wrap">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Keterangan:</p>
          {shifts.slice(0, 5).map(s => {
            const badge = getShiftBadge(s.name);
            const pr = getPresetByHex(s.color);
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold border"
                  style={{ background: pr.bg, borderColor: pr.border, color: s.color }}>
                  {badge}
                </span>
                <span className="text-[10px] text-gray-500">{s.name}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold border border-gray-200 bg-gray-100 text-gray-400">
              –
            </span>
            <span className="text-[10px] text-gray-500">Libur</span>
          </div>
        </div>

        {/* Calendar Grid Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
            <Loader2 size={22} className="animate-spin text-[#16A34A]" />
            <span className="text-[13px]">Memuat jadwal...</span>
          </div>
        ) : (
          <div ref={tableRef} className="overflow-x-auto pb-2">
            <table className="text-[11px] border-collapse" style={{ minWidth: `${Math.max(800, 140 + daysInMonth * 44)}px` }}>
              <thead>
                <tr className="border-b border-gray-100">
                  {/* Sticky name column */}
                  <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-3 min-w-[130px] font-semibold text-gray-500 uppercase tracking-wider text-[10px] border-r border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-gray-400" />
                      Karyawan
                    </div>
                  </th>
                  {days.map(day => {
                    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dow = new Date(viewYear, viewMonth - 1, day).getDay(); // 0=Sun
                    const isToday = dateStr === today_str;
                    return (
                      <th key={day}
                        className={`text-center py-2 px-1 font-semibold text-[10px] ${isToday ? 'bg-green-50' : ''}`}
                        style={{ minWidth: '40px', ...getDayHeaderStyle(dow) }}>
                        <div className="flex flex-col items-center">
                          <span>{DAY_ABBR[dow]}</span>
                          <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            isToday ? 'bg-[#16A34A] text-white' : ''
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
                    <td colSpan={daysInMonth + 1} className="text-center py-10 text-gray-400 text-[12px] italic">
                      {searchQuery ? 'Karyawan tidak ditemukan.' : 'Belum ada karyawan di unit Anda.'}
                    </td>
                  </tr>
                ) : (
                  filteredMonthlyData.map((row, ri) => {
                    const isSelfPj =
                      row.employee_id === user.id ||
                      row.name.toLowerCase().trim() === user.name.toLowerCase().trim();

                    return (
                      <tr key={row.employee_id}
                        className={`border-b border-gray-50 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-green-50/30 transition-colors`}>
                        {/* Sticky name */}
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-2 border-r border-gray-100">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-gray-800 whitespace-nowrap text-[12px]">{row.name}</p>
                            {isSelfPj && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80 whitespace-nowrap">
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

                          return (
                            <td key={day} className={`px-0.5 py-1 text-center relative ${isToday ? 'bg-green-50/50' : ''}`}>
                              {isSaving ? (
                                <div className="flex items-center justify-center h-7">
                                  <Loader2 size={12} className="animate-spin text-[#16A34A]" />
                                </div>
                              ) : isSelfPj ? (
                                /* Sel dikunci khusus untuk PJ Bagian (Otomatis Jam Kantor Reguler, KECUALI bila ada Cuti/Sakit/Dinas Luar yang disetujui) */
                                <div className="relative inline-block">
                                  <button
                                    disabled
                                    className={`w-8 h-7 mx-auto rounded-lg text-[10px] font-bold border flex items-center justify-center cursor-not-allowed opacity-95 ${
                                      assigned
                                        ? 'shadow-sm font-extrabold'
                                        : dow === 0
                                          ? 'border-gray-200 bg-gray-100 text-gray-400'
                                          : 'border-green-300 bg-green-50 text-green-700 font-extrabold shadow-2xs'
                                    }`}
                                    style={assigned && pr ? {
                                      background: pr.bg,
                                      borderColor: pr.border,
                                      color: assigned.color,
                                    } : {}}
                                    title={
                                      assigned
                                        ? `[DISETUJUI] ${assigned.name}`
                                        : dow === 0
                                          ? "Hari Minggu — Libur Reguler"
                                          : "Jam Kantor Biasa (08:30 - 17:00). Akun PJ Bagian otomatis mengikuti Jam Kantor."
                                    }
                                  >
                                    {assigned ? badge : (dow === 0 ? '-' : 'K')}
                                  </button>
                                </div>
                              ) : (
                                <div className="relative inline-block">
                                  <button
                                    onClick={e => handleCellClick(e, row.employee_id, dateStr)}
                                    className={`w-8 h-7 mx-auto rounded-lg text-[10px] font-bold transition-all hover:scale-110 active:scale-95 border flex items-center justify-center ${
                                      isPending
                                        ? 'ring-2 ring-blue-500 border-blue-400 shadow-md font-extrabold animate-pulse'
                                        : assigned
                                          ? 'shadow-sm hover:shadow-md'
                                          : dow === 0
                                            ? 'border-red-100 bg-red-50/50 text-red-300 hover:bg-red-100'
                                            : dow === 6
                                              ? 'border-blue-100 bg-blue-50/50 text-blue-300 hover:bg-blue-100'
                                              : 'border-gray-100 bg-gray-50 text-gray-300 hover:bg-gray-100'
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
