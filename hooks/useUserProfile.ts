'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAPI } from '../lib/dataFetcher';

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

interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUserProfile(userId: string): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchProfile = useCallback(async () => {
    if (!token && userId === 'me') {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await fetchAPI<{ user: UserProfile }>(
        `/api/users/${userId}`,
        { 
          token: token || undefined,
          cacheTTL: 60000, // Cache for 1 minute
        }
      );
      
      setProfile(data.user);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
}
