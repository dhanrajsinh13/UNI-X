'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fetchAPI, dataFetcher } from '../lib/dataFetcher';

interface SuggestedUser {
  id: number;
  name: string;
  username?: string;
  department?: string;
  year?: number;
  profile_image?: string | null;
  mutualFriends?: number;
  mutualFriendNames?: string[];
  reason?: string;
  follower_count?: number;
}

const SuggestionsSection: React.FC = () => {
  const { user, token } = useAuth();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingStates, setFollowingStates] = useState<{ [key: number]: boolean }>({});

  const loadSuggestions = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const data = await fetchAPI<{ suggestions: SuggestedUser[] }>(
        '/api/users/suggestions?limit=5&algorithm=advanced',
        {
          token,
          cacheTTL: 300000 // Cache for 5 minutes
        }
      );

      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleFollow = async (userId: number) => {
    if (!token) return;

    // Optimistic update
    setFollowingStates(prev => ({ ...prev, [userId]: true }));

    try {
      await fetchAPI('/api/users/follow', {
        method: 'POST',
        token,
        body: JSON.stringify({ userId }),
        skipCache: true
      });

      // Remove from suggestions after successful follow
      setSuggestions(prev => prev.filter(s => s.id !== userId));

      // Clear suggestion cache to get fresh data
      dataFetcher.clearCache('/api/users/suggestions');
    } catch (error) {
      console.error('Error following user:', error);
      // Revert on error
      setFollowingStates(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleDismiss = (userId: number) => {
    setSuggestions(prev => prev.filter(s => s.id !== userId));
  };

  const navigateToProfile = (userId: number) => {
    router.push(`/profile/${userId}`);
  };

  if (!user || suggestions.length === 0) return null;

  return (
    <div className="bg-white rounded-lg mb-4">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-500">Suggestions For You</h3>
        <button
          onClick={() => router.push('/suggestions')}
          className="text-xs font-semibold text-black hover:text-gray-600"
        >
          See All
        </button>
      </div>

      <div className="space-y-1">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <div className="w-6 h-6 border-2 border-[#FFAF50] border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div key={suggestion.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => navigateToProfile(suggestion.id)}
                  className="flex-shrink-0"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#FFAF50] to-orange-400">
                    {suggestion.profile_image ? (
                      <Image
                        src={suggestion.profile_image}
                        alt={suggestion.name}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-xs">
                        {suggestion.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => navigateToProfile(suggestion.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate hover:underline">
                    {suggestion.username || suggestion.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {suggestion.reason ||
                      (suggestion.department && suggestion.year
                        ? `${suggestion.department} • ${suggestion.year}${getYearSuffix(suggestion.year)} Year`
                        : 'Suggested for you'
                      )
                    }
                  </p>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleFollow(suggestion.id)}
                  disabled={followingStates[suggestion.id]}
                  className="text-xs font-semibold text-[#0095f6] hover:text-[#00376b] disabled:opacity-50"
                >
                  {followingStates[suggestion.id] ? 'Following' : 'Follow'}
                </button>
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Dismiss"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function getYearSuffix(year: number): string {
  if (year === 1) return 'st';
  if (year === 2) return 'nd';
  if (year === 3) return 'rd';
  return 'th';
}

export default SuggestionsSection;
