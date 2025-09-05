import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import QrCodeModal from './QrCodeModal';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    console.log(`[Dashboard] Showing ${type} notification:`, message);
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleLogout = async () => {
    console.log('[Dashboard] User initiated logout');
    setIsLoading(true);
    
    try {
      await logout();
      console.log('[Dashboard] Logout completed successfully');
    } catch (error) {
      console.error('[Dashboard] Logout failed:', error);
      showNotification('Logout failed, but you have been signed out locally', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTwoFactor = async () => {
    console.log('[Dashboard] Toggling 2FA, current status:', user?.two_factor_enabled);
    console.log('[Dashboard] Full user object:', user);
    
    if (user?.two_factor_enabled) {
      // Disable 2FA
      setIsLoading(true);
      try {
        await apiService.disableTwoFactor();
        console.log('[Dashboard] 2FA disabled successfully');
        updateUser({ two_factor_enabled: false });
        showNotification('Two-factor authentication has been disabled');
      } catch (error) {
        console.error('[Dashboard] Failed to disable 2FA:', error);
        showNotification('Failed to disable two-factor authentication', 'error');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Enable 2FA - show QR code modal
      console.log('[Dashboard] Opening QR code modal for 2FA setup');
      setShowQrCodeModal(true);
    }
  };

  const handleQrCodeModalComplete = () => {
    console.log('[Dashboard] QR code setup completed');
    setShowQrCodeModal(false);
    updateUser({ two_factor_enabled: true });
    showNotification('Two-factor authentication has been enabled successfully!');
  };

  const handleQrCodeModalCancel = () => {
    console.log('[Dashboard] QR code setup cancelled');
    setShowQrCodeModal(false);
  };

  if (!user) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  console.log('[Dashboard] Rendering with user:', user);
  console.log('[Dashboard] 2FA Status:', user.two_factor_enabled);

  return (
    <div className="dashboard-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user.name}!</p>
      </div>

      <div className="dashboard-content">
        <div className="user-info-card">
          <h2>User Information</h2>
          <div className="user-details">
            <div className="detail-item">
              <label>Name:</label>
              <span>{user.name}</span>
            </div>
            <div className="detail-item">
              <label>Email:</label>
              <span>{user.email}</span>
            </div>
            <div className="detail-item">
              <label>Member since:</label>
              <span>{new Date(user.created_at || Date.now()).toLocaleDateString()}</span>
            </div>
            <div className="detail-item">
              <label>Two-Factor Authentication:</label>
              <span className={`status ${user.two_factor_enabled ? 'enabled' : 'disabled'}`}>
                {user.two_factor_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        <div className="actions-card">
          <h2>Account Actions</h2>
          <div className="action-buttons">
            <button
              className={`action-button ${user.two_factor_enabled ? 'danger' : 'primary'}`}
              onClick={handleToggleTwoFactor}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : (
                user.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'
              )}
            </button>

            <button
              className="action-button secondary"
              onClick={handleLogout}
              disabled={isLoading}
            >
              {isLoading ? 'Signing out...' : 'Logout'}
            </button>
          </div>
        </div>

        {user.two_factor_enabled && (
          <div className="security-info-card">
            <h2>Security Information</h2>
            <div className="security-status">
              <div className="security-item">
                <span className="security-icon">🔒</span>
                <div>
                  <h4>Two-Factor Authentication Active</h4>
                  <p>Your account is protected with an additional layer of security</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showQrCodeModal && (
        <QrCodeModal
          onComplete={handleQrCodeModalComplete}
          onCancel={handleQrCodeModalCancel}
        />
      )}
    </div>
  );
};

export default Dashboard;
