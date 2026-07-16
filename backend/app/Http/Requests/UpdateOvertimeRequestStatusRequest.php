<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOvertimeRequestStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->role === 'admin';
    }

    public function rules(): array
    {
        $isReject = str_contains($this->route()->uri(), 'reject');
        return [
            'admin_note' => $isReject ? 'required|string|min:1|max:255' : 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'admin_note.required' => 'Alasan penolakan wajib diisi.',
            'admin_note.max'      => 'Catatan admin maksimal 255 karakter.',
        ];
    }
}
