<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\Schedule;
use Illuminate\Support\Facades\DB;

class PjScheduleRules
{
    /**
     * Cari sub-shift kantor standar untuk seluruh PJ Bagian:
     * Senin-Jumat memakai shift normal dan Sabtu memakai shift Sabtu biasa.
     * Sub-shift yang bertuliskan "khusus" tidak pernah dipilih sebagai standar.
     *
     * @return array{weekday: Schedule, saturday: Schedule}|null
     */
    public static function standardShifts(): ?array
    {
        $parents = Schedule::with('children')
            ->whereNull('parent_id')
            ->where(function ($query) {
                $query->where('status', 'approved')->orWhereNull('status');
            })
            ->get()
            ->sortByDesc(function (Schedule $schedule) {
                $name = strtolower($schedule->name ?? '');
                $score = 0;
                if (str_contains($name, 'administrasi')) $score += 4;
                if (str_contains($name, 'staff office') || str_contains($name, 'office')) $score += 3;
                if ($schedule->owner_department_id === null) $score += 2;
                return $score;
            });

        foreach ($parents as $parent) {
            $children = $parent->children;

            $weekday = $children->first(function (Schedule $child) {
                $name = strtolower($child->name ?? '');
                return !str_contains($name, 'sabtu')
                    && !str_contains($name, 'minggu')
                    && !str_contains($name, 'khusus')
                    && (str_contains($name, 'normal')
                        || str_contains($name, 'senin')
                        || str_contains($name, 'jumat'));
            });

            $saturday = $children->first(function (Schedule $child) {
                $name = strtolower($child->name ?? '');
                return str_contains($name, 'sabtu') && !str_contains($name, 'khusus');
            });

            if ($weekday && $saturday) {
                return ['weekday' => $weekday, 'saturday' => $saturday];
            }
        }

        return null;
    }

    /**
     * Samakan jadwal seorang PJ dengan pola kantor standar.
     * Data penugasan lama (mingguan maupun tanggal khusus) dibersihkan supaya
     * shift khusus tidak tetap mengambil prioritas di aplikasi HP.
     */
    public static function syncStandardSchedule(Employee $employee): bool
    {
        $standard = self::standardShifts();
        if (!$standard) {
            return false;
        }

        DB::transaction(function () use ($employee, $standard) {
            DB::table('employee_schedule')
                ->where('employee_id', $employee->id)
                ->delete();

            $now = now();
            $rows = [];
            foreach (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'] as $day) {
                $rows[] = [
                    'employee_id' => $employee->id,
                    'schedule_id' => $standard['weekday']->id,
                    'day_of_week' => $day,
                    'work_date' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            $rows[] = [
                'employee_id' => $employee->id,
                'schedule_id' => $standard['saturday']->id,
                'day_of_week' => 'Sabtu',
                'work_date' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            DB::table('employee_schedule')->insert($rows);
        });

        return true;
    }
}
