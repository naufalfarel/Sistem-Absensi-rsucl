<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('departments') || ! Schema::hasColumn('departments', 'count_sunday_in_leave')) {
            return;
        }

        // Keep this list additive: this migration must never turn a unit that was
        // already configured as a Sunday-counted/shift unit back into a regular unit.
        $shiftPatterns = [
            '/^(?:farmasi )?depo(?: farmasi)?(?: \d+| poli eksekutif)?$/',
            '/^(?:laboratorium|radiologi)(?: .+)?$/',
            '/^(?:rawat inap|ranap)(?: .+)?$/',
            '/^(?:icu|nicu|igd|igp)(?: .+)?$/',
            '/^gawat darurat$/',
            '/^(?:rekam medis|rm) (?:igd|igp)$/',
            '/^(?:bedah (?:sentral|central)|ibs|cssd)$/',
        ];

        // The historical seed used ward names without the "Rawat Inap" prefix.
        $shiftNames = [
            'jeumpa a',
            'jeumpa b',
            'seulanga',
            'meulu',
            'kupula',
        ];

        $departments = DB::table('departments')->get(['id', 'name']);

        foreach ($departments as $department) {
            $normalizedName = self::normalizeName((string) $department->name);
            $normalizedName = (string) preg_replace('/^(?:(?:unit|instalasi|instasi|instansi) )+/', '', $normalizedName);
            $isShiftUnit = in_array($normalizedName, $shiftNames, true);

            if (! $isShiftUnit) {
                foreach ($shiftPatterns as $pattern) {
                    if (preg_match($pattern, $normalizedName) === 1) {
                        $isShiftUnit = true;
                        break;
                    }
                }
            }

            if ($isShiftUnit) {
                DB::table('departments')
                    ->where('id', $department->id)
                    ->update(['count_sunday_in_leave' => true]);
            }
        }

        $hasPoliGigi = $departments->contains(
            fn (object $department): bool => self::normalizeName((string) $department->name) === 'poli gigi'
        );

        if (! $hasPoliGigi) {
            DB::table('departments')->insert([
                'name' => 'Poli Gigi',
                'count_sunday_in_leave' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Data-only correction. Reverting must not erase an operational unit or
        // disable flags that an administrator may have changed after deployment.
    }

    private static function normalizeName(string $name): string
    {
        return strtolower(trim((string) preg_replace('/\s+/', ' ', $name)));
    }
};
