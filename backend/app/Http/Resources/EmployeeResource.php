<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Class EmployeeResource
 *
 * Mengemas data model Employee ke format JSON API yang konsisten,
 * termasuk pengelompokan data kendaraan pegawai (vehicles).
 */
class EmployeeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'user_id'       => $this->user_id,
            'name'          => $this->user?->name,
            'email'         => $this->user?->email,
            'nip'           => $this->nip,
            'username'      => $this->user?->username,
            'department'    => $this->department?->name,
            'department_id' => $this->department_id,
            'position'      => $this->position?->name,
            'position_id'   => $this->position_id,
            'phone'         => $this->phone,
            'gender'        => $this->gender,
            'join_date'     => $this->join_date?->toDateString(),
            'status'        => $this->status,
            'vehicles'      => [
                'motor_plate_1' => $this->motor_plate_1,
                'motor_plate_2' => $this->motor_plate_2,
                'car_plate_1'   => $this->car_plate_1,
                'car_plate_2'   => $this->car_plate_2,
            ],
        ];
    }
}
