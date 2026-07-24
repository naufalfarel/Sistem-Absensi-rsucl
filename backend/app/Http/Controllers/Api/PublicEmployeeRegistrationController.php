<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeRegistration;
use App\Models\Department;
use App\Models\Position;
use App\Models\User;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class PublicEmployeeRegistrationController extends Controller
{
    /**
     * GET /api/public/employee-registrations/meta
     * Mendapatkan daftar departemen & jabatan untuk opsi form pendaftaran calon pegawai.
     */
    public function meta()
    {
        $departments = Department::select('id', 'name')->orderBy('name')->get();
        
        $targetNames = ['Dokter', 'Perawat', 'Bidan', 'Non Medis', 'Medis'];
        $positions = [];
        foreach ($targetNames as $name) {
            $positions[] = Position::firstOrCreate(['name' => $name]);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'departments' => $departments,
                'positions'   => $positions,
            ]
        ]);
    }

    /**
     * POST /api/public/employee-registrations
     * Mengajukan formulir pendaftaran calon pegawai baru (Onboarding Publik).
     */
    public function store(Request $request)
    {
        $request->validate([
            'name'          => 'required|string|max:255',
            'nik_ktp'       => 'required|string|max:30',
            'email'         => 'required|email|max:255',
            'phone'         => 'required|string|max:250',
            'gender'        => 'required|in:Laki-laki,Perempuan',
            'department_id' => 'required|exists:departments,id',
            'position_id'   => 'required|exists:positions,id',
            'motor_plate_1' => 'nullable|string|max:15',
            'motor_plate_2' => 'nullable|string|max:15',
            'car_plate_1'   => 'nullable|string|max:15',
            'car_plate_2'   => 'nullable|string|max:15',
            'instagram'     => 'nullable|string|max:100',
            'facebook'      => 'nullable|string|max:100',
            'tiktok'        => 'nullable|string|max:100',
            'profile_picture' => 'required|string',
        ]);

        $nikKtp = trim($request->nik_ktp);
        $email  = trim($request->email);

        // Cek apakah NIK atau email sudah menjadi pegawai aktif
        $existingUser = User::where('nik_ktp', $nikKtp)->orWhere('email', $email)->first();
        if ($existingUser) {
            return response()->json([
                'success' => false,
                'message' => 'NIK KTP atau Email sudah terdaftar sebagai akun pegawai di sistem.',
            ], 422);
        }

        // Cek pengajuan yang masih pending
        $existingPending = EmployeeRegistration::where('nik_ktp', $nikKtp)
            ->whereIn('status', ['pending', 'revision_required'])
            ->first();

        if ($existingPending) {
            return response()->json([
                'success' => false,
                'message' => 'Anda sudah memiliki pengajuan pendaftaran pegawai yang sedang diproses (No Ref: ' . $existingPending->registration_number . '). Silakan cek status pengajuan Anda.',
            ], 422);
        }

        // Generate nomor registrasi otomatis (REG-YYYY-XXXXXX)
        $year = date('Y');
        $lastReg = EmployeeRegistration::latest('id')->first();
        $nextId = ($lastReg ? $lastReg->id : 0) + 1;
        $registrationNumber = 'REG-' . $year . '-' . str_pad($nextId, 6, '0', STR_PAD_LEFT);

        // Proses penyimpanan file foto profil jika terdapat upload Base64
        $profilePicturePath = null;
        if ($request->filled('profile_picture')) {
            $imgData = $request->input('profile_picture');
            if (preg_match('/^data:image\/(\w+);base64,/', $imgData, $type)) {
                $imgData = substr($imgData, strpos($imgData, ',') + 1);
                $type = strtolower($type[1]); // png, jpg, jpeg
                if (in_array($type, ['jpg', 'jpeg', 'png'])) {
                    $imgData = base64_decode($imgData);
                    if ($imgData !== false) {
                        $fileName = 'profile_reg_' . uniqid() . '_' . time() . '.' . $type;
                        \Illuminate\Support\Facades\Storage::disk('public')->put('profiles/' . $fileName, $imgData);
                        $profilePicturePath = '/storage/profiles/' . $fileName;
                    }
                }
            }
        }

        $registration = EmployeeRegistration::create([
            'registration_number' => $registrationNumber,
            'name'                => trim($request->name),
            'nik_ktp'             => $nikKtp,
            'email'               => $email,
            'profile_picture'     => $profilePicturePath,
            'phone'               => trim($request->phone),
            'gender'              => $request->gender,
            'department_id'       => $request->department_id,
            'position_id'         => $request->position_id,
            'status'              => 'pending',
            'motor_plate_1'       => $request->motor_plate_1 ? trim($request->motor_plate_1) : null,
            'motor_plate_2'       => $request->motor_plate_2 ? trim($request->motor_plate_2) : null,
            'car_plate_1'         => $request->car_plate_1 ? trim($request->car_plate_1) : null,
            'car_plate_2'         => $request->car_plate_2 ? trim($request->car_plate_2) : null,
            'instagram'           => $request->instagram ? trim($request->instagram) : null,
            'facebook'            => $request->facebook ? trim($request->facebook) : null,
            'tiktok'              => $request->tiktok ? trim($request->tiktok) : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan pendaftaran pegawai berhasil dikirim. Simpan Nomor Referensi Anda.',
            'data'    => [
                'registration_number' => $registration->registration_number,
                'name'                => $registration->name,
                'created_at'          => $registration->created_at->toDateTimeString(),
            ]
        ], 201);
    }

    /**
     * POST /api/public/employee-registrations/check-status
     * Halaman publik untuk mengecek status pengajuan calon pegawai.
     * Menggunakan verifikasi identitas (Nomor Referensi + NIK ATAU No HP).
     */
    public function checkStatus(Request $request)
    {
        $request->validate([
            'registration_number' => 'required|string',
            'nik'                 => 'nullable|string',
            'phone'               => 'nullable|string',
        ]);

        $regNumber = trim($request->registration_number);
        $nik       = $request->filled('nik') ? trim($request->nik) : null;
        $phone     = $request->filled('phone') ? trim($request->phone) : null;

        if (!$nik && !$phone) {
            return response()->json([
                'success' => false,
                'message' => 'Nomor pengajuan atau data verifikasi tidak sesuai.',
            ], 422);
        }

        $reg = EmployeeRegistration::where('registration_number', $regNumber)->first();

        // Verifikasi identitas: registration_number harus ada DAN (nik cocok ATAU phone cocok)
        $nikMatches   = $nik && ($reg?->nik_ktp === $nik);
        $phoneMatches = $phone && ($reg?->phone === $phone);

        if (!$reg || (!$nikMatches && !$phoneMatches)) {
            // Generic message untuk pencegahan probing/anti-guessing
            return response()->json([
                'success' => false,
                'message' => 'Nomor pengajuan atau data verifikasi tidak sesuai.',
            ], 422);
        }

        // Susun data response status
        $responseData = [
            'registration_number' => $reg->registration_number,
            'name'                => $reg->name,
            'status'              => $reg->status,
            'admin_note'          => $reg->admin_note,
            'created_at'          => $reg->created_at?->toDateTimeString(),
            'updated_at'          => $reg->updated_at?->toDateTimeString(),
        ];

        // Khusus status Approved
        if ($reg->status === 'approved') {
            $reg->load(['user', 'department', 'position']);
            $responseData['employee_code'] = $reg->nik_ktp;
            $responseData['username']      = $reg->user?->username ?? '';
            $responseData['department']    = $reg->department?->name;
            $responseData['position']      = $reg->position?->name;

            if (!empty($reg->temp_password_encrypted)) {
                try {
                    $responseData['temp_password'] = Crypt::decryptString($reg->temp_password_encrypted);
                } catch (\Exception $e) {
                    $responseData['temp_password'] = null;
                }
                $responseData['password_note'] = 'Ini password sementara Anda. Anda bisa login memakainya kapan saja, dan bisa menggantinya sendiri lewat halaman Profil setelah login.';
            } else {
                $responseData['temp_password'] = null;
                $responseData['password_note'] = 'Password sudah pernah diganti, silakan gunakan password baru Anda. Kalau lupa, hubungi admin untuk reset.';
            }
        }

        return response()->json([
            'success' => true,
            'data'    => $responseData,
        ]);
    }
}
