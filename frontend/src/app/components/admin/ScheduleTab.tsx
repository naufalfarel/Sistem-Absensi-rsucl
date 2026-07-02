import { useState } from 'react';
import { Sun, Sunset, Moon, Edit2, Check, X, Plus, Users } from 'lucide-react';

type Shift = { id: string; name: string; start: string; end: string; color: string; bg: string; border: string; icon: typeof Sun };

const defaultShifts: Shift[] = [
  { id: 'pagi',    name: 'Shift Pagi',   start: '07:00', end: '14:00', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Sun },
  { id: 'siang',   name: 'Shift Siang',  start: '14:00', end: '21:00', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: Sunset },
  { id: 'malam',   name: 'Shift Malam',  start: '21:00', end: '07:00', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: Moon },
  { id: 'reguler', name: 'Shift Reguler (Sen–Jum)', start: '08:30', end: '17:00', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: Sun },
];

const employeeShifts: Record<string, { name: string; dept: string; shift: string }[]> = {
  pagi:    [
    { name: 'Fajar Nugroho', dept: 'Laboratorium', shift: 'pagi' },
    { name: 'Sri Wahyuni', dept: 'ICU', shift: 'pagi' },
  ],
  siang:   [
    { name: 'dr. Amir Hamzah', dept: 'Poli Umum', shift: 'siang' },
  ],
  malam:   [
    { name: 'Ns. Rizky Pratama', dept: 'IGD', shift: 'malam' },
    { name: 'Ns. Yanti Susanti', dept: 'ICU', shift: 'malam' },
  ],
  reguler: [
    { name: 'Dr. Rina Kusumawati', dept: 'Poli Umum', shift: 'reguler' },
    { name: 'Ns. Ahmad Fauzi', dept: 'ICU', shift: 'reguler' },
    { name: 'dr. Siti Rahma', dept: 'Poli Anak', shift: 'reguler' },
    { name: 'Budi Santoso', dept: 'Administrasi', shift: 'reguler' },
    { name: 'Rini Handayani', dept: 'Farmasi', shift: 'reguler' },
  ],
};

export function ScheduleTab() {
  const [shifts, setShifts] = useState<Shift[]>(defaultShifts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [expandedShift, setExpandedShift] = useState<string | null>(null);

  const startEdit = (shift: Shift) => {
    setEditingId(shift.id);
    setEditStart(shift.start);
    setEditEnd(shift.end);
  };

  const saveEdit = (id: string) => {
    setShifts(prev => prev.map(s => s.id === id ? { ...s, start: editStart, end: editEnd } : s));
    setEditingId(null);
  };

  const totalDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const scheduleMatrix = [
    { emp: 'Dr. Rina Kusumawati', shifts: ['R','R','R','R','R','-'] },
    { emp: 'Ns. Ahmad Fauzi',    shifts: ['R','R','R','R','R','-'] },
    { emp: 'Fajar Nugroho',      shifts: ['P','P','P','P','P','P'] },
    { emp: 'dr. Amir Hamzah',    shifts: ['-','S','S','S','S','-'] },
    { emp: 'Ns. Rizky Pratama',  shifts: ['M','M','M','-','-','M'] },
    { emp: 'Sri Wahyuni',        shifts: ['-','-','P','P','P','P'] },
  ];
  const shiftColors: Record<string, { bg: string; text: string; label: string }> = {
    R: { bg: '#F0FDF4', text: '#16A34A', label: 'Reguler' },
    P: { bg: '#FFFBEB', text: '#D97706', label: 'Pagi' },
    S: { bg: '#EFF6FF', text: '#2563EB', label: 'Siang' },
    M: { bg: '#F5F3FF', text: '#7C3AED', label: 'Malam' },
    '-': { bg: '#F9FAFB', text: '#9CA3AF', label: 'Libur' },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-[16px] font-bold text-gray-900">Jadwal Shift</h2>
        <p className="text-[12px] text-gray-400 mt-0.5">Kelola jadwal shift dan penugasan karyawan</p>
      </div>

      {/* Shift cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shifts.map(shift => (
          <div key={shift.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: shift.bg, border: `1.5px solid ${shift.border}` }}>
                    <shift.icon size={17} style={{ color: shift.color }} />
                  </div>
                  <p className="text-[14px] font-semibold text-gray-800">{shift.name}</p>
                </div>
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

              {editingId === shift.id ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-400 mb-1">Mulai</label>
                    <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all" />
                  </div>
                  <span className="text-gray-400 mt-4">–</span>
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-400 mb-1">Selesai</label>
                    <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center py-2 rounded-xl" style={{ background: shift.bg }}>
                    <p className="text-[11px] text-gray-400">Masuk</p>
                    <p className="text-[18px] font-bold font-mono" style={{ color: shift.color }}>{shift.start}</p>
                  </div>
                  <span className="text-gray-300">–</span>
                  <div className="flex-1 text-center py-2 rounded-xl" style={{ background: shift.bg }}>
                    <p className="text-[11px] text-gray-400">Pulang</p>
                    <p className="text-[18px] font-bold font-mono" style={{ color: shift.color }}>{shift.end}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Employees in this shift */}
            <button onClick={() => setExpandedShift(expandedShift === shift.id ? null : shift.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-gray-400" />
                <span className="text-[12px] text-gray-500">{employeeShifts[shift.id]?.length || 0} karyawan</span>
              </div>
              <span className="text-[11px] text-gray-400">{expandedShift === shift.id ? '▲' : '▼'}</span>
            </button>

            {expandedShift === shift.id && (
              <div className="border-t border-gray-50 px-4 py-3 space-y-1.5">
                {(employeeShifts[shift.id] || []).map((emp, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-[12px] font-medium text-gray-800">{emp.name}</p>
                      <p className="text-[10px] text-gray-400">{emp.dept}</p>
                    </div>
                  </div>
                ))}
                <button className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 border border-dashed border-gray-200 rounded-xl text-[11px] text-gray-400 hover:border-[#16A34A] hover:text-[#16A34A] transition-colors">
                  <Plus size={12} /> Tambah Karyawan
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Schedule matrix */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-[14px] font-semibold text-gray-800">Jadwal Mingguan Karyawan</p>
          <p className="text-[11px] text-gray-400 mt-0.5">R=Reguler · P=Pagi · S=Siang · M=Malam · -=Libur</p>
        </div>
        <div className="overflow-x-auto">
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
              {scheduleMatrix.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-[13px] font-medium text-gray-800 whitespace-nowrap">{row.emp}</td>
                  {row.shifts.map((s, j) => {
                    const sc = shiftColors[s];
                    return (
                      <td key={j} className="px-3 py-3 text-center">
                        <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: sc.bg, color: sc.text }}>
                          {s}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
