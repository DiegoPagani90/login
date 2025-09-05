<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\TwoFactorAuthController;

// Public routes
Route::post('/login', [AuthController::class, 'login']);
Route::post('/verify-two-factor', [TwoFactorAuthController::class, 'verify']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    
    // Two Factor Authentication routes
    Route::post('/two-factor/enable', [TwoFactorAuthController::class, 'enable']);
    Route::post('/two-factor/disable', [TwoFactorAuthController::class, 'disable']);
    Route::post('/two-factor/confirm', [TwoFactorAuthController::class, 'confirm']);
    Route::get('/two-factor/qr-code', [TwoFactorAuthController::class, 'showQrCode']);
    Route::post('/two-factor/recovery-codes', [TwoFactorAuthController::class, 'generateRecoveryCodes']);
});
