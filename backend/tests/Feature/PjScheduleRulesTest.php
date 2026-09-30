<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\User;
use App\Support\AttendanceRules;
use App\Support\PjScheduleRules;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PjScheduleRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_parent_office_shift_selects_only_the_correct_child_for_the_day(): void
    {
        $department = Department::create(['name' => 'Administrasi']);
        $user = User::factory()->create(['role' => 'employee']);
        $employee = $this->createEmployee($user, $department, 'PJ-RULE-001');
        [$parent, $weekday, $saturday] = $this->createOfficeSchedule();

        $employee->schedules()->attach($parent->id, ['day_of_week' => 'Senin']);
        $employee->schedules()->attach($parent->id, ['day_of_week' => 'Sabtu']);

        $mondayShifts = AttendanceRules::resolveAllShiftsFor($employee, Carbon::parse('2026-09-28'));
        $saturdayShifts = AttendanceRules::resolveAllShiftsFor($employee, Carbon::parse('2026-10-03'));

        $this->assertSame([$weekday->id], collect($mondayShifts)->pluck('id')->all());
        $this->assertSame([$saturday->id], collect($saturdayShifts)->pluck('id')->all());
        $this->assertFalse(collect($mondayShifts)->contains(fn($shift) => str_contains(strtolower($shift->name), 'minggu')));
        $this->assertFalse(collect($saturdayShifts)->contains(fn($shift) => str_contains(strtolower($shift->name), 'khusus')));
    }

    public function test_standard_sync_makes_all_pj_weekdays_normal_and_saturday_regular(): void
    {
        $department = Department::create(['name' => 'Administrasi']);
        $pjUser = User::factory()->create(['role' => 'pj_bagian']);
        $pj = $this->createEmployee($pjUser, $department, 'PJ-RULE-002');
        [, $weekday, $saturday, $sundaySpecial] = $this->createOfficeSchedule();

        DB::table('employee_schedule')->insert([
            'employee_id' => $pj->id,
            'schedule_id' => $sundaySpecial->id,
            'day_of_week' => null,
            'work_date' => '2026-09-28',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue(PjScheduleRules::syncStandardSchedule($pj));

        $rows = DB::table('employee_schedule')
            ->where('employee_id', $pj->id)
            ->orderBy('id')
            ->get();

        $this->assertCount(6, $rows);
        $this->assertSame($weekday->id, (int) $rows->firstWhere('day_of_week', 'Senin')->schedule_id);
        $this->assertSame($saturday->id, (int) $rows->firstWhere('day_of_week', 'Sabtu')->schedule_id);
        $this->assertFalse($rows->contains(fn($row) => $row->day_of_week === 'Minggu'));
        $this->assertFalse($rows->contains(fn($row) => $row->work_date !== null));
    }

    public function test_pj_cannot_change_another_pj_schedule_but_admin_can(): void
    {
        $department = Department::create(['name' => 'Administrasi']);
        $actor = User::factory()->create([
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $department->id,
        ]);
        $this->createEmployee($actor, $department, 'PJ-RULE-003');

        $targetUser = User::factory()->create(['role' => 'pj_bagian']);
        $target = $this->createEmployee($targetUser, $department, 'PJ-RULE-004');
        [, $weekday] = $this->createOfficeSchedule();

        Sanctum::actingAs($actor);
        $this->postJson('/api/employee-schedules/assign', [
            'employee_id' => $target->id,
            'day_of_week' => 'Senin',
            'schedule_id' => $weekday->id,
        ])->assertForbidden()->assertJsonPath('message', 'Jadwal PJ Bagian hanya dapat diubah oleh Administrator.');

        $this->assertDatabaseMissing('employee_schedule', [
            'employee_id' => $target->id,
            'day_of_week' => 'Senin',
        ]);

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);
        $this->postJson('/api/employee-schedules/assign', [
            'employee_id' => $target->id,
            'day_of_week' => 'Senin',
            'schedule_id' => $weekday->id,
        ])->assertOk();

        $this->assertDatabaseHas('employee_schedule', [
            'employee_id' => $target->id,
            'schedule_id' => $weekday->id,
            'day_of_week' => 'Senin',
        ]);
    }

    public function test_pj_cannot_override_pj_schedule_by_specific_date_or_emergency(): void
    {
        $department = Department::create(['name' => 'Administrasi']);
        $actor = User::factory()->create([
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $department->id,
        ]);
        $this->createEmployee($actor, $department, 'PJ-RULE-005');

        $targetUser = User::factory()->create(['role' => 'pj_bagian']);
        $target = $this->createEmployee($targetUser, $department, 'PJ-RULE-006');
        [, $weekday] = $this->createOfficeSchedule();

        Sanctum::actingAs($actor);

        $this->postJson('/api/employee-schedules/assign-date', [
            'employee_id' => $target->id,
            'work_date' => '2026-09-28',
            'schedule_id' => $weekday->id,
        ])->assertForbidden();

        $this->postJson('/api/employee-schedules/assign-emergency', [
            'employee_id' => $target->id,
            'work_date' => '2026-09-28',
            'schedule_id' => $weekday->id,
        ])->assertForbidden();

        $this->assertDatabaseMissing('employee_schedule', [
            'employee_id' => $target->id,
            'work_date' => '2026-09-28',
        ]);
    }

    private function createEmployee(User $user, Department $department, string $nik): Employee
    {
        return Employee::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'nik_ktp' => $nik,
            'status' => 'active',
        ]);
    }

    /**
     * @return array{Schedule, Schedule, Schedule, Schedule}
     */
    private function createOfficeSchedule(): array
    {
        $parent = Schedule::create([
            'name' => 'Administrasi/staff office (08:30-17:00)',
            'start_time' => '08:30:00',
            'end_time' => '17:00:00',
            'color' => '#16A34A',
            'icon' => 'sun',
            'status' => 'approved',
        ]);

        $makeChild = fn(string $name, string $start, string $end) => Schedule::create([
            'parent_id' => $parent->id,
            'name' => $name,
            'start_time' => $start,
            'end_time' => $end,
            'color' => '#16A34A',
            'icon' => 'sun',
            'status' => 'approved',
        ]);

        $weekday = $makeChild('Normal Senin s/d Jumat (08:30-17:00)', '08:30:00', '17:00:00');
        $saturday = $makeChild('Sabtu', '08:30:00', '13:00:00');
        $makeChild('Sabtu khusus', '13:00:00', '17:00:00');
        $sundaySpecial = $makeChild('Minggu Khusus', '08:00:00', '13:00:00');

        return [$parent, $weekday, $saturday, $sundaySpecial];
    }
}
