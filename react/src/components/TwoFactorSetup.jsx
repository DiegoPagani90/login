import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import './TwoFactorSetup.css';

const TwoFactorSetup = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1); // 1: QR Code, 2: Verify Code
  const [qrCodeData, setQrCodeData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  useEffect(() => {
    enableTwoFactor();
  }, []);

  const enableTwoFactor = async () => {
    console.log('[TwoFactorSetup] Enabling 2FA and generating QR code');
    setIsLoading(true);
    
    try {
      const response = await apiService.enableTwoFactor();
      console.log('[TwoFactorSetup] 2FA enabled, QR code received');
      setQrCodeData(response);
      setRecoveryCodes(response.recovery_codes || []);
    } catch (err) {
      console.error('[TwoFactorSetup] Failed to enable 2FA:', err);
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
      await apiService.confirmTwoFactor(verificationCode);
      console.log('[TwoFactorSetup] 2FA setup confirmed successfully');
      setStep(3); // Show recovery codes
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
            ) : qrCodeData ? (
              <div className="qr-container">
                <img src={qrCodeData.qr_code_url} alt="2FA QR Code" className="qr-code" />
                <p className="secret-text">
                  Manual entry key: <code>{qrCodeData.secret}</code>
                </p>
              </div>
            ) : (
              <div className="error-container">
                <p>{error || 'Failed to generate QR code'}</p>
                <button onClick={enableTwoFactor} className="retry-button">
                  Try Again
                </button>
              </div>
            )}

            {qrCodeData && (
              <div className="setup-actions">
                <button onClick={() => setStep(2)} className="next-button">
                  Next Step
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
