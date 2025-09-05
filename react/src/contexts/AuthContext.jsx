import React, { createContext, useContext, useReducer, useEffect } from 'react';
import apiService from '../services/api';

const AuthContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  twoFactorRequired: false,
  pendingUserId: null,
};

function authReducer(state, action) {
  console.log('[AuthContext] Action dispatched:', action.type, action.payload);
  
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        twoFactorRequired: false,
        pendingUserId: null,
      };
    
    case 'TWO_FACTOR_REQUIRED':
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        twoFactorRequired: true,
        pendingUserId: action.payload.userId,
      };
    
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    console.log('[AuthContext] Checking authentication status');
    
    if (!apiService.isAuthenticated()) {
      console.log('[AuthContext] No auth token found');
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    try {
      const userData = await apiService.getUser();
      console.log('[AuthContext] User authenticated successfully', userData);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { 
        user: {
          ...userData.user,
          two_factor_enabled: userData.two_factor_enabled
        }
      }});
    } catch (error) {
      console.error('[AuthContext] Authentication check failed');
      apiService.removeAuthToken();
      dispatch({ type: 'LOGOUT' });
    }
  };

  const login = async (credentials) => {
    console.log('[AuthContext] Starting login process');
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await apiService.login(credentials);
      
      if (response.two_factor) {
        console.log('[AuthContext] Two factor authentication required');
        dispatch({
          type: 'TWO_FACTOR_REQUIRED',
          payload: { userId: response.user_id }
        });
        return { requiresTwoFactor: true, userId: response.user_id };
      } else {
        console.log('[AuthContext] Login completed successfully');
        apiService.setAuthToken(response.token);
        dispatch({ type: 'LOGIN_SUCCESS', payload: { 
          user: {
            ...response.user,
            two_factor_enabled: response.two_factor_enabled || false
          }
        }});
        return { requiresTwoFactor: false };
      }
    } catch (error) {
      console.error('[AuthContext] Login failed');
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Login failed' });
      throw error;
    }
  };

  const verifyTwoFactor = async (code) => {
    console.log('[AuthContext] Verifying two factor code');
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await apiService.verifyTwoFactor(state.pendingUserId, code);
      console.log('[AuthContext] Two factor verification successful');
      
      apiService.setAuthToken(response.token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { 
        user: {
          ...response.user,
          two_factor_enabled: response.two_factor_enabled || true // If they just verified 2FA, it must be enabled
        }
      }});
      return true;
    } catch (error) {
      console.error('[AuthContext] Two factor verification failed');
      dispatch({ type: 'SET_ERROR', payload: error.response?.data?.message || 'Verification failed' });
      throw error;
    }
  };

  const logout = async () => {
    console.log('[AuthContext] Starting logout process');
    
    try {
      await apiService.logout();
      console.log('[AuthContext] Logout completed successfully');
    } catch (error) {
      console.error('[AuthContext] Logout request failed, but removing local token');
    }
    
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (userData) => {
    console.log('[AuthContext] Updating user data');
    dispatch({ type: 'UPDATE_USER', payload: userData });
  };

  const value = {
    ...state,
    login,
    logout,
    verifyTwoFactor,
    updateUser,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
