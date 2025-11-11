'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Post {
  id: number;
  content: string;
  category: string;
  media_url?: string;
  media_type?: string;
  aura_count: number;
  created_at: string;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  department: string;
  year: number;
  role: string;
  created_at: string;
  posts: Post[];
  _count: {
    posts: number;
    followers: number;
    following: number;
  };
}

export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchProfile = async () => {
    if (!token && userId === 'me') {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/users/${userId}`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch profile');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId, token]);

  return { profile, loading, error, refetch: fetchProfile };
}
