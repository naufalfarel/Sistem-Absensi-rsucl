<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    public function index()
    {
        $schedules = Schedule::withCount('employees')->get();
        return response()->json(['success' => true, 'data' => $schedules]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:50',
            'start_time' => 'required|date_format:H:i',
            'end_time'   => 'required|date_format:H:i',
            'color'      => 'required|string|max:10',
            'icon'       => 'required|string|max:20',
        ]);

        $schedule = Schedule::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal shift berhasil dibuat.',
            'data'    => $schedule,
        ], 201);
    }

    public function update(Request $request, Schedule $schedule)
    {
        $data = $request->validate([
            'name'       => 'sometimes|string|max:50',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time'   => 'sometimes|date_format:H:i',
            'color'      => 'sometimes|string|max:10',
            'icon'       => 'sometimes|string|max:20',
        ]);

        $schedule->update($data);

        return response()->json(['success' => true, 'message' => 'Jadwal shift berhasil diperbarui.', 'data' => $schedule]);
    }

    public function destroy(Schedule $schedule)
    {
        $schedule->delete();
        return response()->json(['success' => true, 'message' => 'Jadwal shift berhasil dihapus.']);
    }
}
