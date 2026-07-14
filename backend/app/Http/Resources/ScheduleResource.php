<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScheduleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = [
            'id'              => $this->id,
            'name'            => $this->name,
            'start_time'      => $this->start_time,
            'end_time'        => $this->end_time,
            'color'           => $this->color,
            'icon'            => $this->icon,
            'shift_type'      => $this->shift_type ?? 'normal',
            'employees_count' => $this->employees_count ?? ($this->relationLoaded('employees') ? $this->employees->unique('id')->count() : 0),
        ];

        if ($this->relationLoaded('employees')) {
            $data['employees'] = $this->employees->map(function ($emp) {
                return [
                    'id'         => $emp->id,
                    'nip'        => $emp->nip,
                    'phone'      => $emp->phone,
                    'gender'     => $emp->gender,
                    'department' => $emp->department ? ['name' => $emp->department->name] : null,
                    'user'       => $emp->user ? [
                        'name'     => $emp->user->name,
                        'email'    => $emp->user->email,
                        'username' => $emp->user->username
                    ] : null,
                    'pivot'      => [
                        'day_of_week' => $emp->pivot?->day_of_week
                    ]
                ];
            });
        }

        return $data;
    }
}
