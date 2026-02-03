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
  user_liked: boolean;
  created_at: string;
  author: {
    id: number;
    name: string;
    department: string;
    year: number;
    profile_image?: string;
  };
}

interface UsePostsReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

export function usePosts(category?: string, limit: number = 20): UsePostsReturn {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isLoading: authLoading } = useAuth();
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = useCallback(async (append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      // Don't fetch if auth is still loading
      if (authLoading) {
        setLoading(false);
        return;
      }

      // Don't fetch if not authenticated
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (category) params.append('category', category);
      params.append('limit', limit.toString());
      params.append('offset', append ? String(offset) : '0');

      const data = await fetchAPI<{ posts: Post[] }>(
        `/api/posts?${params.toString()}`,
        {
          token,
          cacheTTL: 15000, // Reduced to 15 seconds for faster initial load
        }
      );

      if (append) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }

      setHasMore(data.posts.length === limit);
      setOffset(prev => append ? prev + data.posts.length : data.posts.length);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch posts');
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  }, [category, limit, token, authLoading, offset]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPosts(true);
    }
  }, [loading, hasMore, fetchPosts]);

  const refetch = useCallback(() => {
    setOffset(0);
    setHasMore(true);
    fetchPosts(false);
  }, [fetchPosts]);

  useEffect(() => {
    // Only fetch when auth is not loading
    if (!authLoading) {
      setOffset(0);
      setHasMore(true);
      fetchPosts(false);
    }
  }, [category, limit, token, authLoading]);

  // Listen for new posts
  useEffect(() => {
    const handleNewPost = (event: CustomEvent) => {
      const newPost = event.detail;
      setPosts(prevPosts => [newPost, ...prevPosts]);
    };

    const handlePostUpdated = (event: CustomEvent) => {
      const { id, content } = event.detail;
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === id ? { ...post, content } : post
        )
      );
    };

    const handlePostDeleted = (event: CustomEvent) => {
      const { id } = event.detail;
      setPosts(prevPosts => prevPosts.filter(post => post.id !== id));
    };

    window.addEventListener('postCreated', handleNewPost as EventListener);
    window.addEventListener('postUpdated', handlePostUpdated as EventListener);
    window.addEventListener('postDeleted', handlePostDeleted as EventListener);

    return () => {
      window.removeEventListener('postCreated', handleNewPost as EventListener);
      window.removeEventListener('postUpdated', handlePostUpdated as EventListener);
      window.removeEventListener('postDeleted', handlePostDeleted as EventListener);
    };
  }, []);

  return {
    posts,
    loading,
    error,
    refetch,
    loadMore,
    hasMore
  };
}
