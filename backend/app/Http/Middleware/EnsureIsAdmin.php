<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Middleware EnsureIsAdmin
 * 
 * Memastikan pengguna yang melakukan request memiliki otentikasi aktif dan
 * memiliki role 'admin' sebelum dapat mengakses endpoint tertentu.
 */
class EnsureIsAdmin
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
        // Periksa apakah user login ada dan merupakan admin
        if (!$request->user() || !$request->user()->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Hanya Administrator yang dapat mengakses endpoint ini.',
            ], 403);
        }
        return $next($request);
    }
}
