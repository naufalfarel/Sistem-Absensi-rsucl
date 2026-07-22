<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Carbon\Carbon;

class AttendanceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $shiftName = 'Tidak Ada Shift';
        $shiftType = 'normal';

        if ($this->employee && $this->date) {
            $dayMap = [
                0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa',
                3 => 'Rabu',   4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
            ];
            $carbonDate = Carbon::parse($this->date);
            $dayName = $dayMap[$carbonDate->dayOfWeek];
            
            if ($this->employee->relationLoaded('schedules')) {
                $sched = $this->employee->schedules->first(function ($s) use ($dayName) {
                    return $s->pivot->day_of_week === $dayName;
                });
                if ($sched) {
                    $shiftName = $sched->name;
                    $shiftType = $sched->shift_type ?? 'normal';
                }
            } else {
                $sched = $this->employee->schedules()->wherePivot('day_of_week', $dayName)->first();
                if ($sched) {
                    $shiftName = $sched->name;
                    $shiftType = $sched->shift_type ?? 'normal';
                }
            }
        }

        $dinasReason = null;
        if ($this->employee && $this->date) {
            $carbonDate = Carbon::parse($this->date);
            $approvedLetter = $this->employee->approvedAssignmentLetterOn($carbonDate);
            if ($approvedLetter) {
                $dinasReason = 'Surat Tugas: ' . $approvedLetter->title;
            } elseif ($shiftType === 'dinas_luar') {
                $dinasReason = 'Shift: ' . $shiftName;
            }
        }

        $checkOut = $this->check_out;
        $durationMin = $this->duration_minutes ?? null;

        if ($this->overtime_status === 'rejected' && $this->jam_pulang_normal) {
            $checkOut = $this->jam_pulang_normal;
            $checkInTime = $this->effective_checkin_time ?: $this->check_in;
            if ($checkInTime) {
                $inSec = strtotime($checkInTime);
                $outSec = strtotime($this->jam_pulang_normal);
                if ($outSec < $inSec) {
                    $outSec += 86400; // overnight shift
                }
                $durationMin = (int) round(($outSec - $inSec) / 60);
                if ($durationMin < 0) $durationMin = 0;
            }
        }

        $isIncomplete = \App\Support\AttendanceRules::isAttendanceIncomplete($this->resource, $this->employee);
        $displayStatus = $isIncomplete ? 'tidak_lengkap' : $this->status;

        // Jika absensi tidak lengkap (hanya masuk, belum pulang, shift sudah berakhir),
        // sembunyikan data checkout dan durasi agar tampil '--' di frontend
        if ($isIncomplete) {
            $checkOut    = null;
            $durationMin = null;
        }

        $data = [
            'id'                 => $this->id,
            'date'               => $this->date ? Carbon::parse($this->date)->toDateString() : null,
            'check_in'           => $this->check_in,
            'check_out'          => $checkOut,
            'status'             => $this->status,
            'display_status'     => $displayStatus,
            'checkin_punctuality'      => $this->checkin_punctuality,
            'effective_checkin_time'   => $this->effective_checkin_time,
            'duration_min'       => $durationMin,
            'latitude'           => $this->latitude,
            'longitude'          => $this->longitude,
            'accuracy'           => $this->accuracy,
            'is_within_geofence' => (bool)$this->is_within_geofence,
            'note'               => $this->note,
            'checkin_location_note'  => $this->checkin_location_note,
            'checkout_location_note' => $this->checkout_location_note,
            'image_check_in'     => $this->image_check_in  ? url($this->image_check_in)  : null,
            'image_check_out'    => $this->image_check_out ? url($this->image_check_out) : null,
            
            // New photo and GPS columns
            'checkin_photo_url'        => $this->checkin_photo_url ? url($this->checkin_photo_url) : null,
            'checkout_photo_url'       => $this->checkout_photo_url ? url($this->checkout_photo_url) : null,
            'checkin_latitude'         => $this->checkin_latitude,
            'checkin_longitude'        => $this->checkin_longitude,
            'checkout_latitude'        => $this->checkout_latitude,
            'checkout_longitude'       => $this->checkout_longitude,
            'checkin_distance_meters'  => $this->checkin_distance_meters,
            'checkout_distance_meters' => $this->checkout_distance_meters,

            'shift_name'         => $shiftName,
            'shift_type'         => $shiftType,
            'dinas_reason'       => $dinasReason,
            
            // Pulang Cepat (Early Checkout)
            'is_early_checkout'        => (bool)$this->is_early_checkout,
            'early_checkout_reason'    => $this->early_checkout_reason,
            'early_checkout_status'    => $this->early_checkout_status,
            'early_checkout_admin_note'=> $this->early_checkout_admin_note,
            
            // Lembur (Overtime)
            'is_overtime'      => (bool)$this->is_overtime,
            'overtime_minutes' => $this->overtime_minutes,
            'overtime_note'    => $this->overtime_note,
            'overtime_status'  => $this->overtime_status,
            'overtime_reviewed_by' => $this->overtimeReviewedBy?->name,
            'overtime_reviewed_at' => $this->overtime_reviewed_at ? $this->overtime_reviewed_at->toDateTimeString() : null,
            'overtime_admin_note'  => $this->overtime_admin_note,

            // New Overtime System
            'jam_pulang_normal'        => $this->jam_pulang_normal,
            'is_lembur'                => (bool)$this->is_lembur,
            'durasi_lembur_menit'      => $this->durasi_lembur_menit,
            'keterangan_lembur'        => $this->keterangan_lembur,
            'status_approval_lembur'   => $this->status_approval_lembur,

            // Holiday Work
            'is_holiday_work'  => (bool)$this->is_holiday_work,
            'holiday'          => $this->relationLoaded('holiday') && $this->holiday ? $this->holiday->name : ($this->holiday ? $this->holiday->name : null),
        ];

        if ($this->relationLoaded('employee') && $this->employee) {
            $data['employee'] = [
                'id'         => $this->employee->id,
                'name'       => $this->employee->user?->name,
                'nik_ktp'    => $this->employee->nik_ktp,
                'department' => $this->employee->department?->name,
                'profile_picture' => $this->employee->user?->profile_picture ? url($this->employee->user->profile_picture) : null,
            ];
        }

        $user = $request->user();
        if ($user && $user->role === 'employee') {
            unset(
                $data['is_overtime'],
                $data['overtime_minutes'],
                $data['overtime_note'],
                $data['overtime_status'],
                $data['overtime_reviewed_by'],
                $data['overtime_reviewed_at'],
                $data['overtime_admin_note'],
                $data['jam_pulang_normal'],
                $data['is_lembur'],
                $data['durasi_lembur_menit'],
                $data['keterangan_lembur'],
                $data['status_approval_lembur']
            );
        }

        return $data;
    }
}
