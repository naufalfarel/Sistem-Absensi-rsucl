<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\User;
use App\Support\LiburJagaSchedule;
use App\Support\AttendanceRules;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LiburJagaScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_duplicate_department_lj_schedules_are_merged_without_losing_assignments(): void
    {
        $departmentA = Department::create(['name' => 'Kamar Bersalin', 'count_sunday_in_leave' => true]);
        $departmentB = Department::create(['name' => 'Rawat Inap', 'count_sunday_in_leave' => true]);
        $user = User::factory()->create(['role' => 'employee']);
        $employee = Employee::create([
            'user_id' => $user->id,
            'department_id' => $departmentA->id,
            'nik_ktp' => 'LJ-MERGE-001',
            'status' => 'active',
        ]);

        [$parentA, $childA] = $this->createDuplicateLJ($departmentA->id);
        [$parentB, $childB] = $this->createDuplicateLJ($departmentB->id);

        DB::table('employee_schedule')->insert([
            [
                'employee_id' => $employee->id,
                'schedule_id' => $parentA->id,
                'day_of_week' => 'Minggu',
                'work_date' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'employee_id' => $employee->id,
                'schedule_id' => $childB->id,
                'day_of_week' => 'Minggu',
                'work_date' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $attendance = Attendance::create([
            'employee_id' => $employee->id,
            'schedule_id' => $childA->id,
            'date' => '2026-09-27',
            'status' => 'alpha',
        ]);

        $canonical = LiburJagaSchedule::consolidate();
        $parent = $canonical['parent'];
        $child = $canonical['child'];

        $this->assertNull($parent->owner_department_id);
        $this->assertSame('Libur Jaga (LJ)', $parent->name);
        $this->assertSame('00:00:00', $child->start_time);
        $this->assertSame('00:00:00', $child->end_time);
        $this->assertCount(1, $parent->fresh('children')->children);

        $this->assertDatabaseCount('employee_schedule', 1);
        $this->assertDatabaseHas('employee_schedule', [
            'employee_id' => $employee->id,
            'schedule_id' => $child->id,
            'day_of_week' => 'Minggu',
        ]);
        $this->assertSame($child->id, $attendance->fresh()->schedule_id);

        $this->assertDatabaseMissing('schedules', ['id' => $parentA->id]);
        $this->assertDatabaseMissing('schedules', ['id' => $parentB->id]);
    }

    public function test_repeated_create_requests_return_the_same_global_lj_master(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $payload = [
            'name' => 'Libur Jaga (LJ)',
            'start_time' => '08:00',
            'end_time' => '16:00',
            'color' => '#D97706',
            'icon' => 'moon',
            'shift_type' => 'normal',
        ];

        $firstId = $this->postJson('/api/schedules', $payload)
            ->assertOk()
            ->json('data.id');
        $secondId = $this->postJson('/api/schedules', $payload)
            ->assertOk()
            ->json('data.id');

        $this->assertSame($firstId, $secondId);
        $this->assertSame(1, Schedule::whereNull('parent_id')
            ->whereRaw('LOWER(name) LIKE ?', ['%libur jaga%'])
            ->count());
    }

    public function test_global_lj_parent_resolves_correctly_on_sunday(): void
    {
        $department = Department::create(['name' => 'Rawat Inap', 'count_sunday_in_leave' => true]);
        $user = User::factory()->create(['role' => 'employee']);
        $employee = Employee::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'nik_ktp' => 'LJ-SUNDAY-001',
            'status' => 'active',
        ]);
        $canonical = LiburJagaSchedule::ensureCanonical();

        $employee->schedules()->attach($canonical['parent']->id, ['day_of_week' => 'Minggu']);

        $resolved = AttendanceRules::resolveAllShiftsFor($employee, Carbon::parse('2026-09-27'));

        $this->assertCount(1, $resolved);
        $this->assertSame($canonical['child']->id, $resolved[0]->id);
        $this->assertTrue(LiburJagaSchedule::isName($resolved[0]->name));
    }

    /** @return array{Schedule, Schedule} */
    private function createDuplicateLJ(int $departmentId): array
    {
        $parent = Schedule::create([
            'name' => 'Libur Jaga (LJ)',
            'start_time' => '08:00:00',
            'end_time' => '16:00:00',
            'color' => '#D97706',
            'icon' => 'moon',
            'shift_type' => 'normal',
            'owner_department_id' => $departmentId,
            'status' => 'approved',
        ]);
        $child = Schedule::create([
            'parent_id' => $parent->id,
            'name' => 'Normal (08:00–16:00)',
            'start_time' => '08:00:00',
            'end_time' => '16:00:00',
            'color' => '#D97706',
            'icon' => 'moon',
            'shift_type' => 'normal',
            'owner_department_id' => $departmentId,
            'status' => 'approved',
        ]);

        return [$parent, $child];
    }
}
