<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use App\Models\User;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageRenderer;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

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

        return response()->json([
            'message' => 'Two factor authentication enabled',
            'secret' => decrypt($user->two_factor_secret),
            'qr_code_url' => $this->generateQrCodeUrl($user),
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
            'token' => $token
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

        return response()->json([
            'qr_code_url' => $this->generateQrCodeUrl($user),
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

        if (!$this->verifyTwoFactorCode($user, $request->code)) {
            throw ValidationException::withMessages([
                'code' => ['The provided two factor authentication code is invalid.'],
            ]);
        }

        $confirm = app(ConfirmTwoFactorAuthentication::class);
        $confirm($user, $request->code);

        return response()->json([
            'message' => 'Two factor authentication confirmed successfully'
        ], 200);
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
     * Generate QR code URL for Google Authenticator
     */
    private function generateQrCodeUrl($user): string
    {
        $qrCodeUrl = app(\Laravel\Fortify\TwoFactorAuthenticationProvider::class)->qrCodeUrl(
            config('app.name'),
            $user->email,
            decrypt($user->two_factor_secret)
        );

        $svg = (new Writer(
            new ImageRenderer(
                new RendererStyle(400, 0, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(0, 0, 0))),
                new SvgImageRenderer()
            )
        ))->writeString($qrCodeUrl);

        return 'data:image/svg+xml;base64,' . base64_encode($svg);
    }

    /**
     * Verify two factor authentication code
     */
    private function verifyTwoFactorCode($user, $code): bool
    {
        $twoFactorProvider = app(\Laravel\Fortify\TwoFactorAuthenticationProvider::class);
        
        return $twoFactorProvider->verify(decrypt($user->two_factor_secret), $code) ||
               $this->verifyRecoveryCode($user, $code);
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
