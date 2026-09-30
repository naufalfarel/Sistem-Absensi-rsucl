<?php

use App\Models\Employee;
use App\Support\PjScheduleRules;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Employee::whereHas('user', function ($query) {
            $query->where('role', 'pj_bagian');
        })->each(function (Employee $employee) {
            PjScheduleRules::syncStandardSchedule($employee);
        });
    }

    public function down(): void
    {
        // Jadwal lama tidak dapat dipulihkan dengan aman.
    }
};
