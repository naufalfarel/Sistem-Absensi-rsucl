<?php

namespace App\Services;

use App\Models\Employee;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class EmployeeNipService
{
    private const MEDICAL_KEYWORDS = [
        'dokter',
        'perawat',
        'bidan',
        'apoteker',
        'farmasi',
        'analis lab',
        'laboratorium',
        'radiografer',
        'radiologi',
        'fisioterapi',
        'nutrisionis',
        'ahli gizi',
        'rekam medis',
    ];

    public function generate(string|CarbonInterface $joinDate, ?string $positionName): string
    {
        $sequence = Employee::withTrashed()
            ->whereNotNull('nip')
            ->lockForUpdate()
            ->pluck('nip')
            ->reduce(function (int $highest, string $nip): int {
                $sequence = $this->sequenceFromNip($nip);

                return $sequence === null ? $highest : max($highest, $sequence);
            }, 0) + 1;

        return $this->format($joinDate, $positionName, $sequence);
    }

    public function format(string|CarbonInterface $joinDate, ?string $positionName, int $sequence): string
    {
        $year = ($joinDate instanceof CarbonInterface ? $joinDate : Carbon::parse($joinDate))->format('y');
        $statusCode = $this->isMedicalPosition($positionName) ? '01' : '02';

        return $year.$statusCode.str_pad((string) $sequence, 3, '0', STR_PAD_LEFT);
    }

    public function isMedicalPosition(?string $positionName): bool
    {
        $normalizedName = mb_strtolower(trim((string) $positionName));

        foreach (self::MEDICAL_KEYWORDS as $keyword) {
            if (str_contains($normalizedName, $keyword)) {
                return true;
            }
        }

        return false;
    }

    private function sequenceFromNip(string $nip): ?int
    {
        if (! preg_match('/^\d{4}(\d+)$/', $nip, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }
}
