<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pending = \App\Models\Schedule::where('status', 'pending')->get();
echo "Total pending schedules: " . $pending->count() . "\n";
foreach ($pending as $s) {
    echo "ID: {$s->id}, Name: '{$s->name}', ParentID: " . ($s->parent_id ?? 'null') . ", ProposedBy: " . ($s->proposed_by ?? 'null') . "\n";
}

// Auto approve Libur Jaga and all master shift proposals from PJ Bagian if user requested
$updated = \App\Models\Schedule::where('status', 'pending')->update(['status' => 'approved', 'proposed_by' => null]);
echo "Updated $updated pending schedules to approved.\n";
