<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Support\AttendanceRules;
use App\Models\Attendance;
use Carbon\Carbon;

class CheckOutRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() && $this->user()->employee !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $employee = $this->user()->employee;
        $shiftType = 'normal';

        if ($employee) {
            // Cari data check-in hari ini
            $record = Attendance::where('employee_id', $employee->id)
                                ->where('date', today()->toDateString())
                                ->first();

            // Fallback untuk shift kemarin (overnight)
            if (!$record) {
                $yesterdayRecord = Attendance::where('employee_id', $employee->id)
                                             ->where('date', today()->subDay()->toDateString())
                                             ->first();
                if ($yesterdayRecord && !$yesterdayRecord->check_out) {
                    $record = $yesterdayRecord;
                }
            }

            $date = $record ? Carbon::parse($record->date) : Carbon::now('Asia/Jakarta');
            $shiftType = AttendanceRules::shiftTypeFor($employee, $date);
        }

        $geoRule = ($shiftType === 'dinas_luar') ? 'nullable|numeric' : 'required|numeric';

        return [
            'location_note'          => 'required|string|min:1|max:150',
            'photo'                  => 'required|file|mimes:jpg,jpeg,png|max:2048',
            'latitude'               => $geoRule,
            'longitude'              => $geoRule,
            'accuracy'               => 'nullable|numeric',
            'simulated_time'         => 'nullable|string',
            'early_checkout_reason'  => 'nullable|string',
            'overtime_note'          => 'nullable|string',
            'keterangan_lembur'      => 'nullable|string',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'location_note.required' => 'Keterangan lokasi wajib diisi.',
            'location_note.max'      => 'Keterangan lokasi maksimal 150 karakter.',
            'photo.required'         => 'Foto selfie absensi wajib dilampirkan.',
            'photo.file'             => 'Foto selfie harus berupa file.',
            'photo.mimes'            => 'Foto selfie harus berformat jpg, jpeg, atau png.',
            'photo.max'              => 'Ukuran foto selfie maksimal 2MB.',
            'latitude.required'      => 'Koordinat Latitude GPS diperlukan untuk melakukan check-out. Aktifkan GPS pada perangkat Anda.',
            'longitude.required'     => 'Koordinat Longitude GPS diperlukan untuk melakukan check-out. Aktifkan GPS pada perangkat Anda.',
        ];
    }
}
