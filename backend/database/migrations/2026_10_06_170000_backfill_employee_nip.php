<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const MEDICAL_KEYWORDS = [
        'dokter', 'perawat', 'bidan', 'apoteker', 'farmasi', 'analis lab',
        'laboratorium', 'radiografer', 'radiologi', 'fisioterapi',
        'nutrisionis', 'ahli gizi', 'rekam medis',
    ];

    public function up(): void
    {
        DB::table('employees')->update(['nip' => null]);

        $employees = DB::table('employees')
            ->leftJoin('positions', 'positions.id', '=', 'employees.position_id')
            ->select('employees.id', 'employees.join_date', 'employees.created_at', 'positions.name as position_name')
            ->orderByRaw('employees.join_date IS NULL')
            ->orderBy('employees.join_date')
            ->orderBy('employees.id')
            ->get();

        foreach ($employees as $index => $employee) {
            $date = $employee->join_date ?: $employee->created_at ?: now('Asia/Jakarta');
            $year = \Carbon\Carbon::parse($date)->format('y');
            $statusCode = $this->isMedicalPosition($employee->position_name) ? '01' : '02';
            $sequence = str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT);

            DB::table('employees')->where('id', $employee->id)->update([
                'nip' => $year.$statusCode.$sequence,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('employees')->update(['nip' => null]);
    }

    private function isMedicalPosition(?string $positionName): bool
    {
        $normalizedName = mb_strtolower(trim((string) $positionName));

        foreach (self::MEDICAL_KEYWORDS as $keyword) {
            if (str_contains($normalizedName, $keyword)) {
                return true;
            }
        }

        return false;
    }
};
