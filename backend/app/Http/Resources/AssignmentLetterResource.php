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
            'id'                    => $this->id,
            'employee_id'           => $this->employee_id,
            'source'                => $this->source ?? 'employee_request',
            'director_type'         => $this->director_type,
            'letter_number'         => $this->letter_number,
            'letter_number_seq'     => $this->letter_number_seq,
            'letter_date'           => $this->letter_date ? $this->letter_date->toDateString() : null,
            'title'                 => $this->title,
            'issuing_institution'   => $this->issuing_institution,
            'purpose'               => $this->purpose,
            'travel_purpose'        => $this->travel_purpose,
            'travel_date'           => $this->travel_date,
            'travel_time'           => $this->travel_time,
            'travel_place'          => $this->travel_place,
            'assigned_employees'    => $this->assigned_employees ?? [],
            'start_date'            => $this->start_date ? $this->start_date->toDateString() : null,
            'end_date'              => $this->end_date ? $this->end_date->toDateString() : null,
            'document_url'          => $this->document_url ? url($this->document_url) : null,
            'attendance_proof_url'  => $this->attendance_proof_url ? url($this->attendance_proof_url) : null,
            'activity_notes'        => $this->activity_notes,
            'status'                => $this->status,
            'admin_note'            => $this->admin_note,
            'reviewed_by'           => $this->reviewer?->name,
            'reviewed_at'           => $this->reviewed_at ? $this->reviewed_at->toDateTimeString() : null,
            'created_at'            => $this->created_at ? $this->created_at->toDateTimeString() : null,
            'employee'            => ($this->relationLoaded('employee') && $this->employee) || $this->employee ? [
                'id'         => $this->employee->id,
                'name'       => $this->employee->user?->name,
                'nik_ktp'    => $this->employee->nik_ktp,
                'department' => $this->employee->department?->name,
                'position'   => $this->employee->position?->name,
                'profile_picture' => $this->employee->user?->profile_picture ? url($this->employee->user->profile_picture) : null,
            ] : null,
        ];
    }
}
