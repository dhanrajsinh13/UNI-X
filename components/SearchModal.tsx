'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SearchResult {
  users: Array<{
    id: number;
    name: string;
    department: string;
    year: number;
  }>;
  posts: Array<{
    id: number;
    content: string;
    category: string;
    author: {
      name: string;
      department: string;
    };
  }>;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  // Helper function to convert enum category to readable format
  const formatCategory = useCallback((category?: string) => {
    if (!category) return '';
    
    const categoryMap: { [key: string]: string } = {
      'GENERAL': 'general',
      'ACADEMIC': 'academic',
      'EVENT': 'events',    // Singular form  
      'EVENTS': 'events',   // Plural form
      'CLUBS': 'clubs',
      'SPORTS': 'sports',
      'SOCIAL': 'social',
      // Legacy values
      'INTERNSHIP': 'internship',
      'WORKSHOP': 'academic',
      'LIBRARY_MEMORY': 'library'
    };
    
    return categoryMap[category] || category.toLowerCase();
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (query.trim().length > 2) {
        performSearch(query);
      } else {
        setResults(null);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, performSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-20">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search students, posts, departments..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent"
              autoFocus
            />
            <span className="absolute left-4 top-3.5 text-gray-400 text-xl">🔍</span>
            <button
              onClick={onClose}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-[#02fa97] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Searching...</p>
            </div>
          )}

          {results && !loading && (
            <div className="p-6 space-y-6">
              {/* Users */}
              {results.users && results.users.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Students</h3>
                  <div className="space-y-2">
                    {results.users.map(user => (
                      <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {user.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-600">{user.department} • {user.year}rd Year</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts */}
              {results.posts && results.posts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Posts</h3>
                  <div className="space-y-2">
                    {results.posts.map(post => (
                      <div key={post.id} className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <p className="text-gray-900 text-sm mb-1">{post.content.substring(0, 100)}...</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded">#{formatCategory(post.category)}</span>
                          <span>by {post.author.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {results && results.users?.length === 0 && results.posts?.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🔍</div>
                  <p className="text-gray-600">No results found for &quot;{query}&quot;</p>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!query && !results && !loading && (
            <div className="p-8 text-center">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-gray-600">Start typing to search students and posts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
