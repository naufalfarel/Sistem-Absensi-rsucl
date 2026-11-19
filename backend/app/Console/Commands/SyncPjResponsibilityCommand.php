<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class SyncPjResponsibilityCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'pj:sync-responsibility 
                            {--dry-run : Simulate sync without committing changes to database}
                            {--seed-missing : Create or seed the PJ accounts if they do not exist locally}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Synchronize PJ Bagian assignments (Fauzan -> Jeumpa B & Transit, Yuni -> Seulanga)';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');
        $seedMissing = (bool) $this->option('seed-missing');

        $this->info($isDryRun ? '--- SIMULATION MODE (--dry-run) ---' : '--- SYNCHRONIZING PJ RESPONSIBILITIES ---');

        // 1. Resolve Departments
        $deptJeumpaB = Department::where('name', 'like', '%Jeumpa B%')
            ->orWhere('id', 23)
            ->first();

        $deptTransit = Department::where('name', 'like', '%Transit%')
            ->orWhere('id', 27)
            ->first();

        $deptSeulanga = Department::where('name', 'like', '%Seulanga%')
            ->orWhere('id', 24)
            ->first();

        if (!$deptJeumpaB || !$deptTransit || !$deptSeulanga) {
            $this->error('One or more required departments could not be found:');
            $this->line('- Jeumpa B: ' . ($deptJeumpaB ? "Found (ID: {$deptJeumpaB->id})" : 'NOT FOUND'));
            $this->line('- Transit:   ' . ($deptTransit ? "Found (ID: {$deptTransit->id})" : 'NOT FOUND'));
            $this->line('- Seulanga:  ' . ($deptSeulanga ? "Found (ID: {$deptSeulanga->id})" : 'NOT FOUND'));
            return Command::FAILURE;
        }

        $this->info("Target departments identified:");
        $this->line("- Jeumpa B: [ID: {$deptJeumpaB->id}] {$deptJeumpaB->name}");
        $this->line("- Transit:   [ID: {$deptTransit->id}] {$deptTransit->name}");
        $this->line("- Seulanga:  [ID: {$deptSeulanga->id}] {$deptSeulanga->name}");
        $this->newLine();

        // 2. Resolve Users
        $userFauzan = User::where('name', 'like', '%Fauzan%')
            ->orWhere('username', 'like', '%fauzan%')
            ->first();

        $userYuni = User::where('name', 'like', '%Yuni%')
            ->orWhere('username', 'like', '%yuni%')
            ->first();

        if (!$userFauzan) {
            if ($seedMissing) {
                $this->warn('User Fauzan not found. Creating user "Ns. M. Fauzan Ilhami, S.Kep"...');
                $userFauzan = User::create([
                    'name' => 'Ns. M. Fauzan Ilhami, S.Kep',
                    'username' => 'fauzan',
                    'email' => 'fauzan@rsucl.test',
                    'password' => Hash::make('password'),
                    'role' => 'pj_bagian',
                    'nik_ktp' => '1171010101010001',
                    'pj_bagian_department_id' => $deptJeumpaB->id,
                ]);
                Employee::create([
                    'user_id' => $userFauzan->id,
                    'department_id' => $deptSeulanga->id, // Base unit is Seulanga to test separation
                    'nik_ktp' => '1171010101010001',
                    'nip' => 'RSUCL-PJ-001',
                    'status' => 'active',
                ]);
                $this->info("Created user and employee for Fauzan (User ID: {$userFauzan->id}).");
            } else {
                $this->error('User Ns. M. Fauzan Ilhami could not be found in users table.');
                $this->comment('Tip: Use --seed-missing to automatically create local PJ test accounts.');
                return Command::FAILURE;
            }
        }

        if (!$userYuni) {
            if ($seedMissing) {
                $this->warn('User Yuni not found. Creating user "Yuni Asnidar, A.Md.Kep"...');
                $userYuni = User::create([
                    'name' => 'Yuni Asnidar, A.Md.Kep',
                    'username' => 'yuni',
                    'email' => 'yuni@rsucl.test',
                    'password' => Hash::make('password'),
                    'role' => 'pj_bagian',
                    'nik_ktp' => '1171010101010002',
                    'pj_bagian_department_id' => $deptSeulanga->id,
                ]);
                Employee::create([
                    'user_id' => $userYuni->id,
                    'department_id' => $deptJeumpaB->id, // Base unit is Jeumpa B to test separation
                    'nik_ktp' => '1171010101010002',
                    'nip' => 'RSUCL-PJ-002',
                    'status' => 'active',
                ]);
                $this->info("Created user and employee for Yuni (User ID: {$userYuni->id}).");
            } else {
                $this->error('User Yuni Asnidar could not be found in users table.');
                $this->comment('Tip: Use --seed-missing to automatically create local PJ test accounts.');
                return Command::FAILURE;
            }
        }

        $targets = [
            [
                'user' => $userFauzan,
                'target_depts' => [$deptJeumpaB->id, $deptTransit->id],
                'target_dept_names' => [$deptJeumpaB->name, $deptTransit->name],
                'primary_dept_id' => $deptJeumpaB->id,
            ],
            [
                'user' => $userYuni,
                'target_depts' => [$deptSeulanga->id],
                'target_dept_names' => [$deptSeulanga->name],
                'primary_dept_id' => $deptSeulanga->id,
            ],
        ];

        $report = [];

        DB::beginTransaction();
        try {
            foreach ($targets as $target) {
                /** @var User $user */
                $user = $target['user'];
                $oldPivotIds = $user->pjDepartments()->pluck('departments.id')->toArray();
                $oldPrimary = $user->pj_bagian_department_id;
                $targetDeptIds = $target['target_depts'];
                $primaryId = $target['primary_dept_id'];

                $report[] = [
                    'Name' => $user->name,
                    'Username' => $user->username,
                    'Current Primary' => $oldPrimary ?: '(none)',
                    'Current Pivots' => !empty($oldPivotIds) ? implode(', ', $oldPivotIds) : '(none)',
                    'New Primary' => $primaryId,
                    'New Pivots' => implode(', ', $targetDeptIds),
                ];

                if (!$isDryRun) {
                    // Update pivot
                    $user->pjDepartments()->sync($targetDeptIds);

                    // Update primary fallback & ensure role is pj_bagian
                    $user->update([
                        'role' => 'pj_bagian',
                        'pj_bagian_department_id' => $primaryId,
                    ]);
                }
            }

            if ($isDryRun) {
                DB::rollBack();
                $this->table(['Name', 'Username', 'Current Primary', 'Current Pivots', 'New Primary', 'New Pivots'], $report);
                $this->warn('Simulation complete. No database changes were applied.');
            } else {
                DB::commit();
                $this->table(['Name', 'Username', 'Current Primary', 'Current Pivots', 'New Primary', 'New Pivots'], $report);
                $this->info('Successfully synchronized PJ responsibilities in database.');
            }

            return Command::SUCCESS;
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Failed to sync PJ responsibilities: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
