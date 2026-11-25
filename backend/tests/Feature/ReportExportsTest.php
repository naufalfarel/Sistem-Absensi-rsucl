<?php

namespace Tests\Feature;

use App\Models\AssignmentLetter;
use App\Models\Attendance;
use App\Models\Department;
use App\Models\DisciplinarySanction;
use App\Models\Employee;
use App\Models\ResignationRequest;
use App\Models\Schedule;
use App\Models\Setting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportExportsTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_attendance_history_and_monthly_rekap_handle_work_date_roster_and_overnight_shift(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-25 10:00:00', 'Asia/Jakarta'));

        $admin = User::factory()->create(['role' => 'admin']);
        $dept = Department::create(['name' => 'IGD']);

        $rosterUser = User::factory()->create(['name' => 'Perawat Roster', 'role' => 'employee']);
        $rosterEmployee = Employee::create([
            'user_id' => $rosterUser->id,
            'department_id' => $dept->id,
            'nik_ktp' => '1100110011000001',
            'status' => 'active',
        ]);

        $nightShift = Schedule::create([
            'name' => 'Shift Malam',
            'start_time' => '20:00:00',
            'end_time' => '08:00:00',
        ]);

        // Prioritas 1 roster pada tanggal 2026-11-01 (hari Minggu) tanpa jadwal mingguan Prioritas 2
        DB::table('employee_schedule')->insert([
            'employee_id' => $rosterEmployee->id,
            'schedule_id' => $nightShift->id,
            'day_of_week' => null,
            'work_date' => '2026-11-01',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Attendance::create([
            'employee_id' => $rosterEmployee->id,
            'schedule_id' => $nightShift->id,
            'date' => '2026-11-01',
            'check_in' => '20:00:00',
            'check_out' => '08:00:00',
            'status' => 'hadir',
        ]);

        // Juga test hari ini (2026-11-25) untuk employee dengan roster agar cabang isToday() juga teruji
        DB::table('employee_schedule')->insert([
            'employee_id' => $rosterEmployee->id,
            'schedule_id' => $nightShift->id,
            'day_of_week' => null,
            'work_date' => '2026-11-25',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $historyRes = $this->getJson('/api/attendance/history?month=11&year=2026');
        $historyRes->assertOk()->assertJson(['success' => true]);

        $nov1 = collect($historyRes->json('data'))
            ->first(fn ($row) => ($row['employee_id'] ?? null) === $rosterEmployee->id && ($row['date'] ?? null) === '2026-11-01');
        $this->assertNotNull($nov1);
        $this->assertSame(720, $nov1['duration_min']);

        $rekapRes = $this->getJson('/api/reports/monthly-rekap?month=11&year=2026');
        $rekapRes->assertOk()->assertJson(['success' => true]);

        $empRekap = collect($rekapRes->json('data'))
            ->firstWhere('nik_ktp', '1100110011000001');
        $this->assertNotNull($empRekap);
        $this->assertSame(720, $empRekap['duration_min']);
        $this->assertSame(1, $empRekap['hadir']);
    }

    public function test_lateness_rekap_filters_by_department_id_and_department_name(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-25 10:00:00', 'Asia/Jakarta'));

        $admin = User::factory()->create(['role' => 'admin']);
        $deptA = Department::create(['name' => 'Poli Anak']);
        $deptB = Department::create(['name' => 'Poli Umum']);

        $shift = Schedule::create([
            'name' => 'Pagi',
            'start_time' => '08:00:00',
            'end_time' => '15:00:00',
        ]);

        $empA = Employee::create([
            'user_id' => User::factory()->create(['name' => 'Pegawai A', 'role' => 'employee'])->id,
            'department_id' => $deptA->id,
            'nik_ktp' => '1100220033000001',
            'status' => 'active',
        ]);
        $empB = Employee::create([
            'user_id' => User::factory()->create(['name' => 'Pegawai B', 'role' => 'employee'])->id,
            'department_id' => $deptB->id,
            'nik_ktp' => '1100220033000002',
            'status' => 'active',
        ]);

        Attendance::create([
            'employee_id' => $empA->id,
            'schedule_id' => $shift->id,
            'date' => '2026-11-10',
            'check_in' => '08:20:00',
            'status' => 'telat',
        ]);
        Attendance::create([
            'employee_id' => $empB->id,
            'schedule_id' => $shift->id,
            'date' => '2026-11-10',
            'check_in' => '08:30:00',
            'status' => 'telat',
        ]);

        Sanctum::actingAs($admin);

        // Filter menggunakan ID unit kerja (format default MonthYearDeptFilter)
        $byId = $this->getJson('/api/reports/lateness?month=11&year=2026&department=' . $deptA->id);
        $byId->assertOk()->assertJson(['success' => true]);
        $recordsById = $byId->json('data.records');
        $this->assertCount(1, $recordsById);
        $this->assertSame('1100220033000001', $recordsById[0]['nik_ktp']);

        // Filter menggunakan nama unit kerja
        $byName = $this->getJson('/api/reports/lateness?month=11&year=2026&department=' . urlencode('Poli Umum'));
        $byName->assertOk()->assertJson(['success' => true]);
        $recordsByName = $byName->json('data.records');
        $this->assertCount(1, $recordsByName);
        $this->assertSame('1100220033000002', $recordsByName[0]['nik_ktp']);
    }

    public function test_excel_binary_exports_succeed_with_invalid_logo_or_empty_department(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $emptyDept = Department::create(['name' => 'Unit Kosong']);
        $deptWithStaff = Department::create(['name' => 'Seulanga']);

        Employee::create([
            'user_id' => User::factory()->create(['name' => 'Pegawai Uji', 'role' => 'employee'])->id,
            'department_id' => $deptWithStaff->id,
            'nik_ktp' => '1100330044000001',
            'status' => 'active',
        ]);

        // Simulasikan custom logo dengan ekstensi tidak didukung PhpSpreadsheet / file hilang
        Setting::set('logo_url', '/storage/logos/custom-logo.webp');

        Sanctum::actingAs($admin);

        // Empty department filter -> 0 data rows ($highestRow = 6) harus tetap valid tanpa error range
        $empExportEmpty = $this->get('/api/reports/employees/export?department_id=' . $emptyDept->id);
        $empExportEmpty->assertOk();
        $this->assertNotEmpty($empExportEmpty->streamedContent());

        foreach ([
            '/api/reports/employees/export',
            '/api/reports/vehicles/export',
            '/api/reports/social-media/export',
            '/api/reports/faskes/export',
        ] as $endpoint) {
            $res = $this->get($endpoint);
            $res->assertOk();
            $this->assertNotEmpty($res->streamedContent());
        }
    }

    public function test_admin_hr_rekap_and_attendance_pagination_limits_support_full_export(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-25 10:00:00', 'Asia/Jakarta'));

        $admin = User::factory()->create(['role' => 'admin']);
        $dept = Department::create(['name' => 'Jeumpa B']);
        $employee = Employee::create([
            'user_id' => User::factory()->create(['name' => 'Pegawai SDM', 'role' => 'employee'])->id,
            'department_id' => $dept->id,
            'nik_ktp' => '1100440055000001',
            'status' => 'active',
        ]);

        for ($i = 1; $i <= 18; $i++) {
            AssignmentLetter::create([
                'employee_id' => $employee->id,
                'title' => "Surat Tugas {$i}",
                'issuing_institution' => 'RSUCL',
                'purpose' => 'Pelatihan',
                'start_date' => '2026-11-05',
                'end_date' => '2026-11-06',
                'document_url' => '/storage/dummy.pdf',
                'status' => 'approved',
            ]);

            ResignationRequest::create([
                'employee_id' => $employee->id,
                'request_date' => '2026-11-10',
                'effective_date' => '2026-12-15',
                'notice_days' => 35,
                'reason' => "Alasan {$i}",
                'status' => 'approved',
            ]);

            DisciplinarySanction::create([
                'employee_id' => $employee->id,
                'type' => 'teguran',
                'admin_note' => "Catatan {$i}",
                'created_by' => $admin->id,
            ]);
        }

        // Buat 20 pegawai absen pada tanggal 2026-11-10 untuk uji /api/attendance?per_page=1000
        for ($i = 1; $i <= 20; $i++) {
            $u = User::factory()->create(['name' => "Staf {$i}", 'role' => 'employee']);
            $e = Employee::create([
                'user_id' => $u->id,
                'department_id' => $dept->id,
                'nik_ktp' => sprintf('110055006600%04d', $i),
                'status' => 'active',
            ]);
            Attendance::create([
                'employee_id' => $e->id,
                'date' => '2026-11-10',
                'check_in' => '08:00:00',
                'status' => 'hadir',
            ]);
        }

        Sanctum::actingAs($admin);

        foreach ([
            '/api/assignment-letters?start_date=2026-11-01&end_date=2026-11-30&per_page=9999',
            '/api/resignation-requests?status=approved&per_page=9999',
            '/api/disciplinary-sanctions?per_page=9999',
        ] as $url) {
            $res = $this->getJson($url);
            $res->assertOk()->assertJson(['success' => true]);
            $this->assertCount(18, $res->json('data'), "Endpoint {$url} tidak boleh terpotong di 15 item.");
            $this->assertSame(9999, $res->json('meta.per_page'));
        }

        $attRes = $this->getJson('/api/attendance?date=2026-11-10&per_page=1000');
        $attRes->assertOk()->assertJson(['success' => true]);
        $this->assertSame(1000, $attRes->json('meta.per_page'));
        $this->assertGreaterThanOrEqual(20, count($attRes->json('data')));
    }
}
