<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Employee;
use App\Models\OvertimeRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

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
            'nik_ktp'     => '1234567890123456',
            'status'  => 'active',
        ]);

        $this->adminUser = User::factory()->create(['role' => 'admin']);
    }

    public function test_employee_can_submit_overtime_request()
    {
        Sanctum::actingAs($this->employeeUser);

        $response = $this->postJson('/api/overtime-requests', [
            'date'          => '2026-07-15',
            'reason'        => 'Menyelesaikan laporan bulanan casemix.',
            'photo'         => UploadedFile::fake()->image('working.jpg'),
            'location_note' => 'Ruang Administrasi Lantai 1',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('success', true);
        $this->assertDatabaseHas('overtime_requests', [
            'employee_id'   => $this->employee->id,
            'date'          => '2026-07-15 00:00:00',
            'reason'        => 'Menyelesaikan laporan bulanan casemix.',
            'location_note' => 'Ruang Administrasi Lantai 1',
            'status'        => 'pending',
        ]);
    }

    public function test_employee_cannot_submit_duplicate_overtime_request()
    {
        Sanctum::actingAs($this->employeeUser);

        OvertimeRequest::create([
            'employee_id'   => $this->employee->id,
            'date'          => '2026-07-15',
            'reason'        => 'Existing',
            'photo_url'     => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status'        => 'pending',
        ]);

        $response = $this->postJson('/api/overtime-requests', [
            'date'          => '2026-07-15',
            'reason'        => 'Lembur baru',
            'photo'         => UploadedFile::fake()->image('working2.jpg'),
            'location_note' => 'Ruang B',
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('success', false);
    }

    public function test_employee_cannot_submit_without_photo_or_location()
    {
        Sanctum::actingAs($this->employeeUser);

        $response = $this->postJson('/api/overtime-requests', [
            'date'          => '2026-07-15',
            'reason'        => 'Menyelesaikan laporan bulanan casemix.',
        ]);

        $response->assertStatus(422);
    }

    public function test_admin_can_approve_overtime_request()
    {
        $req = OvertimeRequest::create([
            'employee_id'   => $this->employee->id,
            'date'          => '2026-07-15',
            'reason'        => 'Kerja lembur',
            'photo_url'     => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status'        => 'pending',
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->putJson("/api/overtime-requests/{$req->id}/approve", [
            'admin_note' => 'Disetujui untuk dihitung lembur.',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('success', true);
        $this->assertDatabaseHas('overtime_requests', [
            'id'          => $req->id,
            'status'      => 'approved',
            'admin_note'  => 'Disetujui untuk dihitung lembur.',
            'reviewed_by' => $this->adminUser->id,
        ]);
    }

    public function test_admin_cannot_reject_overtime_request_without_note()
    {
        $req = OvertimeRequest::create([
            'employee_id'   => $this->employee->id,
            'date'          => '2026-07-15',
            'reason'        => 'Kerja lembur',
            'photo_url'     => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status'        => 'pending',
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->putJson("/api/overtime-requests/{$req->id}/reject", []);

        $response->assertStatus(422);
    }

    public function test_admin_reject_overtime_updates_pj_status()
    {
        $req = OvertimeRequest::create([
            'employee_id'   => $this->employee->id,
            'date'          => '2026-07-15',
            'reason'        => 'Kerja lembur',
            'photo_url'     => '/some/path.jpg',
            'location_note' => 'Ruang A',
            'status'        => 'pending',
            'pj_status'     => 'pending',
        ]);

        Sanctum::actingAs($this->adminUser);

        $response = $this->putJson("/api/overtime-requests/{$req->id}/reject", [
            'admin_note' => 'tidak bisa',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('overtime_requests', [
            'id'          => $req->id,
            'status'      => 'rejected',
            'pj_status'   => 'rejected',
            'admin_note'  => 'tidak bisa',
        ]);
    }
}
