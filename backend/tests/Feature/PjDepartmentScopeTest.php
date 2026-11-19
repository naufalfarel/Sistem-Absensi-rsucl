<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PjDepartmentScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_pj_department_ids_returns_only_assigned_pivot_departments(): void
    {
        $deptJeumpaB = Department::create(['name' => 'Rawat Inap Jeumpa B']);
        $deptTransit = Department::create(['name' => 'Transit']);
        $deptSeulanga = Department::create(['name' => 'Rawat Inap Seulanga']);

        // User is hired under Seulanga department as base employee
        $fauzanUser = User::factory()->create([
            'name' => 'Ns. M. Fauzan Ilhami, S.Kep',
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $deptJeumpaB->id,
        ]);
        Employee::create([
            'user_id' => $fauzanUser->id,
            'department_id' => $deptSeulanga->id, // base unit is Seulanga
            'nik_ktp' => '1171010101010001',
            'nip' => 'PJ-FAUZAN-001',
            'status' => 'active',
        ]);

        // Assign PJ responsibilities: Jeumpa B & Transit
        $fauzanUser->pjDepartments()->sync([$deptJeumpaB->id, $deptTransit->id]);

        $ids = $fauzanUser->fresh()->getPjDepartmentIds();

        // Must include Jeumpa B and Transit
        $this->assertContains($deptJeumpaB->id, $ids);
        $this->assertContains($deptTransit->id, $ids);
        // Must NOT include Seulanga (base employee unit)
        $this->assertNotContains($deptSeulanga->id, $ids);
        $this->assertCount(2, $ids);
    }

    public function test_get_pj_department_ids_falls_back_to_legacy_column_when_pivot_is_empty(): void
    {
        $deptSeulanga = Department::create(['name' => 'Rawat Inap Seulanga']);
        $yuniUser = User::factory()->create([
            'name' => 'Yuni Asnidar, A.Md.Kep',
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $deptSeulanga->id,
        ]);

        $ids = $yuniUser->getPjDepartmentIds();

        $this->assertEquals([$deptSeulanga->id], $ids);
    }

    public function test_employee_index_returns_only_assigned_units_and_pj_self(): void
    {
        $deptJeumpaB = Department::create(['name' => 'Rawat Inap Jeumpa B']);
        $deptTransit = Department::create(['name' => 'Transit']);
        $deptSeulanga = Department::create(['name' => 'Rawat Inap Seulanga']);

        // Fauzan: PJ of Jeumpa B & Transit, base employee in Seulanga
        $fauzanUser = User::factory()->create([
            'name' => 'Ns. M. Fauzan Ilhami, S.Kep',
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $deptJeumpaB->id,
        ]);
        $fauzanEmp = Employee::create([
            'user_id' => $fauzanUser->id,
            'department_id' => $deptSeulanga->id,
            'nik_ktp' => '1171010101010001',
            'nip' => 'PJ-FAUZAN-001',
            'status' => 'active',
        ]);
        $fauzanUser->pjDepartments()->sync([$deptJeumpaB->id, $deptTransit->id]);

        // Staff in Jeumpa B
        $userA = User::factory()->create(['name' => 'Pegawai Jeumpa B']);
        $empA = Employee::create([
            'user_id' => $userA->id,
            'department_id' => $deptJeumpaB->id,
            'nik_ktp' => '1171010101010002',
            'nip' => 'EMP-JB-001',
            'status' => 'active',
        ]);

        // Staff in Transit
        $userB = User::factory()->create(['name' => 'Pegawai Transit']);
        $empB = Employee::create([
            'user_id' => $userB->id,
            'department_id' => $deptTransit->id,
            'nik_ktp' => '1171010101010003',
            'nip' => 'EMP-TR-001',
            'status' => 'active',
        ]);

        // Staff in Seulanga
        $userC = User::factory()->create(['name' => 'Pegawai Seulanga']);
        $empC = Employee::create([
            'user_id' => $userC->id,
            'department_id' => $deptSeulanga->id,
            'nik_ktp' => '1171010101010004',
            'nip' => 'EMP-SL-001',
            'status' => 'active',
        ]);

        Sanctum::actingAs($fauzanUser);

        $response = $this->getJson('/api/employees');

        $response->assertOk();
        $employeeIds = collect($response->json('data'))->pluck('id')->all();

        // Fauzan should see staff from Jeumpa B, Transit, and himself
        $this->assertContains($empA->id, $employeeIds);
        $this->assertContains($empB->id, $employeeIds);
        $this->assertContains($fauzanEmp->id, $employeeIds);

        // Fauzan should NOT see staff from Seulanga
        $this->assertNotContains($empC->id, $employeeIds);
    }

    public function test_get_monthly_schedule_isolates_employees_by_pj_assignment(): void
    {
        $deptJeumpaB = Department::create(['name' => 'Rawat Inap Jeumpa B']);
        $deptTransit = Department::create(['name' => 'Transit']);
        $deptSeulanga = Department::create(['name' => 'Rawat Inap Seulanga']);

        // Fauzan: PJ of Jeumpa B & Transit
        $fauzanUser = User::factory()->create([
            'name' => 'Ns. M. Fauzan Ilhami, S.Kep',
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $deptJeumpaB->id,
        ]);
        $fauzanEmp = Employee::create([
            'user_id' => $fauzanUser->id,
            'department_id' => $deptJeumpaB->id,
            'nik_ktp' => '1171010101010001',
            'nip' => 'PJ-FAUZAN-001',
            'status' => 'active',
        ]);
        $fauzanUser->pjDepartments()->sync([$deptJeumpaB->id, $deptTransit->id]);

        // Yuni: PJ of Seulanga
        $yuniUser = User::factory()->create([
            'name' => 'Yuni Asnidar, A.Md.Kep',
            'role' => 'pj_bagian',
            'pj_bagian_department_id' => $deptSeulanga->id,
        ]);
        $yuniEmp = Employee::create([
            'user_id' => $yuniUser->id,
            'department_id' => $deptSeulanga->id,
            'nik_ktp' => '1171010101010002',
            'nip' => 'PJ-YUNI-001',
            'status' => 'active',
        ]);
        $yuniUser->pjDepartments()->sync([$deptSeulanga->id]);

        // Staff in Seulanga
        $userC = User::factory()->create(['name' => 'Pegawai Seulanga']);
        $empC = Employee::create([
            'user_id' => $userC->id,
            'department_id' => $deptSeulanga->id,
            'nik_ktp' => '1171010101010003',
            'nip' => 'EMP-SL-001',
            'status' => 'active',
        ]);

        // 1. Fauzan requests monthly schedule
        Sanctum::actingAs($fauzanUser);
        $resFauzan = $this->getJson('/api/employee-schedules/monthly?year=2026&month=9');
        $resFauzan->assertOk();
        $fauzanEmpIds = collect($resFauzan->json('data'))->pluck('employee_id')->all();

        $this->assertContains($fauzanEmp->id, $fauzanEmpIds);
        $this->assertNotContains($empC->id, $fauzanEmpIds);
        $this->assertNotContains($yuniEmp->id, $fauzanEmpIds);

        // 2. Yuni requests monthly schedule
        Sanctum::actingAs($yuniUser);
        $resYuni = $this->getJson('/api/employee-schedules/monthly?year=2026&month=9');
        $resYuni->assertOk();
        $yuniEmpIds = collect($resYuni->json('data'))->pluck('employee_id')->all();

        $this->assertContains($yuniEmp->id, $yuniEmpIds);
        $this->assertContains($empC->id, $yuniEmpIds);
        $this->assertNotContains($fauzanEmp->id, $yuniEmpIds);
    }
}
