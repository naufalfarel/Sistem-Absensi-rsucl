<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            // Akurasi GPS dari client (dalam meter) — untuk audit trail
            $table->decimal('accuracy', 8, 2)->nullable()->after('longitude');

            // Hasil validasi geofence di server-side (Haversine)
            $table->boolean('is_within_geofence')->default(false)->after('accuracy');
        });
    }

    public function down(): void
    {
        Schema::table('attendance', function (Blueprint $table) {
            $table->dropColumn(['accuracy', 'is_within_geofence']);
        });
    }
};
