<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmployeeRegistration;
use App\Models\User;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminEmployeeRegistrationController extends Controller
{
    /**
     * GET /api/employee-registrations
     * Menampilkan daftar draf pengajuan calon pegawai untuk admin.
     */
    public function index(Request $request)
    {
        $query = EmployeeRegistration::with(['department', 'position', 'user']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('nik_ktp', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('registration_number', 'like', "%{$search}%");
            });
        }

        $registrations = $query->orderBy('created_at', 'desc')->get();

        // Count summary per status
        $summary = [
            'pending'           => EmployeeRegistration::where('status', 'pending')->count(),
            'revision_required' => EmployeeRegistration::where('status', 'revision_required')->count(),
            'approved'          => EmployeeRegistration::where('status', 'approved')->count(),
            'rejected'          => EmployeeRegistration::where('status', 'rejected')->count(),
            'total'             => EmployeeRegistration::count(),
        ];

        return response()->json([
            'success' => true,
            'data'    => $registrations,
            'summary' => $summary,
        ]);
    }

    /**
     * GET /api/employee-registrations/{id}
     * Menampilkan detail pengajuan calon pegawai.
     */
    public function show($id)
    {
        $registration = EmployeeRegistration::with(['department', 'position', 'user', 'employee'])->findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data'    => $registration,
        ]);
    }

    /**
     * PUT /api/employee-registrations/{id}/approve
     * Menyetujui pengajuan pendaftaran pegawai -> Otomatis generate Username & Password sementara -> Membuat Akun User & Employee.
     */
    public function approve(Request $request, $id)
    {
        $registration = EmployeeRegistration::findOrFail($id);

        if ($registration->status === 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan pendaftaran ini sudah disetujui sebelumnya.',
            ], 422);
        }

        return DB::transaction(function () use ($request, $registration) {
            // 1. Auto-generate Username (Format: nama.lengkap, lowercase, unique)
            $baseUsername = $this->generateBaseUsername($registration->name);
            $username     = $baseUsername;
            $counter      = 2;

            while (User::where('username', $username)->exists()) {
                $username = $baseUsername . $counter;
                $counter++;
            }

            // 2. Auto-generate Temp Password (6 digit angka)
            $tempPassword = $this->generateRandomPassword(6);

            // 3. Encrypt Temp Password untuk disimpan di employee_registrations
            $encryptedTemp = Crypt::encryptString($tempPassword);

            // 4. Buat Akun User Baru
            $user = User::create([
                'name'            => $registration->name,
                'email'           => $registration->email,
                'username'        => $username,
                'password'        => Hash::make($tempPassword),
                'nik_ktp'         => $registration->nik_ktp,
                'role'            => 'employee',
                'profile_picture' => $registration->getRawOriginal('profile_picture'),
            ]);

            // 5. Buat Record Employee Baru
            $employee = Employee::create([
                'user_id'       => $user->id,
                'department_id' => $registration->department_id,
                'position_id'   => $registration->position_id,
                'nik_ktp'       => $registration->nik_ktp,
                'phone'         => $registration->phone,
                'gender'        => $registration->gender,
                'join_date'     => now()->toDateString(),
                'motor_plate_1' => $registration->motor_plate_1,
                'motor_plate_2' => $registration->motor_plate_2,
                'car_plate_1'   => $registration->car_plate_1,
                'car_plate_2'   => $registration->car_plate_2,
                'instagram'     => $registration->instagram,
                'facebook'      => $registration->facebook,
                'tiktok'        => $registration->tiktok,
            ]);

            // 6. Update Status Registration
            $registration->update([
                'status'                  => 'approved',
                'admin_note'              => $request->input('admin_note'),
                'temp_password_encrypted' => $encryptedTemp,
                'user_id'                 => $user->id,
                'employee_id'             => $employee->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan pendaftaran berhasil disetujui dan akun pegawai telah dibuat.',
                'data'    => [
                    'registration_id' => $registration->id,
                    'username'        => $username,
                    'temp_password'   => $tempPassword,
                    'user_id'         => $user->id,
                    'employee_id'     => $employee->id,
                ]
            ]);
        });
    }

    /**
     * PUT /api/employee-registrations/{id}/reject
     * Menolak pengajuan pendaftaran calon pegawai.
     */
    public function reject(Request $request, $id)
    {
        $registration = EmployeeRegistration::findOrFail($id);

        if ($registration->status === 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan yang sudah disetujui tidak dapat ditolak.',
            ], 422);
        }

        $registration->update([
            'status'     => 'rejected',
            'admin_note' => $request->input('admin_note') ?? 'Pengajuan ditolak oleh Administrator.',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan pendaftaran telah ditolak.',
            'data'    => $registration,
        ]);
    }

    /**
     * PUT /api/employee-registrations/{id}/revision
     * Meminta revisi data pengajuan calon pegawai.
     */
    public function requestRevision(Request $request, $id)
    {
        $registration = EmployeeRegistration::findOrFail($id);

        if ($registration->status === 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Pengajuan yang sudah disetujui tidak dapat direvisi.',
            ], 422);
        }

        $registration->update([
            'status'     => 'revision_required',
            'admin_note' => $request->input('admin_note') ?? 'Diperlukan perbaikan data pengajuan.',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Status pengajuan telah diubah menjadi Perlu Revisi.',
            'data'    => $registration,
        ]);
    }

    /**
     * Helper: Generate base username dari nama lengkap
     * Contoh: "dr. Rina Kusumawati" -> "rina.kusumawati"
     */
    private function generateBaseUsername(string $fullName): string
    {
        // Bersihkan gelar umum di awal nama
        $cleanName = preg_replace('/^(dr\.|Ns\.|Dr\.|Drs\.|Dra\.|prof\.|Prof\.|H\.|Hj\.)\s*/i', '', $fullName);
        // Bersihkan gelar di belakang koma
        $cleanName = explode(',', $cleanName)[0];
        // Hapus karakter khusus non-alphanumeric (kecuali spasi)
        $cleanName = preg_replace('/[^a-zA-Z0-9\s]/', '', $cleanName);
        // Split kata
        $words = array_filter(explode(' ', strtolower(trim($cleanName))));
        
        if (empty($words)) {
            return 'pegawai';
        }

        return implode('.', $words);
    }

    /**
     * Helper: Generate password acak 6 digit angka
     * Contoh: "748291"
     */
    private function generateRandomPassword(int $length = 6): string
    {
        $numbers = '0123456789';

        $pass = '';
        for ($i = 0; $i < $length; $i++) {
            $pass .= $numbers[rand(0, strlen($numbers) - 1)];
        }

        return $pass;
    }
}
