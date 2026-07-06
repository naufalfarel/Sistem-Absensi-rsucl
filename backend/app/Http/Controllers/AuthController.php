<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * POST /api/login
     * Body: { username, password }
     */
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        // Cari user berdasarkan username
        $user = User::where('username', $request->username)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Username atau Password tidak sesuai.',
            ], 401);
        }

        // Hapus token lama, buat token baru
        $user->tokens()->delete();
        $token = $user->createToken('rsucl-token')->plainTextToken;

        $userData = [
            'id'              => $user->id,
            'name'            => $user->name,
            'email'           => $user->email,
            'role'            => $user->role,
            'nip'             => $user->nip,
            'username'        => $user->username,
            'profile_picture' => $user->profile_picture ? url($user->profile_picture) : null,
        ];

        // Sertakan data employee jika bukan admin
        if (!$user->isAdmin()) {
            $emp = $user->employee()->with(['department', 'position'])->first();
            if ($emp) {
                $userData['employee_id'] = $emp->id;
                $userData['department']  = $emp->department?->name;
                $userData['position']    = $emp->position?->name;
                $userData['phone']       = $emp->phone;
                $userData['gender']      = $emp->gender;
                $userData['join_date']   = $emp->join_date?->toDateString();
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
     */
    public function me(Request $request)
    {
        $user = $request->user();
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
            }
        }

        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * POST /api/logout
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['success' => true, 'message' => 'Logout berhasil.']);
    }

    /**
     * PUT /api/profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name'            => 'sometimes|string|max:255',
            'email'           => 'sometimes|email|unique:users,email,' . $user->id,
            'username'        => 'sometimes|string|max:255|unique:users,username,' . $user->id,
            'password'        => 'sometimes|string|min:6',
            'old_password'    => 'sometimes|string',
            'profile_picture' => 'nullable|string', // base64
            'phone'           => 'sometimes|nullable|string|max:20',
            'gender'          => 'sometimes|nullable|string|max:20',
        ]);

        if ($request->has('name')) {
            $user->name = $request->name;
        }

        if ($request->has('email')) {
            $user->email = $request->email;
        }

        if ($request->has('username')) {
            $user->username = $request->username;
        }

        if ($request->filled('password')) {
            // Wajib verifikasi password lama untuk keamanan
            if (!$request->has('old_password') || !Hash::check($request->old_password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Password lama tidak sesuai.'
                ], 422);
            }
            $user->password = Hash::make($request->password);
        }

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
     * Body: { username, nip, email, password }
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'nip'      => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:6',
        ]);

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

        $user->password = Hash::make($request->password);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password berhasil diubah. Silakan masuk dengan password baru Anda.',
        ]);
    }
}
