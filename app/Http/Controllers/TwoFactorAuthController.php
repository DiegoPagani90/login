<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use Laravel\Fortify\TwoFactorAuthenticationProvider;
use App\Models\User;
use App\Models\TwoFactorSetupSession;
use Illuminate\Support\Str;

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
            // Do NOT include the secret in responses
            'qr_code_url' => $qrCodeUrl,
        ], 200)->header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }

    /**
     * Disable two factor authentication
     */
    public function disable(Request $request): JsonResponse
    {
        $user = $request->user();
        
        // Cancel any pending setup sessions
        TwoFactorSetupSession::where('user_id', $user->id)
            ->where('status', TwoFactorSetupSession::STATUS_PENDING)
            ->update(['status' => TwoFactorSetupSession::STATUS_CANCELLED]);

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

        if ($user->two_factor_confirmed_at) {
            return response()->json([
                'message' => 'Two factor already confirmed'
            ], 409);
        }

        // Generate QR code using Fortify's built-in method
        $qrCodeUrl = app(TwoFactorAuthenticationProvider::class)->qrCodeUrl(
            config('app.name'),
            $user->email,
            decrypt($user->two_factor_secret)
        );

        return response()->json([
            'qr_code_url' => $qrCodeUrl,
        ], 200)->header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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
     * Start a 2FA setup session (TTL 5 minutes) and enable 2FA if not enabled.
     */
    public function startSetup(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->two_factor_secret) {
            $enable = app(EnableTwoFactorAuthentication::class);
            $enable($user, true);
        }

        // Cancel any previous pending sessions
        TwoFactorSetupSession::where('user_id', $user->id)
            ->where('status', TwoFactorSetupSession::STATUS_PENDING)
            ->update(['status' => TwoFactorSetupSession::STATUS_CANCELLED]);

        $session = TwoFactorSetupSession::create([
            'user_id' => $user->id,
            'token' => (string) Str::uuid(),
            'status' => TwoFactorSetupSession::STATUS_PENDING,
            'expires_at' => now()->addMinutes(5),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'Two factor setup session started',
            'token' => $session->token,
            'expires_at' => $session->expires_at->toIso8601String(),
        ]);
    }

    /**
     * Get QR code by session token.
     */
    public function qrByToken(Request $request): JsonResponse
    {
        $request->validate(['token' => 'required|uuid']);
        $user = $request->user();
        $session = TwoFactorSetupSession::where('token', $request->token)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($session->isExpired()) {
            $session->update(['status' => TwoFactorSetupSession::STATUS_EXPIRED]);
            return response()->json(['message' => 'Setup session expired'], 410);
        }

        if ($user->two_factor_confirmed_at) {
            return response()->json(['message' => 'Two factor already confirmed'], 409);
        }

        $session->update(['shown_at' => $session->shown_at ?? now()]);

        $qrCodeUrl = app(TwoFactorAuthenticationProvider::class)->qrCodeUrl(
            config('app.name'),
            $user->email,
            decrypt($user->two_factor_secret)
        );

        return response()->json([
            'qr_code_url' => $qrCodeUrl,
            'expires_at' => $session->expires_at->toIso8601String(),
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }

    /**
     * Poll setup session status.
     */
    public function sessionStatus(Request $request): JsonResponse
    {
        $request->validate(['token' => 'required|uuid']);
        $user = $request->user();
        $session = TwoFactorSetupSession::where('token', $request->token)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($session->isExpired() && $session->status === TwoFactorSetupSession::STATUS_PENDING) {
            $session->update(['status' => TwoFactorSetupSession::STATUS_EXPIRED]);
        }

        // If user already confirmed, mark session as confirmed
        if ($user->two_factor_confirmed_at && $session->status === TwoFactorSetupSession::STATUS_PENDING) {
            $session->update([
                'status' => TwoFactorSetupSession::STATUS_CONFIRMED,
                'confirmed_at' => now(),
            ]);
        }

        return response()->json([
            'status' => $session->status,
            'expires_at' => $session->expires_at->toIso8601String(),
        ]);
    }

    /**
     * Confirm 2FA with session token and code.
     */
    public function confirmWithToken(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|uuid',
            'code' => 'required|string',
        ]);

        $user = $request->user();
        $session = TwoFactorSetupSession::where('token', $request->token)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($session->isExpired()) {
            $session->update(['status' => TwoFactorSetupSession::STATUS_EXPIRED]);
            return response()->json(['message' => 'Setup session expired'], 410);
        }

        try {
            $confirm = app(ConfirmTwoFactorAuthentication::class);
            $confirm($user, $request->code);

            $session->update([
                'status' => TwoFactorSetupSession::STATUS_CONFIRMED,
                'confirmed_at' => now(),
                'attempts' => $session->attempts + 1,
                'last_attempt_at' => now(),
            ]);

            return response()->json([
                'message' => 'Two factor authentication confirmed successfully'
            ], 200);
        } catch (\Exception $e) {
            $session->update([
                'attempts' => $session->attempts + 1,
                'last_attempt_at' => now(),
            ]);

            throw ValidationException::withMessages([
                'code' => ['The provided two factor authentication code is invalid.'],
            ]);
        }
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
