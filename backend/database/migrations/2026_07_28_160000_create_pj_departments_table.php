<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('pj_departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('department_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            $table->unique(['user_id', 'department_id']);
        });

        // Salin data penugasan PJ lama dari users.pj_bagian_department_id ke tabel baru
        try {
            $oldPjs = \Illuminate\Support\Facades\DB::table('users')
                ->where('role', 'pj_bagian')
                ->whereNotNull('pj_bagian_department_id')
                ->get();

            foreach ($oldPjs as $pj) {
                \Illuminate\Support\Facades\DB::table('pj_departments')->insertOrIgnore([
                    'user_id'       => $pj->id,
                    'department_id' => $pj->pj_bagian_department_id,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]);
            }
        } catch (\Exception $e) {
            // Abaikan jika data users belum di-migrate/tidak ada kolom tersebut
        }
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pj_departments');
    }
};
