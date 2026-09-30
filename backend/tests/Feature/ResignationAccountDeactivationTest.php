<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\ResignationRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResignationAccountDeactivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_deactivate_account_after_resignation_is_approved(): void
    {
        $department = Department::create(['name' => 'Kamar Bersalin']);
        $targetUser = User::factory()->create([
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $department->id,
        ]);
        $targetUser->pjDepartments()->attach($department->id);
        $employee = $this->createEmployee($targetUser, $department, 'RESIGN-OFF-001');
        $token = $targetUser->createToken('mobile')->plainTextToken;
        $this->assertNotEmpty($token);

        $resignation = $this->createResignation($employee, 'approved');
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->putJson("/api/resignation-requests/{$resignation->id}/deactivate-account")
            ->assertOk()
            ->assertJsonPath('data.account_status', 'inactive');

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'inactive',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $targetUser->id,
            'role' => 'employee',
            'pj_bagian_department_id' => null,
        ]);
        $this->assertDatabaseMissing('pj_departments', [
            'user_id' => $targetUser->id,
        ]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $targetUser->id,
            'tokenable_type' => User::class,
        ]);
    }

    public function test_account_cannot_be_deactivated_while_resignation_is_pending(): void
    {
        $department = Department::create(['name' => 'Administrasi']);
        $targetUser = User::factory()->create(['role' => 'employee']);
        $employee = $this->createEmployee($targetUser, $department, 'RESIGN-OFF-002');
        $resignation = $this->createResignation($employee, 'pending');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->putJson("/api/resignation-requests/{$resignation->id}/deactivate-account")
            ->assertUnprocessable();

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'active',
        ]);
    }

    public function test_super_admin_can_deactivate_resigned_employee_account(): void
    {
        $department = Department::create(['name' => 'Administrasi']);
        $targetUser = User::factory()->create(['role' => 'employee']);
        $employee = $this->createEmployee($targetUser, $department, 'RESIGN-OFF-003');
        $resignation = $this->createResignation($employee, 'approved');

        $superAdmin = User::factory()->create(['role' => 'super_admin']);
        Sanctum::actingAs($superAdmin);

        $this->putJson("/api/resignation-requests/{$resignation->id}/deactivate-account")
            ->assertOk();

        $this->assertDatabaseHas('employees', [
            'id' => $employee->id,
            'status' => 'inactive',
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

    private function createResignation(Employee $employee, string $status): ResignationRequest
    {
        return ResignationRequest::create([
            'employee_id' => $employee->id,
            'request_date' => '2026-09-01',
            'effective_date' => '2026-10-01',
            'notice_days' => 30,
            'reason' => 'Mengundurkan diri secara resmi dari perusahaan.',
            'status' => $status,
            'pj_status' => $status === 'approved' ? 'approved' : 'pending',
        ]);
    }
}
