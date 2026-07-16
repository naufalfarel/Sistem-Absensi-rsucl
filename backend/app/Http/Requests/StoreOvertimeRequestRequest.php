<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOvertimeRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && $this->user()->employee !== null;
    }

    public function rules(): array
    {
        return [
            'date'          => 'required|date',
            'reason'        => 'required|string|max:1000',
            'photo'         => 'required|file|mimes:jpg,jpeg,png|max:2048',
            'location_note' => 'required|string|max:150',
        ];
    }

    public function messages(): array
    {
        return [
            'date.required'          => 'Tanggal lembur wajib diisi.',
            'date.date'              => 'Format tanggal tidak valid.',
            'reason.required'        => 'Alasan lembur/apa yang dikerjakan wajib diisi.',
            'reason.max'             => 'Alasan lembur maksimal 1000 karakter.',
            'photo.required'         => 'Foto bukti kegiatan lembur wajib diunggah.',
            'photo.file'             => 'Foto bukti harus berupa file.',
            'photo.mimes'            => 'Foto bukti harus berformat jpg, jpeg, atau png.',
            'photo.max'              => 'Ukuran foto bukti maksimal 2MB.',
            'location_note.required' => 'Keterangan lokasi manual wajib diisi.',
            'location_note.max'      => 'Keterangan lokasi manual maksimal 150 karakter.',
        ];
    }
}
