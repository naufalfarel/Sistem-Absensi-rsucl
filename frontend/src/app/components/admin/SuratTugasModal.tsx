import React, { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { AssignmentLetter } from '../../../services/api';
import logoRSUCL from '../../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import logoKars from '../../../imports/logo_kars.png';
import qrDirRsImg from '../../../imports/qr_direktur_rs_cempaka_lima.png';
import qrDirPtImg from '../../../imports/qr_code_cempaka_lima.png';

// ── Bulan dalam bahasa Indonesia ──────────────────────────────────────
const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

// ── Format tanggal panjang ────────────────────────────────────────────
function formatLongDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
    return `${hari}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return dateStr; }
}

// ── Director Config ───────────────────────────────────────────────────
const DIRECTORS = {
  rs_director: {
    name: 'dr. Meri Lidiawati, MM, MKM, CHLQM',
    jabatan: 'Direktur',
    unit_kerja: 'Rumah Sakit Umum Cempaka Lima',
    qr: qrDirRsImg,
    showPtHeader: false,
    city: 'Banda Aceh',
  },
  pt_director: {
    name: 'Amir Hidayat, ST., MKM',
    jabatan: 'Direktur',
    unit_kerja: 'PT. Cempaka Lima Utama',
    qr: qrDirPtImg,
    showPtHeader: true,
    city: 'Banda Aceh',
  },
} as const;

// ── Props ─────────────────────────────────────────────────────────────
interface SuratTugasModalProps {
  letter: AssignmentLetter;
  onClose: () => void;
}

export default function SuratTugasModal({ letter, onClose }: SuratTugasModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const dirType = (letter.director_type ?? 'rs_director') as keyof typeof DIRECTORS;
  const dir = DIRECTORS[dirType];
  const employees = letter.assigned_employees ?? [];

  // Tanggal surat
  const suratDate = letter.letter_date
    ? (() => {
        const d = new Date(letter.letter_date);
        return `${dir.city}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : formatLongDate(letter.start_date);

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML ?? '';
    const printWindow = window.open('', '_blank', 'width=794,height=1123');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Surat Tugas - ${letter.letter_number ?? ''}</title>
          <meta charset="UTF-8"/>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; background: #fff; color: #000; }
            .page { width: 210mm; min-height: 297mm; padding: 20mm 25mm 20mm 30mm; }
            table { border-collapse: collapse; width: 100%; }
            td, th { padding: 3px 6px; }
            th { background: #fff; }
            .border-table td, .border-table th { border: 1px solid #000; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .underline { text-decoration: underline; }
            .divider-thick { border-top: 3px solid #000; margin: 2px 0; }
            .divider-thin { border-top: 1px solid #000; margin: 1px 0; }
            .green-divider { border-top: 3px solid #2d7d32; margin: 2px 0; }
            @media print {
              @page { size: A4; margin: 0; }
              body { margin: 0; }
              .page { padding: 20mm 25mm 20mm 30mm; }
            }
          </style>
        </head>
        <body><div class="page">${printContents}</div></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 600);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
      {/* ── Modal Container ── */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
          <div>
            <p className="text-[13px] font-bold">Preview Surat Tugas</p>
            <p className="text-[10px] text-slate-400">{letter.letter_number ?? 'Draft'} — {letter.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[12px] font-bold transition-all"
            >
              <Printer size={14} /> Cetak Surat
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Surat Preview (A4-like) ── */}
        <div className="overflow-y-auto max-h-[80vh] bg-gray-100 p-4">
          <div
            ref={printRef}
            className="bg-white mx-a            {dir.showPtHeader ? (
              // --- KOP SURAT PT CEMPAKA LIMA UTAMA ---
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px', textAlign: 'center' }}>
                  {/* Logo Left */}
                  <div style={{ width: '96px', height: '96px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: '4px' }}>
                    <img src={logoRSUCL} alt="Logo RSUCL" style={{ maxHeight: '80px', width: 'auto', objectFit: 'contain' }} />
                  </div>

                  {/* Header Text Middle */}
                  <div style={{ flex: 1, minWidth: 0, fontFamily: 'sans-serif', padding: '0 4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#16A34A', letterSpacing: '0.025em', textTransform: 'uppercase' }}>
                      PT.CEMPAKA LIMA UTAMA
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: '800', color: '#DC2626', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px' }}>
                      RUMAH SAKIT UMUM CEMPAKA LIMA
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#1f2937', lineHeight: '1.375', fontWeight: '500', marginTop: '2px' }}>
                      Jln.Politeknik No.23 Dusun Meunasah Dayah Lr.B, Gp.Beurawe,<br />
                      Kecamatan Kuta Alam, Kode Pos 23124,Telp.(0651)3619999,<br />
                      Fax. (0651)3619999, Email: rsu@cempakalima.co.id
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', letterSpacing: '0.1em', marginTop: '2px', textTransform: 'uppercase' }}>
                      BANDA ACEH
                    </div>
                  </div>

                  {/* KARS Logo Right */}
                  <div style={{ width: '96px', height: '96px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: '4px' }}>
                    <img src={logoKars} alt="Logo KARS" style={{ maxHeight: '80px', width: 'auto', objectFit: 'contain' }} />
                  </div>
                </div>

                {/* Double Separator Line */}
                <div style={{ borderTop: '3px solid #16A34A', marginTop: '4px', marginBottom: '2px' }} />
                <div style={{ borderTop: '1px solid black', marginBottom: '16px' }} />
              </>
            ) : (
              // --- KOP SURAT PEMERINTAH PROVINSI ACEH (RS) ---
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px', textAlign: 'center' }}>
                  {/* Logo Left */}
                  <div style={{ width: '96px', height: '96px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: '4px' }}>
                    <img src={logoRSUCL} alt="Logo RSUCL" style={{ maxHeight: '80px', width: 'auto', objectFit: 'contain' }} />
                  </div>

                  {/* Header Text Middle */}
                  <div style={{ flex: 1, minWidth: 0, fontFamily: 'sans-serif', padding: '0 4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#16A34A', letterSpacing: '0.025em', textTransform: 'uppercase' }}>
                      PEMERINTAH PROVINSI ACEH
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: '800', color: '#16A34A', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px' }}>
                      RUMAH SAKIT UMUM CEMPAKA LIMA
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#1f2937', lineHeight: '1.375', fontWeight: '500', marginTop: '2px' }}>
                      Jln. Politeknik No.23 Dusun Meunasah Dayah Lr.II, Gp. Jeulingke,<br />
                      Kecamatan Kuta Alam, Kode Pos 23124, Telp.(0651)3619999,<br />
                      Fax. (0651)3619999, Email: rsu@cempakalima.co.id
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', letterSpacing: '0.1em', marginTop: '2px', textTransform: 'uppercase' }}>
                      BANDA ACEH
                    </div>
                  </div>

                  {/* KARS Logo Right */}
                  <div style={{ width: '96px', height: '96px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: '4px' }}>
                    <img src={logoKars} alt="Logo KARS" style={{ maxHeight: '80px', width: 'auto', objectFit: 'contain' }} />
                  </div>
                </div>

                {/* Double Separator Line */}
                <div style={{ borderTop: '3px solid #16A34A', marginTop: '4px', marginBottom: '2px' }} />
                <div style={{ borderTop: '1px solid black', marginBottom: '16px' }} />
              </>
            )}

            {/* ════════ JUDUL SURAT ════════ */}
            <div style={{ textAlign: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13pt', textDecoration: 'underline', letterSpacing: '1px' }}>
                SURAT TUGAS
              </div>
              <div style={{ fontSize: '11pt', marginTop: '3px' }}>
                Nomor : {letter.letter_number ?? '___/STU/DIR/___/___/____'}
              </div>
            </div>

            {/* ════════ YANG BERTANDA TANGAN ════════ */}
            <div style={{ marginTop: '12px', marginBottom: '8px', fontSize: '11pt' }}>
              Yang bertanda tangan di bawah ini :
            </div>

            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11pt', marginBottom: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '120px', verticalAlign: 'top', paddingBottom: '4px' }}>Nama</td>
                  <td style={{ width: '12px', verticalAlign: 'top', paddingBottom: '4px' }}>:</td>
                  <td style={{ fontWeight: 'bold', verticalAlign: 'top', paddingBottom: '4px' }}>{dir.name}</td>
                </tr>
                <tr>
                  <td style={{ verticalAlign: 'top', paddingBottom: '4px' }}>Jabatan</td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '4px' }}>:</td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '4px' }}>{dir.jabatan}</td>
                </tr>
                <tr>
                  <td style={{ verticalAlign: 'top' }}>Unit Kerja</td>
                  <td style={{ verticalAlign: 'top' }}>:</td>
                  <td style={{ verticalAlign: 'top' }}>{dir.unit_kerja}</td>
                </tr>
              </tbody>
            </table>

            {/* ════════ DENGAN INI MENUGASKAN ════════ */}
            <div style={{ fontSize: '11pt', marginBottom: '8px' }}>Dengan ini menugaskan :</div>

            {/* Tabel Pegawai yang Ditugaskan */}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11pt', marginBottom: '14px', border: '1px solid #000' }}>
              <thead>
                <tr style={{ backgroundColor: '#fff' }}>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', width: '36px' }}>No</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center' }}>Nama</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', width: '120px' }}>Pangkat/Unit Kerja</th>
                  <th style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center', width: '130px' }}>Jabatan</th>
                </tr>
              </thead>
              <tbody>
                {employees.length > 0 ? employees.map((emp, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center' }}>{idx + 1}.</td>
                    <td style={{ border: '1px solid #000', padding: '5px 8px' }}>{emp.name}</td>
                    <td style={{ border: '1px solid #000', padding: '5px 8px', textAlign: 'center' }}>{emp.unit_kerja ?? '-'}</td>
                    <td style={{ border: '1px solid #000', padding: '5px 8px' }}>{emp.jabatan ?? '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', color: '#888' }}>
                      -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* ════════ DETAIL PERJALANAN ════════ */}
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11pt', marginBottom: '14px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '150px', verticalAlign: 'top', paddingBottom: '5px', paddingLeft: '20px' }}>Maksud Perjalanan</td>
                  <td style={{ width: '12px', verticalAlign: 'top', paddingBottom: '5px' }}>:</td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '5px' }}>{letter.travel_purpose ?? '-'}</td>
                </tr>
                <tr>
                  <td style={{ verticalAlign: 'top', paddingBottom: '5px', paddingLeft: '20px' }}>Hari/Tanggal</td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '5px' }}>:</td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '5px' }}>{letter.travel_date ?? '-'}</td>
                </tr>
                <tr>
                  <td style={{ verticalAlign: 'top', paddingBottom: '5px', paddingLeft: '20px' }}>Pukul</td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '5px' }}>:</td>
                  <td style={{ verticalAlign: 'top', paddingBottom: '5px' }}>{letter.travel_time ?? '-'}</td>
                </tr>
                <tr>
                  <td style={{ verticalAlign: 'top', paddingLeft: '20px' }}>Tempat</td>
                  <td style={{ verticalAlign: 'top' }}>:</td>
                  <td style={{ verticalAlign: 'top' }}>{letter.travel_place ?? '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* ════════ PENUTUP ════════ */}
            <div style={{ fontSize: '11pt', marginBottom: '24px', lineHeight: '1.5' }}>
              Demikian surat tugas ini kami buat untuk dapat dipergunakan dan dilaksanakan dengan sebaik-baiknya.
            </div>

            {/* ════════ TANDA TANGAN ════════ */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <div style={{ fontSize: '11pt', marginBottom: '4px' }}>{suratDate}</div>
                <div style={{ fontSize: '11pt', marginBottom: '12px' }}>Rumah Sakit Umum Cempaka Lima</div>

                {/* QR Code Tanda Tangan */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                  <img
                    src={dir.qr}
                    alt={`QR ${dir.name}`}
                    style={{ width: '90px', height: '90px', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ fontSize: '11pt', fontWeight: 'bold', textDecoration: 'underline' }}>
                  {dir.name}
                </div>
                <div style={{ fontSize: '11pt' }}>{dir.jabatan}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
