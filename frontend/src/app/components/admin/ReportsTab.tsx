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
  Briefcase,
  UserMinus,
  Shield,
  ClipboardList,
  Eye,
  DollarSign,
  Search,
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
  overtimeApi,
  leaveApi,
  assignmentLetterApi,
  resignationApi,
  disciplinarySanctionApi,
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

  // State Laporan Keterlambatan & Potongan
  const [latenessData, setLatenessData] = useState<any>(null);
  const [latenessLoading, setLatenessLoading] = useState(false);
  const [latenessSearch, setLatenessSearch] = useState("");
  const [selectedEmpLatenessDetail, setSelectedEmpLatenessDetail] = useState<any>(null);
  const [showLatenessModal, setShowLatenessModal] = useState(false);

  const loadLatenessData = async () => {
    setLatenessLoading(true);
    try {
      const res = await reportApi.lateness(selectedMonth, selectedYear, selectedDepartment);
      if (res.success) {
        setLatenessData(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat data keterlambatan", err);
    } finally {
      setLatenessLoading(false);
    }
  };

  useEffect(() => {
    loadLatenessData();
  }, [selectedMonth, selectedYear, selectedDepartment]);



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

  const handleExportExcel = async (type: "harian" | "bulanan" = "harian") => {
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

      if (type === "harian") {
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
        let envVal = import.meta.env.VITE_API_URL;
        if (envVal === "") return "";
        if (!envVal) envVal = "http://localhost:8000";
        return envVal.replace(/\/api\/?$/, "");
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

  const handleExportSocialMedia = async () => {
    setExporting(true);
    try {
      const token = getToken();
      const getApiUrl = () => {
        let envVal = import.meta.env.VITE_API_URL;
        if (envVal === "") return "";
        if (!envVal) envVal = "http://localhost:8000";
        return envVal.replace(/\/api\/?$/, "");
      };
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/reports/social-media/export`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(
          "Gagal mengekspor data media sosial. Pastikan Anda masuk sebagai Admin.",
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Data_Media_Sosial_Pegawai_RSUCL.xlsx";
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

  const handleExportLatenessExcel = async () => {
    setExporting(true);
    try {
      const res = await reportApi.lateness(selectedMonth, selectedYear, selectedDepartment);
      if (!res.success || !res.data) {
        alert("Gagal memuat data keterlambatan.");
        return;
      }

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

      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const monthStr = monthNames[selectedMonth - 1] + " " + selectedYear;
      const deptSuffix = selectedDepartment !== "all" ? `_${selectedDepartment.replace(/\s+/g, "_")}` : "";

      let bodyRows = "";
      let rowNum = 1;
      const records = res.data.records || [];

      if (records.length === 0) {
        bodyRows = `<tr><td colspan="8" style="text-align:center; padding:15px; color:#6B7280;">Tidak ada data keterlambatan untuk periode ini.</td></tr>`;
      } else {
        records.forEach((r: any) => {
          bodyRows += `<tr>
            <td style="text-align:center;">${rowNum++}</td>
            <td style="text-align:center; mso-number-format:'\\@';">${r.nik_ktp}</td>
            <td style="font-weight:bold;">${r.name}</td>
            <td>${r.department}</td>
            <td style="text-align:center;">${r.total_late_days} Hari</td>
            <td style="text-align:center; font-weight:bold; color:#DC2626;">${r.total_late_minutes} Menit</td>
            <td style="text-align:right;">Rp ${(r.rate_per_minute || 500).toLocaleString('id-ID')}</td>
            <td style="text-align:right; font-weight:bold; color:#B91C1C;">Rp ${(r.total_deduction || 0).toLocaleString('id-ID')}</td>
          </tr>`;
        });

        // Summary row
        bodyRows += `<tr style="background-color:#FEE2E2; font-weight:bold;">
          <td colspan="4" style="text-align:right;">TOTAL KETERLAMBATAN &amp; POTONGAN</td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center; color:#DC2626;">${res.data.grand_total_late_mins || 0} Menit</td>
          <td style="text-align:right;">Rp ${(res.data.rate_per_minute || 500).toLocaleString('id-ID')} / min</td>
          <td style="text-align:right; color:#B91C1C;">Rp ${(res.data.grand_total_deduction || 0).toLocaleString('id-ID')}</td>
        </tr>`;
      }

      const bodyHtml = `
        <table style="border:none; margin-bottom:12px; border-collapse:collapse;">
          <tr style="height:22px;">
            <td rowspan="3" colspan="2" class="logo-cell">${logoImgHtml}</td>
            <td colspan="6" class="header-title" style="text-align:right;">REKAP POTONGAN KETERLAMBATAN PEGAWAI</td>
          </tr>
          <tr style="height:18px;">
            <td colspan="6" class="header-rs" style="text-align:right;">RUMAH SAKIT UMUM CEMPAKA LIMA</td>
          </tr>
          <tr style="height:16px;">
            <td colspan="6" class="header-period" style="text-align:right;">Periode: ${monthStr} ${selectedDepartment !== 'all' ? '| Unit Kerja: ' + selectedDepartment : ''}</td>
          </tr>
          <tr style="height:3px;">
            <td colspan="8" class="separator">&nbsp;</td>
          </tr>
        </table>
        <table>
          <thead>
            <tr>
              <th style="width:40px;">No</th>
              <th>NIK KTP</th>
              <th>Nama Pegawai</th>
              <th>Unit Kerja / Departemen</th>
              <th>Jumlah Hari Telat</th>
              <th>Total Menit Telat</th>
              <th>Tarif Potongan / Menit</th>
              <th>Total Potongan (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
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
            th { background-color: #B91C1C; color: #FFFFFF; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 8px; }
            td { font-size: 10pt; border: 1px solid #000000; vertical-align: middle; padding: 6px 8px; color: #1F2937; }
          </style>
        </head>
        <body>${bodyHtmlStr}</body>
        </html>`;

      const filename = `Laporan_Keterlambatan_Potongan_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2, "0")}${deptSuffix}.xls`;
      
      const blob = new Blob(["\uFEFF" + excelWrapper("Rekap Keterlambatan", bodyHtml)], {
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
      alert(err?.message || "Terjadi kesalahan saat mengekspor Laporan Keterlambatan.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportLatenessPDF = async () => {
    setExporting(true);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Mohon izinkan popup blocker untuk mencetak laporan.");
      setExporting(false);
      return;
    }

    try {
      const res = await reportApi.lateness(selectedMonth, selectedYear, selectedDepartment);
      if (!res.success || !res.data) {
        alert("Gagal memuat data keterlambatan.");
        printWindow.close();
        return;
      }

      const logoPath = logoUrl && logoUrl !== "none" ? logoUrl : logoImg;
      let base64Logo = "";
      if (logoPath) {
        try {
          base64Logo = await getBase64Image(logoPath);
        } catch (e) {
          console.error("Failed to load base64 logo", e);
        }
      }

      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const monthStr = monthNames[selectedMonth - 1] + " " + selectedYear;
      const deptStr = selectedDepartment !== "all" ? ` - Unit Kerja: ${selectedDepartment}` : "";

      const records = res.data.records || [];
      let rowsHtml = "";
      let rowNum = 1;

      records.forEach((r: any) => {
        rowsHtml += `
          <tr>
            <td style="text-align: center;">${rowNum++}</td>
            <td style="font-[#111827]; font-weight: bold;">${r.name}</td>
            <td>${r.nik_ktp}</td>
            <td>${r.department}</td>
            <td style="text-align: center;">${r.total_late_days} Hari</td>
            <td style="text-align: center; font-weight: bold; color: #B91C1C;">${r.total_late_minutes} Menit</td>
            <td style="text-align: right;">Rp ${(r.rate_per_minute || 500).toLocaleString('id-ID')}</td>
            <td style="text-align: right; font-weight: bold; color: #991B1B;">Rp ${(r.total_deduction || 0).toLocaleString('id-ID')}</td>
          </tr>
        `;
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan Keterlambatan & Potongan Pegawai RSUCL</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1F2937; font-size: 12px; }
            .header-table { width: 100%; border-bottom: 3px double #B91C1C; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { width: 80px; height: 80px; object-fit: contain; }
            .header-text { text-align: right; }
            .header-title { font-size: 16px; font-weight: bold; color: #991B1B; margin: 0; }
            .header-subtitle { font-size: 12px; font-weight: bold; color: #374151; margin: 2px 0; }
            .header-period { font-size: 11px; color: #6B7280; margin: 0; }
            
            .summary-box { display: flex; gap: 15px; margin-bottom: 20px; }
            .kpi-card { flex: 1; background: #FEF2F2; border: 1px solid #FCA5A5; padding: 12px; border-radius: 8px; text-align: center; }
            .kpi-title { font-size: 10px; font-weight: bold; color: #7F1D1D; text-transform: uppercase; margin-bottom: 4px; }
            .kpi-value { font-size: 16px; font-weight: bold; color: #991B1B; }

            table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            table.data-table th { background: #B91C1C; color: #FFFFFF; font-size: 10.5px; padding: 8px; text-align: left; font-weight: bold; }
            table.data-table td { padding: 8px; border-bottom: 1px solid #E5E7EB; font-size: 11px; }
            table.data-table tr:nth-child(even) { background-color: #F9FAFB; }

            .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #6B7280; }
            @media print {
              @page { size: A4 landscape; margin: 1.5cm; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="width: 90px;">
                ${base64Logo ? `<img src="${base64Logo}" class="logo" />` : '<b style="color:#B91C1C; font-size:18px;">RSUCL</b>'}
              </td>
              <td class="header-text">
                <h1 class="header-title">LAPORAN KETERLAMBATAN &amp; POTONGAN PEGAWAI</h1>
                <p class="header-subtitle">RUMAH SAKIT UMUM CEMPAKA LIMA</p>
                <p class="header-period">Periode: ${monthStr}${deptStr}</p>
              </td>
            </tr>
          </table>

          <div class="summary-box">
            <div class="kpi-card">
              <div class="kpi-title">Total Pegawai Terlambat</div>
              <div class="kpi-value">${records.filter((r: any) => r.total_late_minutes > 0).length} Pegawai</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Akumulasi Menit Terlambat</div>
              <div class="kpi-value">${res.data.grand_total_late_mins || 0} Menit</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Tarif Potongan / Menit</div>
              <div class="kpi-value">Rp ${(res.data.rate_per_minute || 500).toLocaleString('id-ID')}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">Total Potongan Keterlambatan</div>
              <div class="kpi-value">Rp ${(res.data.grand_total_deduction || 0).toLocaleString('id-ID')}</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">No</th>
                <th>Nama Pegawai</th>
                <th>NIK KTP</th>
                <th>Unit Kerja</th>
                <th style="text-align: center;">Hari Telat</th>
                <th style="text-align: center;">Total Menit</th>
                <th style="text-align: right;">Tarif / Menit</th>
                <th style="text-align: right;">Total Potongan (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:20px;">Tidak ada data keterlambatan.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <p>Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            }
          <\/script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (err: any) {
      alert(err?.message || "Terjadi kesalahan saat meng-generate PDF.");
      printWindow.close();
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

  const handleExportPDF = async (type: "harian" | "bulanan" = "harian") => {
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

      if (type === "harian") {
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

  // ── State Laporan Manajemen SDM ──────────────────────────
  const [hrExporting, setHrExporting] = useState<string | null>(null); // nama laporan yang sedang diekspor

  // ── Helper: Header HTML untuk semua laporan SDM ──────────────────
  const buildHrHtmlHeader = (logoB64: string, title: string, period: string) => {
    const logoHtml = logoB64
      ? `<img src="${logoB64}" width="140" height="54" style="display:block;" />`
      : '<span style="font-size:11pt;font-weight:bold;color:#16A34A;">RSUCL</span>';
    return `
      <table style="border:none;margin-bottom:8px;border-collapse:collapse;">
        <tr style="height:22px;">
          <td rowspan="3" colspan="2" style="border:none;vertical-align:middle;padding:4px;width:140px;">${logoHtml}</td>
          <td colspan="8" style="font-size:13pt;font-weight:bold;color:#111827;text-align:right;vertical-align:bottom;border:none;padding:2px 4px;">${title}</td>
        </tr>
        <tr style="height:18px;"><td colspan="8" style="font-size:10pt;font-weight:bold;color:#374151;text-align:right;vertical-align:middle;border:none;padding:2px 4px;">RUMAH SAKIT UMUM CEMPAKA LIMA</td></tr>
        <tr style="height:16px;"><td colspan="8" style="font-size:9pt;color:#6B7280;text-align:right;vertical-align:top;border:none;padding:2px 4px;">${period}</td></tr>
        <tr style="height:3px;"><td colspan="10" style="height:3px;border:none;border-bottom:2px solid #000000;padding:0;font-size:1px;">\u00a0</td></tr>
      </table>`;
  };

  const buildHrPdfHeader = (logoB64: string, title: string, period: string) => {
    return `
      <table style="width:100%;border-collapse:collapse;border-bottom:3px double #16A34A;padding-bottom:12px;margin-bottom:15px;">
        <tr>
          <td style="width:80px;text-align:left;vertical-align:middle;padding:0;">
            <img src="${logoB64}" style="width:60px;height:60px;object-fit:contain;display:block;" />
          </td>
          <td style="text-align:center;vertical-align:middle;padding:0;">
            <p style="font-size:15px;font-weight:800;color:#16A34A;margin:0 0 2px 0;text-transform:uppercase;">PT. CEMPAKA LIMA UTAMA</p>
            <h1 style="font-size:22px;font-weight:800;color:#DC2626;margin:0;text-transform:uppercase;">RUMAH SAKIT UMUM CEMPAKA LIMA</h1>
            <p style="font-size:13px;color:#000000;margin:3px 0 0 0;">Jl. Politeknik Aceh No.23, Beurawe, Kec. Kuta Alam, Banda Aceh</p>
          </td>
          <td style="width:80px;"></td>
        </tr>
      </table>
      <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;text-align:center;margin:20px 0 5px 0;">${title}</h2>
      <div style="font-size:12px;font-weight:600;text-align:center;margin-bottom:8px;color:#374151;">Periode: ${period}</div>
      <div style="font-size:9px;text-align:right;color:#6B7280;margin-bottom:10px;">Dicetak: ${new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "medium" })}</div>`;
  };

  const excelWrapperHr = (sheetName: string, bodyHtml: string) => `
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
        th { background-color: #16A34A; color: #FFFFFF; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 8px; }
        td { font-size: 10pt; border: 1px solid #000000; vertical-align: middle; padding: 5px 8px; color: #1F2937; }
        .dept-row td { background-color: #E5E7EB; font-weight: bold; font-size: 10pt; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .badge-approved { background-color: #D1FAE5; color: #065F46; font-weight: bold; text-align: center; }
        .badge-pending  { background-color: #FEF9C3; color: #92400E; font-weight: bold; text-align: center; }
        .badge-rejected { background-color: #FEE2E2; color: #991B1B; font-weight: bold; text-align: center; }
      </style>
    </head>
    <body>${bodyHtml}</body>
    </html>`;

  const triggerHrDownload = (html: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
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

  const loadLogoBase64 = async (): Promise<string> => {
    const logoPath = logoUrl && logoUrl !== "none" ? logoUrl : rsLogoImg;
    try {
      const res = await fetch(logoPath);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { return ""; }
  };

  const getMonthsLabel = (month: number, year: number) => {
    const names = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    return `${names[month - 1]} ${year}`;
  };

  const statusBadge = (status: string) => {
    if (status === "approved" || status === "completed") return `<td class="badge-approved">${status.toUpperCase()}</td>`;
    if (status === "pending") return `<td class="badge-pending">${status.toUpperCase()}</td>`;
    return `<td class="badge-rejected">${status.toUpperCase()}</td>`;
  };
 
  const cleanDateStr = (dateStr: string) => {
    if (!dateStr) return "--";
    if (dateStr.includes("T")) {
      return dateStr.split("T")[0];
    }
    return dateStr;
  };

  // ── 1. EKSPOR LEMBUR ────────────────────────────────────────────
  const handleExportOvertimeExcel = async () => {
    setHrExporting("lembur");
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      const res = await overtimeApi.list({ date_from: startDate, date_to: endDate, per_page: 9999 });
      if (!res.success) { alert("Gagal memuat data lembur."); return; }
      const data = res.data.filter(r => {
        const deptOk = selectedDepartment === "all" || r.employee?.department === selectedDepartment;
        return r.status === "approved" && deptOk;
      });
      let rows = ""; let no = 1;
      let totalMinutesAll = 0;

      data.forEach(r => {
        const emp = r.employee;
        let durMin = 0;
        if (r.system_checkout_data?.overtime_minutes && r.system_checkout_data.overtime_minutes > 0) {
          durMin = r.system_checkout_data.overtime_minutes;
        } else if (r.start_time && r.end_time) {
          const [sh, sm] = r.start_time.split(":").map(Number);
          const [eh, em] = r.end_time.split(":").map(Number);
          if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
            let sMins = sh * 60 + sm;
            let eMins = eh * 60 + em;
            if (eMins < sMins) eMins += 24 * 60;
            durMin = Math.max(0, eMins - sMins);
          }
        }
        totalMinutesAll += durMin;

        const durHours = Math.floor(durMin / 60);
        const durMinsRem = durMin % 60;
        let durFormatted = "";
        if (durMin === 0) {
          durFormatted = "0 Menit";
        } else if (durHours > 0 && durMinsRem > 0) {
          durFormatted = `${durHours} Jam ${durMinsRem} Menit`;
        } else if (durHours > 0) {
          durFormatted = `${durHours} Jam`;
        } else {
          durFormatted = `${durMinsRem} Menit`;
        }

        rows += `<tr>
          <td class="center">${no++}</td>
          <td class="center" x:str>${emp?.nik_ktp ?? "--"}</td>
          <td class="bold">${emp?.name ?? "--"}</td>
          <td>${emp?.department ?? "--"}</td>
          <td class="center">${r.date ?? "--"}</td>
          <td class="center">${r.start_time ?? "--"}</td>
          <td class="center">${r.end_time ?? "--"}</td>
          <td class="center bold" style="background-color:#FEF3C7;color:#92400E;">${durFormatted}</td>
          <td>${r.reason ?? "--"}</td>
          <td>${r.tasks ?? "--"}</td>
          ${statusBadge(r.status)}
          <td>${r.admin_note ?? "--"}</td>
        </tr>`;
      });

      const grandTotalHours = Math.floor(totalMinutesAll / 60);
      const grandTotalMinsRem = totalMinutesAll % 60;
      const grandTotalFormatted = grandTotalHours > 0 
        ? `${grandTotalHours} Jam ${grandTotalMinsRem > 0 ? `${grandTotalMinsRem} Menit` : ''}`.trim() + ` (${totalMinutesAll} Menit)`
        : `${grandTotalMinsRem} Menit`;

      const summaryFooterRow = `
        <tr style="background-color:#F3F4F6;font-weight:bold;">
          <td colspan="7" style="text-align:right;padding:8px;">TOTAL AKUMULASI WAKTU LEMBUR:</td>
          <td class="center bold" style="background-color:#FDE68A;color:#78350F;padding:8px;">${grandTotalFormatted}</td>
          <td colspan="4" style="padding:8px;">Total Data: ${data.length} Pengajuan</td>
        </tr>
      `;

      const body = buildHrHtmlHeader(logo, "REKAP PENGAJUAN LEMBUR", period) +
        `<table><thead><tr>
          <th style="width:35px">No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Tanggal</th><th>Jam Mulai</th><th>Jam Selesai</th><th style="background-color:#D97706;color:#FFFFFF;">Total Waktu</th><th>Alasan/Tujuan</th><th>Tugas</th><th>Status</th><th>Catatan Admin</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="12" style="text-align:center;padding:20px;color:#9CA3AF;">Tidak ada data lembur pada periode ini.</td></tr>'}</tbody>
        <tfoot>${summaryFooterRow}</tfoot>
        </table>`;
      triggerHrDownload(excelWrapperHr("Rekap Lembur", body), `Rekap_Lembur_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2,"0")}.xls`);
    } catch(e) { alert("Gagal ekspor data lembur."); } finally { setHrExporting(null); }
  };

  const handleExportOvertimePDF = async () => {
    setHrExporting("lembur-pdf");
    const pw = window.open("", "_blank");
    if (!pw) { alert("Izinkan popup untuk mencetak."); setHrExporting(null); return; }
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      const res = await overtimeApi.list({ date_from: startDate, date_to: endDate, per_page: 9999 });
      if (!res.success) { pw.close(); return; }
      const data = res.data.filter(r => {
        const deptOk = selectedDepartment === "all" || r.employee?.department === selectedDepartment;
        return r.status === "approved" && deptOk;
      });
      let rows = ""; let no = 1;
      let totalMinutesAll = 0;

      data.forEach(r => {
        const emp = r.employee;
        const statusColor = r.status === "approved" ? "#D1FAE5" : r.status === "pending" ? "#FEF9C3" : "#FEE2E2";
        const statusText = r.status === "approved" ? "#065F46" : r.status === "pending" ? "#92400E" : "#991B1B";

        let durMin = 0;
        if (r.system_checkout_data?.overtime_minutes && r.system_checkout_data.overtime_minutes > 0) {
          durMin = r.system_checkout_data.overtime_minutes;
        } else if (r.start_time && r.end_time) {
          const [sh, sm] = r.start_time.split(":").map(Number);
          const [eh, em] = r.end_time.split(":").map(Number);
          if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
            let sMins = sh * 60 + sm;
            let eMins = eh * 60 + em;
            if (eMins < sMins) eMins += 24 * 60;
            durMin = Math.max(0, eMins - sMins);
          }
        }
        totalMinutesAll += durMin;

        const durHours = Math.floor(durMin / 60);
        const durMinsRem = durMin % 60;
        let durFormatted = "";
        if (durMin === 0) {
          durFormatted = "0 Menit";
        } else if (durHours > 0 && durMinsRem > 0) {
          durFormatted = `${durHours} Jam ${durMinsRem} Menit`;
        } else if (durHours > 0) {
          durFormatted = `${durHours} Jam`;
        } else {
          durFormatted = `${durMinsRem} Menit`;
        }

        rows += `<tr style="border-bottom:1px solid #E5E7EB;font-size:10px;">
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${no++}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${emp?.nik_ktp ?? "--"}</td>
          <td style="padding:6px;font-weight:bold;border-right:1px solid #E5E7EB;">${emp?.name ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${emp?.department ?? "--"}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.date ?? "--"}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.start_time ?? "--"}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.end_time ?? "--"}</td>
          <td style="padding:6px;text-align:center;font-weight:bold;background-color:#FEF3C7;color:#92400E;border-right:1px solid #E5E7EB;">${durFormatted}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.reason ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.tasks ?? "--"}</td>
          <td style="padding:6px;text-align:center;font-weight:bold;background-color:${statusColor};color:${statusText};border-right:1px solid #E5E7EB;">${r.status.toUpperCase()}</td>
          <td style="padding:6px;">${r.admin_note ?? "--"}</td>
        </tr>`;
      });

      const grandTotalHours = Math.floor(totalMinutesAll / 60);
      const grandTotalMinsRem = totalMinutesAll % 60;
      const grandTotalFormatted = grandTotalHours > 0 
        ? `${grandTotalHours} Jam ${grandTotalMinsRem > 0 ? `${grandTotalMinsRem} Menit` : ''}`.trim() + ` (${totalMinutesAll} Menit)`
        : `${grandTotalMinsRem} Menit`;

      const summaryFooterRow = `
        <tr style="background-color:#F3F4F6;font-size:10px;font-weight:bold;border-top:2px solid #16A34A;">
          <td colspan="7" style="padding:8px;text-align:right;">TOTAL AKUMULASI WAKTU LEMBUR:</td>
          <td style="padding:8px;text-align:center;background-color:#FDE68A;color:#78350F;font-weight:bold;">${grandTotalFormatted}</td>
          <td colspan="4" style="padding:8px;">Total Data: ${data.length} Pengajuan</td>
        </tr>
      `;

      pw.document.write(`<html><head><title>Rekap Lembur</title><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;border:1px solid #E5E7EB;} th{background:#16A34A;color:#fff;font-size:10px;padding:8px;text-align:left;} @media print{@page{margin:1cm;}}</style></head><body>${buildHrPdfHeader(logo,"REKAP PENGAJUAN LEMBUR",`Periode: ${period}`)}<table><thead><tr><th style="width:30px;">No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Tanggal</th><th>Jam Mulai</th><th>Jam Selesai</th><th style="background-color:#D97706;color:#FFF;">Total Waktu</th><th>Alasan</th><th>Tugas</th><th>Status</th><th>Catatan Admin</th></tr></thead><tbody>${rows || '<tr><td colspan="12" style="text-align:center;padding:20px;">Tidak ada data.</td></tr>'}</tbody><tfoot>${summaryFooterRow}</tfoot></table><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script></body></html>`);
      pw.document.close();
    } catch(e) { pw.close(); } finally { setHrExporting(null); }
  };

  // ── 2. EKSPOR CUTI / SAKIT ───────────────────────────────────────
  const handleExportLeaveExcel = async () => {
    setHrExporting("cuti");
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const res = await leaveApi.list();
      if (!res.success) { alert("Gagal memuat data cuti."); return; }
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      const data = res.data.filter(r => {
        const d = new Date(r.start_date);
        const deptOk = selectedDepartment === "all" || r.employee?.department === selectedDepartment;
        return r.status === "approved" && d >= startDate && d <= endDate && deptOk;
      });
      const typeLabel = (t: string) => ({ cuti: "Cuti Tahunan", sakit: "Izin Sakit", cuti_khusus: "Cuti Khusus", izin: "Izin" }[t] ?? t);
      let rows = ""; let no = 1;
      data.forEach(r => {
        rows += `<tr>
          <td class="center">${no++}</td>
          <td class="center" x:str>${r.employee?.nik_ktp ?? "--"}</td>
          <td class="bold">${r.employee?.name ?? "--"}</td>
          <td>${r.employee?.department ?? "--"}</td>
          <td class="center">${typeLabel(r.type)}</td>
          <td class="center">${r.start_date}</td>
          <td class="center">${r.end_date}</td>
          <td class="center">${r.days} hari</td>
          <td>${r.reason ?? "--"}</td>
          ${statusBadge(r.status)}
          <td>${r.reviewer?.name ?? "--"}</td>
        </tr>`;
      });
      const body = buildHrHtmlHeader(logo, "REKAP PENGAJUAN CUTI / IZIN / SAKIT", period) +
        `<table><thead><tr>
          <th style="width:35px">No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Jenis</th><th>Tgl Mulai</th><th>Tgl Selesai</th><th>Durasi</th><th>Alasan</th><th>Status</th><th>Disetujui Oleh</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="11" style="text-align:center;padding:20px;color:#9CA3AF;">Tidak ada data pada periode ini.</td></tr>'}</tbody></table>`;
      triggerHrDownload(excelWrapperHr("Rekap Cuti", body), `Rekap_Cuti_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2,"0")}.xls`);
    } catch(e) { alert("Gagal ekspor data cuti."); } finally { setHrExporting(null); }
  };

  const handleExportLeavePDF = async () => {
    setHrExporting("cuti-pdf");
    const pw = window.open("", "_blank");
    if (!pw) { alert("Izinkan popup untuk mencetak."); setHrExporting(null); return; }
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const res = await leaveApi.list();
      if (!res.success) { pw.close(); return; }
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      const typeLabel = (t: string) => ({ cuti: "Cuti Tahunan", sakit: "Izin Sakit", cuti_khusus: "Cuti Khusus", izin: "Izin" }[t] ?? t);
      const data = res.data.filter(r => {
        const d = new Date(r.start_date);
        const deptOk = selectedDepartment === "all" || r.employee?.department === selectedDepartment;
        return r.status === "approved" && d >= startDate && d <= endDate && deptOk;
      });
      let rows = ""; let no = 1;
      data.forEach(r => {
        const sc = r.status === "approved" ? "#D1FAE5" : r.status === "pending" ? "#FEF9C3" : "#FEE2E2";
        const st = r.status === "approved" ? "#065F46" : r.status === "pending" ? "#92400E" : "#991B1B";
        rows += `<tr style="border-bottom:1px solid #E5E7EB;font-size:10px;">
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${no++}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.nik_ktp ?? "--"}</td>
          <td style="padding:6px;font-weight:bold;border-right:1px solid #E5E7EB;">${r.employee?.name ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.department ?? "--"}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${typeLabel(r.type)}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.start_date}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.end_date}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.days} hari</td>
          <td style="padding:6px;text-align:center;font-weight:bold;background-color:${sc};color:${st};border-right:1px solid #E5E7EB;">${r.status.toUpperCase()}</td>
          <td style="padding:6px;">${r.reviewer?.name ?? "--"}</td>
        </tr>`;
      });
      pw.document.write(`<html><head><title>Rekap Cuti</title><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;border:1px solid #E5E7EB;} th{background:#16A34A;color:#fff;font-size:10px;padding:8px;text-align:left;} @media print{@page{margin:1cm;}}</style></head><body>${buildHrPdfHeader(logo,"REKAP PENGAJUAN CUTI / IZIN / SAKIT",`Periode: ${period}`)}<table><thead><tr><th>No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Jenis</th><th>Tgl Mulai</th><th>Tgl Selesai</th><th>Durasi</th><th>Status</th><th>Disetujui Oleh</th></tr></thead><tbody>${rows || '<tr><td colspan="10" style="text-align:center;padding:20px;">Tidak ada data.</td></tr>'}</tbody></table><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script></body></html>`);
      pw.document.close();
    } catch(e) { pw.close(); } finally { setHrExporting(null); }
  };

  // ── 3. EKSPOR SURAT TUGAS ────────────────────────────────────────
  const handleExportAssignmentExcel = async () => {
    setHrExporting("surat-tugas");
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      const res = await assignmentLetterApi.list({ start_date: startDate, end_date: endDate, department_id: selectedDepartment !== "all" ? selectedDepartment : undefined, per_page: 9999 } as any);
      if (!res.success) { alert("Gagal memuat data surat tugas."); return; }
      const data = res.data.filter(r => r.status === "approved" || r.status === "completed");
      let rows = ""; let no = 1;
      data.forEach(r => {
        rows += `<tr>
          <td class="center">${no++}</td>
          <td class="center" x:str>${r.employee?.nik_ktp ?? "--"}</td>
          <td class="bold">${r.employee?.name ?? "--"}</td>
          <td>${r.employee?.department ?? "--"}</td>
          <td>${r.title ?? "--"}</td>
          <td>${r.issuing_institution ?? "--"}</td>
          <td>${r.purpose ?? "--"}</td>
          <td class="center">${r.start_date}</td>
          <td class="center">${r.end_date}</td>
          ${statusBadge(r.status)}
        </tr>`;
      });
      const body = buildHrHtmlHeader(logo, "REKAP SURAT TUGAS", period) +
        `<table><thead><tr>
          <th style="width:35px">No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Judul Surat</th><th>Institusi</th><th>Tujuan</th><th>Tgl Mulai</th><th>Tgl Selesai</th><th>Status</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#9CA3AF;">Tidak ada data surat tugas pada periode ini.</td></tr>'}</tbody></table>`;
      triggerHrDownload(excelWrapperHr("Surat Tugas", body), `Rekap_Surat_Tugas_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2,"0")}.xls`);
    } catch(e) { alert("Gagal ekspor data surat tugas."); } finally { setHrExporting(null); }
  };

  const handleExportAssignmentPDF = async () => {
    setHrExporting("surat-tugas-pdf");
    const pw = window.open("", "_blank");
    if (!pw) { alert("Izinkan popup untuk mencetak."); setHrExporting(null); return; }
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      const res = await assignmentLetterApi.list({ start_date: startDate, end_date: endDate, department_id: selectedDepartment !== "all" ? selectedDepartment : undefined, per_page: 9999 } as any);
      if (!res.success) { pw.close(); return; }
      const data = res.data.filter(r => r.status === "approved" || r.status === "completed");
      let rows = ""; let no = 1;
      data.forEach(r => {
        const sc = r.status === "approved" || r.status === "completed" ? "#D1FAE5" : r.status === "pending" ? "#FEF9C3" : "#FEE2E2";
        const st = r.status === "approved" || r.status === "completed" ? "#065F46" : r.status === "pending" ? "#92400E" : "#991B1B";
        rows += `<tr style="border-bottom:1px solid #E5E7EB;font-size:10px;">
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${no++}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.nik_ktp ?? "--"}</td>
          <td style="padding:6px;font-weight:bold;border-right:1px solid #E5E7EB;">${r.employee?.name ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.department ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.title}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.issuing_institution}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.start_date}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${r.end_date}</td>
          <td style="padding:6px;text-align:center;font-weight:bold;background-color:${sc};color:${st};">${r.status.toUpperCase()}</td>
        </tr>`;
      });
      pw.document.write(`<html><head><title>Rekap Surat Tugas</title><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;border:1px solid #E5E7EB;} th{background:#16A34A;color:#fff;font-size:10px;padding:8px;text-align:left;} @media print{@page{margin:1cm;}}</style></head><body>${buildHrPdfHeader(logo,"REKAP SURAT TUGAS",`Periode: ${period}`)}<table><thead><tr><th>No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Judul Surat</th><th>Institusi</th><th>Tgl Mulai</th><th>Tgl Selesai</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;">Tidak ada data.</td></tr>'}</tbody></table><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script></body></html>`);
      pw.document.close();
    } catch(e) { pw.close(); } finally { setHrExporting(null); }
  };

  // ── 4. EKSPOR PENGUNDURAN DIRI ───────────────────────────────────
  const handleExportResignationExcel = async () => {
    setHrExporting("resign");
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const res = await resignationApi.list({ department_id: selectedDepartment !== "all" ? Number(selectedDepartment) : undefined });
      if (!res.success) { alert("Gagal memuat data pengunduran diri."); return; }
      const data = res.data.filter(r => {
        const d = new Date(r.request_date);
        return r.status === "approved" && d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
      });
      let rows = ""; let no = 1;
      data.forEach(r => {
        rows += `<tr>
          <td class="center">${no++}</td>
          <td class="center" x:str>${r.employee?.nik_ktp ?? "--"}</td>
          <td class="bold">${r.employee?.user?.name ?? "--"}</td>
          <td>${r.employee?.department?.name ?? "--"}</td>
          <td>${r.posisi ?? "--"}</td>
          <td class="center">${cleanDateStr(r.request_date)}</td>
          <td class="center">${cleanDateStr(r.effective_date)}</td>
          <td>${r.reason ?? "--"}</td>
          ${statusBadge(r.status)}
        </tr>`;
      });
      const body = buildHrHtmlHeader(logo, "REKAP PENGUNDURAN DIRI", period) +
        `<table><thead><tr>
          <th style="width:35px">No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Jabatan</th><th>Tgl Pengajuan</th><th>Tgl Efektif</th><th>Alasan</th><th>Status</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:#9CA3AF;">Tidak ada data pengunduran diri pada periode ini.</td></tr>'}</tbody></table>`;
      triggerHrDownload(excelWrapperHr("Pengunduran Diri", body), `Rekap_Pengunduran_Diri_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2,"0")}.xls`);
    } catch(e) { alert("Gagal ekspor data pengunduran diri."); } finally { setHrExporting(null); }
  };

  const handleExportResignationPDF = async () => {
    setHrExporting("resign-pdf");
    const pw = window.open("", "_blank");
    if (!pw) { alert("Izinkan popup untuk mencetak."); setHrExporting(null); return; }
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const res = await resignationApi.list({ department_id: selectedDepartment !== "all" ? Number(selectedDepartment) : undefined });
      if (!res.success) { pw.close(); return; }
      const data = res.data.filter(r => {
        const d = new Date(r.request_date);
        return r.status === "approved" && d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
      });
      let rows = ""; let no = 1;
      data.forEach(r => {
        const sc = r.status === "approved" ? "#D1FAE5" : r.status === "pending" ? "#FEF9C3" : "#FEE2E2";
        const st = r.status === "approved" ? "#065F46" : r.status === "pending" ? "#92400E" : "#991B1B";
        rows += `<tr style="border-bottom:1px solid #E5E7EB;font-size:10px;">
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${no++}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.nik_ktp ?? "--"}</td>
          <td style="padding:6px;font-weight:bold;border-right:1px solid #E5E7EB;">${r.employee?.user?.name ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.department?.name ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.posisi ?? "--"}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${cleanDateStr(r.request_date)}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${cleanDateStr(r.effective_date)}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.reason ?? "--"}</td>
          <td style="padding:6px;text-align:center;font-weight:bold;background-color:${sc};color:${st};">${r.status.toUpperCase()}</td>
        </tr>`;
      });
      pw.document.write(`<html><head><title>Rekap Pengunduran Diri</title><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;border:1px solid #E5E7EB;} th{background:#16A34A;color:#fff;font-size:10px;padding:8px;text-align:left;} @media print{@page{margin:1cm;}}</style></head><body>${buildHrPdfHeader(logo,"REKAP PENGUNDURAN DIRI",`Periode: ${period}`)}<table><thead><tr><th>No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Jabatan</th><th>Tgl Pengajuan</th><th>Tgl Efektif</th><th>Alasan</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;">Tidak ada data.</td></tr>'}</tbody></table><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script></body></html>`);
      pw.document.close();
    } catch(e) { pw.close(); } finally { setHrExporting(null); }
  };

  // ── 5. EKSPOR SANKSI DISIPLIN ────────────────────────────────────
  const handleExportDisciplinaryExcel = async () => {
    setHrExporting("disiplin");
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const res = await disciplinarySanctionApi.list({ department_id: selectedDepartment !== "all" ? Number(selectedDepartment) : undefined });
      if (!res.success) { alert("Gagal memuat data sanksi disiplin."); return; }
      const data = res.data.filter(r => {
        const d = new Date(r.created_at);
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
      });
      const typeLabel = (t: string) => ({ teguran: "Teguran", sp1: "SP 1", sp2: "SP 2", phk: "PHK" }[t] ?? t.toUpperCase());
      const typeColor = (t: string) => ({ teguran: "#FEF9C3", sp1: "#FED7AA", sp2: "#FEE2E2", phk: "#FECACA" }[t] ?? "#F3F4F6");
      let rows = ""; let no = 1;
      data.forEach(r => {
        rows += `<tr>
          <td class="center">${no++}</td>
          <td class="center" x:str>${r.employee?.nik_ktp ?? "--"}</td>
          <td class="bold">${r.employee?.user?.name ?? "--"}</td>
          <td>${r.employee?.department?.name ?? "--"}</td>
          <td class="center bold" style="background-color:${typeColor(r.type)};color:#7C2D12;">${typeLabel(r.type)}</td>
          <td class="center">${new Date(r.created_at).toLocaleDateString("id-ID")}</td>
          <td>${r.admin_note ?? "--"}</td>
          <td>${r.creator?.name ?? "--"}</td>
        </tr>`;
      });
      const body = buildHrHtmlHeader(logo, "REKAP SANKSI DISIPLIN", period) +
        `<table><thead><tr>
          <th style="width:35px">No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Jenis Sanksi</th><th>Tanggal</th><th>Catatan / Kronologi</th><th>Ditetapkan Oleh</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#9CA3AF;">Tidak ada sanksi disiplin pada periode ini.</td></tr>'}</tbody></table>`;
      triggerHrDownload(excelWrapperHr("Sanksi Disiplin", body), `Rekap_Sanksi_Disiplin_RSUCL_${selectedYear}_${String(selectedMonth).padStart(2,"0")}.xls`);
    } catch(e) { alert("Gagal ekspor data sanksi disiplin."); } finally { setHrExporting(null); }
  };

  const handleExportDisciplinaryPDF = async () => {
    setHrExporting("disiplin-pdf");
    const pw = window.open("", "_blank");
    if (!pw) { alert("Izinkan popup untuk mencetak."); setHrExporting(null); return; }
    try {
      const logo = await loadLogoBase64();
      const period = getMonthsLabel(selectedMonth, selectedYear);
      const res = await disciplinarySanctionApi.list({ department_id: selectedDepartment !== "all" ? Number(selectedDepartment) : undefined });
      if (!res.success) { pw.close(); return; }
      const data = res.data.filter(r => {
        const d = new Date(r.created_at);
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
      });
      const typeLabel = (t: string) => ({ teguran: "Teguran", sp1: "SP 1", sp2: "SP 2", phk: "PHK" }[t] ?? t.toUpperCase());
      const typeColor = (t: string) => ({ teguran: "#FEF9C3", sp1: "#FED7AA", sp2: "#FEE2E2", phk: "#FECACA" }[t] ?? "#F3F4F6");
      let rows = ""; let no = 1;
      data.forEach(r => {
        rows += `<tr style="border-bottom:1px solid #E5E7EB;font-size:10px;">
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${no++}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.nik_ktp ?? "--"}</td>
          <td style="padding:6px;font-weight:bold;border-right:1px solid #E5E7EB;">${r.employee?.user?.name ?? "--"}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.employee?.department?.name ?? "--"}</td>
          <td style="padding:6px;text-align:center;font-weight:bold;background-color:${typeColor(r.type)};color:#7C2D12;border-right:1px solid #E5E7EB;">${typeLabel(r.type)}</td>
          <td style="padding:6px;text-align:center;border-right:1px solid #E5E7EB;">${new Date(r.created_at).toLocaleDateString("id-ID")}</td>
          <td style="padding:6px;border-right:1px solid #E5E7EB;">${r.admin_note ?? "--"}</td>
          <td style="padding:6px;">${r.creator?.name ?? "--"}</td>
        </tr>`;
      });
      pw.document.write(`<html><head><title>Rekap Sanksi Disiplin</title><style>body{font-family:Arial,sans-serif;padding:20px;} table{width:100%;border-collapse:collapse;border:1px solid #E5E7EB;} th{background:#B91C1C;color:#fff;font-size:10px;padding:8px;text-align:left;} @media print{@page{margin:1cm;}}</style></head><body>${buildHrPdfHeader(logo,"REKAP SANKSI DISIPLIN",`Periode: ${period}`)}<table><thead><tr><th>No</th><th>NIK KTP</th><th>Nama</th><th>Unit Kerja</th><th>Jenis Sanksi</th><th>Tanggal</th><th>Catatan</th><th>Ditetapkan Oleh</th></tr></thead><tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:20px;">Tidak ada data.</td></tr>'}</tbody></table><script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script></body></html>`);
      pw.document.close();
    } catch(e) { pw.close(); } finally { setHrExporting(null); }
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
      </div>

      {/* ── Month, Year & Department Filter ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
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

      {/* ══════════════════════════════════════════════════════════════════
           SECTION: LAPORAN KEHADIRAN & OPERASIONAL
         ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-green-150 shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="px-5 py-4 border-b border-green-100 bg-gradient-to-r from-green-50/60 to-emerald-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={15} className="text-green-700" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-gray-900">Laporan Kehadiran &amp; Operasional</h3>
              <p className="text-[10.5px] text-gray-400 mt-0.5">Cetak &amp; ekspor rekap kehadiran harian, bulanan, data kendaraan, dan media sosial pegawai</p>
            </div>
          </div>
        </div>

        {/* Grid Laporan */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Card 1: Absensi Harian */}
          <div className="bg-blue-50/30 rounded-xl border border-blue-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Clock size={13} className="text-blue-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Absensi Harian</p>
                <p className="text-[10px] text-gray-400">Detail check-in masuk &amp; pulang</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => handleExportExcel("harian")}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />Excel
              </button>
              <button
                onClick={() => handleExportPDF("harian")}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />PDF
              </button>
            </div>
          </div>

          {/* Card 2: Absensi Bulanan */}
          <div className="bg-emerald-50/30 rounded-xl border border-emerald-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Users size={13} className="text-emerald-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Absensi Bulanan</p>
                <p className="text-[10px] text-gray-400">Total kehadiran &amp; jam kerja</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => handleExportExcel("bulanan")}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />Excel
              </button>
              <button
                onClick={() => handleExportPDF("bulanan")}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />PDF
              </button>
            </div>
          </div>

          {/* Card 3: Data Kendaraan */}
          <div className="bg-purple-50/30 rounded-xl border border-purple-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Briefcase size={13} className="text-purple-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Data Kendaraan</p>
                <p className="text-[10px] text-gray-400">Plat nomor kendaraan pegawai</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={handleExportVehicles}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />Unduh Plat Kendaraan (Excel)
              </button>
            </div>
          </div>

          {/* Card 4: Media Sosial */}
          <div className="bg-orange-50/30 rounded-xl border border-orange-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Award size={13} className="text-orange-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Media Sosial</p>
                <p className="text-[10px] text-gray-400">Instagram, FB, TikTok pegawai</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={handleExportSocialMedia}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />Unduh Data Medsos (Excel)
              </button>
            </div>
          </div>

          {/* Card 5: Rekap Keterlambatan & Potongan */}
          <div className="bg-red-50/40 rounded-xl border border-red-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={13} className="text-red-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Keterlambatan &amp; Potongan</p>
                <p className="text-[10px] text-gray-400">Menit telat &amp; denda Rp / menit</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                onClick={handleExportLatenessExcel}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />Excel
              </button>
              <button
                onClick={handleExportLatenessPDF}
                disabled={exporting}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />PDF
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
           SECTION: LAPORAN MANAJEMEN SDM
         ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
        {/* Header Section */}
        <div className="px-5 py-4 border-b border-blue-50 bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={15} className="text-blue-700" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-gray-900">Laporan Manajemen SDM</h3>
              <p className="text-[10.5px] text-gray-400 mt-0.5">Cetak &amp; ekspor laporan lembur, cuti, surat tugas, pengunduran diri, dan sanksi disiplin</p>
            </div>
          </div>
        </div>

        {/* Cards container directly without duplicate filter block */}

        {/* Grid Laporan */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Card 1: Lembur */}
          <div className="bg-amber-50/50 rounded-xl border border-amber-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock size={13} className="text-amber-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Rekap Lembur</p>
                <p className="text-[10px] text-gray-400">Data pengajuan lembur karyawan</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                id="btn-export-lembur-excel"
                onClick={handleExportOvertimeExcel}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />{hrExporting === "lembur" ? "..." : "Excel"}
              </button>
              <button
                id="btn-export-lembur-pdf"
                onClick={handleExportOvertimePDF}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />{hrExporting === "lembur-pdf" ? "..." : "PDF"}
              </button>
            </div>
          </div>

          {/* Card 2: Cuti / Izin / Sakit */}
          <div className="bg-green-50/50 rounded-xl border border-green-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Calendar size={13} className="text-green-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Rekap Cuti / Izin / Sakit</p>
                <p className="text-[10px] text-gray-400">Semua jenis pengajuan ketidakhadiran</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                id="btn-export-cuti-excel"
                onClick={handleExportLeaveExcel}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />{hrExporting === "cuti" ? "..." : "Excel"}
              </button>
              <button
                id="btn-export-cuti-pdf"
                onClick={handleExportLeavePDF}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />{hrExporting === "cuti-pdf" ? "..." : "PDF"}
              </button>
            </div>
          </div>

          {/* Card 3: Surat Tugas */}
          <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Briefcase size={13} className="text-blue-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Rekap Surat Tugas</p>
                <p className="text-[10px] text-gray-400">Data penugasan dinas luar karyawan</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                id="btn-export-surat-tugas-excel"
                onClick={handleExportAssignmentExcel}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />{hrExporting === "surat-tugas" ? "..." : "Excel"}
              </button>
              <button
                id="btn-export-surat-tugas-pdf"
                onClick={handleExportAssignmentPDF}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />{hrExporting === "surat-tugas-pdf" ? "..." : "PDF"}
              </button>
            </div>
          </div>

          {/* Card 4: Pengunduran Diri */}
          <div className="bg-rose-50/50 rounded-xl border border-rose-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                <UserMinus size={13} className="text-rose-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Rekap Pengunduran Diri</p>
                <p className="text-[10px] text-gray-400">Pengajuan resign karyawan</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                id="btn-export-resign-excel"
                onClick={handleExportResignationExcel}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />{hrExporting === "resign" ? "..." : "Excel"}
              </button>
              <button
                id="btn-export-resign-pdf"
                onClick={handleExportResignationPDF}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />{hrExporting === "resign-pdf" ? "..." : "PDF"}
              </button>
            </div>
          </div>

          {/* Card 5: Sanksi Disiplin */}
          <div className="bg-red-50/50 rounded-xl border border-red-100 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <Shield size={13} className="text-red-700" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-gray-800">Rekap Sanksi Disiplin</p>
                <p className="text-[10px] text-gray-400">Teguran, SP1, SP2, dan PHK</p>
              </div>
            </div>
            <div className="flex gap-2 mt-auto">
              <button
                id="btn-export-disiplin-excel"
                onClick={handleExportDisciplinaryExcel}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Download size={11} />{hrExporting === "disiplin" ? "..." : "Excel"}
              </button>
              <button
                id="btn-export-disiplin-pdf"
                onClick={handleExportDisciplinaryPDF}
                disabled={hrExporting !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText size={11} />{hrExporting === "disiplin-pdf" ? "..." : "PDF"}
              </button>
            </div>
          </div>

        </div>

        {/* Footer info */}
        {hrExporting !== null && (
          <div className="px-5 pb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-[11px] text-blue-700 font-medium">Sedang memproses laporan, mohon tunggu...</span>
            </div>
          </div>
        )}
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

      {/* ══════════════════════════════════════════════════════════════════
           SECTION: LAPORAN KETERLAMBATAN & POTONGAN PEGAWAI
         ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden mb-6">
        {/* Header Section */}
        <div className="px-5 py-4 border-b border-red-50 bg-gradient-to-r from-red-50/60 to-rose-50/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={15} className="text-red-700" />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-gray-900">Laporan Keterlambatan &amp; Potongan Pegawai</h3>
              <p className="text-[10.5px] text-gray-400 mt-0.5">
                Kalkulasi otomatis Rp {(latenessData?.rate_per_minute || 500).toLocaleString('id-ID')} / menit keterlambatan pegawai &amp; PJ Bagian
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportLatenessExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[11.5px] font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download size={13} /> Excel
            </button>
            <button
              onClick={handleExportLatenessPDF}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11.5px] font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <FileText size={13} /> PDF
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-red-50/20 border-b border-red-50">
          <div className="bg-white rounded-xl p-3.5 border border-red-100 shadow-2xs">
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Total Pegawai Telat</p>
            <p className="text-xl font-black text-red-600 mt-1">
              {(latenessData?.records || []).filter((r: any) => r.total_late_minutes > 0).length} <span className="text-[12px] font-medium text-gray-400">Orang</span>
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-red-100 shadow-2xs">
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Total Menit Telat</p>
            <p className="text-xl font-black text-red-600 mt-1">
              {latenessData?.grand_total_late_mins || 0} <span className="text-[12px] font-medium text-gray-400">Menit</span>
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-red-100 shadow-2xs">
            <p className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">Tarif / Menit</p>
            <p className="text-xl font-black text-gray-800 mt-1">
              Rp {(latenessData?.rate_per_minute || 500).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-red-100 shadow-2xs">
            <p className="text-[10.5px] font-bold text-red-600 uppercase tracking-wider">Akumulasi Potongan</p>
            <p className="text-xl font-black text-red-700 mt-1">
              Rp {(latenessData?.grand_total_deduction || 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau NIK KTP..."
              value={latenessSearch}
              onChange={(e) => setLatenessSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[12px] focus:outline-none focus:border-red-500 focus:bg-white transition-all"
            />
          </div>
          <p className="text-[11.5px] text-gray-400 font-medium">
            Menampilkan { (latenessData?.records || []).filter((r: any) =>
              r.name.toLowerCase().includes(latenessSearch.toLowerCase()) ||
              r.nik_ktp.includes(latenessSearch)
            ).length } data pegawai
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4 text-center w-12">No</th>
                <th className="py-3 px-4">Nama Pegawai</th>
                <th className="py-3 px-4">NIK KTP</th>
                <th className="py-3 px-4">Unit Kerja</th>
                <th className="py-3 px-4 text-center">Jumlah Hari Telat</th>
                <th className="py-3 px-4 text-center">Total Menit Telat</th>
                <th className="py-3 px-4 text-right">Tarif / Menit</th>
                <th className="py-3 px-4 text-right">Total Potongan (Rp)</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-[12.5px]">
              {latenessLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 text-[12px]">
                    <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin inline-block mr-2" />
                    Memuat data keterlambatan...
                  </td>
                </tr>
              ) : !latenessData?.records || latenessData.records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 text-[12.5px]">
                    Tidak ada catatan keterlambatan untuk periode filter ini.
                  </td>
                </tr>
              ) : (
                latenessData.records
                  .filter((r: any) =>
                    r.name.toLowerCase().includes(latenessSearch.toLowerCase()) ||
                    r.nik_ktp.includes(latenessSearch)
                  )
                  .map((row: any, idx: number) => (
                    <tr key={row.employee_id} className="hover:bg-red-50/20 transition-colors">
                      <td className="py-3 px-4 text-center font-medium text-gray-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{row.name}</td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-[11.5px]">{row.nik_ktp}</td>
                      <td className="py-3 px-4 text-gray-600">{row.department}</td>
                      <td className="py-3 px-4 text-center font-semibold text-gray-700">
                        {row.total_late_days > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                            {row.total_late_days} Hari
                          </span>
                        ) : (
                          <span className="text-gray-400">0 Hari</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-red-600 font-mono">
                        {row.total_late_minutes > 0 ? `${row.total_late_minutes} min` : "0 min"}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        Rp {row.rate_per_minute.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-red-700 font-mono">
                        Rp {row.total_deduction.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedEmpLatenessDetail(row);
                            setShowLatenessModal(true);
                          }}
                          disabled={row.total_late_days === 0}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Eye size={12} /> Rincian
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Rincian Keterlambatan Pegawai */}
      {showLatenessModal && selectedEmpLatenessDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setShowLatenessModal(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
              <div>
                <h3 className="text-[14px] font-bold text-gray-900">Detail Keterlambatan Pegawai</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{selectedEmpLatenessDetail.name} ({selectedEmpLatenessDetail.department})</p>
              </div>
              <button
                onClick={() => setShowLatenessModal(false)}
                className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                <div>
                  <p className="text-[10.5px] font-bold text-red-700 uppercase tracking-wider">Total Akumulasi Denda</p>
                  <p className="text-lg font-black text-red-800">Rp {selectedEmpLatenessDetail.total_deduction.toLocaleString('id-ID')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider">Total Terlambat</p>
                  <p className="text-sm font-bold text-gray-800">{selectedEmpLatenessDetail.total_late_minutes} Menit ({selectedEmpLatenessDetail.total_late_days} Hari)</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-[11.5px] font-bold text-gray-700">Rincian Per Tanggal Presensi:</p>
                {selectedEmpLatenessDetail.details.map((d: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between gap-3 text-[12px]">
                    <div>
                      <p className="font-bold text-gray-800">{d.date} <span className="font-normal text-gray-500">({d.shift_name})</span></p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Jam Masuk Shift: {d.shift_start} | Check-in: <span className="font-bold text-red-600">{d.check_in}</span></p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 rounded font-mono font-bold text-[11px] mb-0.5">
                        +{d.late_minutes} Menit
                      </span>
                      <p className="text-[11.5px] font-extrabold text-red-700 font-mono">Rp {d.deduction.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowLatenessModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
