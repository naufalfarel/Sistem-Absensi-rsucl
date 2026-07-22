<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Middleware EnsureIsSuperAdmin
 * 
 * Memastikan pengguna yang melakukan request memiliki otentikasi aktif dan
 * memiliki role 'super_admin' (Direktur RSUCL) sebelum dapat mengakses endpoint tertentu.
 */
class EnsureIsSuperAdmin
{
    /**
     * Handle incoming request.
     * 
     * @param Request $request
     * @param Closure $next
     * @return mixed Response JSON 403 jika ditolak, atau lanjut ke request berikutnya
     */
    public function handle(Request $request, Closure $next)
    {
        if (!$request->user() || !$request->user()->isSuperAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Fitur ini hanya dapat diakses oleh Super Admin (Direktur RSUCL).',
            ], 403);
        }
        return $next($request);
    }
}
