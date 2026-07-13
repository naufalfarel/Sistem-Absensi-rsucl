<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
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
        $employee = $this->route('employee');
        $userId = $employee ? (is_numeric($employee) ? \App\Models\Employee::find($employee)?->user_id : $employee->user_id) : null;

        return [
            'name'          => 'sometimes|string|max:100',
            'email'         => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($userId)],
            'department_id' => 'sometimes|exists:departments,id',
            'position_id'   => 'sometimes|exists:positions,id',
            'phone'         => 'nullable|string|max:20',
            'gender'        => 'nullable|in:Laki-laki,Perempuan',
            'join_date'     => 'nullable|date',
            'status'        => 'sometimes|in:active,inactive',
            'password'      => 'sometimes|string|min:6',
            // Field Kendaraan Pegawai
            'motor_plate_1' => 'nullable|string|max:15',
            'motor_plate_2' => 'nullable|string|max:15',
            'car_plate_1'   => 'nullable|string|max:15',
            'car_plate_2'   => 'nullable|string|max:15',
        ];
    }
}
