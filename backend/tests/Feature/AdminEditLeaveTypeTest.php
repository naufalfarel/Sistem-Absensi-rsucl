<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\SpecialLeaveCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminEditLeaveTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_correct_special_leave_to_annual_leave(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $employeeUser = User::factory()->create(['role' => 'employee']);
        $department = Department::create(['name' => 'Administrasi']);
        $employee = Employee::create([
            'user_id' => $employeeUser->id,
            'department_id' => $department->id,
            'nik_ktp' => 'EDIT-LEAVE-001',
            'status' => 'active',
        ]);
        $category = SpecialLeaveCategory::create([
            'name' => 'Keperluan Keluarga',
            'is_active' => true,
        ]);
        $leave = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => 'cuti_khusus',
            'special_leave_category_id' => $category->id,
            'special_leave_category_other' => 'Acara keluarga',
            'start_date' => '2026-10-27',
            'end_date' => '2026-10-30',
            'reason' => 'Keperluan keluarga',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/leave-requests/{$leave->id}/edit-admin", [
            'type' => 'cuti',
            'start_date' => '2026-10-27',
            'end_date' => '2026-10-30',
            'admin_note' => 'Dikoreksi menjadi cuti tahunan.',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.type', 'cuti')
            ->assertJsonPath('data.special_leave_category_id', null)
            ->assertJsonPath('data.special_leave_category_other', null);

        $this->assertDatabaseHas('leave_requests', [
            'id' => $leave->id,
            'type' => 'cuti',
            'special_leave_category_id' => null,
            'special_leave_category_other' => null,
        ]);
    }

    public function test_admin_cannot_set_an_unknown_leave_type(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $employeeUser = User::factory()->create(['role' => 'employee']);
        $employee = Employee::create([
            'user_id' => $employeeUser->id,
            'nik_ktp' => 'EDIT-LEAVE-002',
            'status' => 'active',
        ]);
        $leave = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => 'cuti',
            'start_date' => '2026-10-27',
            'end_date' => '2026-10-30',
            'reason' => 'Cuti tahunan',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/leave-requests/{$leave->id}/edit-admin", [
            'type' => 'kategori_tidak_valid',
            'start_date' => '2026-10-27',
            'end_date' => '2026-10-30',
        ])->assertUnprocessable()->assertJsonValidationErrors('type');

        $this->assertDatabaseHas('leave_requests', [
            'id' => $leave->id,
            'type' => 'cuti',
        ]);
    }

    public function test_admin_cannot_change_leave_type_to_izin(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $employeeUser = User::factory()->create(['role' => 'employee']);
        $employee = Employee::create([
            'user_id' => $employeeUser->id,
            'nik_ktp' => 'EDIT-LEAVE-003',
            'status' => 'active',
        ]);
        $leave = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => 'cuti',
            'start_date' => '2026-10-27',
            'end_date' => '2026-10-30',
            'reason' => 'Cuti tahunan',
            'status' => 'pending',
        ]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/leave-requests/{$leave->id}/edit-admin", [
            'type' => 'izin',
            'start_date' => '2026-10-27',
            'end_date' => '2026-10-30',
        ])->assertUnprocessable()->assertJsonValidationErrors('type');

        $this->assertDatabaseHas('leave_requests', [
            'id' => $leave->id,
            'type' => 'cuti',
        ]);
    }
}
