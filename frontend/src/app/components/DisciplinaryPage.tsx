import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, FileText, CheckCircle2, Clock, Download, ExternalLink, Info, Loader2 } from 'lucide-react';
import { disciplinarySanctionApi, DisciplinarySanction } from '../../services/api';
import logoImg from '../../imports/fa46c1c7-c01d-47c1-9cb0-9ab5874c3cfd_130x130.jpeg';
import { useAuth } from '../../context/AuthContext';

export const DisciplinaryPage: React.FC = () => {
  const { logoUrl } = useAuth();
  const [sanctions, setSanctions] = useState<DisciplinarySanction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(true);
  const [warningChecked, setWarningChecked] = useState<boolean>(false);

  const fetchSanctions = async () => {
    setLoading(true);
    try {
      const res = await disciplinarySanctionApi.list({ personal: true });
      if (res.success) {
        setSanctions(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat data sanksi disiplin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSanctions();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      return new Date(dateStr).toLocaleDateString('id-ID', options);
    } catch (e) {
      return dateStr;
    }
  };

  const getSanctionStyle = (type: DisciplinarySanction['type']) => {
    switch (type) {
      case 'teguran':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-700',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          label: 'Surat Teguran'
        };
      case 'sp1':
        return {
          bg: 'bg-orange-50 border-orange-200 text-orange-700',
          badge: 'bg-orange-100 text-orange-850 border-orange-200',
          label: 'Surat Peringatan 1 (SP1)'
        };
      case 'sp2':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-700',
          badge: 'bg-rose-100 text-rose-850 border-rose-200',
          label: 'Surat Peringatan 2 (SP2)'
        };
      case 'phk':
        return {
          bg: 'bg-red-50 border-red-200 text-red-700',
          badge: 'bg-red-100 text-red-850 border-red-200',
          label: 'PHK (Pemutusan Hubungan Kerja)'
        };
      default:
        return {
          bg: 'bg-slate-50 border-slate-200 text-slate-700',
          badge: 'bg-slate-100 text-slate-800 border-slate-200',
          label: 'Sanksi Disiplin'
        };
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 font-sans pb-10 max-w-5xl mx-auto">
      {/* ── HEADER BANNER ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-md relative overflow-hidden border border-slate-700/30">
        <div className="absolute right-0 top-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-350 text-[10.5px] font-extrabold uppercase tracking-wider border border-rose-500/30">
              <ShieldAlert size={13} /> Sanksi Disiplin
            </div>
            <h2 className="text-xl md:text-2xl font-bold mt-2.5">Status &amp; Riwayat Tindakan Disiplin</h2>
            <p className="text-[12.5px] text-slate-350 mt-1 max-w-2xl leading-relaxed">
              Pemantauan surat teguran dan surat peringatan resmi yang diterbitkan oleh Manajemen RSU Cempaka Lima.
            </p>
          </div>
          <button
            onClick={() => {
              setWarningChecked(false);
              setShowWarningModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-2xl text-[12px] transition-all cursor-pointer flex-shrink-0"
          >
            <Info size={14} /> Lihat Ketentuan Disiplin
          </button>
        </div>
      </div>

      {/* ── LIST RIWAYAT SANKSI ────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-slate-850 text-[15px]">Daftar Tindakan Disiplin Aktif</h3>
            <p className="text-[12px] text-slate-400">Riwayat sanksi kedisiplinan yang diberikan kepada Anda.</p>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
            {sanctions.length} Tindakan
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-slate-500" size={24} />
            <span className="text-[12.5px]">Memuat riwayat sanksi...</span>
          </div>
        ) : sanctions.length === 0 ? (
          <div className="py-16 px-4 text-center text-slate-400 space-y-3.5">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-[13.5px] font-bold text-slate-700">Kondisi Disiplin Baik &amp; Bersih</p>
            <p className="text-[12px] text-slate-400 max-w-sm mx-auto">
              Tidak ada surat teguran maupun surat peringatan yang terdaftar atas nama Anda. Pertahankan kinerja baik Anda!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sanctions.map((san) => {
              const style = getSanctionStyle(san.type);
              return (
                <div key={san.id} className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold border uppercase tracking-wider ${style.badge}`}>
                          {style.label}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          Diterbitkan: {formatDate(san.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-400 mt-1">
                        Penerbit Sanksi: <strong className="text-slate-650">{san.creator?.name || 'Manajemen RSUCL'}</strong>
                      </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {san.attachment_url && (
                        <a
                          href={san.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold transition-all"
                        >
                          <FileText size={12} /> Buka {style.label} <ExternalLink size={10} />
                        </a>
                      )}
                      {san.chronology_url && (
                        <a
                          href={san.chronology_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold transition-all"
                        >
                          <FileText size={12} /> Buka Kronologi <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>

                  {san.admin_note && (
                    <div className="text-[12px] text-slate-650 bg-slate-50 border border-slate-100 rounded-2xl p-3.5 sm:p-4 leading-relaxed font-medium">
                      <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block mb-1">Catatan Pelanggaran:</span>
                      {san.admin_note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL POP UP PERATURAN TATA TERTIB DISIPLIN WAJIB ────────────────── */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden font-sans">
            
            {/* Header Warning Red/Slate Gradient */}
            <div className="bg-gradient-to-r from-slate-900 to-rose-950 px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <ShieldAlert size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-[16.5px] font-bold text-white leading-tight">Peraturan Tata Tertib Disiplin</h2>
                  <p className="text-[12px] text-white/70">Ketentuan tindakan kedisiplinan RSUCL</p>
                </div>
              </div>
              <p className="text-[11.5px] text-white/70 italic leading-snug">
                Rumah Sakit Cempaka Lima menerapkan sanksi ketat terhadap pelanggaran disiplin kerja.
              </p>
            </div>

            {/* Notes List */}
            <div className="px-6 pt-5 pb-4 space-y-3.5 max-h-[45vh] overflow-y-auto">
              <p className="text-[12.5px] font-bold text-slate-700 leading-relaxed">
                Kepada karyawan/ti yang melakukan pelanggaran, Rumah Sakit akan memberikan tindakan disiplin sebagai berikut :
              </p>
              
              {[
                { title: '1. Surat Teguran', desc: 'Diberikan sebagai peringatan awal atas pelanggaran disiplin kerja ringan.' },
                { title: '2. Surat Peringatan 1 (SP1)', desc: 'Diberikan apabila pelanggaran berlanjut atau bersifat sedang.' },
                { title: '3. Surat Peringatan 2 (SP2)', desc: 'Tindakan disiplin keras terakhir sebelum evaluasi pemutusan hubungan kerja.' },
                { title: '4. PHK (Pemutusan Hubungan Kerja)', desc: 'Pemberhentian hubungan kerja akibat pelanggaran disiplin berat.' }
              ].map((note, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 border border-slate-150 rounded-2xl px-3.5 py-3">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-rose-700 font-bold text-xs">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-[12.5px] font-bold text-slate-850 mb-0.5">{note.title}</p>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed font-medium">{note.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Checkbox Acknowledge */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setWarningChecked(v => !v)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all cursor-pointer ${
                    warningChecked ? 'bg-rose-600 border-rose-600' : 'border-slate-350 group-hover:border-rose-600'
                  }`}
                >
                  {warningChecked && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <p className="text-[12px] text-slate-700 leading-relaxed font-medium">
                  Saya telah membaca dan memahami ketentuan peraturan tata tertib disiplin di atas.
                </p>
              </label>
            </div>

            {/* Action button */}
            <div className="px-6 pb-6 pt-3">
              <button
                onClick={() => warningChecked && setShowWarningModal(false)}
                disabled={!warningChecked}
                className={`w-full py-3 rounded-2xl text-[13px] font-bold transition-all text-center flex items-center justify-center gap-2 ${
                  warningChecked
                    ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-[0.98] cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {warningChecked ? 'Saya Memahami & Lanjutkan' : 'Centang kotak di atas untuk melanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
