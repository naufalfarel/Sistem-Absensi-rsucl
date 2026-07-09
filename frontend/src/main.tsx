/**
 * Main Entry Point — Sistem Absensi RSUCL
 * 
 * Menginisialisasi React DOM root, memuat file style utama,
 * serta membungkus aplikasi dengan AuthProvider untuk manajemen session.
 */

import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { AuthProvider } from "./context/AuthContext.tsx";

// Merender aplikasi React ke elemen root di file index.html
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);