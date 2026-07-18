<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Http\Requests\StoreScheduleRequest;
use App\Http\Requests\UpdateScheduleRequest;
use App\Http\Resources\ScheduleResource;
use Illuminate\Http\Request;

class ScheduleController extends Controller
{
    /**
     * GET /api/schedules
     * 
     * Mengambil daftar seluruh master jadwal shift kerja,
     * lengkap dengan data karyawan yang ditugaskan beserta jumlah totalnya.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Schedule::whereNull('parent_id');

        if ($user->isPjBagian()) {
            $deptId = $user->pj_bagian_department_id;
            // Saring agar PJ Bagian hanya melihat shift milik departemennya sendiri
            $query->where('owner_department_id', $deptId);

            // Filter relasi pegawai agar hanya mengembalikan yang satu departemen dengan PJ Bagian
            $query->with([
                'creator',
                'updater',
                'ownerDepartment',
                'children.employees' => function ($q) use ($deptId) {
                    $q->where('department_id', $deptId);
                },
                'children.employees.user',
                'children.employees.department'
            ]);
        } else {
            // Admin: bisa lihat semua
            $query->with([
                'creator',
                'updater',
                'ownerDepartment',
                'children.employees.user',
                'children.employees.department'
            ]);
        }

        $schedules = $query->get();

        return response()->json(['success' => true, 'data' => ScheduleResource::collection($schedules)]);
    }

    /**
     * POST /api/schedules
     * 
     * Membuat master jadwal shift baru (misal: Shift Sore, Jam masuk 14:00 s.d 21:00).
     * 
     * @param StoreScheduleRequest $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(StoreScheduleRequest $request)
    {
        // Validasi input data shift baru
        $data = $request->validated();
        
        $user = $request->user();
        if ($user->isPjBagian()) {
            $deptId = $user->pj_bagian_department_id;
            if (!$deptId) {
                return response()->json(['success' => false, 'message' => 'PJ Bagian belum ditugaskan ke departemen.'], 422);
            }
            $data['owner_department_id'] = $deptId;
            $data['created_by'] = $user->id;
        } else {
            $data['created_by'] = $user->id;
        }

        // Buat jadwal shift di database
        $schedule = Schedule::create($data);

        // Jika ini adalah parent template (parent_id = null) dan start_time & end_time disediakan,
        // buat child sub-shift (variant) pertama secara otomatis dengan jam yang sama agar langsung bisa ditugaskan
        if (!isset($data['parent_id']) || $data['parent_id'] === null) {
            if (isset($data['start_time']) && isset($data['end_time'])) {
                $childLimit = null;
                if ($user->isPjBagian()) {
                    try {
                        $childLimit = \Carbon\Carbon::createFromFormat('H:i', substr($data['start_time'], 0, 5))
                            ->addHours(5)
                            ->format('H:i:s');
                    } catch (\Exception $e) {}
                }
                Schedule::create([
                    'parent_id'  => $schedule->id,
                    'name'       => 'Normal (' . substr($data['start_time'], 0, 5) . '–' . substr($data['end_time'], 0, 5) . ')',
                    'start_time' => $data['start_time'],
                    'end_time'   => $data['end_time'],
                    'color'      => $data['color'] ?? '#16A34A',
                    'icon'       => $data['icon'] ?? 'sun',
                    'shift_type' => $data['shift_type'] ?? 'normal',
                    'checkin_window_end_time' => $childLimit,
                    'owner_department_id' => $schedule->owner_department_id,
                    'created_by' => $user->id,
                ]);
            }
        }

        $schedule->load(['creator', 'updater', 'ownerDepartment', 'children']);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal shift berhasil dibuat.',
            'data'    => new ScheduleResource($schedule),
        ], 201);
    }

    /**
     * PUT /api/schedules/{id}
     * 
     * Memperbarui data detail master jadwal shift yang sudah ada.
     * 
     * @param UpdateScheduleRequest $request
     * @param Schedule $schedule
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(UpdateScheduleRequest $request, Schedule $schedule)
    {
        // Validasi payload perubahan data shift
        $data = $request->validated();
        
        $user = $request->user();
        
        if ($user->isPjBagian()) {
            $deptId = $user->pj_bagian_department_id;
            if (!$deptId) {
                return response()->json(['success' => false, 'message' => 'PJ Bagian belum ditugaskan ke departemen.'], 422);
            }
            
            // PJ Bagian trying to edit a shift owned by another department -> tolak 403
            if ($schedule->owner_department_id !== null && (int)$schedule->owner_department_id !== (int)$deptId) {
                return response()->json(['success' => false, 'message' => 'Anda tidak memiliki hak untuk mengubah shift milik departemen lain.'], 403);
            }

            // Check if this shift is shared across multiple departments
            // (assigned to employees belonging to more than one unique department)
            $scheduleIds = [$schedule->id];
            $childIds = $schedule->children()->pluck('id')->toArray();
            $scheduleIds = array_merge($scheduleIds, $childIds);

            $uniqueDepts = \DB::table('employee_schedule')
                ->join('employees', 'employee_schedule.employee_id', '=', 'employees.id')
                ->whereIn('employee_schedule.schedule_id', $scheduleIds)
                ->whereNull('employees.deleted_at')
                ->distinct('employees.department_id')
                ->pluck('employees.department_id')
                ->toArray();

            $uniqueDeptsCount = count($uniqueDepts);
            $isShared = $uniqueDeptsCount > 1;

            if ($isShared) {
                // Shared shift! Create a clone for the PJ Bagian's department.
                // Replicate parent
                $clonedSchedule = $schedule->replicate();
                $deptName = $user->pjBagianDepartment ? $user->pjBagianDepartment->name : 'Dept';
                $clonedSchedule->name = ($data['name'] ?? $schedule->name) . ' – ' . $deptName;
                $clonedSchedule->owner_department_id = $deptId;
                $clonedSchedule->created_by = $user->id;
                $clonedSchedule->updated_by = $user->id;
                
                // If start/end times or colors were updated in parent
                if (isset($data['start_time'])) $clonedSchedule->start_time = $data['start_time'];
                if (isset($data['end_time'])) $clonedSchedule->end_time = $data['end_time'];
                if (isset($data['color'])) $clonedSchedule->color = $data['color'];
                if (isset($data['icon'])) $clonedSchedule->icon = $data['icon'];
                if (isset($data['shift_type'])) $clonedSchedule->shift_type = $data['shift_type'];
                
                $clonedSchedule->save();

                // Clone / create children
                $origChildren = $schedule->children()->orderBy('id')->get();
                $newChildren = collect();

                if ($request->has('children')) {
                    $inputChildren = $data['children'] ?? [];
                    foreach ($inputChildren as $childData) {
                        $start = strlen($childData['start_time']) === 5 ? $childData['start_time'] . ':00' : $childData['start_time'];
                        $end = strlen($childData['end_time']) === 5 ? $childData['end_time'] . ':00' : $childData['end_time'];
                        $newChild = Schedule::create([
                            'parent_id'  => $clonedSchedule->id,
                            'name'       => $childData['name'],
                            'start_time' => $start,
                            'end_time'   => $end,
                            'color'      => $clonedSchedule->color,
                            'icon'       => $clonedSchedule->icon,
                            'shift_type' => $clonedSchedule->shift_type,
                            'owner_department_id' => $deptId,
                            'created_by' => $user->id,
                        ]);
                        $newChildren->push($newChild);
                    }
                } else {
                    foreach ($origChildren as $origChild) {
                        $clonedChild = $origChild->replicate();
                        $clonedChild->parent_id = $clonedSchedule->id;
                        $clonedChild->owner_department_id = $deptId;
                        $clonedChild->created_by = $user->id;
                        $clonedChild->save();
                        $newChildren->push($clonedChild);
                    }
                }

                // Transfer employee assignments of this department from old schedule to cloned schedule
                // We find the employee_schedule records for employees in this department assigned to the old schedules
                $assignments = \DB::table('employee_schedule')
                    ->join('employees', 'employee_schedule.employee_id', '=', 'employees.id')
                    ->whereIn('employee_schedule.schedule_id', $scheduleIds)
                    ->where('employees.department_id', $deptId)
                    ->select('employee_schedule.id', 'employee_schedule.schedule_id')
                    ->get();

                foreach ($assignments as $assign) {
                    // Match which original child was assigned
                    $origChildIndex = $origChildren->search(fn($c) => $c->id == $assign->schedule_id);
                    if ($origChildIndex !== false && isset($newChildren[$origChildIndex])) {
                        \DB::table('employee_schedule')
                            ->where('id', $assign->id)
                            ->update(['schedule_id' => $newChildren[$origChildIndex]->id]);
                    }
                }

                $clonedSchedule->load(['creator', 'updater', 'ownerDepartment', 'children.employees' => function($q) use ($deptId) {
                    $q->where('department_id', $deptId);
                }, 'children.employees.user', 'children.employees.department']);

                return response()->json([
                    'success' => true,
                    'cloned'  => true,
                    'message' => 'Shift ini dipakai bersama departemen lain. Perubahan Anda disimpan sebagai shift baru khusus departemen Anda: "' . $clonedSchedule->name . '"',
                    'data'    => new ScheduleResource($clonedSchedule)
                ]);
            } else {
                // Not shared: PJ Bagian can modify it directly
                // If owner_department_id is null, claim ownership
                if ($schedule->owner_department_id === null) {
                    $schedule->owner_department_id = $deptId;
                }
                $schedule->updated_by = $user->id;
                $schedule->save();
            }
        } else {
            // Admin: set updated_by
            $schedule->updated_by = $user->id;
            $schedule->save();
        }

        // Standard direct update logic (for non-shared PJ Bagian or Admin)
        $schedule->update(\Illuminate\Support\Arr::except($data, ['children']));
        $schedule->children()->update(['owner_department_id' => $schedule->owner_department_id]);

        if ($request->has('children')) {
            $inputChildren = $data['children'] ?? [];
            $keepIds = [];

            foreach ($inputChildren as $childData) {
                $start = strlen($childData['start_time']) === 5 ? $childData['start_time'] . ':00' : $childData['start_time'];
                $end = strlen($childData['end_time']) === 5 ? $childData['end_time'] . ':00' : $childData['end_time'];

                $childLimit = null;
                if ($user->isPjBagian()) {
                    try {
                        $childLimit = \Carbon\Carbon::createFromFormat('H:i', substr($start, 0, 5))
                            ->addHours(5)
                            ->format('H:i:s');
                    } catch (\Exception $e) {}
                }

                if (isset($childData['id']) && $childData['id']) {
                    $child = Schedule::findOrFail($childData['id']);
                    $updatePayload = [
                        'name'       => $childData['name'],
                        'start_time' => $start,
                        'end_time'   => $end,
                        'color'      => $schedule->color,
                        'icon'       => $schedule->icon,
                        'shift_type' => $schedule->shift_type,
                        'updated_by' => $user->id,
                    ];
                    if ($user->isPjBagian()) {
                        $updatePayload['checkin_window_end_time'] = $childLimit;
                    }
                    $child->update($updatePayload);
                    $keepIds[] = $child->id;
                } else {
                    $newChild = Schedule::create([
                        'parent_id'  => $schedule->id,
                        'name'       => $childData['name'],
                        'start_time' => $start,
                        'end_time'   => $end,
                        'color'      => $schedule->color,
                        'icon'       => $schedule->icon,
                        'shift_type' => $schedule->shift_type,
                        'checkin_window_end_time' => $childLimit,
                        'owner_department_id' => $schedule->owner_department_id,
                        'created_by' => $user->id,
                    ]);
                    $keepIds[] = $newChild->id;
                }
            }

            $schedule->children()->whereNotIn('id', $keepIds)->delete();
        }

        // Load relasi terbaru dan hitung ulang jumlah karyawan terkait
        if ($user->isPjBagian()) {
            $deptId = $user->pj_bagian_department_id;
            $schedule->load(['creator', 'updater', 'ownerDepartment', 'children.employees' => function($q) use ($deptId) {
                $q->where('department_id', $deptId);
            }, 'children.employees.user', 'children.employees.department']);
        } else {
            $schedule->load(['creator', 'updater', 'ownerDepartment', 'children.employees.user', 'children.employees.department']);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jadwal shift berhasil diperbarui.',
            'data'    => new ScheduleResource($schedule)
        ]);
    }

    /**
     * DELETE /api/schedules/{id}
     * 
     * Menghapus master jadwal shift dari database.
     * 
     * @param Schedule $schedule
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Schedule $schedule)
    {
        $user = request()->user();
        if ($user->isPjBagian()) {
            if ((int)$schedule->owner_department_id !== (int)$user->pj_bagian_department_id) {
                return response()->json(['success' => false, 'message' => 'Anda hanya dapat menghapus shift milik departemen Anda sendiri.'], 403);
            }
        }

        $schedule->delete();
        return response()->json(['success' => true, 'message' => 'Jadwal shift berhasil dihapus.']);
    }

    /**
     * GET /api/employee-schedules
     * 
     * Mengambil matriks pemetaan jadwal shift kerja mingguan (Senin-Minggu) untuk seluruh karyawan yang aktif.
     * Digunakan oleh Admin untuk memetakan atau melihat sebaran shift karyawan.
     * 
     * @return \Illuminate\Http\JsonResponse
     */
    public function getEmployeeSchedules(Request $request)
    {
        $user = $request->user();
        
        // Dapatkan start_date (Senin dari minggu yang dipilih), default ke Senin minggu ini
        $startDateStr = $request->input('start_date');
        if ($startDateStr) {
            $startDate = \Carbon\Carbon::parse($startDateStr)->startOfDay();
        } else {
            $startDate = \Carbon\Carbon::now('Asia/Jakarta')->startOfWeek(\Carbon\Carbon::MONDAY)->startOfDay();
        }
        
        // Buat list 7 tanggal untuk minggu ini
        $dates = [];
        $dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        for ($i = 0; $i < 7; $i++) {
            $dates[$dayNames[$i]] = $startDate->copy()->addDays($i)->toDateString();
        }

        $query = \App\Models\Employee::with(['user', 'schedules'])->where('status', 'active');

        if ($user->role === 'pj_bagian') {
            $query->where('department_id', $user->pj_bagian_department_id);
        }

        $employees = $query->get();
        
        // Format pemetaan hari kerja per karyawan
        $data = $employees->map(function ($emp) use ($dates) {
            $scheduleMap = [];
            
            foreach ($dates as $dayName => $dateVal) {
                // Cari apakah ada schedule dengan date = $dateVal
                $sched = $emp->schedules->first(function($s) use ($dateVal) {
                    return $s->pivot->date === $dateVal;
                });
                
                // Fallback ke day_of_week
                if (!$sched) {
                    $sched = $emp->schedules->first(function($s) use ($dayName) {
                        return $s->pivot->day_of_week === $dayName && is_null($s->pivot->date);
                    });
                }
                
                if ($sched) {
                    $scheduleMap[$dateVal] = [
                        'id' => $sched->id,
                        'name' => $sched->name,
                        'color' => $sched->color,
                        'icon' => $sched->icon,
                    ];
                }
            }
            
            return [
                'employee_id' => $emp->id,
                'name' => $emp->user->name,
                'schedules' => (object)$scheduleMap
            ];
        });

        return response()->json([
            'success' => true,
            'start_date' => $startDate->toDateString(),
            'dates' => $dates,
            'data' => $data
        ]);
    }

    /**
     * GET /api/my-schedule
     * 
     * Mengambil jadwal shift kerja karyawan yang saat ini sedang login untuk hari ini,
     * serta informasi khusus untuk shift hari Sabtu (jika ada) guna keperluan kalkulasi checkout awal.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function mySchedule(\Illuminate\Http\Request $request)
    {
        $employee = $request->user()->employee;
        if (!$employee) {
            return response()->json(['success' => false, 'message' => 'Data karyawan tidak ditemukan.'], 404);
        }

        // Mapping index hari PHP ke penulisan hari Indonesia pada tabel pivot database
        $dayMap = [
            0 => 'Minggu',
            1 => 'Senin',
            2 => 'Selasa',
            3 => 'Rabu',
            4 => 'Kamis',
            5 => 'Jumat',
            6 => 'Sabtu',
        ];
        $todayName = $dayMap[now('Asia/Jakarta')->dayOfWeek];

        // Ambil semua jadwal shift yang ditugaskan ke karyawan
        $schedules = $employee->schedules()->get();

        // Cari shift untuk hari ini (spesifik tanggal dulu)
        $todayDateStr = now('Asia/Jakarta')->toDateString();
        $todaySchedule = $schedules->first(function ($s) use ($todayDateStr) {
            return $s->pivot->date === $todayDateStr;
        });
        if (!$todaySchedule) {
            $todaySchedule = $schedules->first(function ($s) use ($todayName) {
                return $s->pivot->day_of_week === $todayName && is_null($s->pivot->date);
            });
        }

        // Cari shift untuk hari Sabtu (spesifik tanggal dulu, fallback ke template)
        $satDateStr = now('Asia/Jakarta')->startOfWeek(\Carbon\Carbon::MONDAY)->addDays(5)->toDateString();
        $saturdaySchedule = $schedules->first(function ($s) use ($satDateStr) {
            return $s->pivot->date === $satDateStr;
        });
        if (!$saturdaySchedule) {
            $saturdaySchedule = $schedules->first(function ($s) {
                return $s->pivot->day_of_week === 'Sabtu' && is_null($s->pivot->date);
            });
        }

        $todayData = null;
        if ($todaySchedule) {
            $todayData = [
                'id'         => $todaySchedule->id,
                'name'       => $todaySchedule->name,
                'start_time' => $todaySchedule->start_time,
                'end_time'   => $todaySchedule->end_time,
                'color'      => $todaySchedule->color,
                'icon'       => $todaySchedule->icon,
                'shift_type' => $todaySchedule->shift_type ?? 'normal',
            ];
        }

        $saturdayData = null;
        if ($saturdaySchedule) {
            $saturdayData = [
                'id'         => $saturdaySchedule->id,
                'name'       => $saturdaySchedule->name,
                'start_time' => $saturdaySchedule->start_time,
                'end_time'   => $saturdaySchedule->end_time,
                'color'      => $saturdaySchedule->color,
                'icon'       => $saturdaySchedule->icon,
                'shift_type' => $saturdaySchedule->shift_type ?? 'normal',
            ];
        }

        return response()->json([
            'success' => true,
            'day'     => $todayName,
            'data'    => $todayData,
            'saturday_shift' => $saturdayData,
        ]);
    }

    /**
     * POST /api/employee-schedules/assign
     * 
     * Menugaskan atau memperbarui jadwal shift pegawai berdasarkan hari kerja (day_of_week).
     * Jika schedule_id dikirimkan null, maka pegawai diatur libur pada hari tersebut.
     * Mengirimkan notifikasi pembaruan jadwal secara real-time ke akun pegawai bersangkutan.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function assignEmployeeSchedule(Request $request)
    {
        // Validasi input pegawai, nama hari/tanggal, dan ID jadwal shift
        $data = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'day_of_week' => 'nullable|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
            'date'        => 'nullable|date',
            'schedule_id' => 'nullable|exists:schedules,id',
        ]);

        if (empty($data['day_of_week']) && empty($data['date'])) {
            return response()->json(['success' => false, 'message' => 'Hari (day_of_week) atau Tanggal (date) wajib ditentukan.'], 422);
        }

        $emp = \App\Models\Employee::findOrFail($data['employee_id']);

        if ($request->user()->role === 'pj_bagian' && $emp->department_id !== $request->user()->pj_bagian_department_id) {
            return response()->json(['success' => false, 'message' => 'Anda hanya dapat mengatur jadwal staf di departemen Anda.'], 403);
        }

        // Hapus penugasan shift lama pegawai pada target yang sama (jika ada)
        $query = \Illuminate\Support\Facades\DB::table('employee_schedule')
            ->where('employee_id', $emp->id);
            
        if (!empty($data['date'])) {
            $query->where('date', $data['date']);
        } else {
            $query->where('day_of_week', $data['day_of_week'])->whereNull('date');
        }
        $query->delete();

        // Jika schedule_id dikirim (bukan null), pasang penugasan shift baru ke tabel pivot
        $scheduleName = 'Libur (Tidak Ada Shift)';
        if ($data['schedule_id']) {
            $pivotData = [];
            if (!empty($data['date'])) {
                $pivotData['date'] = $data['date'];
            } else {
                $pivotData['day_of_week'] = $data['day_of_week'];
            }
            $emp->schedules()->attach($data['schedule_id'], $pivotData);
            $scheduleObj = \App\Models\Schedule::find($data['schedule_id']);
            if ($scheduleObj) {
                $scheduleName = $scheduleObj->name;
            }
        }

        $updater = $request->user()->role === 'pj_bagian' ? 'Penanggung Jawab Bagian' : 'Administrator';
        $targetLabel = !empty($data['date']) ? $data['date'] : $data['day_of_week'];

        // Kirim notifikasi sistem secara langsung ke user pegawai yang bersangkutan
        \App\Models\Notification::create([
            'user_id' => $emp->user_id,
            'title'   => 'Jadwal Shift Diperbarui',
            'body'    => 'Jadwal dinas Anda untuk tanggal/hari ' . $targetLabel . ' telah diperbarui menjadi "' . $scheduleName . '" oleh ' . $updater . '.',
            'type'    => 'system',
            'data'    => ['employee_id' => $emp->id, 'day_of_week' => $data['day_of_week'] ?? null, 'date' => $data['date'] ?? null],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Jadwal karyawan berhasil diperbarui.'
        ]);
    }

    /**
     * POST /api/employee-schedules/assign-department
     * 
     * Menugaskan atau memperbarui jadwal shift seluruh pegawai dalam satu departemen sekaligus.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function assignDepartmentSchedule(Request $request)
    {
        $data = $request->validate([
            'department_id' => 'required|exists:departments,id',
            'day_of_week'   => 'nullable|string|in:Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu',
            'date'          => 'nullable|date',
            'schedule_id'   => 'nullable|exists:schedules,id',
        ]);

        if (empty($data['day_of_week']) && empty($data['date'])) {
            return response()->json(['success' => false, 'message' => 'Hari (day_of_week) atau Tanggal (date) wajib ditentukan.'], 422);
        }

        if ($request->user()->role === 'pj_bagian' && (int)$data['department_id'] !== (int)$request->user()->pj_bagian_department_id) {
            return response()->json(['success' => false, 'message' => 'Anda hanya dapat mengatur jadwal departemen Anda sendiri.'], 403);
        }

        $employees = \App\Models\Employee::where('department_id', $data['department_id'])
            ->where('status', 'active')
            ->get();

        $scheduleName = 'Libur (Tidak Ada Shift)';
        if ($data['schedule_id']) {
            $scheduleObj = \App\Models\Schedule::find($data['schedule_id']);
            if ($scheduleObj) {
                $scheduleName = $scheduleObj->name;
            }
        }

        $updater = $request->user()->role === 'pj_bagian' ? 'Penanggung Jawab Bagian' : 'Administrator';
        $targetLabel = !empty($data['date']) ? $data['date'] : $data['day_of_week'];

        foreach ($employees as $emp) {
            // Hapus penugasan shift lama pegawai pada hari kerja yang sama
            $query = \Illuminate\Support\Facades\DB::table('employee_schedule')
                ->where('employee_id', $emp->id);
                
            if (!empty($data['date'])) {
                $query->where('date', $data['date']);
            } else {
                $query->where('day_of_week', $data['day_of_week'])->whereNull('date');
            }
            $query->delete();

            if ($data['schedule_id']) {
                $pivotData = [];
                if (!empty($data['date'])) {
                    $pivotData['date'] = $data['date'];
                } else {
                    $pivotData['day_of_week'] = $data['day_of_week'];
                }
                $emp->schedules()->attach($data['schedule_id'], $pivotData);
            }

            // Kirim notifikasi sistem secara langsung ke user pegawai
            \App\Models\Notification::create([
                'user_id' => $emp->user_id,
                'title'   => 'Jadwal Shift Diperbarui',
                'body'    => 'Jadwal dinas Anda untuk tanggal/hari ' . $targetLabel . ' telah diperbarui menjadi "' . $scheduleName . '" oleh ' . $updater . '.',
                'type'    => 'system',
                'data'    => ['employee_id' => $emp->id, 'day_of_week' => $data['day_of_week'] ?? null, 'date' => $data['date'] ?? null],
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Jadwal departemen berhasil diperbarui.'
        ]);
    }
}
