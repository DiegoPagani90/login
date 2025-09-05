<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Actions\Fortify\UpdateUserPassword;
use App\Actions\Fortify\UpdateUserProfileInformation;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Laravel\Fortify\Actions\RedirectIfTwoFactorAuthenticatable;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::updateUserProfileInformationUsing(UpdateUserProfileInformation::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::redirectUserForTwoFactorAuthenticationUsing(RedirectIfTwoFactorAuthenticatable::class);

        // Configure JSON responses for API
        if (request()->expectsJson()) {
            Fortify::loginView(function () {
                return response()->json(['message' => 'Unauthenticated'], 401);
            });

            Fortify::registerView(function () {
                return response()->json(['message' => 'Registration endpoint'], 200);
            });

            Fortify::requestPasswordResetLinkView(function () {
                return response()->json(['message' => 'Password reset link request'], 200);
            });

            Fortify::resetPasswordView(function () {
                return response()->json(['message' => 'Password reset'], 200);
            });

            Fortify::verifyEmailView(function () {
                return response()->json(['message' => 'Email verification required'], 200);
            });

            Fortify::twoFactorChallengeView(function () {
                return response()->json(['message' => 'Two factor authentication required'], 200);
            });

            Fortify::confirmPasswordView(function () {
                return response()->json(['message' => 'Password confirmation required'], 200);
            });
        }

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });
    }
}
