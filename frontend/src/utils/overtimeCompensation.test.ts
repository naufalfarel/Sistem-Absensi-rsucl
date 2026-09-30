import assert from "node:assert/strict";
import test from "node:test";

import {
  areOvertimeUnitNamesEquivalent,
  calculateEmployeeOvertimeCompensation,
  calculateOvertimeDurationMinutes,
  determineOvertimeShiftCategory,
  isSpecialShiftOvertimeUnit,
  resolveOvertimeUnitName,
  type OvertimeCompensationDepartment,
  type OvertimeCompensationRecord,
} from "./overtimeCompensation";

const departments: OvertimeCompensationDepartment[] = [
  { id: 1, name: "Asuransi", count_sunday_in_leave: false },
  { id: 2, name: "Instalasi Laundry", count_sunday_in_leave: true },
  { id: 3, name: "Poli Gigi", count_sunday_in_leave: false },
];

test("durasi SPL diutamakan dari deteksi absensi dan mendukung lintas hari", () => {
  assert.equal(
    calculateOvertimeDurationMinutes({
      start_time: "08:00",
      end_time: "14:00",
      system_checkout_data: { overtime_minutes: 999 },
    }),
    360,
  );
  assert.equal(
    calculateOvertimeDurationMinutes({
      start_time: "20:00",
      end_time: "08:00",
    }),
    720,
  );
  assert.equal(
    calculateOvertimeDurationMinutes({
      start_time: "tidak-valid",
      end_time: "08:00",
      system_checkout_data: { overtime_minutes: 75 },
    }),
    75,
  );
});

test("kategori malam memakai batas 20:00, overnight, dan dini hari", () => {
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "15:00", end_time: "00:00" }),
    "siang",
  );
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "19:00", end_time: "07:00" }),
    "malam",
  );
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "19:59", end_time: "22:00" }),
    "siang",
  );
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "20:00", end_time: "08:00" }),
    "malam",
  );
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "18:00", end_time: "05:00" }),
    "malam",
  );
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "02:00", end_time: "04:00" }),
    "malam",
  );
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "06:00", end_time: "13:00" }),
    "pagi",
  );
  assert.equal(
    determineOvertimeShiftCategory({ start_time: "07:30", end_time: "14:30" }),
    "pagi",
  );
});

test("nama unit SPL mengalahkan unit pegawai dan pencocokan toleran awalan", () => {
  const record: OvertimeCompensationRecord = {
    unit_kerja: "Instalasi Laboratorium",
    employee: { department: "Asuransi" },
  };
  assert.equal(resolveOvertimeUnitName(record), "Instalasi Laboratorium");
  assert.equal(
    areOvertimeUnitNamesEquivalent("Instalasi Laboratorium", "Laboratorium"),
    true,
  );
  assert.equal(
    areOvertimeUnitNamesEquivalent("Farmasi Depo 1", "Farmasi Depo 2"),
    false,
  );
});

test("flag Minggu dan alias unit historis memakai skema per shift", () => {
  assert.equal(
    isSpecialShiftOvertimeUnit("Instalasi Laundry", departments),
    true,
  );
  assert.equal(
    isSpecialShiftOvertimeUnit("Depo Farmasi Rawat Inap", departments),
    true,
  );
  assert.equal(
    isSpecialShiftOvertimeUnit("Instasi Bedah Central", departments),
    true,
  );
  assert.equal(
    isSpecialShiftOvertimeUnit("Rekam Medis IGP", departments),
    true,
  );
  assert.equal(isSpecialShiftOvertimeUnit("Asuransi", departments), false);
});

test("unit shift dibayar sekali per permohonan, bukan dikali jumlah jam", () => {
  const result = calculateEmployeeOvertimeCompensation(
    [
      { unit_kerja: "Depo Farmasi", start_time: "08:00", end_time: "14:00" },
      { unit_kerja: "ICU", start_time: "14:00", end_time: "20:00" },
      { unit_kerja: "Radiologi", start_time: "19:30", end_time: "21:30" },
      { unit_kerja: "CSSD", start_time: "20:00", end_time: "08:00" },
    ],
    departments,
  );

  assert.equal(result.totalMinutes, 1_560);
  assert.equal(result.totalPay, 210_000);
  assert.equal(result.breakdown.dayShiftCount, 3);
  assert.equal(result.breakdown.nightShiftCount, 1);
  assert.deepEqual(
    result.lines.map((line) => line.rowPay),
    [50_000, 50_000, 50_000, 60_000],
  );
});

test("unit shift tanpa durasi valid tidak menghasilkan nominal", () => {
  const result = calculateEmployeeOvertimeCompensation(
    [{ unit_kerja: "ICU", start_time: null, end_time: null }],
    departments,
  );

  assert.equal(result.totalMinutes, 0);
  assert.equal(result.totalPay, 0);
  assert.equal(result.breakdown.dayShiftCount, 0);
  assert.equal(result.breakdown.nightShiftCount, 0);
  assert.equal(result.lines[0].rowPay, 0);
});

test("unit reguler membulatkan setiap pengajuan dan tidak menggabungkan sisa", () => {
  const result = calculateEmployeeOvertimeCompensation(
    [
      { unit_kerja: "Asuransi", start_time: "17:00", end_time: "17:30" },
      { unit_kerja: "Asuransi", start_time: "17:00", end_time: "17:45" },
      { unit_kerja: "Asuransi", start_time: "17:00", end_time: "18:30" },
      { unit_kerja: "Asuransi", start_time: "17:00", end_time: "19:10" },
    ],
    departments,
  );

  assert.equal(result.totalMinutes, 295);
  assert.equal(result.breakdown.regularPayableHours, 3);
  assert.equal(result.totalPay, 30_000);
  assert.deepEqual(
    result.lines.map((line) => line.rowPay),
    [0, 0, 10_000, 20_000],
  );
});

test("hanya Poli Gigi mengakumulasi pecahan jam dalam rentang laporan", () => {
  const result = calculateEmployeeOvertimeCompensation(
    [
      { unit_kerja: "Poli Gigi", start_time: "17:00", end_time: "17:30" },
      { unit_kerja: "Poliklinik Gigi", start_time: "17:00", end_time: "17:45" },
    ],
    departments,
  );

  assert.equal(result.breakdown.dentalAccumulatedMinutes, 75);
  assert.equal(result.breakdown.dentalPayableHours, 1);
  assert.equal(result.totalPay, 10_000);
  assert.deepEqual(
    result.lines.map((line) => line.rowPay),
    [null, null],
  );
});

test("skema mengikuti unit lembur aktual, bukan departemen asal pegawai", () => {
  const result = calculateEmployeeOvertimeCompensation(
    [
      {
        unit_kerja: "Radiologi",
        employee: { department: "Asuransi" },
        start_time: "08:00",
        end_time: "14:00",
      },
    ],
    departments,
  );

  assert.equal(result.lines[0].unitName, "Radiologi");
  assert.equal(result.lines[0].scheme, "shift");
  assert.equal(result.totalPay, 50_000);
});

test("unit dengan nama mirip tidak saling mewarisi tarif atau filter", () => {
  const configured = [
    { name: "Farmasi Depo 1", count_sunday_in_leave: true },
    { name: "Rekam Medis IGD", count_sunday_in_leave: true },
    { name: "Instalasi Bedah Sentral", count_sunday_in_leave: true },
  ];
  for (const unit of ["Farmasi", "Farmasi Depo 10", "Rekam Medis", "Bedah"]) {
    assert.equal(areOvertimeUnitNamesEquivalent(unit, configured[0].name), false);
  }
  for (const unit of ["Farmasi", "Rekam Medis", "Poli Bedah", "Bedah", "Kepala Instalasi Rawat Inap"]) {
    assert.equal(isSpecialShiftOvertimeUnit(unit, configured), false, unit);
  }
  for (const [legacy, current] of [
    ["Depo 1", "Farmasi Depo 1"],
    ["IGP", "Instalasi Gawat Darurat"],
    ["Rekam Medis IGP", "Rekam Medis IGD"],
    ["Instasi Bedah Central", "Instalasi Bedah Sentral"],
    ["Poliklinik Gigi", "Poli Gigi"],
  ]) {
    assert.equal(areOvertimeUnitNamesEquivalent(legacy, current), true);
  }
});

test("minimum satu jam berlaku per pengajuan selain Poli Gigi", () => {
  for (const unit of ["Asuransi", "Casemix", "ICU"]) {
    const result = calculateEmployeeOvertimeCompensation([
      { unit_kerja: unit, start_time: "08:00", end_time: "08:30" },
      { unit_kerja: unit, start_time: "08:00", end_time: "08:59" },
    ], departments);
    assert.equal(result.totalPay, 0, unit);
  }
  for (const [end, expected] of [["17:59", 0], ["18:00", 10_000], ["18:59", 10_000], ["19:00", 20_000]] as const) {
    assert.equal(calculateEmployeeOvertimeCompensation([
      { unit_kerja: "Asuransi", start_time: "17:00", end_time: end },
    ], departments).totalPay, expected);
  }
});

test("akumulasi Poli Gigi tidak bercampur dengan sisa menit unit lain", () => {
  const result = calculateEmployeeOvertimeCompensation([
    { unit_kerja: "Poli Gigi", start_time: "17:00", end_time: "17:30" },
    { unit_kerja: "Asuransi", start_time: "17:00", end_time: "17:45" },
    { unit_kerja: "ICU", start_time: "20:00", end_time: "08:00" },
  ], departments);
  assert.equal(result.totalPay, 60_000);
  assert.equal(result.breakdown.dentalAccumulatedMinutes, 30);
  assert.equal(result.breakdown.regularPayableHours, 0);
});

test("dua pengajuan Poli Gigi 30 menit menjadi satu jam termasuk bila flag Minggu aktif", () => {
  const result = calculateEmployeeOvertimeCompensation([
    { unit_kerja: "Poli Gigi", start_time: "17:00", end_time: "17:30" },
    { unit_kerja: "Poli Gigi", start_time: "17:00", end_time: "17:30" },
  ], [{ name: "Poli Gigi", count_sunday_in_leave: true }]);
  assert.equal(result.totalPay, 10_000);
  assert.equal(result.breakdown.dentalPayableHours, 1);
  assert.equal(result.breakdown.dayShiftCount, 0);
});

