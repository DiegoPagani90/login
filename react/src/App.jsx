import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import TwoFactorModal from './components/TwoFactorModal';
import './App.css';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  console.log('[ProtectedRoute] Auth status:', { isAuthenticated, isLoading });
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Public Route Component (redirect if authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading, twoFactorRequired } = useAuth();
  
  console.log('[PublicRoute] Auth status:', { isAuthenticated, isLoading, twoFactorRequired });
  
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  // If 2FA is required, stay on login page
  if (twoFactorRequired) {
    return children;
  }
  
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

// App Routes Component
function AppRoutes() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginForm />
              </PublicRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/" 
            element={<Navigate to="/dashboard" replace />} 
          />
          <Route 
            path="*" 
            element={<Navigate to="/dashboard" replace />} 
          />
        </Routes>
        
        {/* Two Factor Modal - Shows globally when needed */}
        <TwoFactorModal />
      </div>
    </Router>
  );
}

// Main App Component
function App() {
  console.log('[App] Application starting');
  
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
