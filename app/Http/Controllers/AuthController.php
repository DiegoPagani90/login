<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Models\User;

class AuthController extends Controller
{
    /**
     * Handle user login
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Check if user has 2FA enabled
        if ($user->two_factor_secret) {
            return response()->json([
                'message' => 'Two factor authentication required',
                'two_factor' => true,
                'user_id' => $user->id
            ], 200);
        }

        // Create token
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => $user,
            'token' => $token,
            'two_factor' => false
        ], 200);
    }

    /**
     * Handle user logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout successful'
        ], 200);
    }

    /**
     * Get authenticated user information
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        
        return response()->json([
            'user' => $user,
            'two_factor_enabled' => !is_null($user->two_factor_secret)
        ], 200);
    }
}
