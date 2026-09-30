export const OVERTIME_COMPENSATION_RATES = {
  regularHourly: 10_000,
  dayShift: 50_000,
  nightShift: 60_000,
} as const;

export interface OvertimeCompensationDepartment {
  id?: number | string;
  name: string;
  count_sunday_in_leave?: boolean;
}

export interface OvertimeCompensationRecord {
  id?: number | string;
  employee_id?: number | string | null;
  unit_kerja?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  employee?: {
    department?: string | null;
  } | null;
  system_checkout_data?: {
    check_in?: string | null;
    check_out?: string | null;
    overtime_minutes?: number | null;
  } | null;
}

export type OvertimeShiftCategory = "pagi" | "siang" | "malam";
export type OvertimeCompensationScheme =
  | "shift"
  | "regular_hourly"
  | "dental_accumulated";

export interface OvertimeLineCalculation<T extends OvertimeCompensationRecord> {
  record: T;
  unitName: string;
  durationMinutes: number;
  shiftCategory: OvertimeShiftCategory;
  scheme: OvertimeCompensationScheme;
  /**
   * Null khusus Poli Gigi karena pecahan menit dibayar setelah diakumulasi
   * pada total pegawai, sehingga nominal tidak boleh ditempelkan ke satu baris.
   */
  rowPay: number | null;
}

export interface OvertimeCompensationBreakdown {
  dayShiftCount: number;
  nightShiftCount: number;
  regularPayableHours: number;
  dentalAccumulatedMinutes: number;
  dentalPayableHours: number;
}

export interface EmployeeOvertimeCompensation<
  T extends OvertimeCompensationRecord,
> {
  lines: OvertimeLineCalculation<T>[];
  totalMinutes: number;
  totalPay: number;
  breakdown: OvertimeCompensationBreakdown;
}

/** Normalisasi nama unit agar data lama, kapitalisasi, dan tanda baca tetap cocok. */
export const normalizeOvertimeUnitName = (value?: string | null): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const canonicalOvertimeUnitName = (value: string): string => {
  const compact = normalizeOvertimeUnitName(value)
    .replace(/\b(instalasi|instansi|instasi|unit kerja|unit|bagian)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bigp\b/g, "igd")
    .replace(/\bgawat darurat\b/g, "igd")
    .replace(/\bcentral\b/g, "sentral")
    .replace(/^ibs$/, "bedah sentral")
    .replace(/^farmasi depo\b/, "depo")
    .replace(/^depo farmasi\b/, "depo")
    .replace(/^(poliklinik gigi|klinik gigi|dental)$/, "poli gigi")
    .replace(/^rawat inap (jeumpa [ab]|seulanga|meulu|kupula|transit)$/, "$1")
    .trim()
    .replace(/\s+/g, " ");
  return compact;
};

/** Membandingkan nama unit dengan toleransi awalan seperti "Instalasi". */
export const areOvertimeUnitNamesEquivalent = (
  left?: string | null,
  right?: string | null,
): boolean => {
  const normalizedLeft = canonicalOvertimeUnitName(left ?? "");
  const normalizedRight = canonicalOvertimeUnitName(right ?? "");
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight;
};

/** Unit pada SPL menjadi sumber utama; unit pegawai hanya untuk data lama. */
export const resolveOvertimeUnitName = (
  record: OvertimeCompensationRecord,
): string => {
  const requestUnit = record.unit_kerja?.trim();
  if (requestUnit) return requestUnit;

  const employeeUnit = record.employee?.department?.trim();
  return employeeUnit || "Umum";
};

const EXPLICIT_SHIFT_UNIT_PATTERNS: RegExp[] = [
  /^depo(?:\s|$)/,
  /^laboratorium(?:\s|$)/,
  /^radiologi(?:\s|$)/,
  /^(rawat inap|ranap)(?:\s|$)/,
  /^igd$/,
  /^nicu$/,
  /^icu$/,
  /^(rekam medis|rm) igd$/,
  /^bedah sentral$/,
  /^cssd$/,
  /^(jeumpa [ab]|seulanga|meulu|kupula|transit)$/,
];

/**
 * Penentu skema per shift. Flag departemen adalah sumber utama. Alias dipakai
 * untuk data historis/variasi nama unit yang secara eksplisit masuk aturan.
 */
export const isSpecialShiftOvertimeUnit = (
  unitName: string,
  departments: readonly OvertimeCompensationDepartment[],
): boolean => {
  const normalizedUnit = canonicalOvertimeUnitName(unitName);
  if (!normalizedUnit) return false;

  const matchesFlaggedDepartment = departments.some(
    (department) =>
      department.count_sunday_in_leave === true &&
      areOvertimeUnitNamesEquivalent(unitName, department.name),
  );
  if (matchesFlaggedDepartment) return true;

  return EXPLICIT_SHIFT_UNIT_PATTERNS.some((pattern) =>
    pattern.test(normalizedUnit),
  );
};

export const isPoliGigiOvertimeUnit = (unitName: string): boolean => {
  return canonicalOvertimeUnitName(unitName) === "poli gigi";
};

const parseClockMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

/** Durasi SPL diutamakan; durasi deteksi absensi hanya fallback data lama. */
export const calculateOvertimeDurationMinutes = (
  record: OvertimeCompensationRecord,
): number => {
  const start = parseClockMinutes(record.start_time);
  const end = parseClockMinutes(record.end_time);

  if (start !== null && end !== null) {
    const normalizedEnd = end < start ? end + 24 * 60 : end;
    return Math.max(0, normalizedEnd - start);
  }

  const fallbackMinutes = Number(
    record.system_checkout_data?.overtime_minutes ?? 0,
  );
  return Number.isFinite(fallbackMinutes)
    ? Math.max(0, Math.floor(fallbackMinutes))
    : 0;
};

/**
 * Pagi/siang sama-sama bertarif Rp50.000. Mulai >=20:00 atau dini hari adalah
 * malam. Untuk variasi lintas hari yang mulai lebih awal, mayoritas durasinya
 * harus berada pada 20:00-08:00; shift siang 15:00-00:00 tetap siang.
 * Batas dini hari berhenti pukul 06:00 agar shift pagi 06:00 tetap pagi.
 */
export const determineOvertimeShiftCategory = (
  record: OvertimeCompensationRecord,
): OvertimeShiftCategory => {
  const start =
    parseClockMinutes(record.start_time) ??
    parseClockMinutes(record.system_checkout_data?.check_in);
  const end =
    parseClockMinutes(record.end_time) ??
    parseClockMinutes(record.system_checkout_data?.check_out);

  if (start === null) return "pagi";

  const crossesMidnight = end !== null && end < start;
  const overnightEnd = crossesMidnight ? end + 24 * 60 : start;
  const nightMinutes = Math.max(
    0,
    Math.min(overnightEnd, 32 * 60) - Math.max(start, 20 * 60),
  );
  const mostlyNight = crossesMidnight && nightMinutes > (overnightEnd - start) / 2;
  if (mostlyNight || start >= 20 * 60 || start < 6 * 60) {
    return "malam";
  }
  if (start >= 14 * 60) return "siang";
  return "pagi";
};

/**
 * Menghitung kompensasi satu pegawai untuk rentang laporan terpilih.
 * - Unit shift: satu permohonan disetujui = satu tarif shift.
 * - Unit reguler: pembulatan jam dilakukan per permohonan, tidak digabung.
 * - Poli Gigi: seluruh menit pada rentang laporan digabung baru dibulatkan.
 */
export const calculateEmployeeOvertimeCompensation = <
  T extends OvertimeCompensationRecord,
>(
  records: readonly T[],
  departments: readonly OvertimeCompensationDepartment[],
): EmployeeOvertimeCompensation<T> => {
  let totalMinutes = 0;
  let directPay = 0;
  let dentalAccumulatedMinutes = 0;

  const breakdown: OvertimeCompensationBreakdown = {
    dayShiftCount: 0,
    nightShiftCount: 0,
    regularPayableHours: 0,
    dentalAccumulatedMinutes: 0,
    dentalPayableHours: 0,
  };

  const lines = records.map((record): OvertimeLineCalculation<T> => {
    const unitName = resolveOvertimeUnitName(record);
    const durationMinutes = calculateOvertimeDurationMinutes(record);
    const shiftCategory = determineOvertimeShiftCategory(record);
    const isDentalAccumulation = isPoliGigiOvertimeUnit(unitName);
    const isSpecialShift =
      !isDentalAccumulation && isSpecialShiftOvertimeUnit(unitName, departments);

    totalMinutes += durationMinutes;

    if (isSpecialShift) {
      // Selain Poli Gigi, setiap pengajuan harus mencapai minimal satu jam.
      if (durationMinutes < 60) {
        return {
          record,
          unitName,
          durationMinutes,
          shiftCategory,
          scheme: "shift",
          rowPay: 0,
        };
      }

      const isNight = shiftCategory === "malam";
      const rowPay = isNight
        ? OVERTIME_COMPENSATION_RATES.nightShift
        : OVERTIME_COMPENSATION_RATES.dayShift;
      directPay += rowPay;
      if (isNight) breakdown.nightShiftCount += 1;
      else breakdown.dayShiftCount += 1;

      return {
        record,
        unitName,
        durationMinutes,
        shiftCategory,
        scheme: "shift",
        rowPay,
      };
    }

    if (isDentalAccumulation) {
      dentalAccumulatedMinutes += durationMinutes;
      return {
        record,
        unitName,
        durationMinutes,
        shiftCategory,
        scheme: "dental_accumulated",
        rowPay: null,
      };
    }

    const payableHours = Math.floor(durationMinutes / 60);
    const rowPay =
      payableHours * OVERTIME_COMPENSATION_RATES.regularHourly;
    directPay += rowPay;
    breakdown.regularPayableHours += payableHours;

    return {
      record,
      unitName,
      durationMinutes,
      shiftCategory,
      scheme: "regular_hourly",
      rowPay,
    };
  });

  const dentalPayableHours = Math.floor(dentalAccumulatedMinutes / 60);
  const dentalPay =
    dentalPayableHours * OVERTIME_COMPENSATION_RATES.regularHourly;
  breakdown.dentalAccumulatedMinutes = dentalAccumulatedMinutes;
  breakdown.dentalPayableHours = dentalPayableHours;

  return {
    lines,
    totalMinutes,
    totalPay: directPay + dentalPay,
    breakdown,
  };
};
