import React from "react";
import { Printer, X } from "lucide-react";
import { LeaveRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import logoImg from "../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg";
import logoKarsImg from "../../../imports/logo_kars.png";
import qrCodeImg from "../../../imports/qr_code_cempaka_lima.png";
import qrHrdImg from "../../../imports/qr_hrd_rsucl.png";
import qrPjBagianImg from "../../../imports/qr_pj_bagian.png";

interface LeaveFormPrintModalProps {
  request: LeaveRequest;
  onClose: () => void;
}

export function LeaveFormPrintModal({
  request,
  onClose,
}: LeaveFormPrintModalProps) {
  const { logoUrl } = useAuth();

  const reqDateStr = request.created_at
    ? request.created_at.substring(0, 10).replace(/-/g, "")
    : "";
  const docNumber = `CUTI-${request.id}-${reqDateStr}`;

  // Helper formatting date
  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return ".......................";
    const d = new Date(dateStr);
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
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Terbilang angka hari
  const terbilangHari = (n: number) => {
    const words = [
      "Nol",
      "Satu",
      "Dua",
      "Tiga",
      "Empat",
      "Lima",
      "Enam",
      "Tujuh",
      "Delapan",
      "Sembilan",
      "Sepuluh",
      "Sebelas",
      "Dua Belas",
    ];
    return words[n] || String(n);
  };

  // Calculate return date (start_date + days)
  const calculateReturnDate = (startStr: string, days: number) => {
    if (!startStr) return "";
    const d = new Date(startStr);
    d.setDate(d.getDate() + (days || 1));
    return formatDateFull(d.toISOString().slice(0, 10));
  };

  const returnDateStr = calculateReturnDate(
    request.end_date || request.start_date,
    1,
  );

  // Split substitutes string (comma separated) into array
  const substitutesList = request.substitute_name
    ? request.substitute_name.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const sub1 = substitutesList[0] || "...................................";
  const sub2 = substitutesList[1] || "...................................";
  const sub3 = substitutesList[2] || "...................................";
  const sub4 = substitutesList[3] || "...................................";

  // Position options matching 3. FORM SURAT CUTI.pdf
  const positionOptions = ["Dokter", "Perawat", "Bidan", "Non Medis", "Medis"];
  const empPos = request.posisi || (request.employee as any)?.position || "";

  // Unit kerja options matching 3. FORM SURAT CUTI.pdf
  const unitOptions = [
    "Adm",
    "Asuransi",
    "Casemix",
    "CSSD",
    "Driver Ambulance",
    "Depo",
    "Endoscopy",
    "Farmasi",
    "Gizi",
    "IT",
    "IPSRS",
    "IPSL",
    "ICU",
    "IBS",
    "IGD",
    "KB",
    "Laboratorium",
    "Laundry",
    "NICU",
    "Poli",
    "Kasir",
    "Keuangan",
    "PPI",
    "Radiologi",
    "Ranap",
    "RM IGD",
    "Resepsionis",
    "Transporter",
    "Penyimpanan",
  ];
  const empUnit = request.unit_kerja || request.employee?.department || "";

  // Leave categories matching 3. FORM SURAT CUTI.pdf
  const leaveTypes = ["Nikah", "Tahunan", "Khusus", "Melahirkan", "Duka"];
  const currentLeaveType =
    request.type === "cuti_khusus"
      ? "Khusus"
      : request.type === "sakit"
        ? "Khusus"
        : "Tahunan";

  return (
    <div className="print-leave-wrapper fixed inset-0 z-[9999] flex items-center justify-center p-4 print:p-0 print:static print:block text-black">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            visibility: hidden !important;
            background: white !important;
          }
          .print-leave-wrapper,
          .print-leave-wrapper * {
            visibility: visible !important;
          }
          .print-leave-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }
          .print-leave-card {
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            border: none !important;
            border-radius: 0 !important;
          }
        }
      `,
        }}
      />

      {/* Overlay Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs no-print"
        onClick={onClose}
      />

      {/* Printable Card Window */}
      <div className="print-leave-card relative bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl p-6 md:p-8 animate-scale-up max-h-[92vh] overflow-y-auto">
        {/* Header Action Bar */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 no-print">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-gray-800">
              Form Surat Cuti Resmi RSUCL
            </h3>
            {request.status === "approved" ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                ✓ Disetujui & Terotorisasi QR Code
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                Draf Permohonan
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] hover:bg-[#0d9240] text-white rounded-xl text-[12px] font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer size={14} /> Cetak Form Surat Cuti
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Paper Container */}
        <div className="print-leave-container bg-white p-2 md:p-6 text-black text-left font-serif leading-tight">
          {/* 1. Kop Surat Header (matching 3. FORM SURAT CUTI.pdf) */}
          <div className="flex items-center justify-between gap-2 pb-1 text-center">
            {/* Logo Left */}
            <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center bg-white p-1">
              <img
                src={logoUrl || logoImg}
                alt="Logo RSUCL"
                className="max-h-20 w-auto object-contain"
              />
            </div>

            {/* Header Text Middle */}
            <div className="flex-1 min-w-0 font-sans px-1">
              <p className="text-[14px] font-bold text-[#16A34A] tracking-wide uppercase">
                PT.CEMPAKA LIMA UTAMA
              </p>
              <h1 className="text-[17px] font-extrabold text-red-600 tracking-wider uppercase mt-0.5">
                RUMAH SAKIT UMUM CEMPAKA LIMA
              </h1>
              <p className="text-[9.5px] text-gray-800 leading-snug font-medium mt-0.5">
                Jln.Politeknik No.23 Dusun Meunasah Dayah Lr.B, Gp.Beurawe,
                <br />
                Kecamatan Kuta Alam, Kode Pos 23124,Telp.(0651)3619999,
                <br />
                Fax. (0651)3619999, Email: rsu@cempakalima.co.id
              </p>
              <p className="text-[11px] font-bold text-gray-900 tracking-widest mt-0.5 uppercase">
                BANDA ACEH
              </p>
            </div>

            {/* KARS Logo Right */}
            <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center bg-white p-1">
              <img
                src={logoKarsImg}
                alt="Logo KARS Terakreditasi Paripurna"
                className="max-h-20 w-auto object-contain"
              />
            </div>
          </div>

          {/* Double Separator Line */}
          <div className="border-t-[3px] border-[#16A34A] mt-1 mb-0.5" />
          <div className="border-t-[1px] border-black mb-4" />

          {/* 2. Document Title */}
          <div className="text-center mb-5 font-sans">
            <h2 className="text-[15px] font-bold text-black tracking-wider uppercase underline decoration-1">
              {request.type === "cuti_khusus"
                ? `FORMULIR PERMOHONAN CUTI KHUSUS ${
                    request.special_leave_category
                      ? `(${request.special_leave_category.name.toUpperCase()})`
                      : ""
                  }`
                : request.type === "sakit"
                  ? "FORMULIR PERMOHONAN IZIN SAKIT"
                  : "FORMULIR PERMOHONAN CUTI TAHUNAN"}
            </h2>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              No. Dokumen: {docNumber}
            </p>
          </div>

          {/* 3. Form Content Body */}
          <div className="text-[11.5px] space-y-3 font-sans leading-normal">
            <p className="font-semibold">Yang memohon di bawah ini :</p>

            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">Nama</span>
              <span>:</span>
              <span className="font-bold text-black">
                {request.employee?.name}
              </span>
            </div>

            {/* Posisi (Nilai terpilih saja) */}
            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">Posisi</span>
              <span>:</span>
              <span className="font-bold text-black">{empPos || "-"}</span>
            </div>

            {/* Unit Kerja / Instalasi (Nilai terpilih saja) */}
            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">Unit Kerja / Instalasi</span>
              <span>:</span>
              <span className="font-bold text-black">{empUnit || "-"}</span>
            </div>

            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">No.Tlp /HP</span>
              <span>:</span>
              <span className="font-semibold">
                {request.employee?.phone || "-"}
              </span>
            </div>

            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline pt-2">
              <span className="font-medium">
                Mohon Cuti/ tidak masuk kerja selama
              </span>
              <span>:</span>
              <span>
                <strong className="underline px-2">{request.days}</strong> (
                {terbilangHari(request.days)}) hari kerja
              </span>
            </div>

            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">Mulai tanggal</span>
              <span>:</span>
              <span className="font-semibold">
                {formatDateFull(request.start_date)} s/d{" "}
                {formatDateFull(request.actual_end_date || request.end_date)}
              </span>
            </div>

            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">Tanggal Masuk</span>
              <span>:</span>
              <span className="font-semibold">{returnDateStr}</span>
            </div>

            {/* Keterangan Cuti */}
            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">Keterangan Cuti</span>
              <span>:</span>
              <span className="font-semibold text-gray-900">
                {request.type === "sakit"
                  ? "Sakit"
                  : request.type === "cuti_khusus"
                    ? "Cuti Khusus"
                    : "Cuti Tahunan"}{" "}
                {request.reason ? `(${request.reason})` : ""}
              </span>
            </div>

            <div className="grid grid-cols-[140px_10px_1fr] gap-1 items-baseline">
              <span className="font-medium">Alamat selama Cuti</span>
              <span>:</span>
              <span className="border-b border-dotted border-gray-400 pb-0.5 font-medium">
                {request.alamat_cuti || "-"}
              </span>
            </div>

            {/* Signatures Row 1: Pemohon & Disetujui oleh PJ Bagian */}
            <div className="pt-4 space-y-2">
              <p className="text-right pr-4">
                Banda Aceh, {formatDateFull(request.start_date)}
              </p>
              <p className="text-[10px] text-gray-600 italic">
                * Permohonan cuti dianggap sah apabila telah disetujui oleh PJ
                Bagian dan Direktur PT Cempaka Lima Utama.
              </p>

              <div className="grid grid-cols-2 gap-8 text-center pt-3 text-[11px] items-start">
                {/* Sisi Kiri: Rekan Kerja Pengganti (Khusus Cuti Tahunan) */}
                {request.type === "cuti" ? (
                  <div className="text-left text-[11px] font-sans pl-2 space-y-1">
                    <p className="font-semibold text-gray-900 mb-1">
                      Rekan Kerja Pengganti:
                    </p>
                    <div className="space-y-0.5 text-[11px] leading-snug text-gray-800">
                      <p>
                        1.{" "}
                        <span
                          className={
                            substitutesList[0]
                              ? "font-bold text-black underline"
                              : "text-gray-400 font-mono"
                          }
                        >
                          {sub1}
                        </span>
                      </p>
                      <p>
                        2.{" "}
                        <span
                          className={
                            substitutesList[1]
                              ? "font-bold text-black underline"
                              : "text-gray-400 font-mono"
                          }
                        >
                          {sub2}
                        </span>
                      </p>
                      <p>
                        3.{" "}
                        <span
                          className={
                            substitutesList[2]
                              ? "font-bold text-black underline"
                              : "text-gray-400 font-mono"
                          }
                        >
                          {sub3}
                        </span>
                      </p>
                      <p>
                        4.{" "}
                        <span
                          className={
                            substitutesList[3]
                              ? "font-bold text-black underline"
                              : "text-gray-400 font-mono"
                          }
                        >
                          {sub4}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div />
                )}
                {/* Disetujui oleh PJ Bagian (QR Code PJ Bagian) */}
                <div className="flex flex-col items-center">
                  <div className="h-6 flex flex-col justify-center items-center">
                    <p className="font-semibold text-gray-900 leading-tight">
                      Disetujui oleh PJ Bagian<br />
                      <span className="text-[10px] text-gray-700 font-medium font-sans">
                        Bagian {request.employee?.department || "Terkait"}
                      </span>
                    </p>
                  </div>

                  {/* QR Code PJ Bagian jika disetujui */}
                  {request.status === "approved" ||
                  request.pj_status === "approved" ? (
                    <div className="my-1.5 p-0.5 border border-gray-200 rounded bg-white shadow-2xs">
                      <img
                        src={qrPjBagianImg}
                        alt="QR Code PJ Bagian"
                        className="w-16 h-16 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="my-1 p-1.5 border border-dashed border-amber-300 rounded bg-amber-50/50 text-center w-28">
                      <span className="text-[9px] font-bold text-amber-700 block">
                        DRAF CUTI
                      </span>
                      <span className="text-[7.5px] text-amber-600 block">
                        Menunggu ACC PJ
                      </span>
                    </div>
                  )}

                  <div className="h-10 flex flex-col justify-start items-center">
                    <p className="font-bold underline text-gray-900">
                      ( {request.pj_reviewer?.name ||
                        request.reviewer?.name ||
                        "PJ Bagian"} )
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Data-data Cuti Pekerja (Bagian Kepegawaian Box) */}
            <div className="border-t border-black pt-3 mt-4 space-y-1">
              <p className="font-bold text-[11px]">
                Data-data cuti pekerja (diisi oleh Bagian Kepegawaian)
              </p>

              <div className="grid grid-cols-[140px_10px_1fr] gap-1 text-[10.5px]">
                <span>Tanggal Masuk</span>
                <span>:</span>
                <span className="font-semibold">{returnDateStr}</span>
                <span>Hak Cuti Dimiliki</span>
                <span>:</span>
                <span className="font-semibold">12 Hari</span>
                <span>Hak Cuti Diambil</span>
                <span>:</span>
                <span className="font-bold text-red-700">
                  {request.days} Hari
                </span>
                <span>Sisa Cuti</span>
                <span>:</span>
                <span className="font-bold text-[#16A34A]">
                  {Math.max(0, 12 - request.days)} Hari
                </span>
                <span>CATATAN</span>
                <span>:</span>
                <span className="italic">
                  Pengajuan telah diverifikasi resmi oleh Kepegawaian RSUCL
                </span>
              </div>
            </div>

            {/* 5. Footer Signatures: Disetujui Oleh (Tim Administrator RSUCL) & Diketahui Oleh (Direktur PT Cempaka Lima Utama) */}
            <div className="border-t border-black pt-4 mt-3 grid grid-cols-2 gap-8 text-center text-[11px] items-start">
              {/* SISI KIRI: Disetujui Oleh - Tim Administrator RSUCL */}
              <div className="flex flex-col items-center">
                <div className="h-6 flex items-center justify-center">
                  <p className="font-bold text-gray-900">Disetujui Oleh,</p>
                </div>
                
                {request.status === "approved" ? (
                  <div className="my-1.5 p-0.5 border border-gray-200 rounded bg-white shadow-2xs">
                    <img
                      src={qrHrdImg}
                      alt="QR HRD RSUCL"
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                ) : (
                  <div className="my-1 p-1.5 border border-dashed border-amber-300 rounded bg-amber-50/50 text-center w-28">
                    <span className="text-[9px] font-bold text-amber-700 block">DRAF CUTI</span>
                    <span className="text-[7.5px] text-amber-600 block">Menunggu Admin</span>
                  </div>
                )}

                <div className="h-10 flex flex-col justify-start items-center">
                  <p className="font-bold underline text-gray-900">
                    Tim Administrator RSUCL
                  </p>
                </div>
              </div>

              {/* SISI KANAN: Diketahui Oleh - Direktur PT Cempaka Lima Utama */}
              <div className="flex flex-col items-center">
                <div className="h-6 flex items-center justify-center">
                  <p className="font-bold text-gray-900">Diketahui Oleh,</p>
                </div>

                {request.status === "approved" ? (
                  <div className="my-1.5 p-0.5 border border-gray-200 rounded bg-white shadow-2xs">
                    <img
                      src={qrCodeImg}
                      alt="QR Code Otorisasi Direktur"
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                ) : (
                  <div className="my-1 p-1.5 border border-dashed border-amber-300 rounded bg-amber-50/50 text-center w-28">
                    <span className="text-[9px] font-bold text-amber-700 block">DRAF SURAT CUTI</span>
                    <span className="text-[7.5px] text-amber-600 block">Menunggu Persetujuan</span>
                  </div>
                )}

                <div className="h-10 flex flex-col justify-start items-center">
                  <p className="font-bold underline text-gray-900">
                    Amir Hidayat, ST, MKM
                  </p>
                  <p className="text-[10px] text-gray-700 font-semibold mt-0.5">
                    Direktur PT Cempaka Lima Utama
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
