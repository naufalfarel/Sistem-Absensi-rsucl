<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Support\HolidaySyncer;

class SyncHolidays extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:sync-holidays {year?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync Indonesian national holidays from online GitHub repository';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $year = $this->argument('year') ?: now()->year;
        $this->info("Syncing holidays for year: {$year}...");
        
        try {
            $count = HolidaySyncer::sync((int)$year);
            // Juga sync tahun berikutnya secara otomatis jika tidak menspesifikasikan tahun tertentu
            if (!$this->argument('year')) {
                $nextYear = (int)$year + 1;
                $this->info("Syncing holidays for next year: {$nextYear}...");
                $count += HolidaySyncer::sync($nextYear);
            }
            $this->info("Successfully synced {$count} holidays.");
        } catch (\Exception $e) {
            $this->error("Failed to sync holidays: " . $e->getMessage());
        }
    }
}
