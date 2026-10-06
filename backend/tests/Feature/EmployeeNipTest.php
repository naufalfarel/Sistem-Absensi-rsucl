<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Position;
use App\Models\User;
use App\Services\EmployeeNipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EmployeeNipTest extends TestCase
{
    use RefreshDatabase;

    public function test_next_nip_uses_one_sequence_for_medical_and_non_medical_employees(): void
    {
        $department = Department::create(['name' => 'Umum']);
        $medicalPosition = Position::create(['name' => 'Perawat']);
        $nonMedicalPosition = Position::create(['name' => 'Staff Admin']);

        $this->createEmployee($department, $medicalPosition, '2401001', '2024-01-01', 'NIK-001');
        $this->createEmployee($department, $nonMedicalPosition, '2502002', '2025-01-01', 'NIK-002');

        $nipService = app(EmployeeNipService::class);

        $this->assertSame('2601003', $nipService->generate('2026-02-13', 'Dokter Umum'));
        $this->assertSame('2602003', $nipService->generate('2026-02-13', 'Staff IT'));
    }

    public function test_rebuild_orders_existing_employees_by_join_date_then_id(): void
    {
        $department = Department::create(['name' => 'Umum']);
        $medicalPosition = Position::create(['name' => 'Dokter Umum']);
        $nonMedicalPosition = Position::create(['name' => 'Keuangan']);

        $newerMedical = $this->createEmployee($department, $medicalPosition, null, '2026-03-10', 'NIK-003');
        $oldestNonMedical = $this->createEmployee($department, $nonMedicalPosition, null, '2024-01-05', 'NIK-004');
        $newerNonMedical = $this->createEmployee($department, $nonMedicalPosition, null, '2026-03-10', 'NIK-005');

        $this->artisan('app:generate-nip', ['--rebuild' => true])
            ->assertSuccessful();

        $this->assertSame('2402001', $oldestNonMedical->fresh()->nip);
        $this->assertSame('2601002', $newerMedical->fresh()->nip);
        $this->assertSame('2602003', $newerNonMedical->fresh()->nip);
    }

    public function test_admin_created_employee_receives_the_next_global_nip(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $department = Department::create(['name' => 'Rawat Jalan']);
        $medicalPosition = Position::create(['name' => 'Perawat']);
        $nonMedicalPosition = Position::create(['name' => 'Staff Keuangan']);
        $this->createEmployee($department, $nonMedicalPosition, '2502001', '2025-01-01', 'NIK-006');

        $response = $this->postJson('/api/employees', [
            'name' => 'Pegawai Medis Baru',
            'email' => 'pegawai.baru@example.test',
            'nik_ktp' => 'NIK-007',
            'username' => 'pegawai.baru',
            'password' => '123456',
            'department_id' => $department->id,
            'position_id' => $medicalPosition->id,
            'join_date' => '2026-02-13',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.nip', '2601002');

        $this->assertDatabaseHas('employees', [
            'nik_ktp' => 'NIK-007',
            'nip' => '2601002',
        ]);
    }

    private function createEmployee(
        Department $department,
        Position $position,
        ?string $nip,
        string $joinDate,
        string $nikKtp,
    ): Employee {
        $user = User::factory()->create([
            'role' => 'employee',
            'nik_ktp' => $nikKtp,
        ]);

        return Employee::create([
            'user_id' => $user->id,
            'department_id' => $department->id,
            'position_id' => $position->id,
            'nik_ktp' => $nikKtp,
            'nip' => $nip,
            'join_date' => $joinDate,
        ]);
    }
}
