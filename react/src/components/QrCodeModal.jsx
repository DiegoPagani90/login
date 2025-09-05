import React, { useState, useEffect, useRef } from 'react';
import apiService from '../services/api';
import './QrCodeModal.css';

const QrCodeModal = ({ onComplete, onCancel }) => {
  const [qrUrl, setQrUrl] = useState(null);
  const [token, setToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const lastHiddenAtRef = useRef(null);

  useEffect(() => {
    startSetupAndLoadQR();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Heuristic: if user switches away (to Authenticator) and comes back within 20s, auto-show verification
  useEffect(() => {
    if (!qrUrl || showVerification) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (lastHiddenAtRef.current && Date.now() - lastHiddenAtRef.current < 20000) {
          proceedToVerification();
        }
        lastHiddenAtRef.current = null;
      }
    };

    const onBlur = () => {
      lastHiddenAtRef.current = Date.now();
    };

    const onFocus = () => {
      if (lastHiddenAtRef.current && Date.now() - lastHiddenAtRef.current < 20000) {
        proceedToVerification();
      }
      lastHiddenAtRef.current = null;
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [qrUrl, showVerification]);

  const startSetupAndLoadQR = async () => {
    console.log('[QrCodeModal] Starting 2FA setup session and loading QR');
    setIsLoading(true);
    setError('');
    try {
      // Start token-based setup session (TTL ~5 min)
      const start = await apiService.startTwoFactorSetup();
      setToken(start.token);
      setExpiresAt(start.expires_at);

      // Initialize countdown timer
      timerRef.current = setInterval(() => {
        const diff = Math.max(0, Math.floor((new Date(start.expires_at).getTime() - Date.now()) / 1000));
        setCountdown(diff);
        if (diff <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
        }
      }, 1000);

      // Fetch QR by token
      const qr = await apiService.getTwoFactorSetupQrByToken(start.token);
      setQrUrl(qr.qr_code_url);

      // Poll status every 3s to react on expiry/confirm (defensive UX)
      pollRef.current = setInterval(async () => {
        try {
          const status = await apiService.getTwoFactorSetupStatus(start.token);
          if (status.status !== 'pending') {
            if (pollRef.current) clearInterval(pollRef.current);
            if (status.status === 'expired') {
              setError('QR code expired. Please restart the setup.');
              setQrUrl(null);
            }
          }
        } catch (e) {
          // ignore polling errors
        }
      }, 3000);
    } catch (err) {
      console.error('[QrCodeModal] Failed to start setup or load QR:', err);
      setError('Failed to generate QR code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    console.log('[QrCodeModal] Verifying setup code');
    
    setError('');
    setIsLoading(true);

    try {
      if (!token) throw new Error('Missing setup token');
      await apiService.confirmTwoFactorWithToken(token, verificationCode);
      console.log('[QrCodeModal] 2FA setup confirmed successfully');
      onComplete();
    } catch (err) {
      console.error('[QrCodeModal] Failed to verify setup code:', err);
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
    if (error) setError('');
  };

  const handleCancel = async () => {
    console.log('[QrCodeModal] Setup cancelled, disabling 2FA');
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await apiService.disableTwoFactor();
      console.log('[QrCodeModal] 2FA disabled successfully');
    } catch (err) {
      console.error('[QrCodeModal] Failed to disable 2FA during cancellation:', err);
    }
    
    onCancel();
  };

  const proceedToVerification = () => {
    console.log('[QrCodeModal] Proceeding to verification (hide QR)');
    setShowVerification(true);
  };

  return (
    <div className="qr-modal-overlay">
      <div className="qr-modal-content">
        <div className="qr-modal-header">
          <h3>
            {!showVerification ? 'Setup Two-Factor Authentication' : 'Verify Your Setup'}
          </h3>
          <button className="qr-close-button" onClick={handleCancel}>×</button>
        </div>

        <div className="qr-modal-body">
          {!showVerification ? (
            // Step 1: Show QR Code
            <>
              <p className="qr-instructions">
                Scan this QR code with your Google Authenticator or any compatible authenticator app:
              </p>

              {isLoading ? (
                <div className="qr-loading-container">
                  <div className="qr-loading-spinner"></div>
                  <p>Generating QR code...</p>
                </div>
              ) : qrUrl ? (
                <div className="qr-code-container">
                  <div className="qr-code-wrapper">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                      alt="2FA QR Code" 
                      className="qr-code-image" 
                      onClick={proceedToVerification}
                      onError={(e) => {
                        console.error('[QrCodeModal] QR code image failed to load, using fallback');
                        e.target.src = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(qrUrl)}`;
                      }}
                    />
                  </div>

                  <div className="qr-steps">
                    <div className="qr-step">
                      <span className="qr-step-number">1</span>
                      <span>Open your authenticator app</span>
                    </div>
                    <div className="qr-step">
                      <span className="qr-step-number">2</span>
                      <span>Scan this QR code or enter the code manually</span>
                    </div>
                    <div className="qr-step">
                      <span className="qr-step-number">3</span>
                      <span>Click the QR or "I scanned it" to verify</span>
                    </div>
                  </div>

                  {expiresAt && (
                    <div className="qr-expiry">
                      Expires in: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="qr-error-container">
                  <p className="qr-error-text">{error || 'Failed to generate QR code'}</p>
                  <button onClick={startSetupAndLoadQR} className="qr-retry-button">
                    Try Again
                  </button>
                </div>
              )}

              {qrUrl && (
                <div className="qr-modal-actions">
                  <button onClick={handleCancel} className="qr-cancel-button">
                    Cancel
                  </button>
                  <button onClick={proceedToVerification} className="qr-next-button">
                    I scanned it - Verify now
                  </button>
                </div>
              )}
            </>
          ) : (
            // Step 2: Verification
            <>
              <p className="qr-instructions">
                Enter the 6-digit code from your authenticator app to complete the setup:
              </p>

              <form onSubmit={handleVerifyCode} className="qr-verify-form">
                <div className="qr-code-input-container">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={handleInputChange}
                    placeholder="000000"
                    maxLength="6"
                    required
                    className="qr-code-input"
                    autoComplete="one-time-code"
                    autoFocus
                    onFocus={() => setShowVerification(true)}
                  />
                </div>

                {error && (
                  <div className="qr-error-message">
                    {error}
                  </div>
                )}

                <div className="qr-modal-actions">
                  <button 
                    type="button" 
                    onClick={() => setShowVerification(false)} 
                    className="qr-back-button"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || verificationCode.length !== 6}
                    className="qr-verify-button"
                  >
                    {isLoading ? 'Verifying...' : 'Complete Setup'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrCodeModal;
