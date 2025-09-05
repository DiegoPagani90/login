import React, { useState, useEffect, useRef } from 'react';
import apiService from '../services/api';
import './TwoFactorSetup.css';

const TwoFactorSetup = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1); // 1: QR Code, 2: Verify Code, 3: Recovery
  const [qrUrl, setQrUrl] = useState(null);
  const [token, setToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const lastHiddenAtRef = useRef(null);

  useEffect(() => {
    startSetup();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Heuristic: if user switches away to scan and comes back quickly, auto-advance to verification
  useEffect(() => {
    if (!qrUrl || step !== 1) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (lastHiddenAtRef.current && Date.now() - lastHiddenAtRef.current < 20000) {
          setStep(2);
        }
        lastHiddenAtRef.current = null;
      }
    };

    const onBlur = () => {
      lastHiddenAtRef.current = Date.now();
    };

    const onFocus = () => {
      if (lastHiddenAtRef.current && Date.now() - lastHiddenAtRef.current < 20000) {
        setStep(2);
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
  }, [qrUrl, step]);

  const startSetup = async () => {
    console.log('[TwoFactorSetup] Starting 2FA setup session');
    setIsLoading(true);
    try {
      const start = await apiService.startTwoFactorSetup();
      setToken(start.token);
      setExpiresAt(start.expires_at);
      timerRef.current = setInterval(() => {
        const diff = Math.max(0, Math.floor((new Date(start.expires_at).getTime() - Date.now()) / 1000));
        setCountdown(diff);
        if (diff <= 0 && timerRef.current) clearInterval(timerRef.current);
      }, 1000);
      const qr = await apiService.getTwoFactorSetupQrByToken(start.token);
      setQrUrl(qr.qr_code_url);
      // Optionally preload recovery codes later after confirm
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
        } catch (e) {}
      }, 3000);
    } catch (err) {
      console.error('[TwoFactorSetup] Failed to start setup:', err);
      setError('Failed to enable two-factor authentication. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    console.log('[TwoFactorSetup] Verifying setup code');
    
    setError('');
    setIsLoading(true);

    try {
      if (!token) throw new Error('Missing setup token');
      await apiService.confirmTwoFactorWithToken(token, verificationCode);
      console.log('[TwoFactorSetup] 2FA setup confirmed successfully');
      // Fetch recovery codes freshly if needed
      try {
        const rec = await apiService.generateRecoveryCodes();
        setRecoveryCodes(rec.recovery_codes || []);
      } catch (e) {}
      setStep(3);
    } catch (err) {
      console.error('[TwoFactorSetup] Failed to verify setup code:', err);
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

  const handleComplete = () => {
    console.log('[TwoFactorSetup] Setup completed by user');
    onComplete();
  };

  const handleCancel = async () => {
    console.log('[TwoFactorSetup] Setup cancelled, disabling 2FA');
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await apiService.disableTwoFactor();
      console.log('[TwoFactorSetup] 2FA disabled successfully');
    } catch (err) {
      console.error('[TwoFactorSetup] Failed to disable 2FA during cancellation:', err);
    }
    
    onCancel();
  };

  return (
    <div className="modal-overlay">
      <div className="setup-modal">
        <div className="setup-header">
          <h3>Setup Two-Factor Authentication</h3>
          <button className="close-button" onClick={handleCancel}>×</button>
        </div>

        {step === 1 && (
          <div className="setup-content">
            <div className="step-indicator">
              <span className="step active">1</span>
              <span className="step">2</span>
              <span className="step">3</span>
            </div>

            <h4>Step 1: Scan QR Code</h4>
            <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>

            {isLoading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Generating QR code...</p>
              </div>
            ) : qrUrl ? (
              <div className="qr-container">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`} alt="2FA QR Code" className="qr-code" onClick={() => setStep(2)} />
                {expiresAt && (
                  <p className="expiry-text">Expires in: {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
                )}
              </div>
            ) : (
              <div className="error-container">
                <p>{error || 'Failed to generate QR code'}</p>
                <button onClick={startSetup} className="retry-button">
                  Try Again
                </button>
              </div>
            )}

            {qrUrl && (
              <div className="setup-actions">
                <button onClick={() => setStep(2)} className="next-button">
                  I scanned it - Next Step
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="setup-content">
            <div className="step-indicator">
              <span className="step completed">1</span>
              <span className="step active">2</span>
              <span className="step">3</span>
            </div>

            <h4>Step 2: Verify Code</h4>
            <p>Enter the 6-digit code from your authenticator app to verify the setup</p>

            <form onSubmit={handleVerifyCode} className="verify-form">
              <div className="form-group">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={handleInputChange}
                  placeholder="000000"
                  maxLength="6"
                  required
                  className="verify-input"
                  autoComplete="one-time-code"
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="setup-actions">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="back-button"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="verify-button"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Complete'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div className="setup-content">
            <div className="step-indicator">
              <span className="step completed">1</span>
              <span className="step completed">2</span>
              <span className="step active">3</span>
            </div>

            <h4>Step 3: Save Recovery Codes</h4>
            <p>Save these recovery codes in a safe place. You can use them to access your account if you lose your authenticator device.</p>

            <div className="recovery-codes">
              {recoveryCodes.map((code, index) => (
                <div key={index} className="recovery-code">
                  {code}
                </div>
              ))}
            </div>

            <div className="warning-message">
              <strong>Important:</strong> These codes will only be shown once. Make sure to save them securely.
            </div>

            <div className="setup-actions">
              <button onClick={handleComplete} className="complete-button">
                I've Saved My Recovery Codes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorSetup;
