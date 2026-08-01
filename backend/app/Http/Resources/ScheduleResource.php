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
                        $emps = $child->employees;
                        if ($this->owner_department_id) {
                            $emps = $emps->filter(fn($e) => (int)$e->department_id === (int)$this->owner_department_id);
                        }
                        $allEmployees = $allEmployees->concat($emps);
                    }
                }
                $employeesCount = $allEmployees->unique('id')->count();
            } else {
                $employeesCount = \App\Models\Employee::whereHas('schedules', function ($q) {
                    $q->where('parent_id', $this->id);
                })->when($this->owner_department_id, function($q) {
                    $q->where('department_id', $this->owner_department_id);
                })->count();
            }
        } else {
            $emps = $this->relationLoaded('employees') ? $this->employees : collect();
            if ($this->parent && $this->parent->owner_department_id) {
                $emps = $emps->filter(fn($e) => (int)$e->department_id === (int)$this->parent->owner_department_id);
            }
            $employeesCount = $emps->unique('id')->count();
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
            'status'          => $this->status ?? 'approved',
            'admin_note'      => $this->admin_note,
            'proposed_by'     => $this->proposed_by,
            'proposed_by_name' => $this->proposedBy ? $this->proposedBy->name : null,
        ];

        if ($this->relationLoaded('children')) {
            $data['children'] = ScheduleResource::collection($this->children);
        }

        if ($this->relationLoaded('employees')) {
            $emps = $this->employees;
            $parentOwnerDeptId = $this->owner_department_id ?? ($this->parent ? $this->parent->owner_department_id : null);
            if ($parentOwnerDeptId) {
                $emps = $emps->filter(fn($e) => (int)$e->department_id === (int)$parentOwnerDeptId);
            }
            $data['employees'] = $emps->map(function ($emp) {
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
                        'day_of_week' => $emp->pivot?->day_of_week,
                        'work_date'   => $emp->pivot?->work_date,
                    ]
                ];
            });
        }

        return $data;
    }
}
