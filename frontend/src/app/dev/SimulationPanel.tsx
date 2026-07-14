/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SIMULATION PANEL — DEVELOPMENT / TESTING ONLY              ║
 * ║  File ini BISA DIHAPUS setelah selesai testing.             ║
 * ║  Untuk menghapus fitur ini:                                 ║
 * ║    1. Hapus file ini: src/app/dev/SimulationPanel.tsx       ║
 * ║    2. Hapus import + <SimulationPanel> dari AttendancePage  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { useState } from 'react';
import { Clock, FlaskConical, ChevronDown, ChevronUp, RotateCcw, Zap } from 'lucide-react';

interface SimulationPanelProps {
  /** Callback dipanggil saat jam simulasi berubah. null = kembali ke jam real. */
  onTimeChange: (time: string | null) => void;
  /** Shift aktif karyawan (untuk menentukan preset waktu) */
  shiftStart?: string; // "08:00:00"
  shiftEnd?: string;   // "17:00:00"
  /** Nilai jam simulasi saat ini */
  currentSimTime: string | null;
}

interface Preset {
  label: string;
  desc: string;
  time: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

function buildPresets(shiftStart: string, shiftEnd: string): Preset[] {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return { h, m };
  };
  const addMin = (t: string, min: number): string => {
    const { h, m } = parse(t);
    const total = h * 60 + m + min;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const subMin = (t: string, min: number): string => {
    const { h, m } = parse(t);
    let total = h * 60 + m - min;
    if (total < 0) total += 24 * 60;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const start = shiftStart.substring(0, 5); // "08:00"
  const end   = shiftEnd.substring(0, 5);   // "17:00"

  return [
    {
      label: '✅ Tepat Waktu',
      desc: `${start} – Pas jam shift mulai`,
      time: start,
      color: '#16A34A',
      bgColor: '#F0FDF4',
      borderColor: '#BBF7D0',
    },
    {
      label: '⚠️ Telat (masih hadir)',
      desc: `${addMin(start, 20)} – 20 menit setelah shift`,
      time: addMin(start, 20),
      color: '#D97706',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
    },
    {
      label: '🔒 Melewati Batas Check-In',
      desc: `${addMin(start, 65)} – 65 menit setelah shift`,
      time: addMin(start, 65),
      color: '#DC2626',
      bgColor: '#FEF2F2',
      borderColor: '#FECACA',
    },
    {
      label: '📤 Check-Out Normal',
      desc: `${end} – Pas jam selesai shift`,
      time: end,
      color: '#EA580C',
      bgColor: '#FFF7ED',
      borderColor: '#FED7AA',
    },
    {
      label: '🚀 Pulang Cepat',
      desc: `${subMin(end, 30)} – 30 menit sebelum selesai`,
      time: subMin(end, 30),
      color: '#7C3AED',
      bgColor: '#F5F3FF',
      borderColor: '#DDD6FE',
    },
    {
      label: '🕐 Lembur',
      desc: `${addMin(end, 30)} – 30 menit setelah selesai`,
      time: addMin(end, 30),
      color: '#0369A1',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
    },
    {
      label: '🔒 Batas Check-Out Lewat',
      desc: `${addMin(end, 61)} – 61 menit setelah selesai`,
      time: addMin(end, 61),
      color: '#DC2626',
      bgColor: '#FEF2F2',
      borderColor: '#FECACA',
    },
    {
      label: '🌙 Shift Malam (Check-In)',
      desc: '21:00 – Jam masuk shift malam',
      time: '21:00',
      color: '#6B7280',
      bgColor: '#F9FAFB',
      borderColor: '#E5E7EB',
    },
    {
      label: '🌅 Shift Malam (Check-Out)',
      desc: '07:00 – Jam pulang shift malam',
      time: '07:00',
      color: '#0891B2',
      bgColor: '#ECFEFF',
      borderColor: '#A5F3FC',
    },
  ];
}

export function SimulationPanel({ onTimeChange, shiftStart = '08:00:00', shiftEnd = '17:00:00', currentSimTime }: SimulationPanelProps) {
  const [open, setOpen] = useState(false);
  const [customTime, setCustomTime] = useState('');

  const presets = buildPresets(shiftStart, shiftEnd);
  const isActive = currentSimTime !== null;

  const handlePreset = (time: string) => {
    onTimeChange(time);
  };

  const handleCustomApply = () => {
    if (!customTime) return;
    onTimeChange(customTime);
  };

  const handleReset = () => {
    onTimeChange(null);
    setCustomTime('');
  };

  return (
    <div
      className="mb-4 rounded-2xl border-2 overflow-hidden transition-all"
      style={{
        borderColor: isActive ? '#F59E0B' : '#FDE68A',
        background: isActive ? '#FFFBEB' : '#FFFDF0',
      }}
    >
      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ background: isActive ? '#FEF3C7' : 'transparent' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: isActive ? '#F59E0B' : '#FDE68A' }}
          >
            <FlaskConical size={14} color={isActive ? 'white' : '#92400E'} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-amber-900">
              🧪 Mode Simulasi Waktu
              <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 align-middle">
                DEV ONLY
              </span>
            </p>
            <p className="text-[10px] text-amber-700">
              {isActive
                ? `Jam disimulasikan: ${currentSimTime} WIB`
                : 'Klik untuk mengganti jam absensi saat testing'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <button
              onClick={(e) => { e.stopPropagation(); handleReset(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-[10px] font-semibold transition-colors"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          )}
          {open
            ? <ChevronUp size={16} color="#92400E" />
            : <ChevronDown size={16} color="#92400E" />
          }
        </div>
      </button>

      {/* Panel body */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-amber-200">
          {/* Warning banner */}
          <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-100 border border-amber-200">
            <span className="text-[11px] text-amber-800 leading-relaxed">
              ⚠️ <strong>Hanya untuk testing.</strong> Jam yang dipilih akan dikirim ke backend sebagai <code className="bg-amber-200 px-1 rounded text-[10px]">simulated_time</code> sehingga validasi shift (telat, lembur, pulang cepat) berjalan sesuai jam simulasi.
            </span>
          </div>

          {/* Custom time input */}
          <div className="mb-3">
            <label className="block text-[10px] font-semibold text-amber-800 mb-1.5 uppercase tracking-wide">
              Atur Jam Manual
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600" />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 border-2 border-amber-200 rounded-xl text-[13px] font-mono bg-white text-amber-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
              <button
                onClick={handleCustomApply}
                disabled={!customTime}
                className="px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-all flex items-center gap-1.5"
                style={{
                  background: customTime ? '#F59E0B' : '#FDE68A',
                  color: customTime ? 'white' : '#92400E',
                  cursor: customTime ? 'pointer' : 'not-allowed',
                }}
              >
                <Zap size={12} />
                Terapkan
              </button>
            </div>
          </div>

          {/* Preset grid */}
          <label className="block text-[10px] font-semibold text-amber-800 mb-1.5 uppercase tracking-wide">
            Skenario Cepat
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const isSelected = currentSimTime === preset.time;
              return (
                <button
                  key={preset.time}
                  onClick={() => handlePreset(preset.time)}
                  className="text-left px-3 py-2.5 rounded-xl border-2 transition-all active:scale-[0.97]"
                  style={{
                    background: isSelected ? preset.bgColor : 'white',
                    borderColor: isSelected ? preset.color : '#FDE68A',
                    boxShadow: isSelected ? `0 0 0 2px ${preset.color}25` : 'none',
                  }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: preset.color }}>
                    {preset.label}
                  </p>
                  <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{preset.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="mt-3 w-full py-2.5 rounded-xl border-2 border-dashed border-amber-300 text-[12px] font-semibold text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={13} />
            Kembalikan ke Jam Real ({new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
          </button>
        </div>
      )}
    </div>
  );
}
