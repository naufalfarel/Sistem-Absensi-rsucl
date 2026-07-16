<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Middleware EnsurePjOrAdmin
 * 
 * Memastikan user yang mengakses endpoint terautentikasi DAN memiliki
 * role 'admin' ATAU 'pj_bagian'. 
 * 
 * Scoping data (pembatasan ke departemen sendiri untuk PJ Bagian) dilakukan
 * di level controller — bukan di middleware ini.
 */
class EnsurePjOrAdmin
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user || !$user->isPjOrAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Endpoint ini hanya untuk Administrator atau Penanggung Jawab Bagian.',
            ], 403);
        }

        return $next($request);
    }
}
