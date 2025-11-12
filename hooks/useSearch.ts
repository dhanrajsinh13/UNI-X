'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAPI, debounce } from '../lib/dataFetcher';

interface SearchUser {
  id: number;
  name: string;
  username?: string;
  department: string;
  year: number;
  profile_image?: string;
}

interface UseSearchReturn {
  results: SearchUser[];
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
  clearResults: () => void;
}

export function useSearch(debounceMs: number = 300): UseSearchReturn {
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (!token) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError(null);

      const data = await fetchAPI<{ users: SearchUser[] }>(
        `/api/search?q=${encodeURIComponent(query)}`,
        {
          token,
          cacheTTL: 120000, // Cache search results for 2 minutes
          signal: abortControllerRef.current.signal,
        }
      );

      setResults(data.users);
      setError(null);
    } catch (err: any) {
      if (err.message !== 'Request cancelled') {
        setError(err.message || 'Search failed');
        console.error('Error searching:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => performSearch(query), debounceMs),
    [performSearch, debounceMs]
  );

  const search = useCallback((query: string) => {
    setLoading(true);
    debouncedSearch(query);
  }, [debouncedSearch]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { results, loading, error, search, clearResults };
}
