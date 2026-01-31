'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    college_id: '',
    password: '',
    department: '',
    year: '',
    bio: '',
    profile_image: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let success = false;
      
      if (mode === 'login') {
        success = await login(formData.college_id, formData.password);
      } else {
        const result = await register({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          college_id: formData.college_id,
          password: formData.password,
          department: formData.department,
          year: parseInt(formData.year),
          bio: formData.bio || undefined,
          profile_image: formData.profile_image || undefined,
        });
        success = result.success;
        if (!success) {
          setError(result.message || 'Registration failed');
        }
      }

      if (success) {
        onClose();
        setFormData({ name: '', username: '', email: '', college_id: '', password: '', department: '', year: '', bio: '', profile_image: '' });
      } else {
        setError(mode === 'login' ? 'Invalid credentials' : (error || 'Registration failed'));
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <h2 className="text-xl font-semibold text-text">
            {mode === 'login' ? 'Sign In to UNI-X' : 'Join UNI-X'}
          </h2>
          <button
            onClick={onClose}
            className="btn-icon"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="input"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="input"
                  placeholder="you@example.com"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                College ID
              </label>
              <input
                type="text"
                name="college_id"
                value={formData.college_id}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="Enter your college ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="input"
                placeholder="Enter your password"
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Department
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    required
                    className="input"
                  >
                    <option value="">Select Department</option>
                    <option value="Bachelor  of Computer Applications">Masters of Computer Applications</option>
                    <option value="Masters of Computer Applications">Masters of Computer Applications</option>
                    <option value="Bachelor of Business Administration">Bachelor of Business Administration</option>
                    <option value="Masters of Business Administration">Masters of Business Administration</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Year
                  </label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    required
                    className="input"
                  >
                    <option value="">Select Year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                    <option value="5">5th Year</option>
                    <option value="6">Graduate</option>
                  </select>
                </div>
              </>
            )}

            {error && (
              <div className="text-error text-sm text-center bg-error/10 py-2 px-4 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full btn-lg"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
                </>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="link text-sm font-semibold"
            >
              {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
