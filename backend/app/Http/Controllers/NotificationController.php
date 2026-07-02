<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * GET /api/notifications
     */
    public function index(Request $request)
    {
        $notifications = Notification::where('user_id', $request->user()->id)
                                     ->orderBy('created_at', 'desc')
                                     ->get()
                                     ->map(fn($n) => $this->format($n));

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
     */
    public function markRead(Request $request, Notification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
        }
        $notification->update(['read_at' => now()]);
        return response()->json(['success' => true, 'message' => 'Notifikasi ditandai telah dibaca.']);
    }

    /**
     * PUT /api/notifications/read-all
     */
    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
                    ->whereNull('read_at')
                    ->update(['read_at' => now()]);

        return response()->json(['success' => true, 'message' => 'Semua notifikasi ditandai telah dibaca.']);
    }

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
