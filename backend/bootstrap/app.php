<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Izinkan frontend Vite (localhost:5173) mengakses API dengan cookie/Sanctum
        $middleware->statefulApi();

        // Alias middleware role admin & pj_bagian
        $middleware->alias([
            'admin'        => \App\Http\Middleware\EnsureIsAdmin::class,
            'pj_or_admin'  => \App\Http\Middleware\EnsurePjOrAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Database\QueryException $e, Request $request) {
            if ($request->is('api/*')) {
                \Illuminate\Support\Facades\Log::error('QueryException caught globally: ' . $e->getMessage(), [
                    'sql' => $e->getSql(),
                    'bindings' => $e->getBindings(),
                    'code' => $e->getCode(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Terjadi kesalahan saat menyimpan data. Silakan coba lagi atau hubungi admin.',
                    'errors'  => null,
                ], 500);
            }
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
