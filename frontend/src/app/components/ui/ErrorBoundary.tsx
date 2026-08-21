import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React ErrorBoundary Component — Sistem Absensi RSUCL
 *
 * Menangkap unhandled JavaScript runtime error pada komponen anak saat re-render
 * dan menampilkan UI fallback yang ramah pengguna alih-alih melempar layar putih polos (blank white screen).
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] w-full p-6 flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-red-100 shadow-sm my-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500 mb-3 shadow-xs">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-[16px] font-bold text-gray-900 mb-1">
            Terjadi Kendala Tampilan
          </h3>
          <p className="text-[12.5px] text-gray-500 max-w-sm mb-4 leading-relaxed">
            Sistem memuat ulang modul komponen untuk mencegah error layar putih. 
            Silakan klik tombol di bawah untuk menyegarkan halaman.
          </p>

          {this.state.error?.message && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left max-w-md w-full">
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider mb-1">
                Detail Error (Log):
              </p>
              <p className="text-[11px] text-red-600 font-mono break-all leading-tight">
                {this.state.error.message}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className="px-5 py-2.5 bg-[#16A34A] hover:bg-[#0d9240] text-white text-[13px] font-bold rounded-xl shadow-md shadow-green-200 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCw size={15} />
            <span>Muat Ulang Halaman</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
