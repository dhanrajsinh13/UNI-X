'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function LandingPage() {
  const [showLogin, setShowLogin] = useState(true);
  const [loginForm, setLoginForm] = useState({ college_id: '', password: '' });
  const router = useRouter();
  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    email: '',
    college_id: '',
    password: '',
    confirmPassword: '',
    department: '',
    year: 1
  });
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register, user, isLoading } = useAuth();

  // Move all hooks before any conditional logic
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    const success = await login(loginForm.college_id, loginForm.password);
    
    if (success) {
      router.push('/');
    } else {
      setError('Invalid college ID or password');
    }
    
    setIsSubmitLoading(false);
  }, [login, loginForm.college_id, loginForm.password, router]);

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitLoading(true);
    setError('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      setIsSubmitLoading(false);
      return;
    }

    if (registerForm.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setIsSubmitLoading(false);
      return;
    }

    const result = await register({
      name: registerForm.name,
      username: registerForm.username,
      email: registerForm.email,
      college_id: registerForm.college_id,
      password: registerForm.password,
      department: registerForm.department,
      year: registerForm.year
    });
    
    if (result.success) {
      router.push('/');
    } else {
      setError(result.message || 'Registration failed. Please try again.');
    }
    
    setIsSubmitLoading(false);
  }, [register, registerForm, router]);

  // Redirect authenticated users to home page
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  const departments = [
    'Bachelor of Computer Applications',
    'Masters of Computer Applications',
    'Bachelor of Business Administration',
    'Masters of Business Administration',
    'Other'
  ];

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFAF50] via-orange-400 to-orange-400 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFAF50] via-orange-400 to-orange-400">
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-6xl w-full flex flex-col lg:flex-row items-center gap-12">
          
          {/* Hero Section */}
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-8">
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                <span className="text-6xl">🎓</span>
                <h1 className="text-5xl lg:text-6xl font-bold text-white">
                  UNIX
                </h1>
              </div>
              <p className="text-xl lg:text-2xl text-white/90 mb-6 leading-relaxed">
                Connect with your college community.<br />
                Share moments, ideas, and experiences.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 text-white/80 text-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <span>Academic Collaboration</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🎉</span>
                  <span>Campus Events</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👥</span>
                  <span>Student Communities</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Forms */}
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {/* Toggle Buttons */}
              <div className="flex mb-8 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setShowLogin(true)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    showLogin 
                      ? 'bg-[#FFAF50] text-black' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setShowLogin(false)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    !showLogin 
                      ? 'bg-[#FFAF50] text-black' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {showLogin ? (
                /* Login Form */
                <form onSubmit={handleLogin} className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Welcome Back!</h2>
                  
                  <div>
                    <label htmlFor="login-college-id" className="block text-sm font-medium text-gray-700 mb-2">
                      College ID
                    </label>
                    <input
                      id="login-college-id"
                      name="college_id"
                      type="text"
                      required
                      value={loginForm.college_id}
                      onChange={(e) => setLoginForm({ ...loginForm, college_id: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="your-college-id"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      required
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="Enter password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitLoading}
                    className="w-full bg-[#FFAF50] hover:bg-orange-500 text-black font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitLoading ? 'Signing In...' : 'Sign In'}
                  </button>
                </form>
              ) : (
                /* Register Form */
                <form onSubmit={handleRegister} className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Join UNIX!</h2>
                  
                  <div>
                    <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      id="register-name"
                      name="name"
                      type="text"
                      required
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-username" className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      id="register-username"
                      name="username"
                      type="text"
                      required
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="johndoe"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      required
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-college-id" className="block text-sm font-medium text-gray-700 mb-2">
                      College ID
                    </label>
                    <input
                      id="register-college-id"
                      name="college_id"
                      type="text"
                      required
                      value={registerForm.college_id}
                      onChange={(e) => setRegisterForm({ ...registerForm, college_id: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="your-college-id"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="register-department" className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                      </label>
                      <select
                        id="register-department"
                        name="department"
                        required
                        value={registerForm.department}
                        onChange={(e) => setRegisterForm({ ...registerForm, department: e.target.value })}
                        className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      >
                        <option value="">Select</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="register-year" className="block text-sm font-medium text-gray-700 mb-2">
                        Year
                      </label>
                      <select
                        id="register-year"
                        name="year"
                        required
                        value={registerForm.year}
                        onChange={(e) => setRegisterForm({ ...registerForm, year: parseInt(e.target.value) })}
                        className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      >
                        <option value={1}>1st Year</option>
                        <option value={2}>2nd Year</option>
                        <option value={3}>3rd Year</option>
                        <option value={4}>4th Year</option>
                        <option value={5}>5th Year+</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      id="register-password"
                      name="password"
                      type="password"
                      required
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="Enter password"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <input
                      id="register-confirm-password"
                      name="confirmPassword"
                      type="password"
                      required
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      className="w-full text-gray-500 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FFAF50] focus:border-transparent outline-none transition-all"
                      placeholder="Enter password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitLoading}
                    className="w-full bg-[#FFAF50] hover:bg-orange-500 text-black font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitLoading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </form>
              )}

              {/* Footer */}
              <div className="mt-8 text-center text-sm text-gray-600">
                {showLogin ? (
                  <p>
                    Don&apos;t have an account?{' '}
                    <button
                      onClick={() => setShowLogin(false)}
                      className="text-[#FFAF50] hover:text-orange-600 font-semibold"
                    >
                      Sign up here
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button
                      onClick={() => setShowLogin(true)}
                      className="text-[#FFAF50] hover:text-orange-600 font-semibold"
                    >
                      Sign in here
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
