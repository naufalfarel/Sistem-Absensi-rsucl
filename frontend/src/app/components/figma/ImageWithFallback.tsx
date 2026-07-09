/**
 * Komponen ImageWithFallback — Sistem Absensi RSUCL
 * 
 * Wrapper untuk elemen HTML `img` yang menampilkan gambar default (fallback SVG)
 * apabila gambar utama yang dimuat (seperti foto selfie absensi atau logo) mengalami kegagalan/error.
 */

import React, { useState } from 'react'

// SVG base64 sebagai gambar cadangan jika terjadi error load gambar asli
const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=='

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  // State untuk melacak apakah gambar gagal dimuat
  const [didError, setDidError] = useState(false)

  // Callback handler jika event onError pada gambar terpicu
  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, ...rest } = props

  // Jika error, tampilkan container abu-abu dengan gambar fallback SVG
  return didError ? (
    <div
      className={`inline-block bg-gray-100 text-center align-middle ${className ?? ''}`}
      style={style}
    >
      <div className="flex items-center justify-center w-full h-full">
        <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
      </div>
    </div>
  ) : (
    // Tampilkan gambar asli dan pasangkan handler onError
    <img src={src} alt={alt} className={className} style={style} {...rest} onError={handleError} />
  )
}

