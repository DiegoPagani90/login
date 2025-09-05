import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import './QrCodeModal.css';

const QrCodeModal = ({ onComplete, onCancel }) => {
  const [qrCodeData, setQrCodeData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  useEffect(() => {
    enableTwoFactorAndShowQR();
  }, []);

  const enableTwoFactorAndShowQR = async () => {
    console.log('[QrCodeModal] Enabling 2FA and generating QR code');
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiService.enableTwoFactor();
      console.log('[QrCodeModal] 2FA enabled, QR code received');
      setQrCodeData(response);
    } catch (err) {
      console.error('[QrCodeModal] Failed to enable 2FA:', err);
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
      await apiService.confirmTwoFactor(verificationCode);
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
    
    try {
      await apiService.disableTwoFactor();
      console.log('[QrCodeModal] 2FA disabled successfully');
    } catch (err) {
      console.error('[QrCodeModal] Failed to disable 2FA during cancellation:', err);
    }
    
    onCancel();
  };

  const proceedToVerification = () => {
    console.log('[QrCodeModal] User proceeding to verification step');
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
              ) : qrCodeData ? (
                <div className="qr-code-container">
                  <div className="qr-code-wrapper">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData.qr_code_url)}`}
                      alt="2FA QR Code" 
                      className="qr-code-image" 
                      onError={(e) => {
                        console.error('[QrCodeModal] QR code image failed to load, using fallback');
                        e.target.src = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(qrCodeData.qr_code_url)}`;
                      }}
                    />
                  </div>
                  
                  <div className="qr-manual-entry">
                    <p className="qr-manual-label">Can't scan? Enter this code manually:</p>
                    <div className="qr-secret-code">
                      {qrCodeData.secret}
                    </div>
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
                      <span>Click "Next" to verify the setup</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="qr-error-container">
                  <p className="qr-error-text">{error || 'Failed to generate QR code'}</p>
                  <button onClick={enableTwoFactorAndShowQR} className="qr-retry-button">
                    Try Again
                  </button>
                </div>
              )}

              {qrCodeData && (
                <div className="qr-modal-actions">
                  <button onClick={handleCancel} className="qr-cancel-button">
                    Cancel
                  </button>
                  <button onClick={proceedToVerification} className="qr-next-button">
                    Next - Verify Setup
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
