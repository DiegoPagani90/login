import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Interceptor per aggiungere il token alle richieste
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        console.log(`[API] Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
        return config;
      },
      (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Interceptor per gestire le risposte
    this.api.interceptors.response.use(
      (response) => {
        console.log(`[API] Response: ${response.status}`, response.data);
        return response;
      },
      (error) => {
        console.error('[API] Response error:', error.response?.data || error.message);
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  async login(credentials) {
    console.log('[AuthService] Attempting login for:', credentials.email);
    try {
      const response = await this.api.post('/login', credentials);
      console.log('[AuthService] Login successful');
      return response.data;
    } catch (error) {
      console.error('[AuthService] Login failed:', error.response?.data?.message);
      throw error;
    }
  }

  async logout() {
    console.log('[AuthService] Attempting logout');
    try {
      const response = await this.api.post('/logout');
      localStorage.removeItem('auth_token');
      console.log('[AuthService] Logout successful');
      return response.data;
    } catch (error) {
      console.error('[AuthService] Logout failed:', error.response?.data?.message);
      localStorage.removeItem('auth_token'); // Remove token anyway
      throw error;
    }
  }

  async getUser() {
    console.log('[AuthService] Fetching user data');
    try {
      const response = await this.api.get('/user');
      console.log('[AuthService] User data retrieved');
      return response.data;
    } catch (error) {
      console.error('[AuthService] Failed to fetch user data:', error.response?.data?.message);
      throw error;
    }
  }

  // Two Factor Authentication methods
  async enableTwoFactor() {
    console.log('[TwoFactorService] Enabling 2FA');
    try {
      const response = await this.api.post('/two-factor/enable');
      console.log('[TwoFactorService] 2FA enabled successfully');
      return response.data;
    } catch (error) {
      console.error('[TwoFactorService] Failed to enable 2FA:', error.response?.data?.message);
      throw error;
    }
  }

  async disableTwoFactor() {
    console.log('[TwoFactorService] Disabling 2FA');
    try {
      const response = await this.api.post('/two-factor/disable');
      console.log('[TwoFactorService] 2FA disabled successfully');
      return response.data;
    } catch (error) {
      console.error('[TwoFactorService] Failed to disable 2FA:', error.response?.data?.message);
      throw error;
    }
  }

  async verifyTwoFactor(userId, code) {
    console.log('[TwoFactorService] Verifying 2FA code');
    try {
      const response = await this.api.post('/verify-two-factor', {
        user_id: userId,
        code: code
      });
      console.log('[TwoFactorService] 2FA verification successful');
      return response.data;
    } catch (error) {
      console.error('[TwoFactorService] 2FA verification failed:', error.response?.data?.message);
      throw error;
    }
  }

  async confirmTwoFactor(code) {
    console.log('[TwoFactorService] Confirming 2FA setup');
    try {
      const response = await this.api.post('/two-factor/confirm', { code });
      console.log('[TwoFactorService] 2FA setup confirmed');
      return response.data;
    } catch (error) {
      console.error('[TwoFactorService] Failed to confirm 2FA setup:', error.response?.data?.message);
      throw error;
    }
  }

  async getQrCode() {
    console.log('[TwoFactorService] Fetching QR code');
    try {
      const response = await this.api.get('/two-factor/qr-code');
      console.log('[TwoFactorService] QR code retrieved');
      return response.data;
    } catch (error) {
      console.error('[TwoFactorService] Failed to fetch QR code:', error.response?.data?.message);
      throw error;
    }
  }

  async generateRecoveryCodes() {
    console.log('[TwoFactorService] Generating new recovery codes');
    try {
      const response = await this.api.post('/two-factor/recovery-codes');
      console.log('[TwoFactorService] Recovery codes generated');
      return response.data;
    } catch (error) {
      console.error('[TwoFactorService] Failed to generate recovery codes:', error.response?.data?.message);
      throw error;
    }
  }

  // 2FA setup session (token-based) methods
  async startTwoFactorSetup() {
    console.log('[TwoFactorService] Starting 2FA setup session');
    try {
      const response = await this.api.post('/two-factor/setup/start');
      // Do NOT log sensitive payloads
      return response.data; // { token, expires_at }
    } catch (error) {
      console.error('[TwoFactorService] Failed to start setup session:', error.response?.data?.message);
      throw error;
    }
  }

  async getTwoFactorSetupQrByToken(token) {
    console.log('[TwoFactorService] Fetching 2FA QR by token');
    try {
      const response = await this.api.get('/two-factor/setup/qr', { params: { token } });
      return response.data; // { qr_code_url, expires_at }
    } catch (error) {
      console.error('[TwoFactorService] Failed to fetch setup QR:', error.response?.data?.message);
      throw error;
    }
  }

  async getTwoFactorSetupStatus(token) {
    // minimal logging (status polling)
    try {
      const response = await this.api.get('/two-factor/setup/status', { params: { token } });
      return response.data; // { status, expires_at }
    } catch (error) {
      console.error('[TwoFactorService] Failed to poll setup status:', error.response?.data?.message);
      throw error;
    }
  }

  async confirmTwoFactorWithToken(token, code) {
    console.log('[TwoFactorService] Confirming 2FA with token');
    try {
      const response = await this.api.post('/two-factor/setup/confirm', { token, code });
      return response.data; // { message }
    } catch (error) {
      console.error('[TwoFactorService] Failed to confirm 2FA (token):', error.response?.data?.message);
      throw error;
    }
  }

  // Utility methods
  setAuthToken(token) {
    localStorage.setItem('auth_token', token);
    console.log('[AuthService] Auth token set');
  }

  getAuthToken() {
    return localStorage.getItem('auth_token');
  }

  removeAuthToken() {
    localStorage.removeItem('auth_token');
    console.log('[AuthService] Auth token removed');
  }

  isAuthenticated() {
    const token = this.getAuthToken();
    return !!token;
  }
}

export default new ApiService();
