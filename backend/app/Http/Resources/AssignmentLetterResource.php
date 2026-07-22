<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssignmentLetterResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'employee_id'         => $this->employee_id,
            'source'              => $this->source ?? 'employee_request',
            'letter_number'       => $this->letter_number,
            'title'               => $this->title,
            'issuing_institution' => $this->issuing_institution,
            'purpose'             => $this->purpose,
            'start_date'          => $this->start_date ? $this->start_date->toDateString() : null,
            'end_date'            => $this->end_date ? $this->end_date->toDateString() : null,
            'document_url'          => $this->document_url ? url($this->document_url) : null,
            'attendance_proof_url'  => $this->attendance_proof_url ? url($this->attendance_proof_url) : null,
            'activity_notes'        => $this->activity_notes,
            'status'                => $this->status,
            'admin_note'          => $this->admin_note,
            'reviewed_by'         => $this->reviewer?->name,
            'reviewed_at'         => $this->reviewed_at ? $this->reviewed_at->toDateTimeString() : null,
            'created_at'          => $this->created_at ? $this->created_at->toDateTimeString() : null,
            'employee'            => ($this->relationLoaded('employee') && $this->employee) || $this->employee ? [
                'id'         => $this->employee->id,
                'name'       => $this->employee->user?->name,
                'nik_ktp'    => $this->employee->nik_ktp,
                'department' => $this->employee->department?->name,
                'profile_picture' => $this->employee->user?->profile_picture ? url($this->employee->user->profile_picture) : null,
            ] : null,
        ];
    }
}
