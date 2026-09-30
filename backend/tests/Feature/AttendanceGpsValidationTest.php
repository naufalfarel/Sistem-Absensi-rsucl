<?php

namespace Tests\Feature;

use App\Models\AssignmentLetter;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Schedule;
use App\Models\Setting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AttendanceGpsValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Employee $employee;

    private Schedule $schedule;

    private Carbon $now;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        $this->now = Carbon::parse('2026-09-29 09:00:00', 'Asia/Jakarta');
        Carbon::setTestNow($this->now);

        $this->user = User::factory()->create();
        $this->employee = Employee::create([
            'user_id' => $this->user->id,
            'nik_ktp' => 'GPS-'.uniqid(),
            'status' => 'active',
        ]);
        $this->schedule = Schedule::create([
            'name' => 'Shift GPS Test',
            'start_time' => '08:30:00',
            'end_time' => '17:00:00',
            'shift_type' => 'normal',
        ]);
        $this->employee->schedules()->attach($this->schedule->id, [
            'day_of_week' => 'Selasa',
        ]);

        Setting::set('enable_gps_validation', '1');
        Setting::set('hospital_latitude', '5.552740480177099');
        Setting::set('hospital_longitude', '95.33486560781716');
        Setting::set('attendance_radius_meters', '100');
        Setting::set('gps_max_accuracy_meters', '100');
        Setting::set('gps_max_age_seconds', '30');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_check_in_rejects_coarse_gps_with_structured_retryable_response(): void
    {
        $response = $this->actingAs($this->user)->postJson(
            '/api/attendance/check-in',
            $this->checkInPayload(5.552740480177099, 95.33486560781716, 150)
        );

        $response->assertStatus(422)->assertJson([
            'success' => false,
            'code' => 'GPS_ACCURACY_TOO_LOW',
            'retryable' => true,
            'gps' => [
                'accuracy_meters' => 150,
                'max_accuracy_meters' => 100,
            ],
        ]);
        $this->assertDatabaseCount('attendance', 0);
    }

    public function test_check_in_rejects_stale_gps_with_structured_retryable_response(): void
    {
        $payload = $this->checkInPayload(5.552740480177099, 95.33486560781716, 20);
        $payload['location_timestamp'] = ($this->now->getTimestamp() - 31) * 1000;

        $response = $this->actingAs($this->user)->postJson('/api/attendance/check-in', $payload);

        $response->assertStatus(422)->assertJson([
            'success' => false,
            'code' => 'GPS_LOCATION_STALE',
            'retryable' => true,
            'gps' => [
                'age_seconds' => 31,
                'max_age_seconds' => 30,
            ],
        ]);
        $this->assertDatabaseCount('attendance', 0);
    }

    public function test_check_in_rejects_position_whose_accuracy_crosses_geofence_boundary(): void
    {
        // Titik sekitar 80 meter dari pusat dengan accuracy 30 meter memiliki
        // kemungkinan posisi 50-110 meter, sehingga belum pasti di dalam.
        $response = $this->actingAs($this->user)->postJson(
            '/api/attendance/check-in',
            $this->checkInPayload(5.55345998, 95.33486560781716, 30)
        );

        $response->assertStatus(422)->assertJson([
            'success' => false,
            'code' => 'GPS_GEOFENCE_UNCERTAIN',
            'retryable' => true,
            'gps' => [
                'accuracy_meters' => 30,
                'radius_meters' => 100,
            ],
        ]);
        $this->assertDatabaseCount('attendance', 0);
    }

    public function test_check_in_accepts_fresh_accurate_position_fully_inside_geofence(): void
    {
        $response = $this->actingAs($this->user)->postJson(
            '/api/attendance/check-in',
            $this->checkInPayload(5.552740480177099, 95.33486560781716, 25)
        );

        $response->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('attendance', [
            'employee_id' => $this->employee->id,
            'is_within_geofence' => true,
            'accuracy' => 25,
        ]);
    }

    public function test_check_out_uses_the_same_gps_quality_validation(): void
    {
        $attendance = Attendance::create([
            'employee_id' => $this->employee->id,
            'schedule_id' => $this->schedule->id,
            'date' => '2026-09-29',
            'check_in' => '08:30:00',
            'status' => 'hadir',
        ]);

        $response = $this->actingAs($this->user)->postJson('/api/attendance/check-out', [
            'latitude' => 5.552740480177099,
            'longitude' => 95.33486560781716,
            'accuracy' => 150,
            'location_timestamp' => $this->now->getTimestamp() * 1000,
            'location_note' => 'Lobi RSUCL',
            'photo' => UploadedFile::fake()->image('checkout.jpg'),
        ]);

        $response->assertStatus(422)->assertJson([
            'success' => false,
            'code' => 'GPS_ACCURACY_TOO_LOW',
            'retryable' => true,
        ]);
        $this->assertNull($attendance->fresh()->check_out);
    }

    public function test_check_in_bypasses_gps_fields_when_global_validation_is_disabled(): void
    {
        Setting::set('enable_gps_validation', '0');

        $response = $this->actingAs($this->user)->postJson('/api/attendance/check-in', [
            'location_note' => 'Lobi RSUCL',
            'photo' => UploadedFile::fake()->image('checkin.jpg'),
        ]);

        $response->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('attendance', [
            'employee_id' => $this->employee->id,
            'is_within_geofence' => true,
        ]);
    }

    public function test_dinas_luar_shift_is_exempt_from_gps_quality_validation(): void
    {
        $this->schedule->update(['shift_type' => 'dinas_luar']);

        $response = $this->actingAs($this->user)->postJson('/api/attendance/check-in', [
            'location_note' => 'Lokasi dinas luar',
            'photo' => UploadedFile::fake()->image('checkin.jpg'),
        ]);

        $response->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('attendance', [
            'employee_id' => $this->employee->id,
            'is_within_geofence' => true,
        ]);
    }

    public function test_approved_assignment_letter_is_exempt_from_gps_quality_validation(): void
    {
        AssignmentLetter::create([
            'employee_id' => $this->employee->id,
            'title' => 'Tugas luar GPS test',
            'issuing_institution' => 'RSUCL',
            'purpose' => 'Pengujian pengecualian lokasi',
            'start_date' => '2026-09-29',
            'end_date' => '2026-09-29',
            'document_url' => '/storage/test-surat-tugas.pdf',
            'status' => 'approved',
        ]);

        $response = $this->actingAs($this->user)->postJson('/api/attendance/check-in', [
            'location_note' => 'Lokasi surat tugas',
            'photo' => UploadedFile::fake()->image('checkin.jpg'),
        ]);

        $response->assertOk()->assertJson(['success' => true]);
        $this->assertDatabaseHas('attendance', [
            'employee_id' => $this->employee->id,
            'is_within_geofence' => true,
            'is_dinas_luar' => true,
        ]);
    }

    public function test_check_out_can_omit_gps_when_global_validation_is_disabled(): void
    {
        Setting::set('enable_gps_validation', '0');
        $attendance = Attendance::create([
            'employee_id' => $this->employee->id,
            'schedule_id' => $this->schedule->id,
            'date' => '2026-09-29',
            'check_in' => '08:30:00',
            'status' => 'hadir',
        ]);

        $response = $this->actingAs($this->user)->postJson('/api/attendance/check-out', [
            'location_note' => 'Lobi RSUCL',
            'photo' => UploadedFile::fake()->image('checkout.jpg'),
        ]);

        $response->assertOk()->assertJson(['success' => true]);
        $this->assertNotNull($attendance->fresh()->check_out);
    }

    #[DataProvider('missingGpsFields')]
    public function test_required_gps_data_cannot_be_omitted_for_check_in_or_out(
        string $action,
        string $field,
        ?string $expectedCode
    ): void {
        $attendance = $action === 'check-out' ? $this->createOpenAttendance() : null;
        $payload = $this->checkInPayload(5.552740480177099, 95.33486560781716, 20);
        unset($payload[$field]);

        $response = $this->actingAs($this->user)->postJson('/api/attendance/'.$action, $payload);

        $response->assertStatus(422);
        if ($expectedCode) {
            $response->assertJson([
                'success' => false,
                'code' => $expectedCode,
                'retryable' => true,
            ]);
        } else {
            $response->assertJsonValidationErrors($field);
        }

        if ($attendance) {
            $this->assertNull($attendance->fresh()->check_out);
        } else {
            $this->assertDatabaseCount('attendance', 0);
        }
    }

    public static function missingGpsFields(): array
    {
        $cases = [];
        foreach (['check-in', 'check-out'] as $action) {
            foreach ([
                'latitude' => null,
                'longitude' => null,
                'accuracy' => 'GPS_ACCURACY_REQUIRED',
                'location_timestamp' => 'GPS_TIMESTAMP_REQUIRED',
            ] as $field => $code) {
                $cases[$action.' missing '.$field] = [$action, $field, $code];
            }
        }

        return $cases;
    }

    #[DataProvider('rejectedCheckoutLocations')]
    public function test_check_out_rejects_stale_future_outside_and_uncertain_locations(
        float $latitude,
        float $accuracy,
        int $ageSeconds,
        string $expectedCode
    ): void {
        $attendance = $this->createOpenAttendance();
        $payload = $this->checkInPayload($latitude, 95.33486560781716, $accuracy);
        $payload['location_timestamp'] = ($this->now->getTimestamp() - $ageSeconds) * 1000;

        $response = $this->actingAs($this->user)->postJson('/api/attendance/check-out', $payload);

        $response->assertStatus(422)->assertJson([
            'success' => false,
            'code' => $expectedCode,
            'retryable' => true,
        ]);
        $this->assertNull($attendance->fresh()->check_out);
        $this->assertNull($attendance->fresh()->checkout_latitude);
        $this->assertDatabaseCount('attendance', 1);
    }

    public static function rejectedCheckoutLocations(): array
    {
        return [
            'cached location' => [5.552740480177099, 20, 31, 'GPS_LOCATION_STALE'],
            'device clock too far ahead' => [5.552740480177099, 20, -11, 'GPS_TIMESTAMP_INVALID'],
            'outside hospital' => [5.55408948, 20, 0, 'GPS_OUTSIDE_GEOFENCE'],
            'uncertain boundary' => [5.55345998, 30, 0, 'GPS_GEOFENCE_UNCERTAIN'],
        ];
    }

    public function test_check_in_rejects_position_outside_hospital_even_with_good_accuracy(): void
    {
        // Around 150 m from the hospital, with only 20 m uncertainty.
        $response = $this->actingAs($this->user)->postJson(
            '/api/attendance/check-in',
            $this->checkInPayload(5.55408948, 95.33486560781716, 20)
        );

        $response->assertStatus(422)->assertJson([
            'success' => false,
            'code' => 'GPS_OUTSIDE_GEOFENCE',
            'retryable' => true,
        ]);
        $this->assertDatabaseCount('attendance', 0);
    }

    public function test_check_out_accepts_fresh_accurate_position_and_saves_actual_location(): void
    {
        $attendance = $this->createOpenAttendance();
        $this->now = $this->now->copy()->setTime(17, 0);
        Carbon::setTestNow($this->now);
        $latitude = 5.55283;
        $longitude = 95.33486560781716;

        $response = $this->actingAs($this->user)->postJson(
            '/api/attendance/check-out',
            $this->checkInPayload($latitude, $longitude, 25)
        );

        $response->assertOk()->assertJson(['success' => true]);
        $saved = $attendance->fresh();
        $this->assertSame('17:00:00', $saved->check_out);
        $this->assertEqualsWithDelta($latitude, (float) $saved->checkout_latitude, 0.000001);
        $this->assertEqualsWithDelta($longitude, (float) $saved->checkout_longitude, 0.000001);
        $this->assertEquals(25, $saved->accuracy);
        $this->assertTrue((bool) $saved->is_within_geofence);
        $this->assertNotNull($saved->checkout_photo_url);
    }

    private function createOpenAttendance(): Attendance
    {
        return Attendance::create([
            'employee_id' => $this->employee->id,
            'schedule_id' => $this->schedule->id,
            'date' => '2026-09-29',
            'check_in' => '08:30:00',
            'status' => 'hadir',
        ]);
    }

    /** @return array<string, mixed> */
    private function checkInPayload(float $latitude, float $longitude, float $accuracy): array
    {
        return [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'accuracy' => $accuracy,
            'location_timestamp' => $this->now->getTimestamp() * 1000,
            'location_note' => 'Lobi RSUCL',
            'photo' => UploadedFile::fake()->image('checkin.jpg'),
        ];
    }
}
