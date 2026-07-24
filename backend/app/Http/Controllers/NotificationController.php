<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

/**
 * Class NotificationController
 * 
 * Mengelola interaksi notifikasi sistem untuk pengguna yang masuk.
 * Mendukung pembacaan detail notifikasi, penandaan "dibaca semua", serta penghapusan.
 */
class NotificationController extends Controller
{
    /**
     * GET /api/notifications
     * 
     * Mengambil seluruh daftar notifikasi milik pengguna saat ini
     * beserta jumlah notifikasi yang belum dibaca (unread count).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        // Ambil notifikasi dari user, diurutkan dari yang terbaru
        $notifications = Notification::where('user_id', $request->user()->id)
                                     ->orderBy('created_at', 'desc')
                                     ->get()
                                     ->map(fn($n) => $this->format($n));

        // Hitung jumlah notifikasi yang belum dibaca
        $unreadCount = Notification::where('user_id', $request->user()->id)
                                   ->whereNull('read_at')
                                   ->count();

        return response()->json([
            'success' => true,
            'data'    => [
                'notifications' => $notifications,
                'unread_count'  => $unreadCount,
            ],
        ]);
    }

    /**
     * PUT /api/notifications/{id}/read
     * 
     * Menandai satu notifikasi tertentu sebagai telah dibaca.
     * 
     * @param Request $request
     * @param Notification $notification
     * @return \Illuminate\Http\JsonResponse
     */
    public function markRead(Request $request, Notification $notification)
    {
        // Validasi kepemilikan notifikasi
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }
        
        // Update waktu keterbacaan
        $notification->update(['read_at' => now()]);
        return response()->json(['success' => true, 'message' => 'Notifikasi ditandai telah dibaca.']);
    }

    /**
     * PUT /api/notifications/read-all
     * 
     * Menandai seluruh notifikasi milik user saat ini sebagai telah dibaca.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
                    ->whereNull('read_at')
                    ->update(['read_at' => now()]);

        return response()->json(['success' => true, 'message' => 'Semua notifikasi ditandai telah dibaca.']);
    }

    /**
     * DELETE /api/notifications/delete-read
     * 
     * Menghapus semua notifikasi milik user saat ini yang sudah dibaca (read_at tidak null).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
                    ->whereNotNull('read_at')
                    ->delete();

        return response()->json(['success' => true, 'message' => 'Semua notifikasi yang telah dibaca berhasil dihapus.']);
    }

    /**
     * DELETE /api/notifications/{id}
     * 
     * Menghapus satu notifikasi tertentu. Hanya notifikasi yang sudah dibaca yang diizinkan untuk dihapus.
     * 
     * @param Request $request
     * @param Notification $notification
     * @return \Illuminate\Http\JsonResponse
     */
    public function delete(Request $request, Notification $notification)
    {
        // Validasi kepemilikan notifikasi
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }

        $notification->delete();

        return response()->json(['success' => true, 'message' => 'Notifikasi berhasil dihapus.']);
    }

    /**
     * Format data output JSON notifikasi.
     * 
     * @param Notification $n
     * @return array
     */
    private function format(Notification $n): array
    {
        return [
            'id'         => $n->id,
            'title'      => $n->title,
            'body'       => $n->body,
            'type'       => $n->type,
            'is_read'    => $n->read_at !== null,
            'read_at'    => $n->read_at?->toDateTimeString(),
            'data'       => $n->data,
            'created_at' => $n->created_at?->toDateTimeString(),
        ];
    }
}
