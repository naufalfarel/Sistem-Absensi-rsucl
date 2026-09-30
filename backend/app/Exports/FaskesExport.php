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
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class FaskesExport extends DefaultValueBinder implements FromCollection, WithHeadings, ShouldAutoSize, WithStyles, WithDrawings, WithCustomStartCell, WithEvents, WithCustomValueBinder
{
    private array $deptHeaderRows = [];

    public function collection()
    {
        $employees = Employee::with(['user', 'department', 'position'])
            ->get()
            ->sortBy(fn($employee) => ($employee->department?->name ?? 'Umum') . '_' . ($employee->user?->name ?? 'Karyawan'));

        $rows = [];
        $lastDepartment = null;
        $number = 1;
        $currentRow = 7;

        foreach ($employees as $employee) {
            $department = $employee->department?->name ?? 'UMUM';

            if ($department !== $lastDepartment) {
                $rows[] = [$department, '', '', '', '', '', ''];
                $this->deptHeaderRows[] = $currentRow++;
                $lastDepartment = $department;
            }

            $rows[] = [
                $number++,
                $employee->nik_ktp,
                $employee->user?->name ?? 'Karyawan',
                $employee->position?->name ?? '',
                $employee->faskes_tk ?? '',
                $employee->faskes_location ?? '',
                $employee->status === 'active' ? 'Aktif' : 'Tidak Aktif',
            ];
            $currentRow++;
        }

        return collect($rows);
    }

    public function startCell(): string
    {
        return 'A6';
    }

    public function headings(): array
    {
        return ['No', 'NIK KTP', 'Nama Karyawan', 'Jabatan', 'Faskes Tingkat', 'Lokasi Faskes', 'Status Pegawai'];
    }

    public function bindValue(Cell $cell, $value)
    {
        if ($cell->getColumn() === 'B' && !empty($value)) {
            $cell->setValueExplicit((string)$value, DataType::TYPE_STRING);
            return true;
        }

        return parent::bindValue($cell, $value);
    }

    public function drawings()
    {
        $logoUrl = Setting::get('logo_url');
        $logoPath = null;

        if ($logoUrl && $logoUrl !== 'none') {
            $path = parse_url($logoUrl, PHP_URL_PATH);
            if ($path) {
                $candidate = storage_path(str_replace('/storage/', 'app/public/', $path));
                if (file_exists($candidate)) {
                    $logoPath = $candidate;
                }
            }
        }

        if (!$logoPath || !file_exists($logoPath)) {
            $logoPath = public_path('rsucl_wide_logo.png');
        }

        if (!file_exists($logoPath)) {
            return [];
        }

        $drawing = new Drawing();
        $drawing->setName('Logo RSUCL');
        $drawing->setDescription('Logo Instansi Rumah Sakit Umum Cempaka Lima');
        $drawing->setPath($logoPath);
        $drawing->setHeight(54);
        $drawing->setCoordinates('A1');

        return $drawing;
    }

    public function styles(Worksheet $sheet)
    {
        return [
            6 => [
                'font' => ['bold' => true, 'name' => 'Calibri', 'size' => 11, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '0891B2'],
                ],
                'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
            ],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $sheet->mergeCells('D1:G1');
                $sheet->mergeCells('D2:G2');
                $sheet->mergeCells('D3:G3');
                $sheet->setCellValue('D1', 'PT. CEMPAKA LIMA UTAMA');
                $sheet->setCellValue('D2', 'RUMAH SAKIT UMUM CEMPAKA LIMA');
                $sheet->setCellValue('D3', 'LAPORAN DATA FASILITAS KESEHATAN PEGAWAI');

                $sheet->getStyle('D1:G1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => '111827']],
                    'alignment' => ['horizontal' => 'right', 'vertical' => 'bottom'],
                ]);
                $sheet->getStyle('D2:G2')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'DC2626']],
                    'alignment' => ['horizontal' => 'right', 'vertical' => 'center'],
                ]);
                $sheet->getStyle('D3:G3')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => '6B7280']],
                    'alignment' => ['horizontal' => 'right', 'vertical' => 'top'],
                ]);

                $sheet->mergeCells('A4:G4');
                $sheet->getStyle('A4:G4')->applyFromArray([
                    'borders' => ['bottom' => [
                        'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_DOUBLE,
                        'color' => ['rgb' => '000000'],
                    ]],
                ]);

                $highestRow = $sheet->getHighestRow();
                $sheet->getStyle("A7:B{$highestRow}")->getAlignment()->setHorizontal('center');
                $sheet->getStyle("E7:E{$highestRow}")->getAlignment()->setHorizontal('center');
                $sheet->getStyle("G7:G{$highestRow}")->getAlignment()->setHorizontal('center');

                foreach ($this->deptHeaderRows as $rowNumber) {
                    $sheet->mergeCells("A{$rowNumber}:G{$rowNumber}");
                    $sheet->getStyle("A{$rowNumber}:G{$rowNumber}")->applyFromArray([
                        'font' => ['bold' => true, 'name' => 'Calibri', 'size' => 11, 'color' => ['rgb' => '374151']],
                        'fill' => [
                            'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                            'startColor' => ['rgb' => 'E5E7EB'],
                        ],
                        'alignment' => ['horizontal' => 'left', 'vertical' => 'center'],
                    ]);
                }

                $sheet->getStyle("A6:G{$highestRow}")->applyFromArray([
                    'borders' => ['allBorders' => [
                        'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN,
                        'color' => ['rgb' => 'D1D5DB'],
                    ]],
                ]);
            },
        ];
    }
}
