<?php

namespace App\Support;

use App\Models\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LiburJagaSchedule
{
    public static function isName(?string $name): bool
    {
        $normalized = strtolower(trim($name ?? ''));
        return str_contains($normalized, 'libur jaga') || strtoupper(trim($name ?? '')) === 'LJ';
    }

    /**
     * Pastikan hanya ada satu master LJ global dan satu sub-shift LJ 00:00-00:00.
     *
     * @return array{parent: Schedule, child: Schedule}
     */
    public static function ensureCanonical(?int $createdBy = null): array
    {
        return DB::transaction(function () use ($createdBy) {
            $parent = Schedule::whereNull('parent_id')
                ->whereNull('owner_department_id')
                ->where(function ($query) {
                    $query->whereRaw('LOWER(name) LIKE ?', ['%libur jaga%'])
                        ->orWhereRaw('UPPER(name) = ?', ['LJ']);
                })
                ->orderByRaw("CASE WHEN name = 'Libur Jaga (LJ)' THEN 0 ELSE 1 END")
                ->orderBy('id')
                ->lockForUpdate()
                ->first();

            if (!$parent) {
                $parent = Schedule::create([
                    'name' => 'Libur Jaga (LJ)',
                    'start_time' => '00:00:00',
                    'end_time' => '00:00:00',
                    'color' => '#475569',
                    'icon' => 'moon',
                    'shift_type' => 'normal',
                    'owner_department_id' => null,
                    'created_by' => $createdBy,
                    'status' => 'approved',
                ]);
            } else {
                $parent->update([
                    'name' => 'Libur Jaga (LJ)',
                    'start_time' => '00:00:00',
                    'end_time' => '00:00:00',
                    'color' => '#475569',
                    'icon' => 'moon',
                    'shift_type' => 'normal',
                    'owner_department_id' => null,
                    'status' => 'approved',
                ]);
            }

            $child = $parent->children()
                ->where(function ($query) {
                    $query->whereRaw('LOWER(name) LIKE ?', ['%libur jaga%'])
                        ->orWhereRaw('UPPER(name) = ?', ['LJ']);
                })
                ->orderBy('id')
                ->first();

            if (!$child) {
                $child = Schedule::create([
                    'parent_id' => $parent->id,
                    'name' => 'Libur Jaga (00:00–00:00)',
                    'start_time' => '00:00:00',
                    'end_time' => '00:00:00',
                    'color' => '#475569',
                    'icon' => 'moon',
                    'shift_type' => 'normal',
                    'owner_department_id' => null,
                    'created_by' => $createdBy,
                    'status' => 'approved',
                ]);
            } else {
                $child->update([
                    'name' => 'Libur Jaga (00:00–00:00)',
                    'start_time' => '00:00:00',
                    'end_time' => '00:00:00',
                    'color' => '#475569',
                    'icon' => 'moon',
                    'shift_type' => 'normal',
                    'owner_department_id' => null,
                    'status' => 'approved',
                ]);
            }

            return ['parent' => $parent->fresh(), 'child' => $child->fresh()];
        });
    }

    /**
     * Gabungkan semua LJ per-unit ke master global dan pertahankan penugasannya.
     */
    public static function consolidate(?int $createdBy = null): array
    {
        return DB::transaction(function () use ($createdBy) {
            $canonical = self::ensureCanonical($createdBy);
            $parent = $canonical['parent'];
            $child = $canonical['child'];

            $ljParentIds = Schedule::whereNull('parent_id')
                ->where(function ($query) {
                    $query->whereRaw('LOWER(name) LIKE ?', ['%libur jaga%'])
                        ->orWhereRaw('UPPER(name) = ?', ['LJ']);
                })
                ->pluck('id');

            $ljChildIds = Schedule::whereIn('parent_id', $ljParentIds)->pluck('id');
            $allLJIds = $ljParentIds->merge($ljChildIds)->unique()->values();

            if ($allLJIds->isNotEmpty()) {
                DB::table('employee_schedule')
                    ->whereIn('schedule_id', $allLJIds)
                    ->update(['schedule_id' => $child->id, 'updated_at' => now()]);

                if (Schema::hasColumn('attendance', 'schedule_id')) {
                    DB::table('attendance')
                        ->whereIn('schedule_id', $allLJIds)
                        ->update(['schedule_id' => $child->id, 'updated_at' => now()]);
                }

                if (Schema::hasTable('shift_assignment_proposals')) {
                    DB::table('shift_assignment_proposals')
                        ->whereIn('schedule_id', $allLJIds)
                        ->update(['schedule_id' => $child->id, 'updated_at' => now()]);
                }
            }

            // Setelah beberapa ID LJ digabung, hilangkan baris pivot identik yang tersisa.
            $seen = [];
            $duplicatePivotIds = [];
            DB::table('employee_schedule')
                ->where('schedule_id', $child->id)
                ->orderBy('id')
                ->get()
                ->each(function ($row) use (&$seen, &$duplicatePivotIds) {
                    $key = implode('|', [
                        $row->employee_id,
                        $row->schedule_id,
                        $row->day_of_week ?? '',
                        $row->work_date ?? '',
                    ]);
                    if (isset($seen[$key])) {
                        $duplicatePivotIds[] = $row->id;
                    } else {
                        $seen[$key] = true;
                    }
                });

            if (!empty($duplicatePivotIds)) {
                DB::table('employee_schedule')->whereIn('id', $duplicatePivotIds)->delete();
            }

            $duplicateParentIds = $ljParentIds->reject(fn($id) => (int) $id === $parent->id);
            if ($duplicateParentIds->isNotEmpty()) {
                Schedule::whereIn('id', $duplicateParentIds)->delete();
            }

            // Bersihkan child tambahan yang mungkin pernah dibuat di parent global.
            $parent->children()->where('id', '!=', $child->id)->delete();

            return ['parent' => $parent->fresh('children'), 'child' => $child->fresh()];
        });
    }
}
