<?php

namespace App\Exports;

use App\Models\Employee;
use App\Models\Setting;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithDrawings;
use Maatwebsite\Excel\Concerns\WithCustomStartCell;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;

class VehicleExport extends DefaultValueBinder implements FromCollection, WithHeadings, ShouldAutoSize, WithStyles, WithDrawings, WithCustomStartCell, WithEvents, WithCustomValueBinder
{
    /**
     * Menyimpan index baris yang bertindak sebagai subheader departemen.
     *
     * @var array
     */
    private array $deptHeaderRows = [];

    /**
     * Mengambil dan menyusun data pegawai dengan format terkelompok per Departemen.
     *
     * @return \Illuminate\Support\Collection
     */
    public function collection()
    {
        $employees = Employee::with(['user', 'department'])
            ->get()
            ->sortBy(fn($emp) => ($emp->department?->name ?? 'Umum') . '_' . ($emp->user?->name ?? 'Karyawan'));

        $rows = [];
        $lastDept = null;
        $no = 1; // Nomor urut berlanjut secara akumulatif (tidak di-reset per departemen)
        $currentRow = 7; // Data dimulai pada baris ke-7

        foreach ($employees as $emp) {
            $dept = $emp->department?->name ?? 'UMUM';

            // Jika departemen berganti, tambahkan baris pembatas departemen
            if ($dept !== $lastDept) {
                $rows[] = [
                    'no'     => $dept, // Nama departemen akan di-merge ke kolom A-G
                    'nip'    => '',
                    'nama'   => '',
                    'motor1' => '',
                    'motor2' => '',
                    'mobil1' => '',
                    'mobil2' => '',
                ];
                $this->deptHeaderRows[] = $currentRow;
                $currentRow++;
                $lastDept = $dept;
            }

            $rows[] = [
                'no'     => $no++,
                'nip'    => $emp->nip,
                'nama'   => $emp->user?->name ?? 'Karyawan',
                'motor1' => $emp->motor_plate_1 ?? '',
                'motor2' => $emp->motor_plate_2 ?? '',
                'mobil1' => $emp->car_plate_1 ?? '',
                'mobil2' => $emp->car_plate_2 ?? '',
            ];
            $currentRow++;
        }

        return collect($rows);
    }

    /**
     * Menentukan sel awal dimulainya tabel data agar menyisakan ruang bagi kop surat.
     *
     * @return string
     */
    public function startCell(): string
    {
        return 'A6';
    }

    /**
     * Mendefinisikan header kolom pada sheet Excel.
     *
     * @return array
     */
    public function headings(): array
    {
        return [
            'No',
            'NIP',
            'Nama Karyawan',
            'Motor 1',
            'Motor 2',
            'Mobil 1',
            'Mobil 2',
        ];
    }

    /**
     * Mengikat nilai cell secara eksplisit untuk mencegah bug NIP berubah menjadi notasi ilmiah.
     *
     * @param Cell  $cell
     * @param mixed $value
     * @return bool
     */
    public function bindValue(Cell $cell, $value)
    {
        if ($cell->getColumn() === 'B' && !empty($value)) {
            $cell->setValueExplicit((string)$value, DataType::TYPE_STRING);
            return true;
        }

        return parent::bindValue($cell, $value);
    }

    /**
     * Menyisipkan logo instansi di sudut kiri atas (koordinat A1).
     *
     * @return Drawing|array
     */
    public function drawings()
    {
        $drawing = new Drawing();
        $drawing->setName('Logo RSUCL');
        $drawing->setDescription('Logo Instansi Rumah Sakit Umum Cempaka Lima');
        
        $logoUrl = Setting::get('logo_url');
        $logoPath = null;

        if ($logoUrl && $logoUrl !== 'none') {
            $path = parse_url($logoUrl, PHP_URL_PATH);
            if ($path) {
                $relativePath = str_replace('/storage/', 'app/public/', $path);
                if (file_exists(storage_path($relativePath))) {
                    $logoPath = storage_path($relativePath);
                }
            }
        }
        
        if (!$logoPath || !file_exists($logoPath)) {
            $logoPath = public_path('rsucl_wide_logo.png');
        }

        if (file_exists($logoPath)) {
            $drawing->setPath($logoPath);
            $drawing->setHeight(54);
            $drawing->setCoordinates('A1');
            return $drawing;
        }

        return [];
    }

    /**
     * Memberikan styling header kolom di baris ke-6.
     *
     * @param Worksheet $sheet
     * @return array
     */
    public function styles(Worksheet $sheet)
    {
        return [
            6 => [
                'font' => ['bold' => true, 'name' => 'Calibri', 'size' => 11, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '16A34A'], // Warna hijau RSUCL
                ],
                'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
            ],
        ];
    }

    /**
     * Meregistrasikan event binding untuk menyusun kop surat serta styling baris subheader departemen.
     *
     * @return array
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                
                // Merge sel untuk teks kop surat di sebelah logo
                $sheet->mergeCells('D1:G1');
                $sheet->mergeCells('D2:G2');
                $sheet->mergeCells('D3:G3');

                // Tulis konten kop surat
                $sheet->setCellValue('D1', 'PT. CEMPAKA LIMA UTAMA');
                $sheet->setCellValue('D2', 'RUMAH SAKIT UMUM CEMPAKA LIMA');
                $sheet->setCellValue('D3', 'LAPORAN DATA PLAT KENDARAAN PEGAWAI');
                
                // Beri styling teks kop surat
                $sheet->getStyle('D1:G1')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => '111827']],
                    'alignment' => ['horizontal' => 'right', 'vertical' => 'bottom']
                ]);
                $sheet->getStyle('D2:G2')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => 'DC2626']], // Warna merah RSUCL
                    'alignment' => ['horizontal' => 'right', 'vertical' => 'center']
                ]);
                $sheet->getStyle('D3:G3')->applyFromArray([
                    'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => '6B7280']],
                    'alignment' => ['horizontal' => 'right', 'vertical' => 'top']
                ]);

                // Garis pembatas tebal di bawah kop surat
                $sheet->mergeCells('A4:G4');
                $sheet->getStyle('A4:G4')->applyFromArray([
                    'borders' => [
                        'bottom' => [
                            'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_DOUBLE,
                            'color' => ['rgb' => '000000']
                        ]
                    ]
                ]);

                // 1. Format nomor urut & NIP di-tengah secara visual untuk baris data umum
                $highestRow = $sheet->getHighestRow();
                $sheet->getStyle("A7:B{$highestRow}")->getAlignment()->setHorizontal('center');

                // 2. Format seluruh baris subheader departemen yang tersimpan (dijalankan TERAKHIR agar alignment left-nya tidak tertimpa center)
                foreach ($this->deptHeaderRows as $rowNum) {
                    $sheet->mergeCells("A{$rowNum}:G{$rowNum}");
                    $sheet->getStyle("A{$rowNum}:G{$rowNum}")->applyFromArray([
                        'font' => ['bold' => true, 'name' => 'Calibri', 'size' => 11, 'color' => ['rgb' => '374151']],
                        'fill' => [
                            'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                            'startColor' => ['rgb' => 'E5E7EB'], // Abu-abu muda
                        ],
                        'alignment' => ['horizontal' => 'left', 'vertical' => 'center'],
                    ]);
                }

                // Tambahkan border tipis pada semua cell data tabel
                $sheet->getStyle("A6:G{$highestRow}")->applyFromArray([
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN,
                            'color' => ['rgb' => 'D1D5DB']
                        ]
                    ]
                ]);
            }
        ];
    }
}
