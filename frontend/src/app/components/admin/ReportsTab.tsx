import { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  X,
  BarChart3,
  Trophy,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  reportApi,
  ReportSummary,
  attendanceApi,
  AttendanceRecord,
  departmentApi,
  getToken,
} from "../../../services/api";
import { MonthYearDeptFilter } from "../ui/MonthYearDeptFilter";
import logoImg from "../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg";
import rsLogoImg from "../../../imports/rsucl_wide_logo.png";
import { useAuth } from "../../../context/AuthContext";
import * as XLSX from "xlsx";
// @ts-ignore
import XLSXStyle from "xlsx-js-style";

/**
 * Komponen Tab Laporan Admin (ReportsTab) — Sistem Absensi RSUCL
 *
 * Halaman modul pelaporan dan analitik kehadiran komprehensif bagi manajemen RSUCL.
 * Menyediakan grafik tren bulanan, grafik pie komposisi kehadiran, ekspor laporan
 * harian (detail jam absensi) dan bulanan (rekap total hari status kehadiran) dalam format
 * Excel (kompatibel dengan WPS/Excel) dan cetak PDF dengan layout resmi rumah sakit.
 */
export function ReportsTab() {
  const { logoUrl } = useAuth();

  // State menampung data analitik ringkasan KPI (kehadiran, terlambat, alpa, cuti)
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  // Indikator memuat data statistik
  const [loading, setLoading] = useState(false);

  // Indikator status ekspor file XLSX / PDF sedang berlangsung
  const [exporting, setExporting] = useState(false);

  // Jenis laporan yang dipilih ('harian' = detil masuk-pulang, 'bulanan' = rekap kehadiran pegawai)
  const [reportType, setReportType] = useState<"harian" | "bulanan">("harian");

  const currentDate = new Date();

  // State filter EKSPOR laporan
  const [selectedMonth, setSelectedMonth] = useState<number>(
    currentDate.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    currentDate.getFullYear(),
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  // State filter DIAGRAM / GRAFIK (terpisah dari filter ekspor)
  const [chartMonth, setChartMonth] = useState<number>(
    currentDate.getMonth() + 1,
  );
  const [chartYear, setChartYear] = useState<number>(currentDate.getFullYear());

  // Menampung daftar departemen untuk dropdown filter
  const [departments, setDepartments] = useState<
    { id: number; name: string }[]
  >([]);



  /**
   * Mengambil data base64 dari file gambar URL (digunakan untuk menyematkan logo resmi pada file PDF).
   */
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

  /**
   * Mengambil data analitik KPI absensi dari API backend.
   * Parameter month/year memungkinkan data grafik difilter per bulan.
   */
  const loadSummary = async (month?: number, year?: number) => {
    setLoading(true);
    try {
      const res = await reportApi.summary(month, year);
      if (res.success) {
        setSummary(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getImageArrayBuffer = async (
    imgUrl: string,
  ): Promise<ArrayBuffer | null> => {
    try {
      const response = await fetch(imgUrl);
      const buffer = await response.arrayBuffer();
      return buffer;
    } catch {
      return null;
    }
  };

  const downloadXlsx = (wb: any, filename: string) => {
    const wbout = XLSXStyle.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const buildHeaderStyle = () => ({
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "16A34A" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    },
  });

  const buildDeptStyle = () => ({
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "374151" } },
    fill: { fgColor: { rgb: "E5E7EB" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    },
  });

  const buildDataStyle = (bold = false, center = false) => ({
    font: { name: "Calibri", sz: 11, bold, color: { rgb: "1F2937" } },
    alignment: { horizontal: center ? "center" : "left", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    },
  });

  const buildMetaStyle = (bold = false, sz = 11, rgb = "111827") => ({
    font: { name: "Calibri", sz, bold, color: { rgb } },
    alignment: { horizontal: "right", vertical: "center" },
  });

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // Load logo as base64 for inline embedding in HTML Excel
      const logoPath = logoUrl && logoUrl !== "none" ? logoUrl : rsLogoImg;
      let base64Logo = "";
      try {
        const response = await fetch(logoPath);
        const blob = await response.blob();
        base64Logo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Failed to load logo for Excel", e);
      }

      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const startDayStr = `01-${String(selectedMonth).padStart(2, "0")}-${selectedYear}`;
      const endDayStr = `${String(lastDay).padStart(2, "0")}-${String(selectedMonth).padStart(2, "0")}-${selectedYear}`;
      const periodStr = `Dari ${startDayStr} s/d ${endDayStr}`;

      const triggerDownload = (html: string, filename: string) => {
        const blob = new Blob(["\uFEFF" + html], {
          type: "application/vnd.ms-excel;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      };

      const excelWrapper = (sheetName: string, bodyHtml: string) => `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8" />
          <!--[if gte mso 9]><xml>
           <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
            <x:Name>${sheetName}</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
           </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
          </xml><![endif]-->
          <style>
            body { font-family: Calibri, Arial, sans-serif; }
            table { border-collapse: collapse; }
            .header-title { font-size: 13pt; font-weight: bold; color: #111827; text-align: right; vertical-align: bottom; border: none; padding: 2px 4px; }
            .header-rs    { font-size: 10pt; font-weight: bold; color: #374151; text-align: right; vertical-align: middle; border: none; padding: 2px 4px; }
            .header-period{ font-size: 9pt;  color: #6B7280; text-align: right; vertical-align: top;    border: none; padding: 2px 4px; }
            .logo-cell    { border: none; vertical-align: middle; padding: 4px; width: 140px; }
            .separator    { height: 3px; border: none; border-bottom: 2px solid #000000; padding: 0; font-size: 1px; mso-height-source: userset; }
            th { background-color: #F3F4F6; color: #1F2937; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 8px; }
            td { font-size: 10pt; border: 1px solid #000000; vertical-align: middle; padding: 5px 8px; color: #1F2937; }
            .dept-row td { background-color: #E5E7EB; font-weight: bold; color: #374151; font-size: 10pt; border: 1px solid #000000; text-align: left; padding: 6px 8px; }
            .center { text-align: center; }
            .bold   { font-weight: bold; }
          </style>
        </head>
        <body>${bodyHtml}</body>
        </html>`;

      // Use HTML width/height attributes so WPS Office respects the size
      const logoImg = base64Logo
        ? `<img src="${base64Logo}" width="140" height="54" style="display:block;" />`
        : '<span style="font-size:11pt;font-weight:bold;color:#16A34A;">RSUCL</span>';

      const deptSuffix =
        selectedDepartment !== "all"
          ? `_${selectedDepartment.replace(/\s+/g, "_")}`
          : "";
      const deptLabelText =
        selectedDepartment !== "all"
          ? ` | Departemen: ${selectedDepartment.toUpperCase()}`
          : "";

      if (reportType === "harian") {
        const res = await attendanceApi.history(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data absensi.");
          return;
        }

        const filteredData =
          selectedDepartment !== "all"
            ? res.data.filter(
                (r) => r.employee?.department === selectedDepartment,
              )
            : res.data;

        // Sort by department name (A-Z), then employee name (A-Z)
        const sortedData = [...filteredData].sort((a, b) => {
          const deptA = a.employee?.department ?? "UMUM";
          const deptB = b.employee?.department ?? "UMUM";
          const deptComp = deptA.localeCompare(deptB);
          if (deptComp !== 0) return deptComp;
          const nameA = a.employee?.name ?? "";
          const nameB = b.employee?.name ?? "";
          return nameA.localeCompare(nameB);
        });

        let bodyRows = "";
        let lastDept = "";
        let rowNum = 1;
        sortedData.forEach((r) => {
          const dept = r.employee?.department ?? "UMUM";
          if (dept !== lastDept) {
            bodyRows += `<tr class="dept-row"><td colspan="10">${dept}</td></tr>`;
            lastDept = dept;
          }
          const dur = r.duration_min
            ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m`
            : "--";

          // Durasi lembur yang disetujui
          const otMin =
            r.overtime_status === "approved" ? (r.overtime_minutes ?? 0) : 0;
          const otStr =
            otMin > 0 ? `${Math.floor(otMin / 60)}j ${otMin % 60}m` : "0m";

          bodyRows += `<tr>
            <td class="center">${rowNum++}</td>
            <td class="center" style="mso-number-format:'\\@';" x:str>${r.employee?.nik_ktp ?? "--"}</td>
            <td class="bold">${r.employee?.name ?? "Karyawan"}</td>
            <td class="center">${r.date || "--"}</td>
            <td>${dept}</td>
            <td class="center">${r.check_in ?? "--"}</td>
            <td class="center">${r.check_out ?? "--"}</td>
            <td class="center">${dur}</td>
            <td class="center">${otStr}</td>
            <td class="center bold">${r.status?.toUpperCase() ?? "--"}</td>
          </tr>`;
        });

        const body = `
          <table style="border:none;margin-bottom:8px;border-collapse:collapse;">
            <tr style="height:22px;">
              <td rowspan="3" colspan="3" class="logo-cell">${logoImg}</td>
              <td colspan="7" class="header-title">DATA ABSENSI KARYAWAN</td>
            </tr>
            <tr style="height:18px;"><td colspan="7" class="header-rs">RUMAH SAKIT UMUM CEMPAKA LIMA</td></tr>
            <tr style="height:16px;"><td colspan="7" class="header-period">${periodStr}${deptLabelText}</td></tr>
            <tr style="height:3px;"><td colspan="10" class="separator">&nbsp;</td></tr>
          </table>
          <table>
            <thead><tr>
              <th style="width:40px">No</th>
              <th>NIK KTP</th>
              <th>Nama</th>
              <th>Tanggal</th>
              <th>Departemen</th>
              <th>Jam Masuk</th>
              <th>Jam Keluar</th>
              <th>Durasi Kerja</th>
              <th>Lembur</th>
              <th>Status Kehadiran</th>
            </tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>`;

        triggerDownload(
          excelWrapper("Laporan Harian", body),
          `Laporan_Harian_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2, "0")}${deptSuffix}.xls`,
        );
      } else {
        const res = await reportApi.monthlyRekap(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data rekap bulanan.");
          return;
        }

        const filteredData =
          selectedDepartment !== "all"
            ? res.data.filter((r) => r.department === selectedDepartment)
            : res.data;

        // Sort by department name (A-Z), then employee name (A-Z)
        const sortedData = [...filteredData].sort((a, b) => {
          const deptA = a.department ?? "UMUM";
          const deptB = b.department ?? "UMUM";
          const deptComp = deptA.localeCompare(deptB);
          if (deptComp !== 0) return deptComp;
          const nameA = a.name ?? "";
          const nameB = b.name ?? "";
          return nameA.localeCompare(nameB);
        });

        let bodyRows = "";
        let lastDept = "";
        let rowNum = 1;
        sortedData.forEach((r) => {
          const dept = r.department ?? "UMUM";
          if (dept !== lastDept) {
            bodyRows += `<tr class="dept-row"><td colspan="10">${dept}</td></tr>`;
            lastDept = dept;
          }
          const dur = r.duration_min
            ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m`
            : "0j 0m";
          bodyRows += `<tr>
            <td class="center">${rowNum++}</td>
            <td class="center" style="mso-number-format:'\\@';" x:str>${r.nik_ktp}</td>
            <td class="bold">${r.name}</td>
            <td class="center">${r.hadir} d</td>
            <td class="center">${r.telat} d</td>
            <td class="center">${r.izin} d</td>
            <td class="center">${r.sakit} d</td>
            <td class="center">${r.cuti} d</td>
            <td class="center">${r.alpha} d</td>
            <td class="center bold">${dur}</td>
          </tr>`;
        });

        const body = `
          <table style="border:none;margin-bottom:8px;border-collapse:collapse;">
            <tr style="height:22px;">
              <td rowspan="3" colspan="3" class="logo-cell">${logoImg}</td>
              <td colspan="7" class="header-title">DATA ABSENSI KARYAWAN</td>
            </tr>
            <tr style="height:18px;"><td colspan="7" class="header-rs">RUMAH SAKIT UMUM CEMPAKA LIMA</td></tr>
            <tr style="height:16px;"><td colspan="7" class="header-period">${periodStr}${deptLabelText}</td></tr>
            <tr style="height:3px;"><td colspan="10" class="separator">&nbsp;</td></tr>
          </table>
          <table>
            <thead><tr>
              <th style="width:40px">No</th>
              <th>NIK KTP</th>
              <th>Nama</th>
              <th>Hadir (Hari)</th>
              <th>Terlambat (Hari)</th>
              <th>Izin (Hari)</th>
              <th>Sakit (Hari)</th>
              <th>Cuti (Hari)</th>
              <th>Alpha (Hari)</th>
              <th>Total Durasi Kerja</th>
            </tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>`;

        triggerDownload(
          excelWrapper("Laporan Bulanan", body),
          `Laporan_Bulanan_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2, "0")}${deptSuffix}.xls`,
        );
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengekspor Excel.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportVehicles = async () => {
    setExporting(true);
    try {
      const token = getToken();
      const getApiUrl = () => {
        const envVal = import.meta.env.VITE_API_URL;
        if (envVal === "") return "";
        return envVal ?? "http://localhost:8000";
      };
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/reports/vehicles/export`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(
          "Gagal mengekspor data kendaraan. Pastikan Anda masuk sebagai Admin.",
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Data_Kendaraan_Pegawai_RSUCL.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Terjadi kesalahan saat mengekspor Excel.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPrestasiExcel = async () => {
    setExporting(true);
    try {
      const logoPath = logoUrl && logoUrl !== "none" ? logoUrl : rsLogoImg;
      let base64Logo = "";
      try {
        const response = await fetch(logoPath);
        const blob = await response.blob();
        base64Logo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Failed to load logo for Excel", e);
      }

      const logoImgHtml = base64Logo
        ? `<img src="${base64Logo}" width="140" height="54" style="display:block;" />`
        : '<span style="font-size:11pt;font-weight:bold;color:#16A34A;">RSUCL</span>';

      const todayStr = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      const monthStr = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ][selectedMonth - 1] + " " + selectedYear;

      const dailyData = summary?.diligence_ranking?.daily ?? [];
      const monthlyData = summary?.diligence_ranking?.monthly ?? [];

      let dailyRows = "";
      if (dailyData.length === 0) {
        dailyRows = '<tr><td colspan="4" style="text-align:center; padding:10px; color:#9CA3AF;">Belum ada rekaman check-in tepat waktu hari ini.</td></tr>';
      } else {
        dailyData.forEach((item) => {
          dailyRows += `
            <tr>
              <td style="text-align:center; font-weight:bold;">${item.rank}</td>
              <td style="text-align:left; font-weight:bold;">${item.name}</td>
              <td style="text-align:left;">${item.department}</td>
              <td style="text-align:center; font-family:monospace;">${item.check_in} WIB</td>
            </tr>
          `;
        });
      }

      let monthlyRows = "";
      if (monthlyData.length === 0) {
        monthlyRows = '<tr><td colspan="5" style="text-align:center; padding:10px; color:#9CA3AF;">Belum ada data kehadiran tepat waktu pada bulan ini.</td></tr>';
      } else {
        monthlyData.forEach((item) => {
          monthlyRows += `
            <tr>
              <td style="text-align:center; font-weight:bold;">${item.rank}</td>
              <td style="text-align:left; font-weight:bold;">${item.name}</td>
              <td style="text-align:left;">${item.department}</td>
              <td style="text-align:center;">${item.hadir_count} Hari</td>
              <td style="text-align:center; font-family:monospace; font-weight:bold;">${item.punctuality_rate}%</td>
            </tr>
          `;
        });
      }

      const bodyHtml = `
        <table style="border:none; margin-bottom:12px; border-collapse:collapse;">
          <tr style="height:22px;">
            <td rowspan="3" colspan="2" class="logo-cell">${logoImgHtml}</td>
            <td colspan="3" class="header-title" style="text-align:right;">PAPAN APRESIASI KEDISIPLINAN PEGAWAI</td>
          </tr>
          <tr style="height:18px;">
            <td colspan="3" class="header-rs" style="text-align:right;">RSU CEMPAKA LIMA</td>
          </tr>
          <tr style="height:16px;">
            <td colspan="3" class="header-period" style="text-align:right;">Periode Harian: ${todayStr} | Periode Bulanan: ${monthStr}</td>
          </tr>
          <tr style="height:3px;">
            <td colspan="5" class="separator">&nbsp;</td>
          </tr>
        </table>

        <h3 style="margin-top:20px; color:#2E7D32; font-size:11pt; font-family:Calibri,sans-serif; font-weight:bold;">1. TERCEPAT MASUK KERJA HARI INI (DAILY CHAMPIONS)</h3>
        <table style="width:100%; border:1px solid #000000; border-collapse:collapse; margin-bottom:25px;">
          <colgroup>
            <col width="80" style="width:80px;" />
            <col width="220" style="width:220px;" />
            <col width="220" style="width:220px;" />
            <col width="150" style="width:150px;" />
          </colgroup>
          <thead>
            <tr>
              <th style="width:80px; text-align:center;">Peringkat</th>
              <th style="text-align:left;">Nama Pegawai</th>
              <th style="text-align:left;">Unit Kerja / Departemen</th>
              <th style="width:150px; text-align:center;">Waktu Masuk</th>
            </tr>
          </thead>
          <tbody>
            ${dailyRows}
          </tbody>
        </table>

        <h3 style="margin-top:20px; color:#2E7D32; font-size:11pt; font-family:Calibri,sans-serif; font-weight:bold;">2. KONSISTENSI ON-TIME TERBANYAK (MONTHLY LEGENDS)</h3>
        <table style="width:100%; border:1px solid #000000; border-collapse:collapse;">
          <colgroup>
            <col width="80" style="width:80px;" />
            <col width="220" style="width:220px;" />
            <col width="220" style="width:220px;" />
            <col width="150" style="width:150px;" />
            <col width="120" style="width:120px;" />
          </colgroup>
          <thead>
            <tr>
              <th style="width:80px; text-align:center;">Peringkat</th>
              <th style="text-align:left;">Nama Pegawai</th>
              <th style="text-align:left;">Unit Kerja / Departemen</th>
              <th style="width:150px; text-align:center;">Kehadiran Tepat Waktu</th>
              <th style="width:120px; text-align:center;">Rasio Ketepatan</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyRows}
          </tbody>
        </table>
      `;

      const excelWrapper = (sheetName: string, bodyHtmlStr: string) => `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8" />
          <!--[if gte mso 9]><xml>
           <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
            <x:Name>${sheetName}</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
           </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
          </xml><![endif]-->
          <style>
            body { font-family: Calibri, Arial, sans-serif; }
            table { border-collapse: collapse; }
            .header-title { font-size: 13pt; font-weight: bold; color: #111827; text-align: right; vertical-align: bottom; border: none; padding: 2px 4px; }
            .header-rs    { font-size: 10pt; font-weight: bold; color: #374151; text-align: right; vertical-align: middle; border: none; padding: 2px 4px; }
            .header-period{ font-size: 9pt;  color: #6B7280; text-align: right; vertical-align: top;    border: none; padding: 2px 4px; }
            .logo-cell    { border: none; vertical-align: middle; padding: 4px; width: 140px; }
            .separator    { height: 3px; border: none; border-bottom: 2px solid #000000; padding: 0; font-size: 1px; mso-height-source: userset; }
            th { background-color: #15803D; color: #FFFFFF; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 8px; }
            td { font-size: 10pt; border: 1px solid #000000; vertical-align: middle; padding: 6px 8px; color: #1F2937; }
          </style>
        </head>
        <body>${bodyHtmlStr}</body>
        </html>`;

      const filename = `Laporan_Prestasi_Kedisiplinan_${monthStr.replace(/\s+/g, "_")}.xls`;
      
      const blob = new Blob(["\uFEFF" + excelWrapper("Apresiasi Kedisiplinan", bodyHtml)], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

    } catch (err: any) {
      alert(err?.message || "Terjadi kesalahan saat mengekspor prestasi.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Mohon izinkan popup blocker untuk mencetak laporan.");
      setExporting(false);
      return;
    }

    try {
      const logoPath = logoUrl && logoUrl !== "none" ? logoUrl : logoImg;
      let base64Logo = "";
      if (logoPath) {
        try {
          base64Logo = await getBase64Image(logoPath);
        } catch (e) {
          console.error("Failed to load base64 logo", e);
        }
      }

      let tableHeaders = "";
      let tableRowsHtml = "";
      let reportTitle = "";

      if (reportType === "harian") {
        const res = await attendanceApi.history(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data absensi.");
          printWindow.close();
          return;
        }

        const deptTitleSuffix =
          selectedDepartment !== "all"
            ? ` - Unit kerja ${selectedDepartment}`
            : "";
        reportTitle = `Laporan Detail Kehadiran Harian${deptTitleSuffix}`;
        tableHeaders = `
          <tr>
            <th style="text-align: center; width: 40px;">No</th>
            <th>Tanggal</th>
            <th>NIK KTP</th>
            <th>Nama</th>
            <th style="text-align: center; width: 80px;">Jam Masuk</th>
            <th style="text-align: center; width: 80px;">Jam Keluar</th>
            <th style="text-align: center; width: 90px;">Durasi Kerja</th>
            <th style="text-align: center; width: 80px;">Lembur</th>
            <th style="text-align: center; width: 80px;">Status</th>
          </tr>
        `;

        let lastDateDept = "";
        let rowCounter = 1;

        const filteredData =
          selectedDepartment !== "all"
            ? res.data.filter(
                (r) => r.employee?.department === selectedDepartment,
              )
            : res.data;

        tableRowsHtml = filteredData
          .map((r, i) => {
            const dateStr = r.date;
            const deptName = r.employee?.department ?? "UMUM";
            const currentDateDept = `${dateStr} - ${deptName}`;
            let deptRow = "";

            if (currentDateDept !== lastDateDept) {
              deptRow = `
              <tr style="background-color: #E5E7EB; font-weight: bold; font-size: 11px;">
                <td colspan="9" style="padding: 8px; border-bottom: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; text-transform: uppercase; color: #374151;">
                  ${deptName} (${dateStr})
                </td>
              </tr>
            `;
              lastDateDept = currentDateDept;
            }

            // Durasi lembur yang disetujui
            const otMin =
              r.overtime_status === "approved" ? (r.overtime_minutes ?? 0) : 0;
            const otStr =
              otMin > 0 ? `${Math.floor(otMin / 60)}j ${otMin % 60}m` : "0m";

            return (
              deptRow +
              `
            <tr style="border-bottom: 1px solid #E5E7EB; font-size: 11px;">
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${rowCounter++}</td>
              <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.date}</td>
              <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.employee?.nik_ktp ?? "--"}</td>
              <td style="padding: 8px; font-weight: bold; border-right: 1px solid #E5E7EB;">${r.employee?.name ?? "Karyawan"}</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB; font-family: monospace;">${r.check_in ?? "--"}</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB; font-family: monospace;">${r.check_out ?? "--"}</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.duration_min ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m` : "--"}</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${otStr}</td>
              <td style="padding: 8px; text-align: center; font-weight: bold; color: #1F2937;">${r.status.toUpperCase()}</td>
            </tr>
          `
            );
          })
          .join("");
      } else {
        const res = await reportApi.monthlyRekap(selectedMonth, selectedYear);
        if (!res.success || !res.data) {
          alert("Gagal memuat data rekap bulanan.");
          printWindow.close();
          return;
        }

        const deptTitleSuffix =
          selectedDepartment !== "all"
            ? ` - Unit kerja ${selectedDepartment}`
            : "";
        reportTitle = `Laporan Rekap Bulanan Kehadiran${deptTitleSuffix}`;
        tableHeaders = `
          <tr>
            <th style="text-align: center; width: 40px;">No</th>
            <th>NIK KTP</th>
            <th>Nama</th>
            <th style="text-align: center; width: 55px;">Hadir</th>
            <th style="text-align: center; width: 55px;">Telat</th>
            <th style="text-align: center; width: 55px;">Izin</th>
            <th style="text-align: center; width: 55px;">Sakit</th>
            <th style="text-align: center; width: 55px;">Cuti</th>
            <th style="text-align: center; width: 55px;">Alpha</th>
            <th style="text-align: center; width: 70px;">Plg Cepat</th>
            <th style="text-align: center; width: 70px;">Lembur (m)*</th>
            <th style="text-align: center; width: 70px;">Kerja Libur</th>
            <th style="text-align: center; width: 80px;">Total Jam</th>
          </tr>
        `;

        let lastDept = "";
        let rowCounter = 1;

        const filteredData =
          selectedDepartment !== "all"
            ? res.data.filter((r) => r.department === selectedDepartment)
            : res.data;

        tableRowsHtml = filteredData
          .map((r, i) => {
            const deptName = r.department ?? "UMUM";
            let deptRow = "";

            if (deptName !== lastDept) {
              deptRow = `
              <tr style="background-color: #E5E7EB; font-weight: bold; font-size: 11px;">
                <td colspan="13" style="padding: 8px; border-bottom: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; text-transform: uppercase; color: #374151;">
                  ${deptName}
                </td>
              </tr>
            `;
              lastDept = deptName;
            }

            return (
              deptRow +
              `
            <tr style="border-bottom: 1px solid #E5E7EB; font-size: 11px;">
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${rowCounter++}</td>
              <td style="padding: 8px; border-right: 1px solid #E5E7EB;">${r.nik_ktp}</td>
              <td style="padding: 8px; font-weight: bold; border-right: 1px solid #E5E7EB;">${r.name}</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.hadir} d</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.telat} d</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.izin} d</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.sakit} d</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.cuti} d</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.alpha} d</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.early_checkout_count ?? 0} d</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.overtime_minutes ?? 0} m</td>
              <td style="padding: 8px; text-align: center; border-right: 1px solid #E5E7EB;">${r.holiday_work_days ?? 0} d</td>
              <td style="padding: 8px; text-align: center; font-weight: bold;">${r.duration_min ? `${Math.floor(r.duration_min / 60)}j ${r.duration_min % 60}m` : "0j"}</td>
            </tr>
          `
            );
          })
          .join("");
      }

      const months = [
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
      const periodStr = `${months[selectedMonth - 1]} ${selectedYear}`;

      const content = `
        <html>
        <head>
          <title>${reportTitle} - Rumah Sakit Umum Cempaka Lima</title>
          <base href="${window.location.origin}/" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F2937; padding: 30px; margin: 0; }
            .header-table { width: 100%; border-bottom: 3px double #16A34A; padding-bottom: 12px; margin-bottom: 15px; }
            .logo-cell { width: 65px; text-align: left; vertical-align: middle; }
            .company-name { font-size: 15px; font-weight: 800; color: #16A34A; margin: 0 0 2px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .hospital-name { font-size: 22px; font-weight: 800; color: #DC2626; margin: 0; text-transform: uppercase; }
            .hospital-sub { font-size: 13px; color: #000000; margin: 3px 0 0 0; font-weight: 500; }
            .title { font-size: 14px; font-weight: 700; text-transform: uppercase; margin: 20px 0 5px 0; text-align: center; letter-spacing: 0.5px; }
            .period { font-size: 12px; font-weight: 600; text-align: center; margin-bottom: 15px; color: #374151; }
            .date-print { font-size: 9px; text-align: right; color: #6B7280; margin-bottom: 10px; }
            .data-table { width: 100%; border-collapse: collapse; border: 1px solid #E5E7EB; }
            .data-table th { background-color: #F9FAFB; color: #374151; font-weight: 600; text-align: left; padding: 10px 8px; border-bottom: 2px solid #E5E7EB; border-right: 1px solid #E5E7EB; font-size: 10px; text-transform: uppercase; }
            .footer-section { margin-top: 40px; display: flex; justify-content: flex-end; }
            .signature-block { width: 220px; text-align: center; font-size: 11px; }
            .signature-space { height: 60px; }
            @media print {
              @page { margin: 0; }
              body { padding: 2cm; margin: 0; }
            }
          </style>
        </head>
        <body>
          <table class="header-table" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 80px; text-align: left; vertical-align: middle; padding: 0;">
                <img src="${base64Logo || logoPath}" style="width: 60px; height: 60px; object-fit: contain; display: block;" />
              </td>
              <td style="text-align: center; vertical-align: middle; padding: 0;">
                <p class="company-name">PT. CEMPAKA LIMA UTAMA</p>
                <h1 class="hospital-name">RUMAH SAKIT UMUM CEMPAKA LIMA</h1>
                <p class="hospital-sub">Jl. Politeknik Aceh No.23, Beurawe, Kec. Kuta Alam, Banda Aceh</p>
              </td>
              <td style="width: 80px; padding: 0;"></td>
            </tr>
          </table>
          
          <h2 class="title">${reportTitle}</h2>
          <div class="period">Periode: ${periodStr}</div>
          <div class="date-print">Dicetak pada: ${new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "medium" })}</div>

          <table class="data-table">
            <thead>
              ${tableHeaders}
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
          <div style="font-size: 9px; color: #6B7280; margin-top: 10px; font-style: italic;">
            * Lembur (m): Hanya mencakup durasi lembur yang telah disetujui oleh admin.
          </div>

          <div class="footer-section">
            <div class="signature-block">
              <p>Banda Aceh, ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p>Kepala Kepegawaian & Administrasi</p>
              <div class="signature-space"></div>
              <p style="text-decoration: underline; font-weight: bold;">( ________________________ )</p>
              <p style="color: #6B7280; font-size: 9px; margin-top: 3px;">NIP. RSUCL.2025.019</p>
            </div>
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
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadSummary(chartMonth, chartYear);
    const fetchDepts = async () => {
      try {
        const res = await departmentApi.list();
        if (res.success) {
          setDepartments(res.data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchDepts();
  }, []);

  // Re-fetch grafik setiap kali filter diagram berubah
  useEffect(() => {
    loadSummary(chartMonth, chartYear);
  }, [chartMonth, chartYear]);



  const totalEmp = summary?.total_employees ?? 0;
  const getMonthlyAttendanceRate = () => {
    const monthH = summary?.this_month.hadir ?? 0;
    const monthT = summary?.this_month.telat ?? 0;
    const monthA = summary?.this_month.alpha ?? 0;
    const monthC = summary?.this_month.cuti ?? 0;
    const total = monthH + monthT + monthA + monthC;
    if (total === 0) return 0;
    return Math.round(((monthH + monthT) / total) * 100);
  };

  const formatTrend = (val: number, unit: string = "org") => {
    if (val > 0) return `+ ${val} ${unit}`;
    if (val < 0) return `- ${Math.abs(val)} ${unit}`;
    return `0 ${unit}`;
  };

  const getTrendColor = (val: number) => {
    if (val > 0) return "bg-green-50 text-green-600";
    if (val < 0) return "bg-red-50 text-red-600";
    return "bg-gray-50 text-gray-500";
  };

  const pieData = summary?.composition ?? [];
  const monthlyTrendData = summary?.monthly_trend ?? [];
  const weeklyLateData = summary?.weekly_late ?? [];
  const deptData = summary?.dept_attendance ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-gray-900">
            Laporan Kehadiran
          </h2>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Analitik dan statistik absensi Rumah Sakit Umum Cempaka Lima ·
            Real-time
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          {/* Kelompok Laporan Absensi */}
          <div className="flex items-center gap-2 p-1.5 bg-gray-50/60 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-left px-2 hidden sm:block">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Laporan Absensi
              </p>
              <p className="text-[8.5px] text-gray-400 leading-none mt-0.5">
                Sesuai filter aktif
              </p>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <FileText size={12} /> {exporting ? "Memproses..." : "Export PDF"}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg text-[11px] font-medium text-[#16A34A] hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <Download size={12} />{" "}
              {exporting ? "Memproses..." : "Export Excel"}
            </button>
          </div>

          {/* Kelompok Laporan Kendaraan */}
          <div className="flex items-center gap-2 p-1.5 bg-gray-50/60 rounded-xl border border-gray-100 shadow-sm">
            <div className="text-left px-2 hidden sm:block">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                Data Kendaraan
              </p>
              <p className="text-[8.5px] text-gray-400 leading-none mt-0.5">
                Daftar plat nomor
              </p>
            </div>
            <button
              onClick={handleExportVehicles}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-lg text-[11px] font-medium text-white transition-colors disabled:opacity-50"
            >
              <Download size={12} />{" "}
              {exporting ? "Memproses..." : "Export Kendaraan"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Month, Year & Department Filter ──────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col gap-1 w-fit">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Tipe Laporan
          </label>
          <div className="relative">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="appearance-none pl-3.5 pr-9 py-2 border border-gray-200 rounded-full text-[13px] bg-white focus:outline-none focus:border-[#16A34A] transition-all text-gray-700 font-semibold cursor-pointer shadow-xs"
            >
              <option value="harian">Harian (Detail Kehadiran)</option>
              <option value="bulanan">Rekap Bulanan (Ringkasan)</option>
            </select>
            <ChevronDown
              size={12}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        <MonthYearDeptFilter
          month={selectedMonth}
          year={selectedYear}
          deptId={selectedDepartment}
          departments={departments}
          showAllMonthsOption={false}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          onDeptChange={setSelectedDepartment}
        />
      </div>

      {/* ── Filter Diagram / Grafik ──────────────────────── */}
      {(() => {
        const monthNames = [
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
        const currentYear = new Date().getFullYear();
        // Pilihan tahun: 2020 s.d. tahun sekarang saja (tanpa tahun masa depan)
        const yearOptions = Array.from(
          { length: currentYear - 2020 + 1 },
          (_, i) => 2020 + i,
        ).reverse();
        const chartPeriodLabel = `${monthNames[chartMonth - 1]} ${chartYear}`;
        return (
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <BarChart3 size={14} className="text-[#16A34A]" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-gray-800">
                    Filter Diagram &amp; Analitik
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Pilih bulan/tahun untuk memperbarui semua grafik
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {/* Shortcut bulan cepat */}
                <div className="flex gap-1">
                  {(() => {
                    const currentMonth = new Date().getMonth() + 1;
                    const currentYearValue = new Date().getFullYear();
                    const isActive = chartMonth === currentMonth && chartYear === currentYearValue;
                    return (
                      <button
                        onClick={() => {
                          setChartMonth(currentMonth);
                          setChartYear(currentYearValue);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold transition-all ${
                          isActive
                            ? "bg-[#16A34A] text-white shadow-sm"
                            : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-200 hover:text-green-600"
                        }`}
                      >
                        Bulan Ini
                      </button>
                    );
                  })()}
                </div>
                <div className="h-5 w-px bg-gray-200" />
                {/* Select bulan */}
                <div className="relative">
                  <select
                    value={chartMonth}
                    onChange={(e) => setChartMonth(Number(e.target.value))}
                    className="appearance-none pl-2.5 pr-7 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all text-gray-700 font-medium cursor-pointer"
                  >
                    {monthNames.map((mn, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {mn}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={11}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                {/* Select tahun */}
                <div className="relative">
                  <select
                    value={chartYear}
                    onChange={(e) => setChartYear(Number(e.target.value))}
                    className="appearance-none pl-2.5 pr-7 py-1.5 border border-gray-200 rounded-lg text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all text-gray-700 font-medium cursor-pointer"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={11}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                {loading && (
                  <span className="text-[10px] text-[#16A34A] font-medium animate-pulse">
                    Memuat...
                  </span>
                )}
              </div>
            </div>
            {/* Period indicator */}
            <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              <span className="text-[10.5px] text-gray-500">
                Menampilkan data grafik periode:{" "}
                <strong className="text-gray-700">{chartPeriodLabel}</strong>
              </span>
            </div>
          </div>
        );
      })()}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Kehadiran Bulan Ini",
            value: `${getMonthlyAttendanceRate()}%`,
            sub: "Rata-rata persentase",
            trend: `${summary ? (summary.trends.presence >= 0 ? "+" : "") + summary.trends.presence : 0}%`,
            trendColor: getTrendColor(summary?.trends.presence ?? 0),
            icon: Users,
            color: "#16A34A",
            bg: "#F0FDF4",
          },
          {
            label: "Keterlambatan",
            value: `${summary?.this_month.telat ?? 0} kali`,
            sub: "Total akumulasi terlambat",
            trend: formatTrend(summary?.trends.late ?? 0, "kali"),
            trendColor: getTrendColor(summary?.trends.late ?? 0),
            icon: Clock,
            color: "#D97706",
            bg: "#FFFBEB",
          },
          {
            label: "Alpha",
            value: `${summary?.this_month.alpha ?? 0} hari`,
            sub: "Total akumulasi alpa",
            trend: formatTrend(summary?.trends.alpha ?? 0, "hari"),
            trendColor: getTrendColor(summary?.trends.alpha ?? 0),
            icon: AlertTriangle,
            color: "#DC2626",
            bg: "#FEF2F2",
          },
          {
            label: "Cuti & Izin",
            value: `${summary?.this_month.cuti ?? 0} hari`,
            sub: "Total akumulasi hari izin",
            trend: formatTrend(summary?.trends.cuti ?? 0, "hari"),
            trendColor: getTrendColor(summary?.trends.cuti ?? 0),
            icon: Calendar,
            color: "#7C3AED",
            bg: "#F5F3FF",
          },
        ].map((k, i) => {
          return (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: k.bg }}
                >
                  <k.icon size={15} style={{ color: k.color }} />
                </div>
                <div
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${k.trendColor}`}
                >
                  {k.trend}
                </div>
              </div>
              <p className="text-[22px] font-bold text-black">{k.value}</p>
              <p className="text-[12px] font-semibold text-gray-800 mt-0.5">
                {k.label}
              </p>
              <p className="text-[9.5px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly trend bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[14px] font-semibold text-gray-800">
                Tren Kehadiran Bulanan
              </p>
              <p className="text-[11px] text-gray-400">
                7 bulan s.d.{" "}
                {
                  [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "Mei",
                    "Jun",
                    "Jul",
                    "Ags",
                    "Sep",
                    "Okt",
                    "Nov",
                    "Des",
                  ][chartMonth - 1]
                }{" "}
                {chartYear}
              </p>
            </div>
            <div className="flex gap-3">
              {[
                ["#16A34A", "Hadir"],
                ["#FBBF24", "Terlambat"],
                ["#F87171", "Alpha"],
                ["#A78BFA", "Cuti"],
              ].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{ background: c }}
                  />
                  <span className="text-[10px] text-gray-400">{l}</span>
                </div>
              ))}
            </div>
          </div>
          {loading && (
            <div className="text-center py-5 text-gray-400 text-[12px]">
              Memuat data tren...
            </div>
          )}
          {monthlyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                id="rep-monthly-bar"
                data={monthlyTrendData}
                barGap={1}
                barCategoryGap="30%"
              >
                <XAxis
                  dataKey="bulan"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.02)" }}
                />
                <Bar
                  dataKey="hadir"
                  name="Hadir"
                  fill="#16A34A"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="terlambat"
                  name="Terlambat"
                  fill="#FBBF24"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="alpha"
                  name="Alpha"
                  fill="#F87171"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="cuti"
                  name="Cuti"
                  fill="#A78BFA"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-[12px] text-gray-400">
              Tidak ada data tren bulanan di database
            </div>
          )}
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-1">
            Komposisi Kehadiran
          </p>
          <p className="text-[11px] text-gray-400 mb-4">
            {
              [
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
              ][chartMonth - 1]
            }{" "}
            {chartYear}
          </p>
          {pieData.some((d) => d.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart id="rep-pie">
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    isAnimationActive={false}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={`rep-pie-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value}%`}
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: d.color }}
                      />
                      <span className="text-[11px] text-gray-600">
                        {d.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-700">
                      {d.value}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-[12px] text-gray-400">
              Belum ada data komposisi
            </div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly late */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-1">
            Keterlambatan per Minggu
          </p>
          <p className="text-[11px] text-gray-400 mb-4">
            Jumlah karyawan terlambat per minggu ·{" "}
            {
              [
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
              ][chartMonth - 1]
            }{" "}
            {chartYear}
          </p>
          {weeklyLateData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart
                id="rep-late-bar"
                data={weeklyLateData}
                barCategoryGap="35%"
              >
                <XAxis
                  dataKey="hari"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  width={20}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid #E5E7EB",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.02)" }}
                />
                <Bar
                  dataKey="count"
                  name="Terlambat"
                  fill="#FBBF24"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-[12px] text-gray-400">
              Tidak ada keterlambatan pada periode ini
            </div>
          )}
        </div>

        {/* Dept breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[14px] font-semibold text-gray-800 mb-1">
            Kehadiran per Unit kerja
          </p>
          <p className="text-[11px] text-gray-400 mb-4">
            {
              [
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
              ][chartMonth - 1]
            }{" "}
            {chartYear}
          </p>
          {deptData.length > 0 ? (
            <div className="space-y-2.5 max-h-[170px] overflow-y-auto pr-1">
              {deptData.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <p className="text-[11px] text-gray-500 w-24 flex-shrink-0">
                    {d.dept}
                  </p>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${d.persen}%`,
                        background:
                          d.persen >= 95
                            ? "#16A34A"
                            : d.persen >= 90
                              ? "#FBBF24"
                              : "#F87171",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700 w-10 text-right">
                    {d.persen}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-[12px] text-gray-400">
              Tidak ada data Unit kerja
            </div>
          )}
        </div>
      </div>

      {/* ── Apresiasi Kedisiplinan Karyawan (Diligence Ranking) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-[#F0FDF4] to-[#DCFCE7]/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Trophy size={15} className="stroke-[2.5]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800">
                Papan Apresiasi Kedisiplinan &amp; Kehadiran Pegawai
              </p>
              <p className="text-[10.5px] text-gray-400 mt-0.5">
                Penghargaan khusus untuk memotivasi staf agar konsisten hadir tepat waktu
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPrestasiExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-lg text-[10.5px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Download size={11} className="stroke-[2.5]" />
              Cetak Prestasi (Excel)
            </button>
            <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider">
              Prestasi Staf
            </span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/20">
          {/* Kolom 1: Tercepat Hari Ini (Harian) */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <p className="text-[13px] font-bold text-gray-800">Tercepat Masuk Kerja Hari Ini</p>
              </div>
              <span className="text-[9.5px] bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] px-2 py-0.5 rounded-lg font-extrabold uppercase tracking-wide">
                Daily Champions
              </span>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {!summary?.diligence_ranking?.daily || summary.diligence_ranking.daily.length === 0 ? (
                <div className="py-8 text-center text-gray-450 text-[11.5px] bg-slate-50/50 rounded-xl">
                  Belum ada rekaman check-in tepat waktu hari ini.
                </div>
              ) : (
                summary.diligence_ranking.daily.map((item) => {
                  let badgeBg = "bg-slate-100 text-slate-700";
                  if (item.rank === 1) badgeBg = "bg-amber-50 border border-amber-200 text-amber-700 font-bold";
                  if (item.rank === 2) badgeBg = "bg-slate-50 border border-slate-200 text-slate-600 font-bold";
                  if (item.rank === 3) badgeBg = "bg-orange-50 border border-orange-100 text-orange-700 font-bold";
                  return (
                    <div key={item.employee_id} className="flex items-center justify-between py-1.5 px-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 ${badgeBg}`}>
                          {item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : item.rank === 3 ? "🥉" : item.rank}
                        </div>
                        <div className="truncate">
                          <span className="text-[11.5px] font-bold text-gray-800 block truncate">{item.name}</span>
                          <span className="text-[9.5px] text-gray-400 block truncate">{item.department}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="px-2 py-0.5 bg-[#E8F5E9] border border-[#C8E6C9] rounded text-[10px] font-bold font-mono text-[#2E7D32]">
                          {item.check_in} WIB
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Kolom 2: Konsistensi Bulanan (Bulanan) */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏆</span>
                <p className="text-[13px] font-bold text-gray-800">Konsistensi On-Time Terbanyak</p>
              </div>
              <span className="text-[9.5px] bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9] px-2 py-0.5 rounded-lg font-extrabold uppercase tracking-wide">
                Monthly Legends
              </span>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {!summary?.diligence_ranking?.monthly || summary.diligence_ranking.monthly.length === 0 ? (
                <div className="py-8 text-center text-gray-455 text-[11.5px] bg-slate-50/50 rounded-xl">
                  Belum ada data kehadiran tepat waktu pada bulan ini.
                </div>
              ) : (
                summary.diligence_ranking.monthly.map((item) => {
                  let badgeBg = "bg-slate-100 text-slate-700";
                  if (item.rank === 1) badgeBg = "bg-amber-50 border border-amber-200 text-amber-700 font-bold";
                  if (item.rank === 2) badgeBg = "bg-slate-50 border border-slate-200 text-slate-600 font-bold";
                  if (item.rank === 3) badgeBg = "bg-orange-50 border border-orange-100 text-orange-700 font-bold";
                  return (
                    <div key={item.employee_id} className="flex items-center justify-between py-1.5 px-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 ${badgeBg}`}>
                          {item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : item.rank === 3 ? "🥉" : item.rank}
                        </div>
                        <div className="truncate">
                          <span className="text-[11.5px] font-bold text-gray-800 block truncate">{item.name}</span>
                          <span className="text-[9.5px] text-gray-400 block truncate">{item.department}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-[#E8F5E9] border border-[#C8E6C9] rounded text-[10px] font-bold font-mono text-[#2E7D32]">
                          {item.hadir_count} Hari
                        </span>
                        <span className="text-[9.5px] text-gray-500 font-bold font-mono">({item.punctuality_rate}%)</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
