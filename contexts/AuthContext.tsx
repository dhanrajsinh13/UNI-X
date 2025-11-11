'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  college_id: string;
  username?: string;
  department: string;
  year: number;
  role: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (college_id: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isLoading: boolean;
  setSocketDisconnect?: (disconnectFn: () => void) => void;
}

interface RegisterData {
  name: string;
  username: string;
  email: string;
  college_id: string;
  password: string;
  department: string;
  year: number;
  role?: string;
  bio?: string;
  profile_image?: string;
}

interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
}

interface ErrorResponse {
  message: string;
  error?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socketDisconnect, setSocketDisconnectFn] = useState<(() => void) | null>(null);
  const router = useRouter();

  const setSocketDisconnect = useCallback((disconnectFn: () => void) => {
    setSocketDisconnectFn(() => disconnectFn);
  }, []);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    
    setIsLoading(false);
  }, []);

  const login = useCallback(async (college_id: string, password: string): Promise<boolean> => {
    try {
      console.log('Attempting login with:', { college_id, password: '***' });
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ college_id, password }),
      });

      console.log('Login response status:', response.status);
      console.log('Login response ok:', response.ok);

      if (response.ok) {
        const data = await response.json() as LoginResponse;
        console.log('Login successful, user data:', data.user);
        setUser(data.user);
        setToken(data.token);
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        return true;
      } else {
        const errorData = await response.json() as ErrorResponse;
        console.log('Login failed with error:', errorData);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json() as LoginResponse;
        setUser(result.user);
        setToken(result.token);
        
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        return { success: true };
      }

      // Try to extract a helpful message from the backend
      let message = 'Registration failed. Please try again.';
      try {
        const err = (await response.json()) as { error?: string; message?: string };
        message = err?.message || err?.error || message;
      } catch (_) {
        // ignore JSON parse errors; keep default message
      }
      return { success: false, message };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: 'Network error. Please check your connection.' };
    }
  }, []);

  const logout = useCallback(() => {
    try {
      // Disconnect socket first
      if (socketDisconnect) {
        socketDisconnect();
      }
      
      // Clear user state immediately for instant UI update
      setUser(null);
      setToken(null);
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Clear any other cached data that might exist
      localStorage.removeItem('conversations');
      localStorage.removeItem('posts');
      localStorage.removeItem('notifications');
      
      // Clear session storage as well
      sessionStorage.clear();
      
      // Force redirect to landing page
      router.push('/landing');
      
      // Force page reload to clear any remaining state
      setTimeout(() => {
        window.location.href = '/landing';
      }, 100);
      
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, still try to clear state and redirect
      setUser(null);
      setToken(null);
      window.location.href = '/landing';
    }
  }, [socketDisconnect, router]);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading, setSocketDisconnect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
