<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEmployeeRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() && $this->user()->isAdmin();
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name'          => 'required|string|max:100',
            'email'         => 'required|email|unique:users,email',
            'nip'           => 'required|string|unique:users,nip|unique:employees,nip',
            'username'      => 'required|string|unique:users,username',
            'password'      => 'required|string|min:6',
            'department_id' => 'required|exists:departments,id',
            'position_id'   => 'required|exists:positions,id',
            'phone'         => 'nullable|string|max:20',
            'gender'        => 'nullable|in:Laki-laki,Perempuan',
            'join_date'     => 'nullable|date',
            // Field Kendaraan Pegawai
            'motor_plate_1' => 'nullable|string|max:15',
            'motor_plate_2' => 'nullable|string|max:15',
            'car_plate_1'   => 'nullable|string|max:15',
            'car_plate_2'   => 'nullable|string|max:15',
        ];
    }
}
