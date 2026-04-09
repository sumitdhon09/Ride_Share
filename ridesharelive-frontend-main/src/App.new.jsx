import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Dashboard Pages
import RiderDashboard from './pages/rider/RiderDashboard';
import DriverDashboard from './pages/driver/DriverDashboard';

// Utility Pages
import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Rider Routes */}
            <Route
              path="rider/dashboard"
              element={
                <ProtectedRoute requiredRole="RIDER">
                  <RiderDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Driver Routes */}
            <Route
              path="driver/dashboard"
              element={
                <ProtectedRoute requiredRole="DRIVER">
                  <DriverDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Default redirect based on role */}
            <Route
              index
              element={<Navigate to="/rider/dashboard" replace />}
            />
          </Route>
          
          {/* Error Pages */}
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;
