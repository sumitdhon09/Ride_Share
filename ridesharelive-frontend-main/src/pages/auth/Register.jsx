import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { Card } from '../ui/Card';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: 'RIDER',
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\+?[\d\s-()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    clearError();
    
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    
    if (result.success) {
      const user = result.data.user;
      if (user.role === 'DRIVER') {
        navigate('/driver/dashboard');
      } else {
        navigate('/rider/dashboard');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-4xl font-bold text-gray-900 mb-2"
          >
            Join RideShare Live
          </motion.h1>
          <p className="text-gray-600">Create your account to get started</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Alert variant="error" onClose={clearError}>
                  {error}
                </Alert>
              </motion.div>
            )}

            <div className="space-y-4">
              <Input
                label="Full Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Enter your full name"
                required
                autoComplete="name"
              />

              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="Enter your email"
                required
                autoComplete="email"
              />

              <Input
                label="Phone Number"
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                error={errors.phoneNumber}
                placeholder="+1 (555) 123-4567"
                required
                autoComplete="tel"
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="relative flex items-center justify-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="role"
                      value="RIDER"
                      checked={formData.role === 'RIDER'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className={`text-center ${formData.role === 'RIDER' ? 'text-blue-600' : 'text-gray-600'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 mx-auto mb-2 ${formData.role === 'RIDER' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`} />
                      <span className="font-medium">Rider</span>
                    </div>
                  </label>
                  
                  <label className="relative flex items-center justify-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="role"
                      value="DRIVER"
                      checked={formData.role === 'DRIVER'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className={`text-center ${formData.role === 'DRIVER' ? 'text-blue-600' : 'text-gray-600'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 mx-auto mb-2 ${formData.role === 'DRIVER' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`} />
                      <span className="font-medium">Driver</span>
                    </div>
                  </label>
                </div>
              </div>

              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="Create a strong password"
                required
                autoComplete="new-password"
              />

              <Input
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="text-xs text-gray-500">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="text-blue-600 hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Register;
