import { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  User,
  Lock,
  Bell,
  Globe,
  Info,
  Shield,
  LogOut,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Building2,
  Edit3,
  Camera,
  Plus,
  X,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  ChevronDown,
  AlertCircle,
  Paperclip,
  Trash2,
  Car,
  Instagram,
  Facebook,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  leaveApi,
  LeaveRequest as ApiLeave,
  LeaveQuota,
  profileApi,
  disciplinarySanctionApi,
  DisciplinarySanction,
} from "../../services/api";
import rsPhoto from "../../imports/2328bb14-b47f-4ac6-a2be-6db33f64fce3_980x381.png";

interface ProfilePageProps {
  onLogout: () => void;
  initialSection?: "profile" | "leave";
  initialOpenModal?: boolean;
  onResetInitials?: () => void;
  onNavigateToLeave?: () => void;
}

type LeaveType = "cuti" | "izin" | "sakit" | "cuti_khusus";
type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled" | "draft";

const typeConfig: Record<
  LeaveType,
  { label: string; color: string; bg: string; border: string }
> = {
  cuti: {
    label: "Cuti Tahunan",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
  },
  izin: { label: "Izin", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  sakit: { label: "Sakit", color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
  cuti_khusus: {
    label: "Cuti Khusus / Diluar Tanggungan",
    color: "#EA580C",
    bg: "#FFF7ED",
    border: "#FFEDD5",
  },
};

const statusConfig: Record<
  LeaveStatus,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "Menunggu", color: "#D97706", bg: "#FEF3C7", icon: Clock },
  approved: {
    label: "Disetujui",
    color: "#16A34A",
    bg: "#DCFCE7",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Ditolak",
    color: "#DC2626",
    bg: "#FEE2E2",
    icon: XCircle,
  },
  cancelled: {
    label: "Dibatalkan",
    color: "#6B7280",
    bg: "#F3F4F6",
    icon: XCircle,
  },
  draft: {
    label: "Draf (Menunggu PJ)",
    color: "#4F46E5",
    bg: "#EEF2FF",
    icon: Clock,
  },
};

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const formatDate = (str: string) => {
  if (!str) return "";
  const d = new Date(str);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

function CreditCardIcon({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * Halaman Profil Staf (ProfilePage) — Sistem Absensi RSUCL
 *
 * Mengelola tampilan biodata pribadi karyawan, informasi jabatan/kepegawaian,
 * pengajuan cuti/izin/sakit baru beserta dokumen lampiran pendukung,
 * riwayat permohonan cuti, ubah password mandiri, dan update foto profil.
 */
export function ProfilePage({
  onLogout,
  initialSection,
  initialOpenModal,
  onResetInitials,
  onNavigateToLeave,
}: ProfilePageProps) {
  const { user, refreshUser } = useAuth();

  // Referensi input file tersembunyi untuk upload foto avatar
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State konfirmasi modal keluar sistem
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // State pengontrol modal pengajuan cuti/izin/sakit baru
  const [showLeaveModal, setShowLeaveModal] = useState(
    initialOpenModal || false,
  );

  // State menyimpan seluruh riwayat pengajuan cuti karyawan aktif
  const [requests, setRequests] = useState<ApiLeave[]>([]);

  // State konfirmasi pembatalan pengajuan
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ── States Form Data Kendaraan Pegawai ──────────────────────────────────
  const [motor1, setMotor1] = useState(user?.vehicles?.motor_plate_1 ?? "");
  const [motor2, setMotor2] = useState(user?.vehicles?.motor_plate_2 ?? "");
  const [car1, setCar1] = useState(user?.vehicles?.car_plate_1 ?? "");
  const [car2, setCar2] = useState(user?.vehicles?.car_plate_2 ?? "");
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleSuccess, setVehicleSuccess] = useState("");
  const [vehicleError, setVehicleError] = useState("");

  // Sinkronisasikan data kendaraan saat data user berubah / ter-refresh
  useEffect(() => {
    if (user?.vehicles) {
      setMotor1(user.vehicles.motor_plate_1 ?? "");
      setMotor2(user.vehicles.motor_plate_2 ?? "");
      setCar1(user.vehicles.car_plate_1 ?? "");
      setCar2(user.vehicles.car_plate_2 ?? "");
    }
  }, [user]);

  // State menyimpan data kuota cuti tahunan dari API
  const [quota, setQuota] = useState<LeaveQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  // State melacak tab sub-seksi aktif ('profile' = biodata, 'leave' = pengajuan cuti)
  const [activeSection, setActiveSection] = useState<"profile" | "leave">(
    initialSection || "profile",
  );

  // Indikator memuat data
  const [loading, setLoading] = useState(false);

  // Mensinkronisasikan seksi tab jika dilempar parameter dari dashboard parent
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
    if (initialOpenModal !== undefined) {
      setShowLeaveModal(initialOpenModal);
    }
    if (initialSection || initialOpenModal) {
      if (onResetInitials) {
        onResetInitials();
      }
    }
  }, [initialSection, initialOpenModal]);

  // ── States Form Modal Ubah Password Mandiri ──────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // ── States Form Modal Ubah Profil Pribadi ────────────────────────────────
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGender, setEditGender] = useState("Laki-laki");
  const [editInstagram, setEditInstagram] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [editTiktok, setEditTiktok] = useState("");
  const [editProfileError, setEditProfileError] = useState("");
  const [editProfileSuccess, setEditProfileSuccess] = useState("");
  const [editProfileLoading, setEditProfileLoading] = useState(false);

  // ── State Toggle Notifikasi Sistem Lokal ──────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(() => {
    const saved = localStorage.getItem("notifications_enabled");
    return saved !== null ? JSON.parse(saved) : true;
  });

  /**
   * Mengubah preferensi aktifasi notifikasi dan menyimpannya di localStorage.
   */
  const toggleNotifs = () => {
    const newValue = !notifEnabled;
    setNotifEnabled(newValue);
    localStorage.setItem("notifications_enabled", JSON.stringify(newValue));
  };

  // ── States sanksi disiplin mandiri ────────────────────────────────────────
  const [sanctions, setSanctions] = useState<DisciplinarySanction[]>([]);
  const [sanctionsLoading, setSanctionsLoading] = useState(true);

  useEffect(() => {
    const fetchSanctions = async () => {
      setSanctionsLoading(true);
      try {
        const res = await disciplinarySanctionApi.list({ personal: true });
        if (res.success) {
          setSanctions(res.data);
        }
      } catch (err) {
        console.error("Gagal mengambil data sanksi:", err);
      } finally {
        setSanctionsLoading(false);
      }
    };
    fetchSanctions();
  }, []);

  const getSanctionStyle = (type: string) => {
    switch (type) {
      case 'teguran':
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', badge: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Surat Teguran' };
      case 'sp1':
        return { bg: 'bg-orange-50 text-orange-700 border-orange-200', badge: 'bg-orange-100 text-orange-850 border-orange-200', label: 'Surat Peringatan 1 (SP1)' };
      case 'sp2':
        return { bg: 'bg-rose-50 text-rose-700 border-rose-200', badge: 'bg-rose-100 text-rose-850 border-rose-200', label: 'Surat Peringatan 2 (SP2)' };
      case 'phk':
        return { bg: 'bg-red-50 text-red-700 border-red-200', badge: 'bg-red-100 text-red-850 border-red-200', label: 'PHK (Pemutusan Hubungan Kerja)' };
      default:
        return { bg: 'bg-slate-50 text-slate-700 border-slate-200', badge: 'bg-slate-100 text-slate-800 border-slate-200', label: 'Sanksi Disiplin' };
    }
  };

  // Avatar upload handler
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        setLoading(true);
        const res = await profileApi.update({ profile_picture: base64 });
        if (res.success) {
          await refreshUser();
        }
      } catch (err: any) {
        alert(err?.message ?? "Gagal memperbarui foto profil.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Password change submit handler
  const handlePasswordChange = async () => {
    if (!oldPassword) {
      setPasswordError("Password lama wajib diisi.");
      return;
    }
    if (!newPassword) {
      setPasswordError("Password baru wajib diisi.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password minimal 6 angka.");
      return;
    }
    if (!/^\d+$/.test(newPassword)) {
      setPasswordError("Password hanya boleh berupa angka.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password tidak cocok.");
      return;
    }
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);
    try {
      const res = await profileApi.update({
        password: newPassword,
        old_password: oldPassword,
      });
      if (res.success) {
        setPasswordSuccess("Password berhasil diperbarui.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess("");
        }, 1500);
      }
    } catch (err: any) {
      setPasswordError(err?.message ?? "Gagal mengubah password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEditProfileSubmit = async () => {
    if (!editName || !editUsername || !editEmail) {
      setEditProfileError("Nama, Username, dan Email wajib diisi.");
      return;
    }
    setEditProfileError("");
    setEditProfileSuccess("");
    setEditProfileLoading(true);
    try {
      const res = await profileApi.update({
        name: editName,
        username: editUsername,
        email: editEmail,
        phone: editPhone,
        gender: editGender,
        instagram: editInstagram.trim() || null,
        facebook: editFacebook.trim() || null,
        tiktok: editTiktok.trim() || null,
      });
      if (res.success) {
        setEditProfileSuccess("Profil berhasil diperbarui.");
        await refreshUser();
        setTimeout(() => {
          setShowEditProfileModal(false);
          setEditProfileSuccess("");
        }, 1500);
      }
    } catch (err: any) {
      setEditProfileError(err?.message ?? "Gagal memperbarui profil.");
    } finally {
      setEditProfileLoading(false);
    }
  };

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveType>("cuti");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const loadCategories = async () => {
    try {
      const { specialLeaveApi } = await import("../../services/api");
      const res = await specialLeaveApi.listActive();
      if (res.success) {
        const sorted = [...(res.data || [])].sort((a, b) => {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          if (nameA === "lainnya") return 1;
          if (nameB === "lainnya") return -1;
          return nameA.localeCompare(nameB, "id");
        });
        setCategories(sorted);
      }
    } catch (err) {
      console.error("Gagal mengambil kategori cuti khusus:", err);
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Untuk Cuti Khusus maksimal 2MB, untuk yang lainnya kita gunakan limit 2MB juga agar konsisten
    if (file.size > 2 * 1024 * 1024) {
      setFormError("Ukuran file maksimal adalah 2MB.");
      return;
    }
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setFormError("Format file harus berupa PDF, PNG, atau JPG/JPEG.");
      return;
    }

    setFormError("");
    setAttachmentName(file.name);
    setAttachmentFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => {
    setAttachmentName("");
    setAttachmentBase64(null);
    setAttachmentFile(null);
  };

  const loadLeaveRequests = async () => {
    setLoading(true);
    try {
      const res = await leaveApi.list({ personal: "1" });
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuota = async () => {
    setQuotaLoading(true);
    try {
      const res = await leaveApi.quota();
      if (res.success && !Array.isArray(res.data)) {
        setQuota(res.data as LeaveQuota);
      }
    } catch (err) {
      console.error("Gagal mengambil data kuota cuti:", err);
    } finally {
      setQuotaLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelLoading(true);
    try {
      await leaveApi.cancel(cancelId);
      setCancelId(null);
      // Refresh daftar pengajuan dan kuota setelah pembatalan
      await Promise.all([loadLeaveRequests(), loadQuota()]);
    } catch (err: any) {
      console.error("Gagal membatalkan pengajuan:", err);
      alert(err?.message ?? "Gagal membatalkan pengajuan. Coba lagi.");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSaveVehicles = async () => {
    setVehicleLoading(true);
    setVehicleSuccess("");
    setVehicleError("");
    try {
      const res = await profileApi.updateVehicles({
        motor_plate_1: motor1.trim() || null,
        motor_plate_2: motor2.trim() || null,
        car_plate_1: car1.trim() || null,
        car_plate_2: car2.trim() || null,
      });
      if (res.success) {
        setVehicleSuccess("Data kendaraan berhasil diperbarui.");
        await refreshUser();
      }
    } catch (err: any) {
      console.error(err);
      setVehicleError(err?.message ?? "Gagal menyimpan data kendaraan.");
    } finally {
      setVehicleLoading(false);
    }
  };

  useEffect(() => {
    loadLeaveRequests();
    loadQuota();
    loadCategories();
  }, []);

  const calcDays = () => {
    if (!startDate || !endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(1, Math.floor(diff / 86400000) + 1);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Validasi input khusus Cuti Khusus vs Cuti/Izin/Sakit biasa
    if (leaveType === "cuti_khusus") {
      if (
        !startDate ||
        !endDate ||
        !reason.trim() ||
        !selectedCategory ||
        !attachmentFile
      ) {
        setFormError(
          "Semua field wajib diisi, termasuk kategori cuti khusus dan dokumen pendukung (lampiran).",
        );
        return;
      }
    } else {
      if (!startDate || !endDate || !reason.trim()) {
        setFormError(
          "Tanggal mulai, tanggal selesai, dan keterangan wajib diisi.",
        );
        return;
      }
    }

    if (new Date(endDate) < new Date(startDate)) {
      setFormError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("type", leaveType);
      formData.append("start_date", startDate);
      formData.append("end_date", endDate);
      formData.append("reason", reason.trim());
      if (leaveType === "cuti_khusus") {
        formData.append("special_leave_category_id", selectedCategory);
      }
      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      } else if (attachmentBase64) {
        formData.append("attachment", attachmentBase64);
      }

      const res = await leaveApi.create(formData);
      if (res.success) {
        setRequests((prev) => [res.data, ...prev]);
        setShowLeaveModal(false);
        setStartDate("");
        setEndDate("");
        setReason("");
        setLeaveType("cuti");
        setSelectedCategory("");
        setAttachmentName("");
        setAttachmentBase64(null);
        setAttachmentFile(null);
        setSubmitSuccess(true);
        setActiveSection("leave");
        loadQuota(); // Refresh kuota cuti tahunan
        setTimeout(() => setSubmitSuccess(false), 4000);
      }
    } catch (err: any) {
      setFormError(err?.message ?? "Gagal mengirim pengajuan cuti.");
    } finally {
      setSubmitting(false);
    }
  };

  const pending = requests.filter((r) => r.status === "pending").length;
  // Gunakan data kuota dari API (bukan hardcode)
  const quotaTotal = quota?.quota ?? 12;
  const usedCuti = quota?.used ?? 0; // approved only
  const pendingCuti = quota?.pending ?? 0; // pending (belum diapprove)
  const remainingCuti = quota?.remaining ?? quotaTotal; // sisa yang bisa diajukan
  const cutiPercentage = Math.round((remainingCuti / quotaTotal) * 100);

  const infoPersonal = [
    { icon: User, label: "Nama Lengkap", value: user?.name ?? "" },
    { icon: CreditCardIcon, label: "NIK KTP", value: user?.nik_ktp ?? "" },
    { icon: User, label: "Username", value: user?.username ?? "" },
    { icon: Mail, label: "Email", value: user?.email ?? "" },
    { icon: Phone, label: "Nomor HP", value: user?.phone ?? "--" },
    { icon: User, label: "Jenis Kelamin", value: user?.gender ?? "--" },
    {
      icon: Instagram,
      label: "Instagram",
      value: user?.social_media?.instagram
        ? `@${user.social_media.instagram}`
        : "--",
    },
    {
      icon: Facebook,
      label: "Facebook",
      value: user?.social_media?.facebook ?? "--",
    },
    {
      icon: Globe,
      label: "TikTok",
      value: user?.social_media?.tiktok ? `@${user.social_media.tiktok}` : "--",
    },
  ];

  const infoKerja = [
    {
      icon: Calendar,
      label: "Tanggal Masuk Pertama",
      value: user?.join_date ? formatDate(user.join_date) : "--",
      badge: false,
    },
    {
      icon: Briefcase,
      label: "Jabatan",
      value: user?.position ?? "--",
      badge: false,
    },
    {
      icon: Building2,
      label: "Unit kerja",
      value: user?.department ?? "--",
      badge: false,
    },
    { icon: User, label: "Status Pegawai", value: "Aktif", badge: true },
  ];

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Profil Saya</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          {onNavigateToLeave
            ? "Informasi detail akun Anda"
            : "Informasi akun dan pengajuan cuti"}
        </p>
      </div>

      {/* Success banner */}
      {submitSuccess && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4">
          <CheckCircle2 size={16} className="text-[#16A34A] flex-shrink-0" />
          <p className="text-[13px] text-[#16A34A] font-medium">
            Pengajuan berhasil dikirim! Menunggu persetujuan admin.
          </p>
        </div>
      )}

      {/* Tab switcher — only show if no dedicated leave page navigation available */}
      {!onNavigateToLeave && (
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-100 p-1 shadow-sm mb-5 w-fit">
          {[
            { key: "profile", label: "Profil" },
            {
              key: "leave",
              label: `Pengajuan Cuti${pending > 0 ? ` (${pending})` : ""}`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key as "profile" | "leave")}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                activeSection === tab.key
                  ? "bg-[#16A34A] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── PROFIL SECTION ── */}
      {activeSection === "profile" && (
        <>
          {/* Profile hero card with RS Cempaka Lima building photo */}
          <div
            className="rounded-2xl p-5 mb-5 relative overflow-hidden shadow-lg border border-white/30"
            style={{
              backgroundImage: `url(${rsPhoto})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Lighter, vibrant green gradient overlay to show bright building photo */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/60 via-[#16A34A]/30 to-black/25" />
            <div className="absolute inset-0 bg-black/10" />

            <div className="relative z-10 flex items-center gap-4">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                title="Ubah Foto Profil"
              >
                {user?.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt="Foto Profil"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white flex-shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/25 backdrop-blur-md border-2 border-white flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white text-xl font-bold drop-shadow-sm">
                      {(user?.name || "U").charAt(0)}
                    </span>
                  </div>
                )}
                {/* Camera hover icon */}
                <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={16} className="text-white" />
                </div>
                {/* Visible Camera badge overlay */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#16A34A] border-2 border-white rounded-lg flex items-center justify-center shadow-md">
                  <Camera size={11} className="text-white" />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <div className="flex-1 text-white drop-shadow-sm">
                <p className="text-[16px] font-bold text-white drop-shadow-md">
                  {user?.name}
                </p>
                <p className="text-[13px] text-white/95 font-medium drop-shadow-sm mt-0.5">
                  {user?.position}
                </p>
                <p className="text-[12px] text-white/80 drop-shadow-sm mt-0.5">
                  {user?.department}
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/25 backdrop-blur-md text-white border border-white/40 flex-shrink-0 shadow-md">
                Aktif
              </span>
            </div>
            <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Kehadiran", value: "100%" },
                {
                  label: "Status",
                  value:
                    user?.role === "super_admin"
                      ? "Super Admin"
                      : user?.role === "admin"
                        ? "Admin"
                        : user?.role === "pj_bagian"
                          ? "PJ Bagian"
                          : "Karyawan",
                },
                { label: "Sisa Cuti", value: `${remainingCuti} hari` },
              ].map((s, i) => (
                <div
                  key={i}
                  className="bg-white/25 backdrop-blur-md rounded-xl p-2.5 text-center border border-white/30 shadow-md"
                >
                  <p className="text-[15px] font-bold text-white drop-shadow-sm">
                    {s.value}
                  </p>
                  <p className="text-[10px] text-white/90 font-medium drop-shadow-sm mt-0.5">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-gray-800">
                Informasi Pribadi
              </p>
              <button
                onClick={() => {
                  setEditName(user?.name ?? "");
                  setEditUsername(user?.username ?? "");
                  setEditEmail(user?.email ?? "");
                  setEditPhone(user?.phone ?? "");
                  setEditGender(user?.gender ?? "Laki-laki");
                  setEditInstagram(user?.social_media?.instagram ?? "");
                  setEditFacebook(user?.social_media?.facebook ?? "");
                  setEditTiktok(user?.social_media?.tiktok ?? "");
                  setEditProfileError("");
                  setEditProfileSuccess("");
                  setShowEditProfileModal(true);
                }}
                className="text-[#16A34A] hover:text-[#0d9240] text-[12px] font-semibold flex items-center gap-1 transition-all"
              >
                <Edit3 size={13} /> Edit
              </button>
            </div>
            <div className="p-4 space-y-3.5">
              {infoPersonal.map(({ icon: Icon, label, value }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-400">{label}</p>
                    <p className="text-[13px] font-medium text-gray-800 mt-0.5 break-words">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Work info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3.5 border-b border-gray-50">
              <p className="text-[13px] font-semibold text-gray-800">
                Informasi Pekerjaan
              </p>
            </div>
            <div className="p-4 space-y-3.5">
              {infoKerja.map(({ icon: Icon, label, value, badge }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] text-gray-400">{label}</p>
                    {badge ? (
                      <span className="inline-block mt-0.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-green-100 text-[#16A34A]">
                        {value}
                      </span>
                    ) : (
                      <p className="text-[13px] font-medium text-gray-800 mt-0.5">
                        {value}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Data Kendaraan Pegawai */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
              <Car size={15} className="text-[#16A34A]" />
              <p className="text-[13px] font-semibold text-gray-800">
                Data Kendaraan Pegawai
              </p>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-[11px] text-gray-400">
                Masukkan plat nomor kendaraan Anda (maksimal 2 motor dan 2
                mobil, bersifat opsional).
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    Motor 1
                  </label>
                  <input
                    type="text"
                    value={motor1}
                    onChange={(e) => {
                      setMotor1(e.target.value);
                      setVehicleSuccess("");
                      setVehicleError("");
                    }}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50/50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all placeholder:text-gray-300"
                    placeholder="Contoh: BL 1234 AA"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    Motor 2
                  </label>
                  <input
                    type="text"
                    value={motor2}
                    onChange={(e) => {
                      setMotor2(e.target.value);
                      setVehicleSuccess("");
                      setVehicleError("");
                    }}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50/50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all placeholder:text-gray-300"
                    placeholder="Contoh: BL 5678 BB"
                    maxLength={15}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    Mobil 1
                  </label>
                  <input
                    type="text"
                    value={car1}
                    onChange={(e) => {
                      setCar1(e.target.value);
                      setVehicleSuccess("");
                      setVehicleError("");
                    }}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50/50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all placeholder:text-gray-300"
                    placeholder="Contoh: B 9999 XX"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">
                    Mobil 2
                  </label>
                  <input
                    type="text"
                    value={car2}
                    onChange={(e) => {
                      setCar2(e.target.value);
                      setVehicleSuccess("");
                      setVehicleError("");
                    }}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[12px] bg-gray-50/50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all placeholder:text-gray-300"
                    placeholder="Contoh: B 8888 YY"
                    maxLength={15}
                  />
                </div>
              </div>

              {vehicleError && (
                <p className="text-[11.5px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {vehicleError}
                </p>
              )}
              {vehicleSuccess && (
                <p className="text-[11.5px] text-green-600 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                  {vehicleSuccess}
                </p>
              )}

              <button
                onClick={handleSaveVehicles}
                disabled={vehicleLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm disabled:opacity-50"
              >
                {vehicleLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {vehicleLoading ? "Menyimpan..." : "Simpan Data Kendaraan"}
              </button>
            </div>
          </div>

          {/* Settings Menu */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3.5 border-b border-gray-50">
              <p className="text-[13px] font-semibold text-gray-800">
                Pengaturan
              </p>
            </div>
            <div className="p-2 space-y-1">
              {/* Row 1: Ubah Password */}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                    <Lock size={15} className="text-gray-500" />
                  </div>
                  <span className="text-[13px] text-gray-700 font-medium">
                    Ubah Password
                  </span>
                </div>
                <ChevronRight
                  size={14}
                  className="text-gray-300 group-hover:text-gray-500 transition-colors"
                />
              </button>

              {/* Row 2: Pengaturan Notifikasi */}
              <div className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                    <Bell size={15} className="text-gray-500" />
                  </div>
                  <span className="text-[13px] text-gray-700 font-medium">
                    Pengaturan Notifikasi
                  </span>
                </div>
                <button
                  onClick={toggleNotifs}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none ${
                    notifEnabled ? "bg-[#16A34A]" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      notifEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Catatan Sanksi & Kedisiplinan Staf */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-gray-800">
                  Catatan Sanksi &amp; Kedisiplinan Staf
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Riwayat tindakan disiplin resmi yang terdaftar
                </p>
              </div>
              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                {sanctions.length} Tindakan
              </span>
            </div>

            <div className="p-4">
              {sanctionsLoading ? (
                <div className="py-6 text-center text-gray-400 text-[12px] flex flex-col items-center justify-center gap-1">
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  <span>Memuat catatan...</span>
                </div>
              ) : sanctions.length === 0 ? (
                <div className="py-6 text-center text-gray-450 space-y-2">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto border border-emerald-100 text-emerald-600">
                    <CheckCircle2 size={18} />
                  </div>
                  <p className="text-[12.5px] font-bold text-gray-700">Kondisi Disiplin Bersih &amp; Baik</p>
                  <p className="text-[11.5px] text-gray-450 max-w-xs mx-auto leading-relaxed">
                    Tidak ada catatan teguran maupun peringatan yang terdaftar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sanctions.map((san) => {
                    const style = getSanctionStyle(san.type);
                    return (
                      <div key={san.id} className="border border-slate-100 rounded-2xl p-3.5 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black border uppercase tracking-wider ${style.badge}`}>
                            {style.label}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-400">
                            Terbit: {formatDate(san.created_at)}
                          </span>
                        </div>
                        {san.admin_note && (
                          <p className="text-[12px] text-gray-600 leading-relaxed font-medium">
                            {san.admin_note}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {san.attachment_url && (
                            <a
                              href={san.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50/30 text-rose-700 border border-rose-100 rounded-xl text-[10.5px] font-bold transition-all shadow-xs"
                            >
                              <FileText size={11} /> Lihat Surat Sanksi
                            </a>
                          )}
                          {san.chronology_url && (
                            <a
                              href={san.chronology_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100/50 text-slate-700 border border-slate-200 rounded-xl text-[10.5px] font-bold transition-all shadow-xs"
                            >
                              <FileText size={11} /> Lihat Kronologi
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

          {/* Logout */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center justify-center gap-2 text-red-600 font-medium text-[14px] hover:bg-red-100 transition-colors"
          >
            <LogOut size={16} /> Keluar dari Akun
          </button>
        </>
      )}

      {/* ── PENGAJUAN CUTI SECTION ── */}
      {activeSection === "leave" && (
        <div className="space-y-4">
          {/* Quota card */}
          <div className="bg-gradient-to-br from-[#16A34A] to-[#0B7A36] rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full border-[20px] border-white/10 translate-x-8 -translate-y-8" />
            <p className="text-[12px] text-white/70 mb-3 relative">
              {quota?.period_label
                ? `Periode: ${quota.period_label}`
                : "Kuota Cuti Tahunan"}
            </p>
            <div className="flex items-end gap-3 relative">
              <div>
                <span className="text-4xl font-bold text-white">
                  {quotaLoading ? "..." : remainingCuti}
                </span>
                <span className="text-white/70 text-[14px] ml-1">
                  / {quotaTotal} hari
                </span>
              </div>
              <div className="flex-1 mb-1.5">
                <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-white"
                    style={{ width: `${cutiPercentage}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/60 mt-1">
                  {usedCuti} hari disetujui
                  {pendingCuti > 0 ? ` · ${pendingCuti} hari pending` : ""}
                </p>
              </div>
            </div>
            <div className="relative mt-4 flex gap-2">
              {[
                {
                  label: "Menunggu",
                  value: String(pending),
                  color: "bg-amber-400/30 text-amber-200",
                },
                {
                  label: "Disetujui",
                  value: String(
                    requests.filter((r) => r.status === "approved").length,
                  ),
                  color: "bg-white/20 text-white",
                },
                {
                  label: "Ditolak",
                  value: String(
                    requests.filter((r) => r.status === "rejected").length,
                  ),
                  color: "bg-red-400/30 text-red-200",
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-xl px-3 py-2 text-center ${s.color}`}
                >
                  <p className="text-[16px] font-bold">{s.value}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ajukan buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => {
                setShowLeaveModal(true);
                setLeaveType("cuti");
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-2xl text-[13px] font-semibold transition-all shadow-sm active:scale-[0.98]"
            >
              <Plus size={16} /> Ajukan Cuti / Izin / Sakit
            </button>
            <button
              onClick={() => {
                setShowLeaveModal(true);
                setLeaveType("cuti_khusus");
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-[13px] font-semibold transition-all shadow-sm active:scale-[0.98]"
            >
              <Plus size={16} /> Ajukan Cuti Khusus / Diluar Tanggungan
            </button>
          </div>

          {/* Request list */}
          <div className="space-y-3">
            <p className="text-[13px] font-semibold text-gray-700 px-1">
              Riwayat Pengajuan
            </p>
            {loading && (
              <div className="text-center py-5 text-gray-400 text-[12px]">
                Memuat data pengajuan...
              </div>
            )}
            {requests.length === 0 && !loading && (
              <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 w-full">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-gray-100">
                  <FileText size={20} className="text-gray-400" />
                </div>
                <p className="text-[13px] font-semibold text-gray-700">
                  Belum ada pengajuan
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Daftar permohonan cuti dan sakit Anda akan muncul di sini.
                </p>
              </div>
            )}
            {requests.map((req) => {
              const tc = typeConfig[req.type as LeaveType] || {
                label: req.type,
                color: "#6B7280",
                bg: "#F3F4F6",
                border: "#E5E7EB",
              };
              const sc = statusConfig[req.status as LeaveStatus] || {
                label: req.status,
                color: "#6B7280",
                bg: "#F3F4F6",
                icon: Clock,
              };
              const StatusIcon = sc.icon || Clock;
              return (
                <div
                  key={req.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${req.status === "pending" ? "border-amber-200" : "border-gray-100"}`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{
                            background: tc.bg,
                            border: `1.5px solid ${tc.border}`,
                          }}
                        >
                          <span
                            className="text-[12px] font-bold"
                            style={{ color: tc.color }}
                          >
                            {req.type === "cuti"
                              ? "C"
                              : req.type === "izin"
                                ? "I"
                                : req.type === "sakit"
                                  ? "S"
                                  : "CK"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[13px] font-semibold text-gray-800">
                            {req.type === "cuti_khusus" &&
                            req.special_leave_category
                              ? `Cuti Khusus (${req.special_leave_category.name})`
                              : tc.label}
                          </span>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Diajukan: {formatDate(req.created_at)}
                          </p>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ color: sc.color, background: sc.bg }}
                      >
                        <StatusIcon size={11} /> {sc.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-gray-400">
                          Tanggal Mulai
                        </p>
                        <p className="text-[12px] font-semibold text-gray-800 mt-0.5">
                          {formatDate(req.start_date)}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-gray-400">
                          {req.actual_end_date
                            ? "Selesai (Dipersingkat)"
                            : "Tanggal Selesai"}
                        </p>
                        <p className="text-[12px] font-semibold text-gray-800 mt-0.5">
                          {req.actual_end_date
                            ? formatDate(req.actual_end_date)
                            : formatDate(req.end_date)}
                        </p>
                      </div>
                    </div>

                    {req.actual_end_date && (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3 text-[11px] text-amber-800">
                        <span className="font-semibold">
                          Masa cuti diperpendek admin:
                        </span>{" "}
                        selesai {formatDate(req.actual_end_date)} (semula{" "}
                        {formatDate(req.end_date)}).
                        {req.shortened_reason && (
                          <p className="mt-1 italic text-amber-900 font-medium">
                            Alasan: "{req.shortened_reason}"
                          </p>
                        )}
                      </div>
                    )}

                    {req.status === "cancelled" && req.cancellation_reason && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3 text-[11px] text-gray-600">
                        <span className="font-semibold">
                          Alasan dibatalkan:
                        </span>{" "}
                        "{req.cancellation_reason}"
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-gray-500 italic flex-1 mr-3">
                        "{req.reason}"
                      </p>
                      <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
                        {req.days} hari efektif
                      </span>
                    </div>

                    {req.attachment_url && (
                      <div className="mt-3">
                        <a
                          href={req.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A34A] hover:text-[#0d9240] bg-green-50/70 hover:bg-green-100 px-3 py-1.5 rounded-xl border border-green-100 transition-all"
                        >
                          <Paperclip size={11} className="flex-shrink-0" />
                          Lihat Dokumen Pendukung
                        </a>
                      </div>
                    )}

                    {req.admin_note && (
                      <div
                        className={`mt-3 px-3 py-2 rounded-xl border text-[11px] ${
                          req.status === "approved"
                            ? "bg-green-50 border-green-100 text-green-700"
                            : "bg-red-50 border-red-100 text-red-600"
                        }`}
                      >
                        <span className="font-semibold">Catatan Admin:</span>{" "}
                        {req.admin_note}
                      </div>
                    )}

                    {/* Tombol Batalkan — hanya muncul saat status pending */}
                    {req.status === "pending" && (
                      <div className="mt-3 pt-3 border-t border-amber-100">
                        <button
                          onClick={() => setCancelId(req.id)}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl border border-red-100 transition-all"
                        >
                          <Trash2 size={11} />
                          Batalkan Pengajuan
                        </button>
                      </div>
                    )}
                  </div>
                  {req.status === "pending" && (
                    <div className="h-0.5 bg-gradient-to-r from-amber-400 to-transparent" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL PENGAJUAN CUTI ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            onClick={() => {
              setShowLeaveModal(false);
              setFormError("");
            }}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                  <FileText size={15} className="text-[#16A34A]" />
                </div>
                <p className="text-[15px] font-semibold text-gray-900">
                  Ajukan Cuti / Izin
                </p>
              </div>
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  setFormError("");
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl">
                  <AlertCircle size={14} className="flex-shrink-0" />{" "}
                  {formError}
                </div>
              )}

              {/* Type selector */}
              {leaveType !== "cuti_khusus" ? (
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-2">
                    Jenis Pengajuan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["cuti", "izin", "sakit"] as LeaveType[]).map((t) => {
                      const tc = typeConfig[t];
                      return (
                        <button
                          key={t}
                          onClick={() => {
                            setLeaveType(t);
                            setFormError("");
                          }}
                          className={`py-2.5 rounded-xl border-2 text-center transition-all ${
                            leaveType === t
                              ? "shadow-sm"
                              : "border-gray-100 hover:border-gray-200"
                          }`}
                          style={
                            leaveType === t
                              ? { borderColor: tc.color, background: tc.bg }
                              : { background: "#F9FAFB" }
                          }
                        >
                          <p
                            className="text-[12px] font-semibold"
                            style={{
                              color: leaveType === t ? tc.color : "#6B7280",
                            }}
                          >
                            {tc.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-orange-50 border border-orange-100 rounded-xl px-3.5 py-3 flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                  <p className="text-[12px] font-semibold text-orange-800">
                    Jenis Pengajuan: Cuti Khusus / Diluar Tanggungan
                  </p>
                </div>
              )}

              {/* Special leave categories dropdown */}
              {leaveType === "cuti_khusus" && (
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-medium text-gray-600">
                    Kategori Cuti Khusus <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setFormError("");
                      }}
                      className="w-full pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all text-gray-700 font-medium cursor-pointer appearance-none"
                    >
                      <option value="">-- Pilih Kategori Cuti Khusus --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setFormError("");
                    }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setFormError("");
                    }}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all"
                  />
                </div>
              </div>

              {/* Duration preview */}
              {startDate && endDate && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 border ${
                    leaveType === "cuti" && calcDays() > remainingCuti
                      ? "bg-red-50 border-red-200"
                      : leaveType === "cuti_khusus"
                        ? "bg-orange-50 border-orange-200"
                        : "bg-green-50 border-green-100"
                  }`}
                >
                  <Calendar
                    size={14}
                    className={
                      leaveType === "cuti" && calcDays() > remainingCuti
                        ? "text-red-500"
                        : leaveType === "cuti_khusus"
                          ? "text-orange-600"
                          : "text-[#16A34A]"
                    }
                  />
                  <p
                    className={`text-[12px] font-medium ${
                      leaveType === "cuti" && calcDays() > remainingCuti
                        ? "text-red-600"
                        : leaveType === "cuti_khusus"
                          ? "text-orange-700"
                          : "text-[#16A34A]"
                    }`}
                  >
                    Durasi: <strong>{calcDays()} hari</strong>
                    {leaveType === "cuti" && calcDays() > remainingCuti && (
                      <span className="ml-1 font-normal">
                        — Melebihi sisa kuota ({remainingCuti} hari)! Pengajuan
                        akan ditolak.
                      </span>
                    )}
                    {leaveType === "cuti_khusus" && (
                      <span className="ml-1 font-normal text-orange-600/90">
                        — Cuti khusus / diluar tanggungan tidak memotong kuota
                        cuti tahunan.
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                  Keterangan / Alasan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setFormError("");
                  }}
                  rows={3}
                  placeholder={
                    leaveType === "sakit"
                      ? "Jelaskan kondisi kesehatan Anda..."
                      : "Jelaskan keperluan Anda..."
                  }
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/15 transition-all resize-none placeholder:text-gray-300"
                />
              </div>

              {/* Document upload field */}
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1.5">
                  Dokumen Pendukung{" "}
                  {leaveType === "cuti_khusus" ? (
                    <span className="text-red-500">* (Wajib)</span>
                  ) : (
                    <span className="text-gray-400 font-normal">
                      (Opsional)
                    </span>
                  )}{" "}
                  <span className="text-gray-400 font-normal">
                    (PDF, PNG, JPG max 2MB)
                  </span>
                </label>
                {!attachmentName ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-250 rounded-2xl p-4.5 cursor-pointer hover:border-[#16A34A] hover:bg-green-50/5 transition-all text-center">
                    <Paperclip size={18} className="text-gray-400 mb-1.5" />
                    <span className="text-[12px] text-gray-500 font-medium">
                      Klik untuk unggah dokumen
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      Surat sakit, surat tugas, atau dokumen lainnya
                    </span>
                    <input
                      type="file"
                      onChange={handleAttachmentChange}
                      accept=".pdf,image/png,image/jpeg,image/jpg"
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText
                        size={16}
                        className="text-[#16A34A] flex-shrink-0"
                      />
                      <span className="text-[12px] font-medium text-gray-700 truncate">
                        {attachmentName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className="w-6 h-6 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Sakit note */}
              {leaveType === "sakit" && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                  <Info
                    size={13}
                    className="text-blue-500 flex-shrink-0 mt-0.5"
                  />
                  <p className="text-[11px] text-blue-600">
                    Sertakan surat keterangan dokter jika sakit lebih dari 2
                    hari. Bisa diserahkan langsung ke admin.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  setFormError("");
                  clearAttachment();
                }}
                disabled={submitting}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  (leaveType === "cuti_khusus" &&
                    (!selectedCategory || !attachmentFile))
                }
                className="flex-1 py-3 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-all shadow-sm shadow-green-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {submitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {submitting ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xs">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LogOut size={22} className="text-red-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">
              Keluar dari Akun?
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-5">
              Anda akan keluar dari sistem absensi RSUCL.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={onLogout}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL UBAH PASSWORD ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowPasswordModal(false);
              setPasswordError("");
              setPasswordSuccess("");
              setOldPassword("");
            }}
          />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordError("");
                setPasswordSuccess("");
                setOldPassword("");
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X size={16} className="text-gray-500" />
            </button>
            <h3 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock size={18} className="text-[#16A34A]" /> Ubah Password
            </h3>
            {passwordError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl mb-3">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-green-50 border border-green-100 text-[#16A34A] text-[12px] px-3.5 py-2.5 rounded-xl mb-3">
                {passwordSuccess}
              </div>
            )}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Password Lama
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="Masukkan password saat ini (angka)"
                  value={oldPassword}
                  onChange={(e) =>
                    setOldPassword(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Password Baru{" "}
                  <span className="text-gray-400 font-normal text-[11px]">
                    (Minimal 6 angka)
                  </span>
                </label>
                <input
                  type="password"
                  placeholder="Minimal 6 angka"
                  inputMode="numeric"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Konfirmasi Password Baru{" "}
                  <span className="text-gray-400 font-normal text-[11px]">
                    (Ulangi angka)
                  </span>
                </label>
                <input
                  type="password"
                  placeholder="Ulangi angka password baru"
                  inputMode="numeric"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[16px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError("");
                  setPasswordSuccess("");
                  setOldPassword("");
                }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                disabled={passwordLoading}
              >
                Batal
              </button>
              <button
                onClick={handlePasswordChange}
                className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
                disabled={passwordLoading}
              >
                {passwordLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDIT PROFIL ── */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowEditProfileModal(false);
              setEditProfileError("");
              setEditProfileSuccess("");
            }}
          />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowEditProfileModal(false);
                setEditProfileError("");
                setEditProfileSuccess("");
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X size={16} className="text-gray-500" />
            </button>
            <h3 className="text-[16px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User size={18} className="text-[#16A34A]" /> Edit Profil
            </h3>

            {/* Avatar edit section in modal */}
            <div className="flex flex-col items-center mb-5 pb-3 border-b border-gray-50">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                title="Ubah Foto Profil"
              >
                {user?.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt="Foto Profil"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-green-100 flex-shrink-0 shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-green-50 border-2 border-green-100 flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-[#16A34A] text-2xl font-bold">
                      {(user?.name || "U").charAt(0)}
                    </span>
                  </div>
                )}
                {/* Visible Camera badge overlay */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#16A34A] border-2 border-white rounded-lg flex items-center justify-center shadow-md">
                  <Camera size={11} className="text-white" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-[11px] font-bold text-[#16A34A] hover:text-[#0d9240] transition-colors"
              >
                Ganti Foto Profil
              </button>
            </div>

            {editProfileError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[12px] px-3.5 py-2.5 rounded-xl mb-3">
                {editProfileError}
              </div>
            )}
            {editProfileSuccess && (
              <div className="bg-green-50 border border-green-100 text-[#16A34A] text-[12px] px-3.5 py-2.5 rounded-xl mb-3">
                {editProfileSuccess}
              </div>
            )}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Nomor HP
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Jenis Kelamin
                </label>
                <div className="relative">
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all appearance-none cursor-pointer"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Instagram
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-[13px]">
                    @
                  </span>
                  <input
                    type="text"
                    value={editInstagram}
                    onChange={(e) => setEditInstagram(e.target.value)}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Facebook
                </label>
                <input
                  type="text"
                  value={editFacebook}
                  onChange={(e) => setEditFacebook(e.target.value)}
                  placeholder="nama.pengguna"
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  TikTok
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-[13px]">
                    @
                  </span>
                  <input
                    type="text"
                    value={editTiktok}
                    onChange={(e) => setEditTiktok(e.target.value)}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-[13px] bg-gray-50 focus:outline-none focus:border-[#16A34A] transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowEditProfileModal(false);
                  setEditProfileError("");
                  setEditProfileSuccess("");
                }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                disabled={editProfileLoading}
              >
                Batal
              </button>
              <button
                onClick={handleEditProfileSubmit}
                className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-1.5"
                disabled={editProfileLoading}
              >
                {editProfileLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL KONFIRMASI BATALKAN PENGAJUAN ── */}
      {cancelId !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => !cancelLoading && setCancelId(null)}
          />
          <div className="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xs">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 text-center mb-1">
              Batalkan Pengajuan?
            </h3>
            <p className="text-[13px] text-gray-500 text-center mb-5">
              Pengajuan yang dibatalkan tidak bisa dikembalikan.
              {requests.find((r) => r.id === cancelId)?.type === "cuti" && (
                <span className="block mt-1 text-amber-600 font-medium">
                  Kuota cuti yang terpakai akan dikembalikan.
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelId(null)}
                disabled={cancelLoading}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-70"
              >
                {cancelLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {cancelLoading ? "Membatalkan..." : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
