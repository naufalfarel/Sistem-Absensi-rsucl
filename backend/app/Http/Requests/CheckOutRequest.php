<?php

namespace App\Http\Requests;

use App\Models\Attendance;
use App\Models\Setting;
use App\Support\AttendanceRules;
use Carbon\Carbon;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

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
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $employee = $this->user()->employee;
        $shiftDate = Carbon::now('Asia/Jakarta');

        if ($employee) {
            // Cari data check-in hari ini
            $record = Attendance::where('employee_id', $employee->id)
                ->where('date', today()->toDateString())
                ->first();

            // Fallback untuk shift kemarin (overnight)
            if (! $record) {
                $yesterdayRecord = Attendance::where('employee_id', $employee->id)
                    ->where('date', today()->subDay()->toDateString())
                    ->first();
                if ($yesterdayRecord && ! $yesterdayRecord->check_out) {
                    $record = $yesterdayRecord;
                }
            }

            $shiftDate = $record ? Carbon::parse($record->date) : $shiftDate;
        }

        $gpsRequired = $employee
            && Setting::get('enable_gps_validation', '1') !== '0'
            && ! AttendanceRules::isExemptFromGps($employee, $shiftDate);
        $geoPresenceRule = $gpsRequired ? 'required' : 'nullable';

        return [
            'location_note' => 'required|string|min:1|max:150',
            'photo' => 'required|file|mimes:jpg,jpeg,png|max:2048',
            'latitude' => $geoPresenceRule.'|numeric|between:-90,90',
            'longitude' => $geoPresenceRule.'|numeric|between:-180,180',
            'accuracy' => 'nullable|numeric|min:0.01',
            'location_timestamp' => 'nullable',
            'early_checkout_reason' => 'nullable|string',
            'overtime_note' => 'nullable|string',
            'keterangan_lembur' => 'nullable|string',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'location_note.required' => 'Keterangan lokasi wajib diisi.',
            'location_note.max' => 'Keterangan lokasi maksimal 150 karakter.',
            'photo.required' => 'Foto selfie absensi wajib dilampirkan.',
            'photo.file' => 'Foto selfie harus berupa file.',
            'photo.mimes' => 'Foto selfie harus berformat jpg, jpeg, atau png.',
            'photo.max' => 'Ukuran foto selfie maksimal 2MB.',
            'latitude.required' => 'Koordinat Latitude GPS diperlukan untuk melakukan check-out. Aktifkan GPS pada perangkat Anda.',
            'longitude.required' => 'Koordinat Longitude GPS diperlukan untuk melakukan check-out. Aktifkan GPS pada perangkat Anda.',
            'latitude.between' => 'Koordinat Latitude GPS tidak valid. Perbarui lokasi lalu coba kembali.',
            'longitude.between' => 'Koordinat Longitude GPS tidak valid. Perbarui lokasi lalu coba kembali.',
            'accuracy.numeric' => 'Data akurasi GPS tidak valid. Perbarui lokasi lalu coba kembali.',
            'accuracy.min' => 'Data akurasi GPS tidak valid. Perbarui lokasi lalu coba kembali.',
        ];
    }
}
