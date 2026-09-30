<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\User;
use App\Support\AttendanceRules;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class OvernightAttendanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_overnight_shift_today_returns_yesterday_record_for_checkout()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nik_ktp' => '999888777',
            'status' => 'active',
        ]);

        $nightShift = Schedule::create([
            'name' => 'Shift Malam',
            'start_time' => '20:00:00',
            'end_time' => '08:00:00',
        ]);

        $employee->schedules()->attach($nightShift->id, ['day_of_week' => 'Senin']);
        $employee->schedules()->attach($nightShift->id, ['day_of_week' => 'Selasa']);

        // Check-in on Monday at 20:00
        $mondayDate = '2026-08-10';
        $attRecord = Attendance::create([
            'employee_id' => $employee->id,
            'schedule_id' => $nightShift->id,
            'date' => $mondayDate,
            'check_in' => '20:00:00',
            'status' => 'hadir',
        ]);

        // Travel to Tuesday morning at 08:00 AM
        Carbon::setTestNow(Carbon::parse('2026-08-11 08:00:00', 'Asia/Jakarta'));

        $response = $this->actingAs($user)->getJson('/api/attendance/today');

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'data' => [
                'id' => $attRecord->id,
                'check_in' => '20:00:00',
                'check_out' => null,
            ],
            'active_shift' => [
                'id' => $nightShift->id,
                'name' => 'Shift Malam',
            ],
        ]);
    }

    public function test_overnight_shift_blocks_new_checkin_when_unclosed()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nik_ktp' => '999888778',
            'status' => 'active',
        ]);

        $nightShift = Schedule::create([
            'name' => 'Shift Malam',
            'start_time' => '20:00:00',
            'end_time' => '08:00:00',
        ]);

        $employee->schedules()->attach($nightShift->id, ['day_of_week' => 'Senin']);
        $employee->schedules()->attach($nightShift->id, ['day_of_week' => 'Selasa']);

        // Check-in on Monday at 20:00
        Attendance::create([
            'employee_id' => $employee->id,
            'schedule_id' => $nightShift->id,
            'date' => '2026-08-10',
            'check_in' => '20:00:00',
            'status' => 'hadir',
        ]);

        // Travel to Tuesday morning at 08:00 AM
        Carbon::setTestNow(Carbon::parse('2026-08-11 08:00:00', 'Asia/Jakarta'));

        $file = UploadedFile::fake()->image('selfie.jpg');

        $response = $this->actingAs($user)->postJson('/api/attendance/check-in', [
            'latitude' => 5.55274,
            'longitude' => 95.33486,
            'location_note' => 'RSUCL Lobby',
            'photo' => $file,
        ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
        ]);
        $this->assertStringContainsString('belum melakukan check-out', $response->json('message'));
    }

    public function test_expired_unclosed_attendance_remains_incomplete_when_next_shift_checkin_succeeds()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nik_ktp' => '999888780',
            'status' => 'active',
        ]);

        $nightShift = Schedule::create([
            'name' => 'Shift Malam',
            'start_time' => '20:00:00',
            'end_time' => '08:00:00',
        ]);

        $employee->schedules()->attach($nightShift->id, ['day_of_week' => 'Senin']);
        $employee->schedules()->attach($nightShift->id, ['day_of_week' => 'Selasa']);

        $oldAttendance = Attendance::create([
            'employee_id' => $employee->id,
            'schedule_id' => $nightShift->id,
            'date' => '2026-08-10',
            'check_in' => '20:00:00',
            'status' => 'hadir',
        ]);

        // Batas checkout shift Senin sudah berakhir pada Selasa pukul 11:00.
        Carbon::setTestNow(Carbon::parse('2026-08-11 20:00:00', 'Asia/Jakarta'));

        $response = $this->actingAs($user)->postJson('/api/attendance/check-in', [
            'latitude' => 5.552740480177099,
            'longitude' => 95.33486560781716,
            'accuracy' => 5,
            'location_timestamp' => Carbon::now('Asia/Jakarta')->getTimestamp() * 1000,
            'location_note' => 'RSUCL Lobby',
            'photo' => UploadedFile::fake()->image('selfie.jpg'),
        ]);

        $response->assertOk()->assertJson(['success' => true]);

        $this->assertNull($oldAttendance->fresh()->check_out);
        $this->assertTrue(AttendanceRules::isAttendanceIncomplete(
            $oldAttendance->fresh(),
            $employee,
            Carbon::parse('2026-08-11 20:00:00', 'Asia/Jakarta'),
        ));
        $this->assertTrue(Attendance::where('employee_id', $employee->id)
            ->whereDate('date', '2026-08-11')
            ->where('schedule_id', $nightShift->id)
            ->exists());
    }

    public function test_attendance_duration_attribute_for_overnight_shift()
    {
        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'nik_ktp' => '999888779',
            'status' => 'active',
        ]);

        $attRecord = Attendance::create([
            'employee_id' => $employee->id,
            'date' => '2026-08-10',
            'check_in' => '20:00:00',
            'check_out' => '08:00:00',
            'status' => 'hadir',
        ]);

        // 20:00 to 08:00 next day is 12 hours = 720 minutes
        $this->assertEquals(720, $attRecord->duration_minutes);
    }
}
