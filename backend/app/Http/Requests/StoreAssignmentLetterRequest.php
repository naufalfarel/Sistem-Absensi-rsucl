<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAssignmentLetterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title'               => 'required|string|max:200',
            'issuing_institution' => 'required|string|max:200',
            'purpose'             => 'required|string|max:1000',
            'start_date'          => 'required|date',
            'end_date'            => 'required|date|after_or_equal:start_date',
            'letter_number'       => 'nullable|string|max:100',
            'document'            => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:2048',
            'attendance_proof'    => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:2048',
        ];
    }
}
