import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './TwoFactorModal.css';

const TwoFactorModal = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { verifyTwoFactor, twoFactorRequired } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[TwoFactorModal] Attempting to verify 2FA code');
    
    setError('');
    setIsLoading(true);

    try {
      await verifyTwoFactor(code);
      console.log('[TwoFactorModal] 2FA verification successful');
      setCode('');
    } catch (err) {
      console.error('[TwoFactorModal] 2FA verification failed:', err);
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    if (error) setError('');
  };

  if (!twoFactorRequired) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Two-Factor Authentication</h3>
          <p>Please enter the 6-digit code from your authenticator app</p>
        </div>

        <form onSubmit={handleSubmit} className="twofa-form">
          <div className="form-group">
            <label htmlFor="twofa-code">Verification Code</label>
            <input
              type="text"
              id="twofa-code"
              value={code}
              onChange={handleInputChange}
              placeholder="000000"
              maxLength="6"
              required
              autoComplete="one-time-code"
              className="twofa-input"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="verify-button"
            disabled={isLoading || code.length !== 6}
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="modal-footer">
          <p className="help-text">
            Can't access your authenticator? Use a recovery code instead.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorModal;
