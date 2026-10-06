<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use App\Models\Employee;
use App\Services\EmployeeNipService;
use Illuminate\Support\Facades\DB;

#[Signature('app:generate-nip {--rebuild : Susun ulang seluruh NIP berdasarkan tanggal masuk paling lama}')]
#[Description('Generate NIP pegawai dengan nomor urut global medis dan nonmedis')]
class GenerateNipCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(EmployeeNipService $nipService): int
    {
        $rebuild = (bool) $this->option('rebuild');
        $generated = 0;

        DB::transaction(function () use ($nipService, $rebuild, &$generated): void {
            $employees = Employee::withTrashed()
                ->with(['position', 'user'])
                ->orderByRaw('join_date IS NULL')
                ->orderBy('join_date')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            if ($rebuild) {
                Employee::withTrashed()->update(['nip' => null]);
            }

            $sequence = 0;
            foreach ($employees as $employee) {
                if (! $rebuild && $employee->nip) {
                    continue;
                }

                $joinDate = $employee->join_date ?? $employee->created_at ?? now('Asia/Jakarta');
                $nip = $rebuild
                    ? $nipService->format($joinDate, $employee->position?->name, ++$sequence)
                    : $nipService->generate($joinDate, $employee->position?->name);

                $employee->nip = $nip;
                $employee->save();
                $generated++;
                $this->line(($employee->user?->name ?? "Pegawai #{$employee->id}").": {$nip}");
            }
        });

        $this->info("Selesai. {$generated} NIP dibuat.");

        return self::SUCCESS;
    }
}
