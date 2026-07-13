<?php
// backend/database/seeders/SpecialLeaveCategorySeeder.php

namespace Database\Seeders;

use App\Models\SpecialLeaveCategory;
use Illuminate\Database\Seeder;

class SpecialLeaveCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            'Naik Haji',
            'Duka/Kepergian Keluarga',
            'Lainnya',
        ];

        foreach ($categories as $name) {
            SpecialLeaveCategory::updateOrCreate(
                ['name' => $name],
                ['is_active' => true]
            );
        }
    }
}
