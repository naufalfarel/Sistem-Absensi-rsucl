<?php

namespace App\Exports;

use App\Models\Employee;
use App\Models\Setting;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithCustomStartCell;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithDrawings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class EmployeeExport extends DefaultValueBinder implements FromCollection, WithHeadings, ShouldAutoSize, WithStyles, WithDrawings, WithCustomStartCell, WithEvents, WithCustomValueBinder
{
    public function __construct(private readonly ?int $departmentId = null)
    {
    }

    public function collection()
    {
        return Employee::with(['user', 'department', 'position'])
            ->when($this->departmentId, fn ($query) => $query->where('department_id', $this->departmentId))
            ->orderByRaw('join_date IS NULL')
            ->orderBy('join_date')
            ->orderBy('id')
            ->get()
            ->values()
            ->map(fn (Employee $employee, int $index) => [
                'no' => $index + 1,
                'nip' => $employee->nip ?? '',
                'nik_ktp' => $employee->nik_ktp,
                'name' => $employee->user?->name ?? 'Karyawan',
                'department' => $employee->department?->name ?? 'Umum',
                'position' => $employee->position?->name ?? '',
                'phone' => $employee->phone ?? '',
                'gender' => $employee->gender ?? '',
                'join_date' => $employee->join_date?->format('d-m-Y') ?? '',
                'employment_type' => match (substr((string) $employee->nip, 2, 2)) {
                    '01' => 'Medis',
                    '02' => 'Non-Medis',
                    default => '-',
                },
                'status' => $employee->status === 'active' ? 'Aktif' : 'Tidak Aktif',
            ]);
    }

    public function headings(): array
    {
        return [
            'No', 'NIP', 'NIK KTP', 'Nama Pegawai', 'Unit Kerja', 'Jabatan',
            'No. Telepon / WA', 'Jenis Kelamin', 'Tanggal Masuk', 'Status Tenaga', 'Status Akun',
        ];
    }

    public function startCell(): string
    {
        return 'A6';
    }

    public function bindValue(Cell $cell, $value)
    {
        if (in_array($cell->getColumn(), ['B', 'C'], true) && $value !== '') {
            $cell->setValueExplicit((string) $value, DataType::TYPE_STRING);

            return true;
        }

        return parent::bindValue($cell, $value);
    }

    public function drawings()
    {
        $logoPath = $this->resolveLogoPath();
        if (! $logoPath) {
            return [];
        }

        $drawing = new Drawing();
        $drawing->setName('Logo RSUCL');
        $drawing->setDescription('Logo Rumah Sakit Umum Cempaka Lima');
        $drawing->setPath($logoPath);
        $drawing->setHeight(54);
        $drawing->setCoordinates('A1');

        return $drawing;
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            6 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '15803D']],
                'alignment' => ['horizontal' => 'center', 'vertical' => 'center', 'wrapText' => true],
            ],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event): void {
                $sheet = $event->sheet->getDelegate();
                $sheet->mergeCells('D1:K1');
                $sheet->mergeCells('D2:K2');
                $sheet->mergeCells('D3:K3');
                $sheet->setCellValue('D1', 'PT. CEMPAKA LIMA UTAMA');
                $sheet->setCellValue('D2', 'RUMAH SAKIT UMUM CEMPAKA LIMA');
                $sheet->setCellValue('D3', 'LAPORAN DATA INDUK PEGAWAI DAN NIP');

                $sheet->getStyle('D1:K1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11],
                    'alignment' => ['horizontal' => 'right'],
                ]);
                $sheet->getStyle('D2:K2')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'DC2626']],
                    'alignment' => ['horizontal' => 'right'],
                ]);
                $sheet->getStyle('D3:K3')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => '6B7280']],
                    'alignment' => ['horizontal' => 'right'],
                ]);

                $sheet->mergeCells('A4:K4');
                $sheet->getStyle('A4:K4')->getBorders()->getBottom()
                    ->setBorderStyle(Border::BORDER_DOUBLE)
                    ->getColor()->setRGB('000000');

                $highestRow = $sheet->getHighestRow();
                $sheet->getStyle("A6:K{$highestRow}")->getBorders()->getAllBorders()
                    ->setBorderStyle(Border::BORDER_THIN)
                    ->getColor()->setRGB('D1D5DB');
                $sheet->getStyle("A7:C{$highestRow}")->getAlignment()->setHorizontal('center');
                $sheet->getStyle("G7:K{$highestRow}")->getAlignment()->setHorizontal('center');
                $sheet->freezePane('A7');
                $sheet->setAutoFilter("A6:K{$highestRow}");
            },
        ];
    }

    private function resolveLogoPath(): ?string
    {
        $logoUrl = Setting::get('logo_url');
        if ($logoUrl && $logoUrl !== 'none') {
            $urlPath = parse_url($logoUrl, PHP_URL_PATH);
            $candidate = $urlPath ? storage_path(str_replace('/storage/', 'app/public/', $urlPath)) : null;
            if ($candidate && file_exists($candidate)) {
                return $candidate;
            }
        }

        $fallback = public_path('rsucl_wide_logo.png');

        return file_exists($fallback) ? $fallback : null;
    }
}
