<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use Laravel\Fortify\TwoFactorAuthenticationProvider;
use App\Models\User;

class TwoFactorAuthController extends Controller
{
    /**
     * Enable two factor authentication
     */
    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $enable = app(EnableTwoFactorAuthentication::class);
        $enable($user, true);

        $secret = decrypt($user->two_factor_secret);
        
        \Log::info('[2FA] Enabled for user', [
            'user_id' => $user->id,
            'secret_length' => strlen($secret),
            'app_name' => config('app.name')
        ]);

        // Generate QR code using Fortify's built-in method
        $qrCodeUrl = app(TwoFactorAuthenticationProvider::class)->qrCodeUrl(
            config('app.name'),
            $user->email,
            $secret
        );

        \Log::info('[2FA] QR code generated', [
            'user_id' => $user->id,
            'qr_url_length' => strlen($qrCodeUrl)
        ]);

        return response()->json([
            'message' => 'Two factor authentication enabled',
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
            'recovery_codes' => json_decode(decrypt($user->two_factor_recovery_codes), true)
        ], 200);
    }

    /**
     * Disable two factor authentication
     */
    public function disable(Request $request): JsonResponse
    {
        $user = $request->user();
        
        $disable = app(DisableTwoFactorAuthentication::class);
        $disable($user);

        return response()->json([
            'message' => 'Two factor authentication disabled'
        ], 200);
    }

    /**
     * Verify two factor authentication code and complete login
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'code' => 'required|string',
        ]);

        $user = User::findOrFail($request->user_id);

        // Verify the 2FA code
        if (!$this->verifyTwoFactorCode($user, $request->code)) {
            throw ValidationException::withMessages([
                'code' => ['The provided two factor authentication code is invalid.'],
            ]);
        }

        // Create token
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Two factor authentication successful',
            'user' => $user,
            'token' => $token,
            'two_factor_enabled' => !is_null($user->two_factor_secret)
        ], 200);
    }

    /**
     * Show QR code for two factor authentication
     */
    public function showQrCode(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->two_factor_secret) {
            return response()->json([
                'message' => 'Two factor authentication is not enabled'
            ], 400);
        }

        // Generate QR code using Fortify's built-in method
        $qrCodeUrl = app(TwoFactorAuthenticationProvider::class)->qrCodeUrl(
            config('app.name'),
            $user->email,
            decrypt($user->two_factor_secret)
        );

        return response()->json([
            'qr_code_url' => $qrCodeUrl,
            'secret' => decrypt($user->two_factor_secret),
            'recovery_codes' => $user->two_factor_recovery_codes ? 
                json_decode(decrypt($user->two_factor_recovery_codes), true) : []
        ], 200);
    }

    /**
     * Confirm two factor authentication setup
     */
    public function confirm(Request $request): JsonResponse
    {
        $request->validate([
            'code' => 'required|string',
        ]);

        $user = $request->user();

        if (!$user->two_factor_secret) {
            return response()->json([
                'message' => 'Two factor authentication is not enabled'
            ], 400);
        }

        try {
            $confirm = app(ConfirmTwoFactorAuthentication::class);
            $confirm($user, $request->code);

            return response()->json([
                'message' => 'Two factor authentication confirmed successfully'
            ], 200);
        } catch (\Exception $e) {
            throw ValidationException::withMessages([
                'code' => ['The provided two factor authentication code is invalid.'],
            ]);
        }
    }

    /**
     * Generate new recovery codes
     */
    public function generateRecoveryCodes(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->two_factor_secret) {
            return response()->json([
                'message' => 'Two factor authentication is not enabled'
            ], 400);
        }

        $generate = app(GenerateNewRecoveryCodes::class);
        $generate($user);

        return response()->json([
            'message' => 'New recovery codes generated',
            'recovery_codes' => json_decode(decrypt($user->two_factor_recovery_codes), true)
        ], 200);
    }

    /**
     * Verify two factor authentication code
     */
    private function verifyTwoFactorCode($user, $code): bool
    {
        $twoFactorProvider = app(TwoFactorAuthenticationProvider::class);
        $secret = decrypt($user->two_factor_secret);
        
        \Log::info('[2FA] Verifying code', [
            'user_id' => $user->id,
            'code_length' => strlen($code),
            'secret_length' => strlen($secret),
            'timestamp' => now()->timestamp
        ]);
        
        $isValid = $twoFactorProvider->verify($secret, $code);
        
        if (!$isValid) {
            $isValid = $this->verifyRecoveryCode($user, $code);
        }
        
        \Log::info('[2FA] Verification result', [
            'user_id' => $user->id,
            'is_valid' => $isValid
        ]);
        
        return $isValid;
    }

    /**
     * Verify recovery code
     */
    private function verifyRecoveryCode($user, $code): bool
    {
        if (!$user->two_factor_recovery_codes) {
            return false;
        }

        $recoveryCodes = json_decode(decrypt($user->two_factor_recovery_codes), true);
        
        if (in_array($code, $recoveryCodes)) {
            // Remove used recovery code
            $recoveryCodes = array_diff($recoveryCodes, [$code]);
            $user->forceFill([
                'two_factor_recovery_codes' => encrypt(json_encode(array_values($recoveryCodes))),
            ])->save();

            return true;
        }

        return false;
    }
}
