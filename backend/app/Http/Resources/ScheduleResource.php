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
        // Hitung employees_count secara agregat dari seluruh sub-shift jika ini parent
        $employeesCount = 0;
        if ($this->parent_id === null) {
            if ($this->relationLoaded('children')) {
                // Kumpulkan semua pegawai dari seluruh children
                $allEmployees = collect();
                foreach ($this->children as $child) {
                    if ($child->relationLoaded('employees')) {
                        $allEmployees = $allEmployees->concat($child->employees);
                    }
                }
                $employeesCount = $allEmployees->unique('id')->count();
            } else {
                $employeesCount = \App\Models\Employee::whereHas('schedules', function ($q) {
                    $q->where('parent_id', $this->id);
                })->count();
            }
        } else {
            $employeesCount = $this->relationLoaded('employees') ? $this->employees->unique('id')->count() : 0;
        }

        $data = [
            'id'              => $this->id,
            'parent_id'       => $this->parent_id,
            'name'            => $this->name,
            'start_time'      => $this->start_time,
            'end_time'        => $this->end_time,
            'color'           => $this->color,
            'icon'            => $this->icon,
            'shift_type'      => $this->shift_type ?? 'normal',
            'employees_count' => $this->employees_count ?? $employeesCount,
            'owner_department_id' => $this->owner_department_id,
            'owner_department_name' => $this->ownerDepartment ? $this->ownerDepartment->name : null,
            'created_by'      => $this->created_by,
            'created_by_name' => $this->creator ? $this->creator->name : null,
            'updated_by'      => $this->updated_by,
            'updated_by_name' => $this->updater ? $this->updater->name : null,
        ];

        if ($this->relationLoaded('children')) {
            $data['children'] = ScheduleResource::collection($this->children);
        }

        if ($this->relationLoaded('employees')) {
            $data['employees'] = $this->employees->map(function ($emp) {
                return [
                    'id'         => $emp->id,
                    'nik_ktp'    => $emp->nik_ktp,
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
