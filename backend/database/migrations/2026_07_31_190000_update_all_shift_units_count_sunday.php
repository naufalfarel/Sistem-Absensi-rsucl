<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $keywords = [
            'igd', 'gawat darurat', 'rawat inap', 'ranap', 'depo', 'icu', 'nicu', 
            'juru masak', 'cuci piring', 'laundry', 'kasir', 'gizi', 'cssd', 
            'transporter', 'kamar bersalin', 'rekam medis', 'ambulance'
        ];

        $departments = DB::table('departments')->get();
        foreach ($departments as $dept) {
            $nameLower = strtolower($dept->name);
            foreach ($keywords as $kw) {
                if (str_contains($nameLower, $kw)) {
                    DB::table('departments')->where('id', $dept->id)->update(['count_sunday_in_leave' => true]);
                    break;
                }
            }
        }
    }

    public function down(): void
    {
    }
};
