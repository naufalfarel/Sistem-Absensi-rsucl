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
     * Body: { nip, username, password }
     */
    public function login(Request $request)
    {
        $request->validate([
            'nip'      => 'required|string',
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        // Cari user berdasarkan NIP atau username
        $user = User::where('nip', $request->nip)
                    ->where('username', $request->username)
                    ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'NIP, Username, atau Password tidak sesuai.',
            ], 401);
        }

        // Hapus token lama, buat token baru
        $user->tokens()->delete();
        $token = $user->createToken('rsucl-token')->plainTextToken;

        $userData = [
            'id'       => $user->id,
            'name'     => $user->name,
            'email'    => $user->email,
            'role'     => $user->role,
            'nip'      => $user->nip,
            'username' => $user->username,
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
            'id'       => $user->id,
            'name'     => $user->name,
            'email'    => $user->email,
            'role'     => $user->role,
            'nip'      => $user->nip,
            'username' => $user->username,
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
}
