<?php

namespace App\Exports\Concerns;

use App\Models\Setting;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

trait ResolvesExportLogo
{
    /**
     * Resolve and validate the hospital logo file path for PhpSpreadsheet drawings.
     * Ensures unsupported formats (e.g. WebP/SVG) or missing files on VPS/local never crash exports.
     */
    protected function buildLogoDrawing(): array|Drawing
    {
        $logoPath = $this->resolveValidLogoPath();
        if (! $logoPath) {
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

    protected function resolveValidLogoPath(): ?string
    {
        $candidates = [];
        $logoUrl = Setting::get('logo_url');

        if ($logoUrl && $logoUrl !== 'none') {
            $urlPath = parse_url($logoUrl, PHP_URL_PATH);
            if ($urlPath) {
                $candidates[] = storage_path(str_replace('/storage/', 'app/public/', $urlPath));
                $candidates[] = public_path(ltrim($urlPath, '/'));
            }
        }

        $candidates[] = public_path('rsucl_wide_logo.png');

        foreach ($candidates as $candidate) {
            if (! $candidate || ! is_file($candidate) || ! is_readable($candidate)) {
                continue;
            }
            $info = @getimagesize($candidate);
            if ($info && in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG, IMAGETYPE_GIF, IMAGETYPE_BMP], true)) {
                return $candidate;
            }
        }

        return null;
    }
}
