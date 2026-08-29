<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Employee;
use App\Models\Department;
use App\Models\LeaveRequest;
use App\Support\LeaveQuotaHelper;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

class LeaveSundayQuotaTest extends TestCase
{
    use RefreshDatabase;

    public function testSundayExcludedForRegularDepartment()
    {
        $deptReg = Department::create([
            'name' => 'Poli Klinik Rawat Jalan',
            'count_sunday_in_leave' => false,
        ]);

        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'department_id' => $deptReg->id,
            'nik_ktp' => '111222333',
            'status' => 'active',
        ]);

        // Friday 2026-08-07 to Monday 2026-08-10 (Fri, Sat, Sun, Mon = 4 calendar days, Sun excluded => 3 days)
        $lr = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => 'cuti',
            'start_date' => '2026-08-07',
            'end_date' => '2026-08-10',
            'reason' => 'Cuti Tahunan',
            'status' => 'approved',
            'unit_kerja' => 'Poli Klinik Rawat Jalan',
        ]);

        $this->assertEquals(3, $lr->days);
    }

    public function testSundayIncludedForShiftDepartment()
    {
        $deptShift = Department::create([
            'name' => 'Farmasi Depo Poli Eksekutif',
            'count_sunday_in_leave' => true,
        ]);

        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'department_id' => $deptShift->id,
            'nik_ktp' => '111222334',
            'status' => 'active',
        ]);

        // Friday 2026-08-07 to Monday 2026-08-10 (4 days, Sunday included)
        $lr = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => 'cuti',
            'start_date' => '2026-08-07',
            'end_date' => '2026-08-10',
            'reason' => 'Cuti Tahunan Shift',
            'status' => 'approved',
            'unit_kerja' => 'Farmasi Depo Poli Eksekutif',
        ]);

        $this->assertEquals(4, $lr->days);
    }

    public function testCutiLamaDeductsQuotaCorrectly()
    {
        $deptReg = Department::create([
            'name' => 'Farmasi Poli Rawat Jalan',
            'count_sunday_in_leave' => false,
        ]);

        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'department_id' => $deptReg->id,
            'nik_ktp' => '111222335',
            'status' => 'active',
            'custom_leave_quota' => 15, // Custom quota including cuti lama
        ]);

        $now = Carbon::parse('2026-08-10');

        // Approved leave of 3 work days
        LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => 'cuti',
            'start_date' => '2026-08-03',
            'end_date' => '2026-08-05',
            'reason' => 'Cuti Lama Inputted',
            'status' => 'approved',
            'unit_kerja' => 'Farmasi Poli Rawat Jalan',
        ]);

        $used = LeaveQuotaHelper::usedDays($employee, $now);
        $remaining = LeaveQuotaHelper::remainingDays($employee, $now);

        $this->assertEquals(3, $used);
        $this->assertEquals(12, $remaining); // 15 - 3 = 12
    }

    public function testSundayIncludedByUnitKerjaWhenDepartmentIsNull()
    {
        $deptShift = Department::create([
            'name' => 'Transit',
            'count_sunday_in_leave' => true,
        ]);

        $user = User::factory()->create();
        $employee = Employee::create([
            'user_id' => $user->id,
            'department_id' => null,
            'nik_ktp' => '111222336',
            'status' => 'active',
        ]);

        // Sep 10 (Thu) to Sep 13 (Sun) = 4 calendar days
        $lr = LeaveRequest::create([
            'employee_id' => $employee->id,
            'type' => 'cuti',
            'start_date' => '2026-09-10',
            'end_date' => '2026-09-13',
            'reason' => 'Cuti Transit',
            'status' => 'pending',
            'unit_kerja' => 'Transit',
        ]);

        $this->assertEquals(4, $lr->days);
    }
}
