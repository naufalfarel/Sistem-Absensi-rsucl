<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Models\Attendance;
use Carbon\Carbon;

class OvertimeRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $employee = $this->employee;
        $dateStr = $this->date ? Carbon::parse($this->date)->toDateString() : null;

        // Cari data attendance pembanding jika user adalah admin
        $systemCheckoutData = null;
        if ($request->user() && $request->user()->role === 'admin' && $employee && $dateStr) {
            $attendance = Attendance::where('employee_id', $employee->id)
                ->whereDate('date', $dateStr)
                ->first();

            $systemCheckoutData = [
                'check_in'         => $attendance?->check_in,
                'check_out'        => $attendance?->check_out,
                'is_overtime'      => $attendance ? (bool)$attendance->is_overtime : false,
                'overtime_minutes' => $attendance?->overtime_minutes ?? 0,
            ];
        }

        return [
            'id'            => $this->id,
            'employee_id'   => $this->employee_id,
            'employee'      => $this->employee ? [
                'id'         => $this->employee->id,
                'name'       => $this->employee->user?->name,
                'nip'        => $this->employee->nip,
                'department' => $this->employee->department?->name,
            ] : null,
            'date'          => $dateStr,
            'reason'        => $this->reason,
            'photo_url'     => $this->photo_url ? url($this->photo_url) : null,
            'location_note' => $this->location_note,
            'status'        => $this->status,
            'admin_note'    => $this->admin_note,
            'reviewed_by'   => $this->reviewed_by,
            'reviewed_at'   => $this->reviewed_at ? $this->reviewed_at->toDateTimeString() : null,
            'created_at'    => $this->created_at ? $this->created_at->toDateTimeString() : null,
            'updated_at'    => $this->updated_at ? $this->updated_at->toDateTimeString() : null,
            'system_checkout_data' => $systemCheckoutData,
        ];
    }
}
