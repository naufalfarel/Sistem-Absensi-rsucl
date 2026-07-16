<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\User;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\Setting;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AttendanceServiceTest extends TestCase
{
    use RefreshDatabase;

    private AttendanceService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new AttendanceService();

        // Setup default setting for overtime grace minutes
        Setting::updateOrCreate(
            ['key' => 'overtime_grace_minutes'],
            ['value' => '15']
        );
    }

    public function testNormalCheckoutWithinGrace()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nip' => '123456',
            'status' => 'active',
        ]);

        $schedule = Schedule::create([
            'name' => 'Pagi',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
        ]);

        // Attach schedule for Tuesday (Selasa)
        // 2026-07-14 is a Tuesday
        $employee->schedules()->attach($schedule->id, ['day_of_week' => 'Selasa']);

        $shiftDate = Carbon::create(2026, 7, 14, 0, 0, 0, 'Asia/Jakarta');
        // Checkout at 17:10:00 (10 minutes late, within 15 mins grace)
        $checkoutTime = Carbon::create(2026, 7, 14, 17, 10, 0, 'Asia/Jakarta');

        $result = $this->service->hitungStatusLembur($employee, $checkoutTime, $shiftDate);

        $this->assertFalse($result['is_lembur']);
        $this->assertEquals(0, $result['durasi_lembur_menit']);
        $this->assertEquals('17:00:00', $result['jam_pulang_normal']);
    }

    public function testOvertimeCheckout()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nip' => '123456',
            'status' => 'active',
        ]);

        $schedule = Schedule::create([
            'name' => 'Pagi',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
        ]);

        $employee->schedules()->attach($schedule->id, ['day_of_week' => 'Selasa']);

        $shiftDate = Carbon::create(2026, 7, 14, 0, 0, 0, 'Asia/Jakarta');
        // Checkout at 18:30:00 (90 minutes late, past 15 mins grace)
        $checkoutTime = Carbon::create(2026, 7, 14, 18, 30, 0, 'Asia/Jakarta');

        $result = $this->service->hitungStatusLembur($employee, $checkoutTime, $shiftDate);

        $this->assertTrue($result['is_lembur']);
        $this->assertEquals(90, $result['durasi_lembur_menit']);
        $this->assertEquals('17:00:00', $result['jam_pulang_normal']);
    }

    public function testNightShiftOvertimeCheckout()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nip' => '123456',
            'status' => 'active',
        ]);

        $schedule = Schedule::create([
            'name' => 'Malam',
            'start_time' => '20:00:00',
            'end_time' => '05:00:00',
        ]);

        $employee->schedules()->attach($schedule->id, ['day_of_week' => 'Selasa']);

        $shiftDate = Carbon::create(2026, 7, 14, 0, 0, 0, 'Asia/Jakarta'); // Tuesday
        // Checkout next day (Wednesday) at 07:30:00
        $checkoutTime = Carbon::create(2026, 7, 15, 7, 30, 0, 'Asia/Jakarta');

        $result = $this->service->hitungStatusLembur($employee, $checkoutTime, $shiftDate);

        $this->assertTrue($result['is_lembur']);
        // From 05:00 to 07:30 is 150 minutes
        $this->assertEquals(150, $result['durasi_lembur_menit']);
        $this->assertEquals('05:00:00', $result['jam_pulang_normal']);
    }

    public function testNoShiftDefaultCheckout()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nip' => '123456',
            'status' => 'active',
        ]);

        // No schedule assigned for Tuesday
        $shiftDate = Carbon::create(2026, 7, 14, 0, 0, 0, 'Asia/Jakarta');
        // Checkout at 19:00:00 (120 minutes past fallback 17:00)
        $checkoutTime = Carbon::create(2026, 7, 14, 19, 0, 0, 'Asia/Jakarta');

        $result = $this->service->hitungStatusLembur($employee, $checkoutTime, $shiftDate);

        $this->assertTrue($result['is_lembur']);
        $this->assertEquals(120, $result['durasi_lembur_menit']);
        $this->assertEquals('17:00:00', $result['jam_pulang_normal']);
    }

    public function testAttendanceIncompleteLogic()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nip' => '1234567',
            'status' => 'active',
        ]);

        $schedule = Schedule::create([
            'name' => 'Pagi',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
        ]);

        // 2026-07-14 is a Tuesday (Selasa)
        $employee->schedules()->attach($schedule->id, ['day_of_week' => 'Selasa']);

        // Case 1: checked out -> false
        $att1 = \App\Models\Attendance::create([
            'employee_id' => $employee->id,
            'date' => '2026-07-14',
            'check_in' => '08:00:00',
            'check_out' => '17:00:00',
            'status' => 'hadir',
        ]);
        $this->assertFalse(\App\Support\AttendanceRules::isAttendanceIncomplete($att1, $employee, '2026-07-14 18:00:00'));

        // Case 2: not checked in -> false
        $att2 = \App\Models\Attendance::create([
            'employee_id' => $employee->id,
            'date' => '2026-07-21',
            'check_in' => null,
            'check_out' => null,
            'status' => 'alpha',
        ]);
        $this->assertFalse(\App\Support\AttendanceRules::isAttendanceIncomplete($att2, $employee, '2026-07-21 18:00:00'));

        // Case 3: checked in, before shift end -> false
        $att3 = \App\Models\Attendance::create([
            'employee_id' => $employee->id,
            'date' => '2026-07-28',
            'check_in' => '08:00:00',
            'check_out' => null,
            'status' => 'hadir',
        ]);
        $this->assertFalse(\App\Support\AttendanceRules::isAttendanceIncomplete($att3, $employee, '2026-07-28 14:00:00'));

        // Case 4: checked in, after shift end -> true
        $this->assertTrue(\App\Support\AttendanceRules::isAttendanceIncomplete($att3, $employee, '2026-07-28 18:00:00'));
    }
}
