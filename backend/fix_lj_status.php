<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$all = \App\Models\Schedule::whereNull('parent_id')->get(['id', 'name', 'status', 'proposed_by', 'owner_department_id']);
echo "Total parent schedules: " . $all->count() . "\n";
foreach ($all as $s) {
    echo "ID: {$s->id}, Name: '{$s->name}', Status: '{$s->status}', ProposedBy: " . ($s->proposed_by ?? 'null') . "\n";
}

$updated = \App\Models\Schedule::where(function($q) {
    $q->where('name', 'LIKE', '%Libur Jaga%')
      ->orWhere('name', 'LIKE', '%LJ%');
})->update(['status' => 'approved', 'proposed_by' => null]);

echo "Updated $updated Libur Jaga schedules.\n";
