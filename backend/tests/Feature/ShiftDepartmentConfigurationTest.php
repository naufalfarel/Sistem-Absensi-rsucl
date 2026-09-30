<?php

namespace Tests\Feature;

use App\Models\Department;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShiftDepartmentConfigurationTest extends TestCase
{
    use RefreshDatabase;

    public function test_data_migration_backfills_shift_aliases_without_disabling_regular_units(): void
    {
        Department::where('name', 'Poli Gigi')->delete();

        $shiftUnits = [
            'Depo Farmasi',
            'Farmasi Depo 1',
            'Depo Poli Eksekutif',
            'Laboratorium',
            'Radiologi',
            'Rawat Inap Mawar',
            'IGP',
            'Instalasi Gawat Darurat',
            'ICU',
            'NICU',
            'Rekam Medis IGP',
            'Rekam Medis IGD',
            'Instasi Bedah Central',
            'Instalasi Bedah Sentral',
            'CSSD',
        ];

        foreach ($shiftUnits as $name) {
            Department::create([
                'name' => $name,
                'count_sunday_in_leave' => false,
            ]);
        }

        $existingCustomShift = Department::create([
            'name' => 'Asuransi',
            'count_sunday_in_leave' => true,
        ]);
        $regularUnits = [
            'Casemix', 'Rekam Medis dan Penyimpanan', 'Poli Bedah', 'Bedah',
            'Kasir', 'Instalasi Laundry', 'Administrasi Laboratorium',
            'Kepala Instalasi Rawat Inap',
        ];
        foreach ($regularUnits as $name) {
            Department::create(['name' => $name, 'count_sunday_in_leave' => false]);
        }

        $migration = require database_path(
            'migrations/2026_09_29_120000_backfill_shift_department_leave_flags.php'
        );
        $migration->up();

        foreach ($shiftUnits as $name) {
            $this->assertTrue(
                (bool) Department::where('name', $name)->value('count_sunday_in_leave'),
                "Unit {$name} seharusnya ditandai sebagai unit shift."
            );
        }

        $this->assertTrue((bool) $existingCustomShift->fresh()->count_sunday_in_leave);
        foreach ($regularUnits as $name) {
            $this->assertFalse(
                (bool) Department::where('name', $name)->value('count_sunday_in_leave'),
                "Migration tidak boleh mengubah konfigurasi unit reguler {$name}."
            );
        }
        $this->assertDatabaseHas('departments', [
            'name' => 'Poli Gigi',
            'count_sunday_in_leave' => false,
        ]);

        // Menjalankan kembali migration data tidak boleh membuat unit ganda.
        $migration->up();
        $this->assertSame(1, Department::where('name', 'Poli Gigi')->count());
    }

    public function test_database_seeder_sets_fresh_install_shift_flags_and_preserves_existing_department_id(): void
    {
        $existingPoliGigi = Department::where('name', 'Poli Gigi')->firstOrFail();

        $this->seed(DatabaseSeeder::class);

        foreach ([
            'ICU',
            'IGD',
            'Laboratorium',
            'Radiologi',
            'Jeumpa A',
            'Depo 1',
            'Rekam Medis IGD',
            'Instalasi Bedah Sentral',
            'Instalasi CSSD',
            'Kasir',
            'Instalasi Laundry',
            'Instalasi Ambulance',
            'Transporter',
        ] as $name) {
            $this->assertTrue(
                (bool) Department::where('name', $name)->value('count_sunday_in_leave'),
                "Seeder harus menandai {$name} sebagai unit shift."
            );
        }

        foreach (['Asuransi', 'Casemix', 'Poli Gigi', 'Rekam Medis dan Penyimpanan', 'Bedah'] as $name) {
            $this->assertFalse(
                (bool) Department::where('name', $name)->value('count_sunday_in_leave'),
                "Seeder harus mempertahankan {$name} sebagai unit reguler."
            );
        }

        $this->assertSame($existingPoliGigi->id, Department::where('name', 'Poli Gigi')->value('id'));
        $this->assertSame(1, Department::where('name', 'Poli Gigi')->count());
    }
}
