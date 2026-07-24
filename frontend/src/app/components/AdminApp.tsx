import { useState, useEffect, Fragment } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  History,
  CalendarDays,
  FileText,
  Bell,
  Settings,
  LogOut,
  UserCheck,
  Clock,
  AlertCircle,
  Search,
  Plus,
  Upload,
  Download,
  MoreHorizontal,
  Lock,
  Menu,
  X,
  CheckCircle2,
  BarChart3,
  Edit2,
  Trash2,
  ChevronDown,
  Building2,
  Trophy,
  Award,
  Eye,
} from "lucide-react";
import logoImg from "../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { AttendanceTab } from "./admin/AttendanceTab";
import { HistoryTab } from "./admin/HistoryTab";
import { ScheduleTab } from "./admin/ScheduleTab";
import { LeaveTab } from "./admin/LeaveTab";
import { OvertimeTab } from "./admin/OvertimeTab";
import { ReportsTab } from "./admin/ReportsTab";
import { NotificationsTab } from "./admin/NotificationsTab";
import { SettingsTab } from "./admin/SettingsTab";
import { DepartmentsTab } from "./admin/DepartmentsTab";
import { HolidaysTab } from "./admin/HolidaysTab";
import { PJBagianTab } from "./admin/PJBagianTab";
import { EmployeeRegistrationTab } from "./admin/EmployeeRegistrationTab";
import { ResignationTab } from "./admin/ResignationTab";
import AssignmentLetterTab from "./admin/AssignmentLetterTab";
import { AdminManagementTab } from "./admin/AdminManagementTab";
import { DisciplinaryTab } from "./admin/DisciplinaryTab";
import { Crown, ShieldAlert } from "lucide-react";
import {
  employeeApi,
  Employee,
  reportApi,
  ReportSummary,
  notificationApi,
  overtimeApi,
  employeeRegistrationApi,
} from "../../services/api";

const sidebarItems = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "employees", icon: Users, label: "Data Pegawai" },
  {
    id: "onboarding",
    icon: UserCheck,
    label: "Draf Pegawai / Onboarding",
    badge: 0,
  },
  { id: "departments", icon: Building2, label: "Unit Kerja" },
  { id: "pj_bagian", icon: UserCheck, label: "PJ Bagian" },
  { id: "attendance", icon: ClipboardList, label: "Absensi" },
  { id: "history", icon: History, label: "Riwayat" },
  { id: "schedule", icon: CalendarDays, label: "Jadwal Shift" },
  { id: "holidays", icon: CalendarDays, label: "Kalender Libur" },
  { id: "leave", icon: FileText, label: "Pengajuan Cuti", badge: 0 },
  { id: "overtime", icon: Clock, label: "Lembur", badge: 0 },
  { id: "assignment", icon: FileText, label: "Pengajuan Surat Tugas" },
  { id: "resignation", icon: ShieldAlert, label: "Pengunduran Diri" },
  { id: "disciplinary", icon: ShieldAlert, label: "Sanksi Disiplin" },
  { id: "reports", icon: BarChart3, label: "Laporan" },
  { id: "notifications", icon: Bell, label: "Notifikasi", badge: 0 },
  { id: "settings", icon: Settings, label: "Pengaturan" },
  {
    id: "super_admin_management",
    icon: Crown,
    label: "Kelola Admin (Super Admin)",
  },
];

const statusColors: Record<string, { color: string; bg: string }> = {
  hadir: { color: "#16A34A", bg: "#DCFCE7" },
  telat: { color: "#D97706", bg: "#FEF3C7" },
  alpha: { color: "#DC2626", bg: "#FEE2E2" },
  cuti: { color: "#2563EB", bg: "#DBEAFE" },
  izin: { color: "#7C3AED", bg: "#F5F3FF" },
  sakit: { color: "#EA580C", bg: "#FFF7ED" },
  tidak_ada_shift: { color: "#6B7280", bg: "#F3F4F6" },
  belum_hadir: { color: "#9CA3AF", bg: "#F9FAFB" },
};

const statusLabels: Record<string, string> = {
  hadir: "Hadir",
  telat: "Terlambat",
  alpha: "Alpha",
  cuti: "Cuti",
  izin: "Izin",
  sakit: "Sakit",
  tidak_ada_shift: "Tidak Ada Shift",
  belum_hadir: "Belum Hadir",
};

const emptyForm = {
  name: "",
  nik_ktp: "",
  username: "",
  password: "",
  department_id: "",
  position_id: "",
  email: "",
  phone: "",
  gender: "Laki-laki",
  joinDate: "",
  motor_plate_1: "",
  motor_plate_2: "",
  car_plate_1: "",
  car_plate_2: "",
  instagram: "",
  facebook: "",
  tiktok: "",
};

interface AdminAppProps {
  onLogout: () => void;
}

/**
 * Layang Utama Administrator (AdminApp) — Sistem Absensi RSUCL
 *
 * Komponen induk untuk seluruh fitur manajemen admin (Dashboard statistik, manajemen pegawai,
 * manajemen departemen, absensi real-time, laporan bulanan, persetujuan cuti/izin, pengaturan geofence,
 * serta notifikasi sistem).
 *
 * @param onLogout Callback untuk membersihkan sesi autentikasi dan keluar sistem
 */
export function AdminApp({ onLogout }: AdminAppProps) {
  const { user, logoUrl } = useAuth();

  // Tab menu aktif di sidebar (default: 'dashboard')
  const [activeTab, setActiveTab] = useState("dashboard");

  // Pengontrol buka/tutup laci sidebar pada tampilan layar kecil (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Kata kunci pencarian data pegawai
  const [searchQuery, setSearchQuery] = useState("");

  // ── States Penyimpanan Data dari API ──────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<
    { id: number; name: string }[]
  >([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(
    null,
  );

  // Indikator status loading tarik data
  const [loading, setLoading] = useState(false);

  // Penampung pesan error dari backend
  const [errorMsg, setErrorMsg] = useState("");

  // ── States Pengelolaan Modal CRUD Pegawai ────────────────────────────────
  const [modalType, setModalType] = useState<"add" | "edit" | "delete" | null>(
    null,
  );
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  // Melacak baris tabel data pegawai mana yang opsi popover-nya sedang dibuka
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Melacak baris tabel pegawai mana yang sedang di-expand untuk menampilkan kendaraan
  const [expandedEmpId, setExpandedEmpId] = useState<number | null>(null);

  // Penampung pesan error validasi input di dalam form modal
  const [formError, setFormError] = useState("");

  // Jumlah notifikasi sistem admin yang belum dibaca
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Jumlah pengajuan lembur yang belum diproses (draft / pending)
  const [pendingOvertimeCount, setPendingOvertimeCount] = useState(0);

  // Jumlah pengajuan pendaftaran pegawai baru yang belum diproses (pending)
  const [pendingRegistrationCount, setPendingRegistrationCount] = useState(0);

  // State untuk detail modal pegawai
  const [detailModalEmp, setDetailModalEmp] = useState<Employee | null>(null);

  // State untuk preview pas foto besar
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    name: string;
  } | null>(null);

  /**
   * Mengambil jumlah notifikasi admin belum dibaca dari API.
   */
  const fetchUnreadNotificationsCount = async () => {
    try {
      const res = await notificationApi.list();
      if (res.success) {
        setUnreadNotifications(res.data.unread_count);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Mengambil jumlah pengajuan lembur yang masih pending/draft.
   */
  const fetchPendingOvertimeCount = async () => {
    try {
      const res = await overtimeApi.overtimesSummary();
      if (res.success) {
        setPendingOvertimeCount(
          (res.data.pending || 0) + (res.data.draft || 0),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Mengambil jumlah pendaftaran pegawai baru yang pending.
   */
  const fetchPendingRegistrationCount = async () => {
    try {
      const res = await employeeRegistrationApi.list({ status: "pending" });
      if (res.success && res.summary) {
        setPendingRegistrationCount(res.summary.pending || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Mengambil data utama secara massal (Daftar Pegawai, Metadata Departemen & Jabatan, Ringkasan Laporan).
   */
  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [empRes, metaRes, reportRes] = await Promise.all([
        employeeApi.list(),
        employeeApi.meta(),
        reportApi.summary(),
      ]);

      if (empRes.success) setEmployees(empRes.data);
      if (metaRes.success) {
        setDepartments(metaRes.data.departments);
        setPositions(metaRes.data.positions);
      }
      if (reportRes.success) setReportSummary(reportRes.data);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mengambil ringkasan laporan terbaru saja (untuk update instan sehabis persetujuan cuti).
   */
  const refreshReportSummary = async () => {
    try {
      const reportRes = await reportApi.summary();
      if (reportRes.success) {
        setReportSummary(reportRes.data);
      }
    } catch (err) {
      console.error("Error refreshing summary:", err);
    }
  };

  // Pemuatan data awal saat komponen terpasang di DOM dan inisialisasi polling notifikasi (20 detik)
  useEffect(() => {
    loadData();
    fetchUnreadNotificationsCount();
    fetchPendingOvertimeCount();
    fetchPendingRegistrationCount();
    const interval = setInterval(() => {
      fetchUnreadNotificationsCount();
      fetchPendingOvertimeCount();
      fetchPendingRegistrationCount();
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setForm({
      ...emptyForm,
      department_id: departments[0]?.id?.toString() ?? "",
      position_id: positions[0]?.id?.toString() ?? "",
    });
    setFormError("");
    setSelectedEmp(null);
    setModalType("add");
  };

  const openEdit = (emp: Employee) => {
    setForm({
      name: emp.name,
      nik_ktp: emp.nik_ktp,
      username: emp.username,
      password: "", // blank by default on edit
      department_id: emp.department_id?.toString() ?? "",
      position_id: emp.position_id?.toString() ?? "",
      email: emp.email || "",
      phone: emp.phone || "",
      gender: emp.gender || "Laki-laki",
      joinDate: emp.join_date || "",
      motor_plate_1: emp.vehicles?.motor_plate_1 || "",
      motor_plate_2: emp.vehicles?.motor_plate_2 || "",
      car_plate_1: emp.vehicles?.car_plate_1 || "",
      car_plate_2: emp.vehicles?.car_plate_2 || "",
      instagram: emp.social_media?.instagram || "",
      facebook: emp.social_media?.facebook || "",
      tiktok: emp.social_media?.tiktok || "",
    });
    setFormError("");
    setSelectedEmp(emp);
    setOpenMenuId(null);
    setModalType("edit");
  };

  const openDelete = (emp: Employee) => {
    setSelectedEmp(emp);
    setOpenMenuId(null);
    setModalType("delete");
  };

  const handleExportEmployeeExcel = async () => {
    try {
      let base64Logo = "";
      try {
        const response = await fetch(logoUrl && logoUrl !== "none" ? logoUrl : logoImg);
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
        year: "numeric",
      });

      const listToExport = filtered.length > 0 ? filtered : employees;

      let bodyRows = "";
      listToExport.forEach((emp, index) => {
        const motor1 = emp.vehicles?.motor_plate_1 || emp.motor_plate_1 || "--";
        const car1 = emp.vehicles?.car_plate_1 || emp.car_plate_1 || "--";
        const genderLabel = emp.gender === "L" ? "Laki-laki" : emp.gender === "P" ? "Perempuan" : (emp.gender || "--");
        const statusLabel = emp.status === "active" ? "Aktif" : "Non-Aktif";

        bodyRows += `
          <tr>
            <td style="text-align:center; font-weight:bold;">${index + 1}</td>
            <td style="text-align:center; font-family:monospace; mso-number-format:'\\@';" x:str>${emp.nik_ktp || "--"}</td>
            <td style="text-align:left; font-weight:bold;">${emp.name}</td>
            <td style="text-align:left;">${emp.email || "--"}</td>
            <td style="text-align:left;">${emp.username || "--"}</td>
            <td style="text-align:left;">${emp.department || "--"}</td>
            <td style="text-align:left;">${emp.position || "--"}</td>
            <td style="text-align:center;">${emp.phone || "--"}</td>
            <td style="text-align:center;">${genderLabel}</td>
            <td style="text-align:center;">${emp.join_date || "--"}</td>
            <td style="text-align:center; font-family:monospace;">${motor1}</td>
            <td style="text-align:center; font-family:monospace;">${car1}</td>
            <td style="text-align:center; font-weight:bold; color:${emp.status === 'active' ? '#16A34A' : '#DC2626'};">${statusLabel}</td>
          </tr>
        `;
      });

      const bodyHtml = `
        <table style="border:none; margin-bottom:12px; border-collapse:collapse;">
          <tr style="height:22px;">
            <td rowspan="3" colspan="3" class="logo-cell">${logoImgHtml}</td>
            <td colspan="10" class="header-title" style="text-align:right;">DATA KEPEGAWAIAN &amp; STAF RUMAH SAKIT</td>
          </tr>
          <tr style="height:18px;">
            <td colspan="10" class="header-rs" style="text-align:right;">RSU CEMPAKA LIMA</td>
          </tr>
          <tr style="height:16px;">
            <td colspan="10" class="header-period" style="text-align:right;">Dicetak Tanggal: ${todayStr} | Total Pegawai: ${listToExport.length} Personel</td>
          </tr>
          <tr style="height:3px;">
            <td colspan="13" class="separator">&nbsp;</td>
          </tr>
        </table>

        <h3 style="margin-top:20px; color:#15803D; font-size:11pt; font-family:Calibri,sans-serif; font-weight:bold;">DAFTAR INDUK DATA PEGAWAI (MASTER EMPLOYEE DIRECTORY)</h3>
        <table style="width:100%; border:1px solid #000000; border-collapse:collapse;">
          <colgroup>
            <col width="45" style="width:45px;" />
            <col width="150" style="width:150px;" />
            <col width="200" style="width:200px;" />
            <col width="180" style="width:180px;" />
            <col width="130" style="width:130px;" />
            <col width="150" style="width:150px;" />
            <col width="150" style="width:150px;" />
            <col width="120" style="width:120px;" />
            <col width="110" style="width:110px;" />
            <col width="110" style="width:110px;" />
            <col width="110" style="width:110px;" />
            <col width="110" style="width:110px;" />
            <col width="100" style="width:100px;" />
          </colgroup>
          <thead>
            <tr>
              <th style="width:45px; text-align:center;">No</th>
              <th style="width:150px; text-align:center;">NIK KTP</th>
              <th style="text-align:left;">Nama Lengkap</th>
              <th style="text-align:left;">Email</th>
              <th style="text-align:left;">Username</th>
              <th style="text-align:left;">Unit Kerja</th>
              <th style="text-align:left;">Jabatan</th>
              <th style="text-align:center;">No. HP / WA</th>
              <th style="text-align:center;">Gender</th>
              <th style="text-align:center;">Tgl Masuk</th>
              <th style="text-align:center;">Plat Motor</th>
              <th style="text-align:center;">Plat Mobil</th>
              <th style="text-align:center;">Status</th>
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
            th { background-color: #15803D; color: #FFFFFF; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 8px; }
            td { font-size: 10pt; border: 1px solid #000000; vertical-align: middle; padding: 6px 8px; color: #1F2937; }
          </style>
        </head>
        <body>${bodyHtmlStr}</body>
        </html>`;

      const filename = `Data_Pegawai_RSUCL_${todayStr.replace(/\s+/g, "_")}.xls`;

      const blob = new Blob(["\uFEFF" + excelWrapper("Data Pegawai", bodyHtml)], {
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
      alert(err?.message || "Gagal mengunduh Excel Data Pegawai.");
    }
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedEmp(null);
    setFormError("");
  };

  const handleSave = async () => {
    if (
      !form.name.trim() ||
      !form.nik_ktp.trim() ||
      !form.username.trim() ||
      (modalType === "add" && !form.password.trim())
    ) {
      setFormError("Nama, NIK KTP, Username, dan Password wajib diisi.");
      return;
    }
    if (modalType === "add" && !/^\d{6,}$/.test(form.password)) {
      setFormError("Password harus berupa angka minimal 6 digit.");
      return;
    }
    if (
      modalType === "edit" &&
      form.password.trim() &&
      !/^\d{6,}$/.test(form.password)
    ) {
      setFormError("Password baru harus berupa angka minimal 6 digit.");
      return;
    }
    setFormError("");
    try {
      if (modalType === "add") {
        const res = await employeeApi.create({
          name: form.name,
          nik_ktp: form.nik_ktp,
          username: form.username,
          password: form.password,
          department_id: Number(form.department_id),
          position_id: Number(form.position_id),
          email: form.email,
          phone: form.phone,
          gender: form.gender as any,
          join_date: form.joinDate || undefined,
          motor_plate_1: form.motor_plate_1 || undefined,
          motor_plate_2: form.motor_plate_2 || undefined,
          car_plate_1: form.car_plate_1 || undefined,
          car_plate_2: form.car_plate_2 || undefined,
          instagram: form.instagram || undefined,
          facebook: form.facebook || undefined,
          tiktok: form.tiktok || undefined,
        } as any);
        if (res.success) {
          setEmployees((prev) => [res.data, ...prev]);
        }
      } else if (modalType === "edit" && selectedEmp) {
        const updateData: any = {
          name: form.name,
          email: form.email,
          department_id: Number(form.department_id),
          position_id: Number(form.position_id),
          phone: form.phone,
          gender: form.gender,
          join_date: form.joinDate || undefined,
          motor_plate_1: form.motor_plate_1 || null,
          motor_plate_2: form.motor_plate_2 || null,
          car_plate_1: form.car_plate_1 || null,
          car_plate_2: form.car_plate_2 || null,
          instagram: form.instagram || null,
          facebook: form.facebook || null,
          tiktok: form.tiktok || null,
        };
        if (form.password.trim()) {
          updateData.password = form.password;
        }
        const res = await employeeApi.update(selectedEmp.id, updateData);
        if (res.success) {
          setEmployees((prev) =>
            prev.map((e) => (e.id === selectedEmp.id ? res.data : e)),
          );
        }
      }
      closeModal();
      loadData(); // reload charts
    } catch (err: any) {
      setFormError(err?.message ?? "Gagal menyimpan data.");
    }
  };

  const handleDelete = async () => {
    if (selectedEmp) {
      try {
        const res = await employeeApi.delete(selectedEmp.id);
        if (res.success) {
          setEmployees((prev) => prev.filter((e) => e.id !== selectedEmp.id));
        }
        closeModal();
        loadData();
      } catch (err: any) {
        alert(err?.message ?? "Gagal menghapus data.");
      }
    }
  };

  // Re-calculate live stats from API if available, fallback to local lists otherwise
  const stats = [
    {
      icon: Users,
      label: "Total Pegawai",
      value: reportSummary
        ? String(reportSummary.total_employees)
        : String(employees.length),
      sub: `${departments.length} Unit Kerja`,
      color: "#374151",
      bg: "#F9FAFB",
    },
    {
      icon: UserCheck,
      label: "Hadir Hari Ini",
      value: reportSummary
        ? String(reportSummary.today.hadir)
        : String(
            employees.filter(
              (e) =>
                e.today_attendance?.status === "hadir" ||
                e.today_attendance?.status === "telat",
            ).length,
          ),
      sub: "dari total pegawai",
      color: "#16A34A",
      bg: "#F0FDF4",
    },
    {
      icon: Clock,
      label: "Terlambat",
      value: reportSummary
        ? String(reportSummary.today.telat)
        : String(
            employees.filter((e) => e.today_attendance?.status === "telat")
              .length,
          ),
      sub: "absen masuk > 08:30",
      color: "#D97706",
      bg: "#FFFBEB",
    },
    {
      icon: FileText,
      label: "Cuti Aktif",
      value: reportSummary ? String(reportSummary.today.cuti) : "0",
      sub: "hari ini",
      color: "#2563EB",
      bg: "#EFF6FF",
    },
    {
      icon: AlertCircle,
      label: "Alpha",
      value: reportSummary ? String(reportSummary.today.alpha) : "0",
      sub: "tanpa keterangan",
      color: "#DC2626",
      bg: "#FEF2F2",
    },
  ];

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.nik_ktp.includes(searchQuery) ||
      e.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.position.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Map summary chart structure into recharts
  const weeklyData =
    reportSummary?.daily_chart.map((c) => ({
      day: c.label,
      hadir: c.hadir ?? 0,
      alpha: c.alpha ?? 0,
    })) ?? [];

  const SidebarContent = ({ mobile }: { mobile?: boolean }) => {
    const sidebarItemsWithBadges = sidebarItems.map((item) => {
      if (item.id === "onboarding") {
        return { ...item, badge: pendingRegistrationCount };
      }
      if (item.id === "leave") {
        return { ...item, badge: reportSummary?.pending_leave ?? 0 };
      }
      if (item.id === "overtime") {
        return { ...item, badge: pendingOvertimeCount };
      }
      if (item.id === "notifications") {
        return { ...item, badge: unreadNotifications };
      }
      return item;
    });

    const getItem = (id: string) =>
      sidebarItemsWithBadges.find((i) => i.id === id);

    // Grouping Sidebar Menu Admin
    const groups = [
      {
        title: "Utama",
        items: ["dashboard", "reports", "notifications"]
          .map(getItem)
          .filter(Boolean),
      },
      {
        title: "Manajemen Pegawai",
        items: [
          "employees",
          "onboarding",
          "departments",
          "pj_bagian",
          ...(user?.role === "super_admin" ? ["super_admin_management"] : []),
        ]
          .map(getItem)
          .filter(Boolean),
      },
      {
        title: "Operasional & Jadwal",
        items: ["attendance", "history", "schedule", "holidays"]
          .map(getItem)
          .filter(Boolean),
      },
      {
        title: "Permohonan & Persetujuan",
        items: ["leave", "overtime", "assignment", "resignation", "disciplinary"].map(getItem).filter(Boolean),
      },
      {
        title: "Pengaturan",
        items: ["settings"].map(getItem).filter(Boolean),
      },
    ];

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header Logo */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {logoUrl !== "none" && (
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img
                  src={logoUrl || logoImg}
                  alt="Logo RSUCL"
                  className="w-8 h-8 object-contain"
                />
              </div>
            )}
            <div>
              <p className="text-[13px] font-bold text-gray-900 leading-tight">
                {user?.role === "super_admin" ? "RSUCL Direksi" : "RSUCL Admin"}
              </p>
              <p className="text-[10px] text-gray-400 font-medium">
                {user?.role === "super_admin"
                  ? "Super Admin (Direktur)"
                  : "Administrator Panel"}
              </p>
            </div>
          </div>
        </div>

        {/* Grouped Nav List */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {groups.map((grp, gIdx) => (
            <div
              key={gIdx}
              className={gIdx > 0 ? "pt-3 border-t border-gray-100" : ""}
            >
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider px-3 mb-1.5 mt-0.5">
                {grp.title}
              </p>
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  if (!item) return null;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (mobile) setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-all ${
                        isActive
                          ? "bg-[#16A34A] text-white font-semibold shadow-sm shadow-green-200"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 ? (
                        <span
                          className={`text-[10px] font-bold min-w-[18px] min-h-[18px] px-1 rounded-full flex items-center justify-center ${
                            isActive
                              ? "bg-white/30 text-white"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile Card & Logout (Bottom) */}
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-[#16A34A]/15 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[#16A34A] text-[11px] font-bold">
                  {user?.name
                    ?.split(" ")
                    .slice(0, 2)
                    .map((w) => w.charAt(0))
                    .join("")
                    .toUpperCase() || "AD"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-900 truncate">
                {user?.name || "Super Admin"}
              </p>
              <p className="text-[10px] text-gray-400">Administrator</p>
            </div>
            <button
              onClick={onLogout}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Keluar"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex h-screen bg-[#F5F7FA] overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
      onClick={() => openMenuId !== null && setOpenMenuId(null)}
    >
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0 w-64 h-full border-r border-gray-100 shadow-sm">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-72 h-full shadow-2xl">
            <SidebarContent mobile />
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X size={14} className="text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"
            >
              <Menu size={16} className="text-gray-600" />
            </button>
            <div>
              <h2 className="text-[14px] font-semibold text-gray-900">
                {sidebarItems.find((s) => s.id === activeTab)?.label ||
                  "Dashboard"}
              </h2>
              <p className="text-[11px] text-gray-400">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("notifications")}
              className="relative w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shadow-sm"
              title="Notifikasi"
            >
              <Bell size={15} />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {errorMsg && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-[13px] text-red-600 mb-5 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                onClick={loadData}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg font-semibold transition-all"
              >
                Segarkan
              </button>
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {activeTab === "dashboard" && (
            <div className="max-w-6xl mx-auto space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {stats.map((s, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: s.bg }}
                    >
                      <s.icon size={15} style={{ color: s.color }} />
                    </div>
                    <p className="text-[22px] font-bold text-gray-900">
                      {s.value}
                    </p>
                    <p className="text-[11px] font-medium text-gray-600">
                      {s.label}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[14px] font-semibold text-gray-800">
                        Absensi Mingguan
                      </p>
                      <p className="text-[11px] text-gray-400">
                        7 Hari Terakhir
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {[
                        ["#16A34A", "Hadir"],
                        ["#F87171", "Alpha"],
                      ].map(([c, l]) => (
                        <div key={l} className="flex items-center gap-1">
                          <div
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ background: c }}
                          />
                          <span className="text-[10px] text-gray-400">{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {weeklyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        id="admin-weekly-bar"
                        data={weeklyData}
                        barGap={1}
                        barCategoryGap="35%"
                      >
                        <XAxis
                          dataKey="day"
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
                          dataKey="alpha"
                          name="Alpha"
                          fill="#F87171"
                          radius={[3, 3, 0, 0]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[180px] flex items-center justify-center text-gray-300 text-[12px]">
                      Belum ada data mingguan.
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
                  <div className="mb-4">
                    <p className="text-[14px] font-semibold text-gray-800">
                      Status Kehadiran Bulan Ini
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Statistik berjalan
                    </p>
                  </div>
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500 font-medium">
                        Total Check-In
                      </span>
                      <span className="text-[13px] font-bold text-[#16A34A]">
                        {(reportSummary?.this_month.hadir ?? 0) +
                          (reportSummary?.this_month.telat ?? 0)}{" "}
                        kali
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500 font-medium">
                        Terlambat
                      </span>
                      <span className="text-[13px] font-bold text-amber-500">
                        {reportSummary?.this_month.telat ?? 0} kali
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500 font-medium">
                        Cuti & Izin
                      </span>
                      <span className="text-[13px] font-bold text-indigo-500">
                        {reportSummary?.this_month.cuti ?? 0} kali
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500 font-medium">
                        Alpha
                      </span>
                      <span className="text-[13px] font-bold text-red-500">
                        {reportSummary?.this_month.alpha ?? 0} kali
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 text-[10px] text-gray-400 border-t border-gray-50 pt-3">
                    Diperbarui otomatis dari database absensi.
                  </div>
                </div>
              </div>

              {/* ── SEKSI TAMBAHAN: LIVE FEED & PINTASAN AKSI ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
                {/* Kolom Kiri: Log Aktivitas Absensi Hari Ini (lg:col-span-2) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div className="px-5 py-4 border-b border-gray-50 bg-gradient-to-r from-[#F0FDF4] to-[#DCFCE7]/30 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <p className="text-[14px] font-bold text-gray-800">
                        Log Aktivitas Absensi Hari Ini (Real-time)
                      </p>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      Live Feed
                    </span>
                  </div>

                  <div className="p-4 flex-1">
                    {/* Filter checkedInToday */}
                    {(() => {
                      const checkedInToday = employees
                        .filter((emp) => emp.today_attendance && emp.today_attendance.check_in)
                        .sort((a, b) => {
                          const timeA = a.today_attendance?.check_in || "";
                          const timeB = b.today_attendance?.check_in || "";
                          return timeB.localeCompare(timeA);
                        });

                      if (checkedInToday.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-16 text-center h-full">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3 border border-emerald-100/50">
                              <Clock size={20} className="animate-pulse" />
                            </div>
                            <p className="text-[12.5px] font-bold text-gray-700">Menunggu Absensi Hari Ini</p>
                            <p className="text-[10.5px] text-gray-400 max-w-xs mt-1 leading-relaxed">
                              Belum ada staf yang check-in. Aktivitas masuk dan pulang akan langsung tercatat di sini secara otomatis.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                          {checkedInToday.slice(0, 6).map((emp) => {
                            const isLate = emp.today_attendance?.status === "telat";
                            return (
                              <div key={emp.id} className="flex items-center justify-between p-2.5 border border-gray-50 rounded-xl hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[12px] flex items-center justify-center">
                                    {emp.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-[12px] font-bold text-gray-800">{emp.name}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{emp.department}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                      isLate 
                                        ? "bg-amber-50 border border-amber-250 text-amber-700" 
                                        : "bg-green-50 border border-green-200 text-green-700"
                                    }`}>
                                      Masuk: {emp.today_attendance?.check_in?.substring(0, 5) ?? "—"}
                                    </span>
                                    <p className="text-[8px] text-gray-450 mt-0.5 uppercase tracking-wider font-bold">
                                      {isLate ? "Terlambat" : "Tepat Waktu"}
                                    </p>
                                  </div>
                                  <div className="text-right min-w-[75px]">
                                    {emp.today_attendance?.check_out ? (
                                      <>
                                        <span className="px-2 py-0.5 bg-blue-50 border border-blue-150 rounded text-[10px] font-bold font-mono text-blue-700">
                                          Pulang: {emp.today_attendance.check_out.substring(0, 5)}
                                        </span>
                                        <p className="text-[8px] text-gray-450 mt-0.5 uppercase tracking-wider font-bold">Selesai</p>
                                      </>
                                    ) : (
                                      <>
                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold font-mono text-slate-500">
                                          Aktif Kerja
                                        </span>
                                        <p className="text-[8px] text-gray-450 mt-0.5 uppercase tracking-wider font-bold">Di Lapangan</p>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Kolom Kanan: Pintasan Aksi & Unit Kerja Terbaik (lg:col-span-1) */}
                <div className="space-y-4 flex flex-col">
                  {/* Pintasan Tugas Pending */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4.5 space-y-3">
                    <p className="text-[13px] font-bold text-gray-800">⚡ Tindakan Cepat Diperlukan</p>
                    
                    <div className="space-y-2">
                      {/* Row Cuti */}
                      <div 
                        onClick={() => setActiveTab("leaves")}
                        className="flex items-center justify-between p-2.5 bg-indigo-50/40 hover:bg-indigo-50 border border-indigo-100/50 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📅</span>
                          <div>
                            <p className="text-[11.5px] font-bold text-indigo-950">Persetujuan Cuti</p>
                            <p className="text-[9.5px] text-indigo-600 mt-0.5">
                              {reportSummary?.pending_leave && reportSummary.pending_leave > 0 
                                ? `${reportSummary.pending_leave} pengajuan baru` 
                                : "Tidak ada antrean"}
                            </p>
                          </div>
                        </div>
                        {reportSummary?.pending_leave && reportSummary.pending_leave > 0 ? (
                          <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                            {reportSummary.pending_leave}
                          </span>
                        ) : (
                          <span className="text-indigo-400 text-xs">➔</span>
                        )}
                      </div>

                      {/* Row Lembur */}
                      <div 
                        onClick={() => setActiveTab("overtimes")}
                        className="flex items-center justify-between p-2.5 bg-amber-50/40 hover:bg-amber-50 border border-amber-100/50 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">⏰</span>
                          <div>
                            <p className="text-[11.5px] font-bold text-amber-950">Persetujuan Lembur</p>
                            <p className="text-[9.5px] text-amber-600 mt-0.5">
                              {pendingOvertimeCount > 0 
                                ? `${pendingOvertimeCount} pengajuan baru` 
                                : "Tidak ada antrean"}
                            </p>
                          </div>
                        </div>
                        {pendingOvertimeCount > 0 ? (
                          <span className="w-5 h-5 bg-amber-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                            {pendingOvertimeCount}
                          </span>
                        ) : (
                          <span className="text-amber-400 text-xs">➔</span>
                        )}
                      </div>

                      {/* Row Onboarding */}
                      <div 
                        onClick={() => setActiveTab("onboarding")}
                        className="flex items-center justify-between p-2.5 bg-teal-50/40 hover:bg-teal-50 border border-teal-100/50 rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">👤</span>
                          <div>
                            <p className="text-[11.5px] font-bold text-teal-955">Draf Onboarding</p>
                            <p className="text-[9.5px] text-teal-600 mt-0.5">
                              {pendingRegistrationCount > 0 
                                ? `${pendingRegistrationCount} draf menunggu` 
                                : "Tidak ada antrean"}
                            </p>
                          </div>
                        </div>
                        {pendingRegistrationCount > 0 ? (
                          <span className="w-5 h-5 bg-teal-600 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                            {pendingRegistrationCount}
                          </span>
                        ) : (
                          <span className="text-teal-400 text-xs">➔</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unit Kerja Teraktif */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4.5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[13px] font-bold text-gray-800">🏢 Unit Kerja Teraktif Bulan Ini</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Persentase kehadiran unit tertinggi</p>
                    </div>
                    <div className="space-y-2 mt-2 flex-1 flex flex-col justify-center">
                      {!reportSummary?.dept_attendance || reportSummary.dept_attendance.length === 0 ? (
                        <div className="text-center py-4 text-[11px] text-gray-400">Tidak ada data unit kerja</div>
                      ) : (
                        [...reportSummary.dept_attendance]
                          .sort((a, b) => b.persen - a.persen)
                          .slice(0, 3)
                          .map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] p-2 bg-slate-50/50 rounded-lg border border-slate-100/30">
                              <span className="font-semibold text-gray-700 truncate max-w-[120px]">{d.dept}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#16A34A]">{d.persen}%</span>
                                <span className="text-[9px] bg-green-50 text-green-700 px-1 py-0.2 rounded font-bold uppercase">Top {i+1}</span>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DATA PEGAWAI ── */}
          {activeTab === "employees" && (
            <div className="max-w-6xl mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Cari nama, NIK KTP, atau Unit kerja..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-100 rounded-xl text-[13px] bg-white shadow-sm focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleExportEmployeeExcel}
                    className="flex items-center gap-2 px-3.5 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[12px] text-white font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Download size={13} className="stroke-[2.5]" /> Export Excel Pegawai
                  </button>
                  <button
                    onClick={openAdd}
                    className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 rounded-xl text-[12px] text-white font-bold transition-all shadow-sm active:scale-95"
                  >
                    <Plus size={13} /> Tambah Pegawai
                  </button>
                </div>
              </div>

              {/* Stats mini */}
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {[
                  { label: "Total", value: employees.length, color: "#374151" },
                  {
                    label: "Hadir",
                    value: employees.filter(
                      (e) =>
                        e.today_attendance?.status === "hadir" ||
                        e.today_attendance?.status === "telat",
                    ).length,
                    color: "#16A34A",
                  },
                  {
                    label: "Terlambat",
                    value: employees.filter(
                      (e) => e.today_attendance?.status === "telat",
                    ).length,
                    color: "#D97706",
                  },
                  {
                    label: "Alpha",
                    value: employees.filter(
                      (e) => e.today_attendance?.status === "alpha",
                    ).length,
                    color: "#DC2626",
                  },
                  {
                    label: "Cuti",
                    value: employees.filter(
                      (e) =>
                        e.today_attendance?.status === "izin" ||
                        e.today_attendance?.status === "sakit" ||
                        e.today_attendance?.status === "cuti",
                    ).length,
                    color: "#2563EB",
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 text-center shadow-sm"
                  >
                    <p className="text-[18px] font-bold text-black">
                      {s.value}
                    </p>
                    <p className="text-[11px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50 bg-gray-50/50">
                        {[
                          "Nama Pegawai",
                          "NIK KTP",
                          "Username",
                          "Unit kerja",
                          "Jabatan",
                          "Status",
                          "Check-In",
                          "Aksi",
                        ].map((h, i) => (
                          <th
                            key={i}
                            className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((emp) => {
                        const todayStatus =
                          emp.today_attendance?.status ?? "alpha";
                        const sc = statusColors[todayStatus] || {
                          color: "#6B7280",
                          bg: "#F3F4F6",
                        };
                        const isExpanded = expandedEmpId === emp.id;
                        return (
                          <Fragment key={emp.id}>
                            <tr
                              onClick={() =>
                                setExpandedEmpId(isExpanded ? null : emp.id)
                              }
                              className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? "bg-green-50/10" : ""}`}
                            >
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    onClick={(e) => {
                                      if (emp.profile_picture) {
                                        e.stopPropagation();
                                        setPreviewPhoto({
                                          url: emp.profile_picture,
                                          name: emp.name,
                                        });
                                      }
                                    }}
                                    className={`w-8 h-8 rounded-xl bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100 ${emp.profile_picture ? "cursor-zoom-in hover:scale-105 active:scale-95 transition-all" : ""}`}
                                  >
                                    {emp.profile_picture ? (
                                      <img
                                        src={emp.profile_picture}
                                        alt={emp.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-[#16A34A] text-[11px] font-bold">
                                        {emp.name
                                          .replace(/^(dr\.|Ns\.|Dr\.)\s*/i, "")
                                          .charAt(0)}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-medium text-gray-800">
                                      {emp.name}
                                    </p>
                                    <p className="text-[11px] text-gray-400">
                                      {emp.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-[12px] font-mono text-gray-500">
                                {emp.nik_ktp}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  <Lock
                                    size={11}
                                    className="text-gray-300 flex-shrink-0"
                                  />
                                  <span className="text-[12px] text-gray-500">
                                    {emp.username || "—"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-[13px] text-gray-600">
                                {emp.department}
                              </td>
                              <td className="px-4 py-3.5 text-[13px] text-gray-600">
                                {emp.position}
                              </td>
                              <td className="px-4 py-3.5">
                                <span
                                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase"
                                  style={{ color: sc.color, background: sc.bg }}
                                >
                                  {statusLabels[todayStatus] || todayStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-[13px] font-mono text-gray-600">
                                {emp.today_attendance?.check_in || "--:--"}
                              </td>
                              <td
                                className="px-4 py-3.5 relative"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(
                                      openMenuId === emp.id ? null : emp.id,
                                    );
                                  }}
                                  className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                                >
                                  <MoreHorizontal
                                    size={14}
                                    className="text-gray-400"
                                  />
                                </button>
                                {openMenuId === emp.id && (
                                  <div
                                    className="absolute right-8 top-2 z-20 bg-white rounded-xl border border-gray-100 shadow-lg py-1 min-w-[130px]"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setDetailModalEmp(emp);
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <Eye size={13} className="text-blue-600" />{" "}
                                      Lihat Detail Staf
                                    </button>
                                    <div className="h-px bg-gray-50 mx-2" />
                                    <button
                                      onClick={() => openEdit(emp)}
                                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <Edit2
                                        size={13}
                                        className="text-[#16A34A]"
                                      />{" "}
                                      Edit Pegawai
                                    </button>
                                    <div className="h-px bg-gray-50 mx-2" />
                                    <button
                                      onClick={() => openDelete(emp)}
                                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 size={13} /> Hapus
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-gray-50/50">
                                <td
                                  colSpan={8}
                                  className="px-6 py-3.5 border-b border-gray-100"
                                >
                                  <div className="flex flex-col gap-2.5 text-[12px]">
                                    <div className="flex flex-wrap gap-x-8 gap-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">
                                          Motor 1:
                                        </span>
                                        <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">
                                          {emp.vehicles?.motor_plate_1 || "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">
                                          Motor 2:
                                        </span>
                                        <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">
                                          {emp.vehicles?.motor_plate_2 || "—"}
                                        </span>
                                      </div>
                                      <div className="w-px bg-gray-200 hidden sm:block" />
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">
                                          Mobil 1:
                                        </span>
                                        <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">
                                          {emp.vehicles?.car_plate_1 || "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">
                                          Mobil 2:
                                        </span>
                                        <span className="font-mono bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">
                                          {emp.vehicles?.car_plate_2 || "—"}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-x-8 gap-y-2 pt-1 border-t border-gray-100">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">
                                          Instagram:
                                        </span>
                                        <span className="text-gray-700 font-medium">
                                          {emp.social_media?.instagram
                                            ? `@${emp.social_media.instagram}`
                                            : "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">
                                          Facebook:
                                        </span>
                                        <span className="text-gray-700 font-medium">
                                          {emp.social_media?.facebook || "—"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">
                                          TikTok:
                                        </span>
                                        <span className="text-gray-700 font-medium">
                                          {emp.social_media?.tiktok
                                            ? `@${emp.social_media.tiktok}`
                                            : "—"}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Disciplinary Sanctions History */}
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                        Catatan Sanksi &amp; Kedisiplinan Staf:
                                      </p>
                                      {!emp.disciplinary_sanctions || emp.disciplinary_sanctions.length === 0 ? (
                                        <p className="text-[11px] text-emerald-600 font-semibold bg-emerald-50/50 border border-emerald-100 rounded-xl px-3 py-1.5 w-fit">
                                          ✓ Kondisi disiplin bersih &amp; baik (Tidak ada catatan)
                                        </p>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                          {emp.disciplinary_sanctions.map((san) => {
                                            const getSanctLabel = (t: string) => {
                                              if (t === 'teguran') return 'Surat Teguran';
                                              if (t === 'sp1') return 'SP1';
                                              if (t === 'sp2') return 'SP2';
                                              if (t === 'phk') return 'PHK';
                                              return t.toUpperCase();
                                            };
                                            const getSanctColor = (t: string) => {
                                              if (t === 'teguran') return 'bg-amber-100 text-amber-800 border-amber-200';
                                              if (t === 'sp1') return 'bg-orange-100 text-orange-850 border-orange-200';
                                              if (t === 'sp2') return 'bg-rose-100 text-rose-850 border-rose-200';
                                              if (t === 'phk') return 'bg-red-100 text-red-850 border-red-200';
                                              return 'bg-slate-100 text-slate-800 border-slate-200';
                                            };
                                            const formattedDate = new Date(san.created_at).toLocaleDateString("id-ID", {
                                              day: "numeric",
                                              month: "long",
                                              year: "numeric"
                                            });
                                            return (
                                              <div key={san.id} className="border border-gray-200 bg-white rounded-xl p-3 flex flex-col gap-2 shadow-xs">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${getSanctColor(san.type)}`}>
                                                    {getSanctLabel(san.type)}
                                                  </span>
                                                  <span className="text-[10px] text-gray-450 font-medium">
                                                    {formattedDate}
                                                  </span>
                                                </div>
                                                {san.admin_note && (
                                                  <p className="text-[11.5px] text-gray-600 leading-relaxed">
                                                    {san.admin_note}
                                                  </p>
                                                )}
                                                <div className="flex gap-2">
                                                  {san.attachment_url && (
                                                    <a
                                                      href={san.attachment_url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-lg hover:underline"
                                                    >
                                                      <FileText size={10} /> Surat
                                                    </a>
                                                  )}
                                                  {san.chronology_url && (
                                                    <a
                                                      href={san.chronology_url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-650 bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-lg hover:underline"
                                                    >
                                                      <FileText size={10} /> Kronologi
                                                    </a>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="text-center py-12">
                    <Users size={28} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-[13px] text-gray-400">
                      Tidak ada pegawai ditemukan
                    </p>
                  </div>
                )}
                <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between">
                  <p className="text-[12px] text-gray-400">
                    Menampilkan {filtered.length} dari {employees.length}{" "}
                    pegawai
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── DEDICATED TABS ── */}
          {activeTab === "attendance" && <AttendanceTab />}
          {activeTab === "history" && <HistoryTab />}
          {activeTab === "schedule" && <ScheduleTab />}
          {activeTab === "holidays" && <HolidaysTab />}
          {activeTab === "leave" && (
            <LeaveTab onUpdateCount={refreshReportSummary} />
          )}
          {activeTab === "overtime" && (
            <OvertimeTab onUpdateCount={fetchPendingOvertimeCount} />
          )}
          {activeTab === "assignment" && <AssignmentLetterTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "notifications" && (
            <NotificationsTab
              onUpdateCount={fetchUnreadNotificationsCount}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "departments" && (
            <DepartmentsTab onRefreshDepartments={loadData} />
          )}
          {activeTab === "pj_bagian" && <PJBagianTab />}
          {activeTab === "onboarding" && <EmployeeRegistrationTab />}
          {activeTab === "resignation" && <ResignationTab />}
          {activeTab === "disciplinary" && <DisciplinaryTab />}
          {activeTab === "super_admin_management" && <AdminManagementTab />}
        </div>
      </div>

      {/* ── MODAL ADD / EDIT ── */}
      {(modalType === "add" || modalType === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${modalType === "add" ? "bg-green-50" : "bg-blue-50"}`}
                >
                  {modalType === "add" ? (
                    <Plus size={16} className="text-[#16A34A]" />
                  ) : (
                    <Edit2 size={16} className="text-blue-600" />
                  )}
                </div>
                <p className="text-[15px] font-semibold text-gray-900">
                  {modalType === "add"
                    ? "Tambah Pegawai Baru"
                    : "Edit Data Pegawai"}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-[13px] px-4 py-2.5 rounded-xl">
                  {formError}
                </div>
              )}
              {/* Akun Login info */}
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <Lock
                  size={13}
                  className="text-blue-500 flex-shrink-0 mt-0.5"
                />
                <p className="text-[12px] text-blue-700 leading-snug">
                  Isi <strong>Username</strong> dan{" "}
                  {modalType === "add" ? (
                    <strong>Password (angka saja, minimal 6 digit)</strong>
                  ) : (
                    <strong>
                      Password (kosongkan jika tidak ingin diubah — angka saja,
                      minimal 6 digit)
                    </strong>
                  )}{" "}
                  untuk akses login absensi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama */}
                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Contoh: Dr. Andi Wijaya"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
                {/* NIK KTP */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    NIK KTP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nik_ktp}
                    disabled={modalType === "edit"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, nik_ktp: e.target.value }))
                    }
                    placeholder="198501012010011001"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all font-mono disabled:opacity-50"
                  />
                </div>
                {/* Email */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="nama@rsucl.id"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
                {/* Username */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Username Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    disabled={modalType === "edit"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="nama.pegawai"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Password{" "}
                    {modalType === "add" && (
                      <span className="text-red-500">*</span>
                    )}{" "}
                    <span className="text-gray-400 font-normal text-[11px]">
                      (Minimal 6 angka)
                    </span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        password: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder={
                      modalType === "edit"
                        ? "Kosongkan jika tidak diubah (angka saja)"
                        : "Minimal 6 angka"
                    }
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all font-mono"
                  />
                </div>
                {/* Phone */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Nomor HP
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
                {/* Gender */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Jenis Kelamin
                  </label>
                  <div className="relative">
                    <select
                      value={form.gender}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, gender: e.target.value }))
                      }
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                    >
                      <option>Laki-laki</option>
                      <option>Perempuan</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                </div>
                {/* Dept */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Unit kerja
                  </label>
                  <div className="relative">
                    <select
                      value={form.department_id}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          department_id: e.target.value,
                        }))
                      }
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                </div>
                {/* Position */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Jabatan
                  </label>
                  <div className="relative">
                    <select
                      value={form.position_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, position_id: e.target.value }))
                      }
                      className="w-full appearance-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                    >
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                </div>
                {/* Join Date */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Tanggal Masuk Pertama
                  </label>
                  <input
                    type="date"
                    value={form.joinDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, joinDate: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
              </div>

              {/* Data Kendaraan Section */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <p className="text-[12.5px] font-bold text-gray-700 uppercase tracking-wider border-l-2 border-[#16A34A] pl-2">
                  Data Kendaraan Pegawai
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      Motor 1
                    </label>
                    <input
                      type="text"
                      value={form.motor_plate_1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          motor_plate_1: e.target.value,
                        }))
                      }
                      placeholder="Contoh: BL 1234 AA"
                      maxLength={15}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      Motor 2
                    </label>
                    <input
                      type="text"
                      value={form.motor_plate_2}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          motor_plate_2: e.target.value,
                        }))
                      }
                      placeholder="Contoh: BL 5678 BB"
                      maxLength={15}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      Mobil 1
                    </label>
                    <input
                      type="text"
                      value={form.car_plate_1}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, car_plate_1: e.target.value }))
                      }
                      placeholder="Contoh: B 9999 XX"
                      maxLength={15}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      Mobil 2
                    </label>
                    <input
                      type="text"
                      value={form.car_plate_2}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, car_plate_2: e.target.value }))
                      }
                      placeholder="Contoh: B 8888 YY"
                      maxLength={15}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all placeholder:text-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Data Sosial Media Section */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <p className="text-[12.5px] font-bold text-gray-700 uppercase tracking-wider border-l-2 border-[#16A34A] pl-2">
                  Sosial Media Pegawai (Opsional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      Instagram
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-[12px]">
                        @
                      </span>
                      <input
                        type="text"
                        value={form.instagram}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, instagram: e.target.value }))
                        }
                        placeholder="username"
                        className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      Facebook
                    </label>
                    <input
                      type="text"
                      value={form.facebook}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, facebook: e.target.value }))
                      }
                      placeholder="nama.pengguna"
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">
                      TikTok
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-[12px]">
                        @
                      </span>
                      <input
                        type="text"
                        value={form.tiktok}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, tiktok: e.target.value }))
                        }
                        placeholder="username"
                        className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors shadow-sm shadow-green-200"
              >
                {modalType === "add" ? "Tambah Pegawai" : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DELETE ── */}
      {modalType === "delete" && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">
              Hapus Pegawai?
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-1">
              Data pegawai berikut akan dihapus permanen:
            </p>
            <p className="text-[13px] font-semibold text-gray-800 text-center mb-5">
              {selectedEmp.name}
            </p>
            <div className="bg-red-50 rounded-xl p-3 mb-5 text-center">
              <p className="text-[12px] text-red-600">
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETAIL PEGAWAI ── */}
      {detailModalEmp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200 text-emerald-800 font-bold text-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                  {detailModalEmp.profile_picture ? (
                    <img src={detailModalEmp.profile_picture} alt={detailModalEmp.name} className="w-full h-full object-cover" />
                  ) : (
                    detailModalEmp.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900 leading-snug">{detailModalEmp.name}</h3>
                  <p className="text-[11px] text-gray-500">{detailModalEmp.email || "Tanpa Email"}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="px-2.5 py-0.5 bg-emerald-100/80 text-emerald-800 rounded-md text-[9.5px] font-extrabold uppercase">
                      {detailModalEmp.department}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[9.5px] font-extrabold">
                      {detailModalEmp.position}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetailModalEmp(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Rincian Identitas */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-gray-100 text-[12px]">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">NIK KTP</span>
                  <span className="font-mono font-bold text-gray-800">{detailModalEmp.nik_ktp}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Username</span>
                  <span className="font-semibold text-gray-800">{detailModalEmp.username}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">No. Telepon / WA</span>
                  <span className="text-gray-800 font-medium">{detailModalEmp.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Jenis Kelamin</span>
                  <span className="text-gray-800 font-medium">{detailModalEmp.gender === "L" ? "Laki-laki" : detailModalEmp.gender === "P" ? "Perempuan" : (detailModalEmp.gender || "—")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Tanggal Bergabung</span>
                  <span className="text-gray-800 font-medium">{detailModalEmp.join_date || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase block">Status Akun</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${detailModalEmp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {detailModalEmp.status === 'active' ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>
              </div>

              {/* Data Kendaraan */}
              <div className="space-y-2">
                <p className="text-[12px] font-bold text-gray-800 border-l-2 border-emerald-600 pl-2">
                  Plat Kendaraan Terdaftar
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-2xs">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase">Motor 1</span>
                    <span className="font-mono font-bold text-gray-700">{detailModalEmp.vehicles?.motor_plate_1 || detailModalEmp.motor_plate_1 || "—"}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-2xs">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase">Motor 2</span>
                    <span className="font-mono font-bold text-gray-700">{detailModalEmp.vehicles?.motor_plate_2 || detailModalEmp.motor_plate_2 || "—"}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-2xs">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase">Mobil 1</span>
                    <span className="font-mono font-bold text-gray-700">{detailModalEmp.vehicles?.car_plate_1 || detailModalEmp.car_plate_1 || "—"}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-gray-100 rounded-xl shadow-2xs">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase">Mobil 2</span>
                    <span className="font-mono font-bold text-gray-700">{detailModalEmp.vehicles?.car_plate_2 || detailModalEmp.car_plate_2 || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Media Sosial */}
              {(detailModalEmp.social_media?.instagram || detailModalEmp.social_media?.facebook || detailModalEmp.social_media?.tiktok) && (
                <div className="space-y-2">
                  <p className="text-[12px] font-bold text-gray-800 border-l-2 border-emerald-600 pl-2">
                    Media Sosial
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {detailModalEmp.social_media?.instagram && (
                      <span className="px-2.5 py-1 bg-pink-50 text-pink-700 border border-pink-100 rounded-lg font-medium">
                        Instagram: @{detailModalEmp.social_media.instagram}
                      </span>
                    )}
                    {detailModalEmp.social_media?.facebook && (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg font-medium">
                        Facebook: {detailModalEmp.social_media.facebook}
                      </span>
                    )}
                    {detailModalEmp.social_media?.tiktok && (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg font-medium">
                        TikTok: @{detailModalEmp.social_media.tiktok}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Catatan Sanksi & Kedisiplinan Staf */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <p className="text-[12px] font-bold text-gray-800 border-l-2 border-emerald-600 pl-2">
                  Catatan Sanksi &amp; Kedisiplinan Staf
                </p>
                {!detailModalEmp.disciplinary_sanctions || detailModalEmp.disciplinary_sanctions.length === 0 ? (
                  <div className="p-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl">
                    <p className="text-[11.5px] text-emerald-700 font-medium leading-relaxed">
                      Kondisi disiplin bersih dan baik. Tidak ada catatan sanksi atau teguran aktif untuk pegawai ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailModalEmp.disciplinary_sanctions.map((san: any) => {
                      const getSanctLabel = (t: string) => {
                        if (t === 'teguran' || t === 'teguran_lisan') return 'Surat Teguran';
                        if (t === 'sp1' || t === 'sp_1') return 'SP1';
                        if (t === 'sp2' || t === 'sp_2') return 'SP2';
                        if (t === 'sp3' || t === 'sp_3') return 'SP3';
                        if (t === 'skorsing') return 'Skorsing';
                        if (t === 'phk') return 'PHK';
                        return t.toUpperCase();
                      };
                      const getSanctColor = (t: string) => {
                        if (t === 'teguran' || t === 'teguran_lisan') return 'bg-amber-100 text-amber-800 border-amber-200';
                        if (t === 'sp1' || t === 'sp_1') return 'bg-orange-100 text-orange-850 border-orange-200';
                        if (t === 'sp2' || t === 'sp_2') return 'bg-rose-100 text-rose-850 border-rose-200';
                        if (t === 'sp3' || t === 'sp_3' || t === 'phk') return 'bg-red-100 text-red-850 border-red-200';
                        return 'bg-slate-100 text-slate-800 border-slate-200';
                      };
                      const dateStr = san.sanction_date || san.created_at;
                      const formattedDate = dateStr
                        ? new Date(dateStr).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "—";
                      return (
                        <div key={san.id} className="border border-gray-100 bg-slate-50/50 rounded-xl p-3 flex flex-col gap-1.5 text-[11.5px]">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${getSanctColor(san.type)}`}>
                              {getSanctLabel(san.type)}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {formattedDate}
                            </span>
                          </div>
                          <p className="text-gray-800 font-medium leading-relaxed">{san.reason || san.notes || "Catatan sanksi diterbitkan."}</p>
                          {san.issued_by && (
                            <p className="text-[9.5px] text-gray-400 italic">Diterbitkan oleh: {san.issued_by}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <button
                onClick={() => {
                  const empToEdit = detailModalEmp;
                  setDetailModalEmp(null);
                  openEdit(empToEdit);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[12px] font-bold hover:bg-emerald-100 transition-colors"
              >
                <Edit2 size={13} /> Edit Data Staf
              </button>
              <button
                onClick={() => setDetailModalEmp(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[12px] font-bold hover:bg-slate-900 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX PHOTO PREVIEW MODAL ── */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setPreviewPhoto(null)}
          />
          <div className="relative max-w-sm w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-fade-in flex flex-col items-center">
            {/* Header/Close button */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setPreviewPhoto(null)}
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all focus:outline-none"
              >
                <X size={18} />
              </button>
            </div>
            {/* Image Wrapper */}
            <div className="p-3 w-full bg-gray-50 flex justify-center items-center">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-sm border border-gray-100"
              />
            </div>
            {/* Caption */}
            <div className="px-6 py-4.5 bg-white w-full text-center border-t border-gray-50">
              <p className="text-[14px] font-bold text-gray-900 leading-tight">
                {previewPhoto.name}
              </p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">
                Foto Profil Karyawan RSUCL
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
