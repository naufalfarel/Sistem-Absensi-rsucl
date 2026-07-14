<?php

namespace App\Support;

use App\Models\Holiday;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class HolidaySyncer
{
    /**
     * Sinkronisasi data hari libur nasional Indonesia untuk tahun tertentu dari repositori online.
     *
     * @param int $year
     * @return int Jumlah hari libur yang berhasil disimpan/diperbarui
     */
    public static function sync(int $year): int
    {
        $url = 'https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json';
        
        try {
            $response = Http::timeout(15)->get($url);
            if (!$response->successful()) {
                throw new \Exception("Gagal mengambil data hari libur dari server: HTTP " . $response->status());
            }
            
            $data = $response->json();
            if (!is_array($data)) {
                throw new \Exception("Format JSON data hari libur tidak valid.");
            }
            
            $count = 0;
            $blocklist = [
                '2026-02-15', // Isra Mikraj salah/ganda (Correct is 16 Jan 2026)
                '2026-01-29', // Imlek 2025 ganda
                '2026-05-13', // Waisak ganda
            ];
            foreach ($data as $dateStr => $details) {
                // Filter berdasarkan tahun
                if (str_starts_with($dateStr, (string)$year)) {
                    if (in_array($dateStr, $blocklist)) {
                        continue;
                    }
                    $isHoliday = $details['holiday'] ?? false;
                    if ($isHoliday) {
                        $name = $details['summary'][0] ?? 'Hari Libur';
                        
                        Holiday::updateOrCreate(
                            ['date' => $dateStr],
                            ['name' => $name]
                        );
                        $count++;
                    }
                }
            }
            
            return $count;
        } catch (\Exception $e) {
            Log::error('Holiday Synchronization Failed: ' . $e->getMessage());
            throw $e;
        }
    }
}
