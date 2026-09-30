<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Department;
use App\Models\Employee;
use App\Models\OvertimeRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OvertimeRequestTest extends TestCase
{
    use RefreshDatabase;

    private User $employeeUser;

    private Employee $employee;

    private User $adminUser;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        $this->employeeUser = User::factory()->create(['role' => 'employee']);
        $this->employee = Employee::create([
            'user_id' => $this->employeeUser->id,
            'nik_ktp' => '1234567890123456',
            'status' => 'active',
        ]);

        $this->adminUser = User::factory()->create(['role' => 'admin']);
    }

    public function test_employee_can_submit_overtime_request()
    {
        Sanctum::actingAs($this->employeeUser);

        $response = $this->postJson('/api/overtime-requests', [
            'date' => '2026-07-15',
            'reason' => 'Menyelesaikan laporan bulanan casemix.',
            'photo' => UploadedFile::fake()->image('working.jpg'),
            'location_note' => 'Ruang Administrasi Lantai 1',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $this->assertDatabaseHas('overtime_requests', [
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15 00:00:00',
            'reason' => 'Menyelesaikan laporan bulanan casemix.',
            'location_note' => 'Ruang Administrasi Lantai 1',
            'status' => 'pending',
        ]);
    }

    public function test_employee_cannot_submit_duplicate_overtime_request()
    {
        Sanctum::actingAs($this->employeeUser);

        OvertimeRequest::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'reason' => 'Existing',
            'photo_url' => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status' => 'pending',
        ]);

        $response = $this->postJson('/api/overtime-requests', [
            'date' => '2026-07-15',
            'reason' => 'Lembur baru',
            'photo' => UploadedFile::fake()->image('working2.jpg'),
            'location_note' => 'Ruang B',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
    }

    public function test_employee_cannot_submit_without_photo_or_location()
    {
        Sanctum::actingAs($this->employeeUser);

        $response = $this->postJson('/api/overtime-requests', [
            'date' => '2026-07-15',
            'reason' => 'Menyelesaikan laporan bulanan casemix.',
        ]);

        $response->assertStatus(422);
    }

    public function test_admin_can_approve_overtime_request()
    {
        $req = OvertimeRequest::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'reason' => 'Kerja lembur',
            'photo_url' => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->putJson("/api/overtime-requests/{$req->id}/approve", [
            'admin_note' => 'Disetujui untuk dihitung lembur.',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertDatabaseHas('overtime_requests', [
            'id' => $req->id,
            'status' => 'approved',
            'admin_note' => 'Disetujui untuk dihitung lembur.',
            'reviewed_by' => $this->adminUser->id,
        ]);
    }

    public function test_admin_cannot_reject_overtime_request_without_note()
    {
        $req = OvertimeRequest::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'reason' => 'Kerja lembur',
            'photo_url' => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->putJson("/api/overtime-requests/{$req->id}/reject", []);

        $response->assertStatus(422);
    }

    public function test_admin_reject_overtime_updates_pj_status()
    {
        $req = OvertimeRequest::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'reason' => 'Kerja lembur',
            'photo_url' => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status' => 'pending',
            'pj_status' => 'pending',
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->putJson("/api/overtime-requests/{$req->id}/reject", [
            'admin_note' => 'tidak bisa',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('overtime_requests', [
            'id' => $req->id,
            'status' => 'rejected',
            'pj_status' => 'rejected',
            'admin_note' => 'tidak bisa',
        ]);
    }

    public function test_pj_bagian_can_approve_overtime_request()
    {
        $department = Department::create(['name' => 'Department Test', 'code' => 'DT']);
        $this->employee->update(['department_id' => $department->id]);

        $pjUser = User::factory()->create([
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $department->id,
        ]);

        $req = OvertimeRequest::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'reason' => 'Lembur proyek',
            'photo_url' => '/some/path.jpg',
            'location_note' => 'Ruang B',
            'status' => 'pending',
            'pj_status' => 'pending',
        ]);

        Sanctum::actingAs($pjUser);

        $response = $this->putJson("/api/overtime-requests/{$req->id}/approve", [
            'admin_note' => 'Disetujui PJ Bagian',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertDatabaseHas('overtime_requests', [
            'id' => $req->id,
            'status' => 'pending',
            'pj_status' => 'approved',
            'pj_reviewed_by' => $pjUser->id,
            'pj_note' => 'Disetujui PJ Bagian',
        ]);
    }

    public function test_admin_and_super_admin_can_request_more_than_one_hundred_rows_for_reports(): void
    {
        $this->createOvertimeRequests(101);

        Sanctum::actingAs($this->adminUser);

        $adminResponse = $this->getJson('/api/overtime-requests?per_page=9999');

        $adminResponse
            ->assertOk()
            ->assertJsonCount(101, 'data')
            ->assertJsonPath('meta.per_page', 9999)
            ->assertJsonPath('meta.total', 101);

        $superAdmin = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($superAdmin);

        $superAdminResponse = $this->getJson('/api/overtime-requests?per_page=9999');

        $superAdminResponse
            ->assertOk()
            ->assertJsonCount(101, 'data')
            ->assertJsonPath('meta.per_page', 9999)
            ->assertJsonPath('meta.total', 101);
    }

    public function test_employee_large_page_request_remains_capped_at_one_hundred_rows(): void
    {
        $this->createOvertimeRequests(101);
        Sanctum::actingAs($this->employeeUser);

        $response = $this->getJson('/api/overtime-requests?personal=1&per_page=9999');

        $response
            ->assertOk()
            ->assertJsonCount(100, 'data')
            ->assertJsonPath('meta.per_page', 100)
            ->assertJsonPath('meta.total', 101);
    }

    public function test_pagination_has_stable_order_for_requests_on_the_same_date(): void
    {
        $this->createOvertimeRequests(3);
        $expectedIds = OvertimeRequest::orderByDesc('id')->pluck('id')->all();
        Sanctum::actingAs($this->adminUser);

        foreach ($expectedIds as $index => $expectedId) {
            $this->getJson('/api/overtime-requests?per_page=1&page=' . ($index + 1))
                ->assertOk()
                ->assertJsonPath('data.0.id', $expectedId);
        }
    }

    public function test_summary_uses_positive_request_durations_including_overnight_overtime(): void
    {
        $this->createOvertimeRequests(3);
        $requests = OvertimeRequest::orderBy('id')->get();
        $requests[0]->update(['start_time' => '08:00', 'end_time' => '14:00']);
        $requests[1]->update(['start_time' => '20:00', 'end_time' => '08:00']);
        $requests[2]->update(['status' => 'pending']);
        Attendance::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'check_in' => '08:00:00',
            'check_out' => '19:00:00',
            'status' => 'HADIR',
            'is_overtime' => true,
            'overtime_minutes' => 120,
        ]);
        Sanctum::actingAs($this->adminUser);

        $this->getJson('/api/overtime-requests/summary')
            ->assertOk()
            ->assertJsonPath('data.approved', 2)
            ->assertJsonPath('data.total_minutes', 1080)
            ->assertJsonPath('data.total_hours', 18);
    }

    public function test_pj_bagian_large_page_request_remains_capped_at_one_hundred_rows(): void
    {
        $department = Department::create(['name' => 'Unit PJ']);
        $this->employee->update(['department_id' => $department->id]);
        $this->createOvertimeRequests(101);

        $pjUser = User::factory()->create([
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $department->id,
        ]);
        Sanctum::actingAs($pjUser);

        $response = $this->getJson('/api/overtime-requests?per_page=9999');

        $response
            ->assertOk()
            ->assertJsonCount(100, 'data')
            ->assertJsonPath('meta.per_page', 100)
            ->assertJsonPath('meta.total', 101);
    }

    public function test_resource_exposes_employee_department_shift_metadata(): void
    {
        $department = Department::create([
            'name' => 'Laboratorium',
            'count_sunday_in_leave' => true,
        ]);
        $this->employee->update(['department_id' => $department->id]);
        $this->createOvertimeRequests(1);
        Attendance::create([
            'employee_id' => $this->employee->id,
            'date' => '2026-07-15',
            'check_in' => '08:00:00',
            'check_out' => '18:15:00',
            'status' => 'HADIR',
            'is_overtime' => true,
            'overtime_minutes' => 75,
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->getJson('/api/overtime-requests?per_page=20');

        $response
            ->assertOk()
            ->assertJsonPath('data.0.employee.department_id', $department->id)
            ->assertJsonPath('data.0.employee.department', 'Laboratorium')
            ->assertJsonPath('data.0.employee.count_sunday_in_leave', true)
            ->assertJsonPath('data.0.system_checkout_data.overtime_minutes', 75);
    }

    private function createOvertimeRequests(int $count): void
    {
        $now = now();
        $rows = [];

        for ($index = 1; $index <= $count; $index++) {
            $rows[] = [
                'employee_id' => $this->employee->id,
                'date' => '2026-07-15',
                'reason' => "Lembur laporan {$index}",
                'photo_url' => '/some/path.jpg',
                'location_note' => 'Ruang Administrasi',
                'unit_kerja' => 'Administrasi',
                'overtime_day_type' => 'workday',
                'start_time' => '17:00',
                'end_time' => '18:00',
                'tasks' => 'Menyiapkan laporan',
                'status' => 'approved',
                'pj_status' => 'approved',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        OvertimeRequest::insert($rows);
    }
}
