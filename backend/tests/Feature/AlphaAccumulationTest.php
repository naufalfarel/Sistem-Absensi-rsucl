<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Schedule;
use App\Models\User;
use App\Services\AbsenceReconciliationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AlphaAccumulationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_employee_becomes_alpha_only_after_the_checkin_window_closes(): void
    {
        $employee = $this->createScheduledEmployee();
        $service = app(AbsenceReconciliationService::class);

        Carbon::setTestNow(Carbon::parse('2026-10-06 10:00:00', 'Asia/Jakarta'));
        $this->assertSame(0, $service->reconcileDate('2026-10-06'));
        $this->assertDatabaseMissing('attendance', [
            'employee_id' => $employee->id,
            'date' => '2026-10-06',
            'status' => 'alpha',
        ]);

        Carbon::setTestNow(Carbon::parse('2026-10-06 13:00:00', 'Asia/Jakarta'));
        $this->assertSame(1, $service->reconcileDate('2026-10-06'));
        $this->assertSame(0, $service->reconcileDate('2026-10-06'));
        $this->assertDatabaseHas('attendance', [
            'employee_id' => $employee->id,
            'date' => '2026-10-06',
            'status' => 'alpha',
        ]);
    }

    public function test_dashboard_summary_persists_and_accumulates_alpha(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-06 13:00:00', 'Asia/Jakarta'));
        $employee = $this->createScheduledEmployee();
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/reports/summary?month=10&year=2026')
            ->assertOk()
            ->assertJsonPath('data.today.alpha', 1)
            ->assertJsonPath('data.this_month.alpha', 1);

        $this->assertSame(1, Attendance::where('employee_id', $employee->id)
            ->whereDate('date', '2026-10-06')
            ->where('status', 'alpha')
            ->count());

        $this->getJson('/api/reports/summary?month=10&year=2026')
            ->assertOk()
            ->assertJsonPath('data.today.alpha', 1)
            ->assertJsonPath('data.this_month.alpha', 1);

        $this->assertDatabaseCount('attendance', 1);
    }

    public function test_approved_leave_and_off_shift_are_not_counted_as_alpha(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-06 13:00:00', 'Asia/Jakarta'));
        $workingEmployee = $this->createScheduledEmployee();
        $leaveEmployee = $this->createScheduledEmployee();
        LeaveRequest::create([
            'employee_id' => $leaveEmployee->id,
            'type' => 'cuti',
            'start_date' => '2026-10-06',
            'end_date' => '2026-10-06',
            'reason' => 'Cuti disetujui',
            'status' => 'approved',
        ]);
        $offEmployee = $this->createScheduledEmployee('Libur / OFF');

        $this->assertSame(1, app(AbsenceReconciliationService::class)->reconcileDate('2026-10-06'));
        $this->assertDatabaseHas('attendance', [
            'employee_id' => $workingEmployee->id,
            'status' => 'alpha',
        ]);
        $this->assertDatabaseMissing('attendance', ['employee_id' => $leaveEmployee->id]);
        $this->assertDatabaseMissing('attendance', ['employee_id' => $offEmployee->id]);
    }

    private function createScheduledEmployee(string $scheduleName = 'Shift Pagi'): Employee
    {
        $department = Department::create(['name' => 'Rawat Jalan']);
        $user = User::factory()->create(['role' => 'employee']);
        $employee = Employee::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'nik_ktp' => 'ALPHA-'.uniqid(),
            'join_date' => '2026-01-01',
            'status' => 'active',
        ]);
        $schedule = Schedule::create([
            'name' => $scheduleName,
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'checkin_window_end_time' => '12:30:00',
            'color' => '#16A34A',
            'icon' => 'sun',
            'shift_type' => 'normal',
            'status' => 'approved',
        ]);
        $employee->schedules()->attach($schedule->id, [
            'day_of_week' => 'Selasa',
            'work_date' => null,
        ]);

        return $employee;
    }
}
