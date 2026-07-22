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
            'nik_ktp'       => $this->nik_ktp,
            'username'      => $this->user?->username,
            'profile_picture' => $this->user?->profile_picture ? url($this->user->profile_picture) : null,
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
            'social_media'  => [
                'instagram' => $this->instagram,
                'facebook'  => $this->facebook,
                'tiktok'    => $this->tiktok,
            ],
        ];
    }
}
