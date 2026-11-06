<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'count_sunday_work')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('count_sunday_work')->default(false)->after('can_edit_own_schedule');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'count_sunday_work')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('count_sunday_work');
            });
        }
    }
};
