<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Class AuthController
 * 
 * Mengelola alur otentikasi pengguna termasuk proses Login, Logout,
 * pengambilan profil aktif (me), update profil, serta pengaturan ulang password (forgot password).
 */
class AuthController extends Controller
{
    /**
     * POST /api/login
     * 
     * Memproses otentikasi user menggunakan username dan password.
     * Jika login sukses, token Laravel Sanctum akan diterbitkan dan dikirim kembali beserta data user.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function login(Request $request)
    {
        // Validasi input parameter login
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        // Cari user berdasarkan username
        $user = User::where('username', $request->username)->first();

        // Verifikasi keberadaan user dan kecocokan password menggunakan Hash::check
        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Username atau Password tidak sesuai.',
            ], 401);
        }

        // Hapus token lama untuk mencegah kebocoran sesi multipel, lalu terbitkan token baru
        $user->tokens()->delete();
        $token = $user->createToken('rsucl-token')->plainTextToken;

        // Siapkan struktur dasar payload data pengguna
        $userData = [
            'id'              => $user->id,
            'name'            => $user->name,
            'email'           => $user->email,
            'role'            => $user->role,
            'nip'             => $user->nip,
            'username'        => $user->username,
            'profile_picture' => $user->profile_picture ? url($user->profile_picture) : null,
        ];

        // Jika user bukan admin (berarti karyawan/employee), sertakan info jabatan dan departemen
        if (!$user->isAdmin()) {
            $emp = $user->employee()->with(['department', 'position'])->first();
            if ($emp) {
                $userData['employee_id'] = $emp->id;
                $userData['department']  = $emp->department?->name;
                $userData['position']    = $emp->position?->name;
                $userData['phone']       = $emp->phone;
                $userData['gender']      = $emp->gender;
                $userData['join_date']   = $emp->join_date?->toDateString();
                $userData['vehicles']    = [
                    'motor_plate_1' => $emp->motor_plate_1,
                    'motor_plate_2' => $emp->motor_plate_2,
                    'car_plate_1'   => $emp->car_plate_1,
                    'car_plate_2'   => $emp->car_plate_2,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Login berhasil.',
            'data'    => [
                'token' => $token,
                'user'  => $userData,
            ],
        ]);
    }

    /**
     * GET /api/me
     * 
     * Mengambil detail profil user yang sedang login saat ini (berdasarkan token bearer).
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function me(Request $request)
    {
        $user = $request->user();
        
        // Buat representasi data user aktif
        $data = [
            'id'              => $user->id,
            'name'            => $user->name,
            'email'           => $user->email,
            'role'            => $user->role,
            'nip'             => $user->nip,
            'username'        => $user->username,
            'profile_picture' => $user->profile_picture ? url($user->profile_picture) : null,
        ];

        // Lampirkan data kepegawaian jika role-nya adalah employee
        if (!$user->isAdmin()) {
            $emp = $user->employee()->with(['department', 'position'])->first();
            if ($emp) {
                $data['employee_id'] = $emp->id;
                $data['department']  = $emp->department?->name;
                $data['position']    = $emp->position?->name;
                $data['phone']       = $emp->phone;
                $data['gender']      = $emp->gender;
                $data['join_date']   = $emp->join_date?->toDateString();
                $data['vehicles']    = [
                    'motor_plate_1' => $emp->motor_plate_1,
                    'motor_plate_2' => $emp->motor_plate_2,
                    'car_plate_1'   => $emp->car_plate_1,
                    'car_plate_2'   => $emp->car_plate_2,
                ];
            }
        }

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * POST /api/logout
     * 
     * Menghapus token otentikasi aktif yang digunakan untuk request saat ini.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout(Request $request)
    {
        // Hapus token akses saat ini dari database
        $request->user()->currentAccessToken()->delete();
        return response()->json(['success' => true, 'message' => 'Logout berhasil.']);
    }

    /**
     * PUT /api/profile
     * 
     * Memperbarui detail profil user (seperti nama, email, username, password, dan foto profil).
     * Foto profil diproses dari format upload Base64.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        // Validasi payload perubahan profil
        $request->validate([
            'name'            => 'sometimes|string|max:255',
            'email'           => 'sometimes|email|unique:users,email,' . $user->id,
            'username'        => 'sometimes|string|max:255|unique:users,username,' . $user->id,
            'password'        => 'sometimes|string|min:6',
            'old_password'    => 'sometimes|string',
            'profile_picture' => 'nullable|string', // String base64
            'phone'           => 'sometimes|nullable|string|max:20',
            'gender'          => 'sometimes|nullable|string|max:20',
        ]);

        // Perbarui atribut umum User jika dilampirkan
        if ($request->has('name')) {
            $user->name = $request->name;
        }

        if ($request->has('email')) {
            $user->email = $request->email;
        }

        if ($request->has('username')) {
            $user->username = $request->username;
        }

        // Jika mengubah password, wajib melakukan verifikasi password lama terlebih dahulu
        if ($request->filled('password')) {
            if (!$request->has('old_password') || !Hash::check($request->old_password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Password lama tidak sesuai.'
                ], 422);
            }
            $user->password = Hash::make($request->password);
        }

        // Proses penyimpanan file foto profil jika terdapat upload Base64 baru
        if ($request->has('profile_picture')) {
            $imgData = $request->input('profile_picture');
            if ($imgData === null) {
                $user->profile_picture = null;
            } elseif (preg_match('/^data:image\/(\w+);base64,/', $imgData, $type)) {
                $imgData = substr($imgData, strpos($imgData, ',') + 1);
                $type = strtolower($type[1]); // png, jpg, jpeg
                if (in_array($type, ['jpg', 'jpeg', 'png'])) {
                    $imgData = base64_decode($imgData);
                    if ($imgData !== false) {
                        $fileName = 'profile_' . $user->id . '_' . time() . '.' . $type;
                        \Illuminate\Support\Facades\Storage::disk('public')->put('profiles/' . $fileName, $imgData);
                        $user->profile_picture = '/storage/profiles/' . $fileName;
                    }
                }
            }
        }

        $user->save();

        // Jika user adalah karyawan, perbarui juga data profile employee terkait
        if (!$user->isAdmin()) {
            $emp = $user->employee;
            if ($emp) {
                if ($request->has('phone')) {
                    $emp->phone = $request->phone;
                }
                if ($request->has('gender')) {
                    $emp->gender = $request->gender;
                }
                $emp->save();
            }
        }

        // Siapkan ulang response payload data profil terbaru
        $data = [
            'id'              => $user->id,
            'name'            => $user->name,
            'email'           => $user->email,
            'role'            => $user->role,
            'nip'             => $user->nip,
            'username'        => $user->username,
            'profile_picture' => $user->profile_picture ? url($user->profile_picture) : null,
        ];

        if (!$user->isAdmin()) {
            $emp = $user->employee()->with(['department', 'position'])->first();
            if ($emp) {
                $data['employee_id'] = $emp->id;
                $data['department']  = $emp->department?->name;
                $data['position']    = $emp->position?->name;
                $data['phone']       = $emp->phone;
                $data['gender']      = $emp->gender;
                $data['join_date']   = $emp->join_date?->toDateString();
                $data['vehicles']    = [
                    'motor_plate_1' => $emp->motor_plate_1,
                    'motor_plate_2' => $emp->motor_plate_2,
                    'car_plate_1'   => $emp->car_plate_1,
                    'car_plate_2'   => $emp->car_plate_2,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Profil berhasil diperbarui.',
            'data'    => $data,
        ]);
    }

    /**
     * POST /api/forgot-password
     * 
     * Melakukan set ulang password tanpa login.
     * Menggunakan validasi kecocokan data kombinasi Username, NIP, dan Email.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function resetPassword(Request $request)
    {
        // Validasi parameter reset password
        $request->validate([
            'username' => 'required|string',
            'nip'      => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        // Pastikan kombinasi username, NIP, dan email benar-benar terdaftar di database
        $user = User::where('username', $request->username)
                    ->where('nip', $request->nip)
                    ->where('email', $request->email)
                    ->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Data tidak cocok. Silakan periksa kembali Username, NIP, dan Email Anda.',
            ], 422);
        }

        // Set password baru dan lakukan hashing
        $user->password = Hash::make($request->password);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password berhasil diubah. Silakan masuk dengan password baru Anda.',
        ]);
    }

    /**
     * PUT /api/profile/vehicles
     *
     * Endpoint mandiri bagi karyawan untuk memperbarui plat nomor kendaraan mereka sendiri.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateVehicles(Request $request)
    {
        $user = $request->user();

        // Pastikan user memiliki profil employee
        $employee = $user->employee;
        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Profil pegawai tidak ditemukan.',
            ], 404);
        }

        // Validasi 4 plat nomor (maks 15 karakter, semuanya opsional)
        $data = $request->validate([
            'motor_plate_1' => 'nullable|string|max:15',
            'motor_plate_2' => 'nullable|string|max:15',
            'car_plate_1'   => 'nullable|string|max:15',
            'car_plate_2'   => 'nullable|string|max:15',
        ]);

        // Simpan pembaruan ke database
        $employee->update([
            'motor_plate_1' => $data['motor_plate_1'] ?? null,
            'motor_plate_2' => $data['motor_plate_2'] ?? null,
            'car_plate_1'   => $data['car_plate_1'] ?? null,
            'car_plate_2'   => $data['car_plate_2'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Data kendaraan berhasil diperbarui.',
            'data'    => [
                'motor_plate_1' => $employee->motor_plate_1,
                'motor_plate_2' => $employee->motor_plate_2,
                'car_plate_1'   => $employee->car_plate_1,
                'car_plate_2'   => $employee->car_plate_2,
            ],
        ]);
    }
}
