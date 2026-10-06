<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\AbsenceReconciliationService;

class MarkAbsentEmployees extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:mark-absent {date?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Mark active employees who missed check-in as absent (alpha)';

    /**
     * Execute the console command.
     */
    public function handle(AbsenceReconciliationService $absenceService): int
    {
        $date = $this->argument('date');
        $count = $date
            ? $absenceService->reconcileDate($date)
            : $absenceService->reconcileOutstanding() + $absenceService->reconcileDate(today('Asia/Jakarta'));

        $this->info("Selesai. {$count} data Alpha baru tersimpan.");

        return self::SUCCESS;
    }
}
