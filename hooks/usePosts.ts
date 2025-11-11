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
  user_liked: boolean;
  created_at: string;
  author: {
    id: number;
    name: string;
    department: string;
    year: number;
  };
}

export function usePosts(category?: string, limit: number = 20) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, isLoading: authLoading } = useAuth();
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = async (append: boolean = false) => {
    try {
      setLoading(true);
      
      // Don't fetch if we don't have a token and auth is still loading
      if (!token && authLoading) {
        setLoading(false);
        return;
      }
      
      // Don't fetch if we don't have a token and auth is not loading (user not authenticated)
      if (!token && !authLoading) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (category) params.append('category', category);
      params.append('limit', limit.toString());
      params.append('offset', append ? String(offset) : '0');

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch(`/api/posts?${params.toString()}`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        if (append) {
          setPosts(prev => [...prev, ...data.posts]);
        } else {
          setPosts(data.posts);
        }
        setHasMore(data.posts.length === limit);
        setOffset(prev => append ? prev + data.posts.length : data.posts.length);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch posts');
      }
    } catch (err) {
      setError('Network error');
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

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

    window.addEventListener('postCreated', handleNewPost as EventListener);
    
    return () => {
      window.removeEventListener('postCreated', handleNewPost as EventListener);
    };
  }, []);

  // Listen for post updates and deletes
  useEffect(() => {
    const handleUpdated = (event: CustomEvent) => {
      const { id, content } = event.detail || {};
      if (!id) return;
      setPosts(prev => prev.map(p => (p.id === id ? { ...p, content: content ?? p.content } : p)));
    };
    const handleDeleted = (event: CustomEvent) => {
      const { id } = event.detail || {};
      if (!id) return;
      setPosts(prev => prev.filter(p => p.id !== id));
    };
    window.addEventListener('postUpdated', handleUpdated as EventListener);
    window.addEventListener('postDeleted', handleDeleted as EventListener);
    return () => {
      window.removeEventListener('postUpdated', handleUpdated as EventListener);
      window.removeEventListener('postDeleted', handleDeleted as EventListener);
    };
  }, []);

  return { posts, loading, error, refetch: () => fetchPosts(false), fetchMore: () => hasMore && fetchPosts(true), hasMore };
}
