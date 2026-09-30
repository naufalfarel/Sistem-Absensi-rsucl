import React from "react";

export const INDO_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

interface MonthYearDeptFilterProps {
  month: number; // 0 = Semua Bulan, 1..12 = Jan..Des
  year: number; // Contoh: 2026 (0 = Semua Tahun)
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;

  // Optional: Filter Departemen / Bagian (untuk Admin & PJ Bagian)
  deptId?: string | number;
  onDeptChange?: (deptId: string) => void;
  departments?: Array<{ id: number; name: string }>;

  // Options
  showAllMonthsOption?: boolean; // Default true (tampilkan pilihan "Semua Bulan")
  showAllYearsOption?: boolean; // Default false (tampilkan pilihan "Semua Tahun")
  yearRange?: number[]; // Default: 2020 .. 2050+
  embedded?: boolean; // True: gabung langsung dalam card/tabel tanpa border outer ganda
  className?: string;
}

/**
 * Komponen Reusable Filter BULAN, TAHUN, dan Unit kerja
 * dengan tata letak responsif sesuai antarmuka standar RSUCL.
 */
export function MonthYearDeptFilter({
  month,
  year,
  onMonthChange,
  onYearChange,
  deptId,
  onDeptChange,
  departments,
  showAllMonthsOption = true,
  showAllYearsOption = false,
  yearRange,
  embedded = false,
  className = "",
}: MonthYearDeptFilterProps) {
  // Generasi rentang tahun secara dinamis (untuk masa depan)
  const currentYr = new Date().getFullYear();
  const maxYear = currentYr + 10; // Batas atas = 10 tahun ke depan
  const minYear = 2020;

  const effectiveYearRange =
    yearRange ??
    Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const containerStyle = embedded
    ? `period-filter flex flex-wrap items-end gap-3 font-sans ${className}`
    : `period-filter flex flex-wrap items-end gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs font-sans ${className}`;

  return (
    <div className={containerStyle}>
      {/* ── BULAN ────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Bulan
        </label>
        <select
          aria-label="Bulan"
          value={month}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all cursor-pointer shadow-xs"
        >
          {showAllMonthsOption && <option value={0}>Semua Bulan</option>}
          {INDO_MONTHS.map((m, i) => (
            <option key={i + 1} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* ── TAHUN ────────────────────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Tahun
        </label>
        <select
          aria-label="Tahun"
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all cursor-pointer shadow-xs"
        >
          {showAllYearsOption && <option value={0}>Semua Tahun</option>}
          {effectiveYearRange.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* ── DEPARTEMEN / BAGIAN (OPSIONAL) ────────────────── */}
      {onDeptChange && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Unit kerja
          </label>
          <select
            aria-label="Unit kerja"
            value={deptId ?? "all"}
            onChange={(e) => onDeptChange(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 bg-white focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all cursor-pointer shadow-xs"
          >
            <option value="all">Semua Unit kerja</option>
            {departments?.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
