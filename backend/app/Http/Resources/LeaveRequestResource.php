<?php
// backend/app/Http/Resources/LeaveRequestResource.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaveRequestResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'type'           => $this->type,
            'special_leave_category_id' => $this->special_leave_category_id,
            'special_leave_category' => $this->specialLeaveCategory ? [
                'id' => $this->specialLeaveCategory->id,
                'name' => $this->specialLeaveCategory->name,
            ] : null,
            'start_date'     => $this->start_date?->toDateString(),
            'end_date'       => $this->end_date?->toDateString(),
            'days'           => $this->days_count,
            'reason'         => $this->reason,
            'attachment_url' => $this->attachment_url ? url($this->attachment_url) : null,
            'status'         => $this->status,
            'admin_note'     => $this->admin_note,
            'reviewed_at'    => $this->reviewed_at?->toDateTimeString(),
            'created_at'     => $this->created_at?->toDateTimeString(),
            'employee'       => [
                'id'         => $this->employee?->id,
                'name'       => $this->employee?->user?->name,
                'nip'        => $this->employee?->nip,
                'department' => $this->employee?->department?->name,
            ],
            'reviewer'       => $this->reviewer ? ['name' => $this->reviewer->name] : null,
        ];
    }
}
