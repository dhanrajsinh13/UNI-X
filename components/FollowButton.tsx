'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchAPI, dataFetcher } from '../lib/dataFetcher'

interface FollowButtonProps {
  userId: number
  isFollowing: boolean
  requested?: boolean
  onFollowChange?: (isFollowing: boolean, followerCount: number) => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function FollowButton({ 
  userId, 
  isFollowing, 
  requested = false,
  onFollowChange, 
  className = '',
  size = 'md'
}: FollowButtonProps) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [followState, setFollowState] = useState(isFollowing)
  const [requestState, setRequestState] = useState(requested)

  const handleFollowToggle = useCallback(async () => {
    if (loading || !token) return

    setLoading(true)
    const previousState = followState

    // Optimistic update
    if (followState) {
      setFollowState(false)
    } else if (requestState) {
      setRequestState(false)
    } else {
      // We don't know if target is private; optimistic assume public follow
      setFollowState(true)
    }

    try {
      const method = (followState || requestState) ? 'DELETE' : 'POST'
      const data = await fetchAPI<any>(
        `/api/users/${userId}/follow`,
        {
          method,
          token,
          skipCache: true
        }
      )

      // Clear relevant caches after follow/unfollow
      dataFetcher.clearCache('/api/users/suggestions')
      dataFetcher.clearCache('/api/users/me/following')
      dataFetcher.clearCache(`/api/users/${userId}`)

      // Private account case returns requested: true
      if (data.requested) {
        setFollowState(false)
        setRequestState(true)
        if (onFollowChange) onFollowChange(false, data.follower_count ?? 0)
      } else {
        if (typeof data.is_following !== 'boolean') {
          throw new Error('Invalid response format');
        }
        setRequestState(false)
        setFollowState(data.is_following)
        if (onFollowChange) onFollowChange(data.is_following, data.follower_count ?? 0)
      }
    } catch (error: any) {
      console.error('Follow/unfollow error:', error)
      // Revert optimistic update on error
      setFollowState(previousState)
      setRequestState(requested)
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to update follow status';
      console.warn('Follow operation failed:', errorMessage);
    } finally {
      setLoading(false)
    }
  }, [loading, token, followState, userId, onFollowChange]);

  const sizeClasses = useMemo(() => ({
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  }), []);

  const baseClasses = useMemo(() => `
    font-semibold rounded-lg transition-all duration-200 
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-offset-2
    active:scale-95
    ${sizeClasses[size]}
  `, [sizeClasses, size]);

  if (followState) {
    return (
      <button
        onClick={handleFollowToggle}
        disabled={loading}
        className={`
          ${baseClasses}
          ${sizeClasses[size] || 'px-6 py-2.5'}
          bg-gray-100 text-text border border-border
          hover:bg-gray-200 focus:ring-gray-300
          ${className}
        `}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-text border-t-transparent rounded-full animate-spin"></div>
            <span>Following</span>
          </div>
        ) : (
          'Following'
        )}
      </button>
    )
  }

  if (requestState) {
    return (
      <button
        onClick={handleFollowToggle}
        disabled={loading}
        className={`
          ${baseClasses}
          ${sizeClasses[size] || 'px-6 py-2.5'}
          bg-warning/10 text-warning border border-warning/30
          hover:bg-warning/20 focus:ring-warning
          ${className}
        `}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-warning border-t-transparent rounded-full animate-spin"></div>
            <span>Requested</span>
          </div>
        ) : (
          'Requested'
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleFollowToggle}
      disabled={loading}
      className={`
        ${baseClasses}
        ${sizeClasses[size] || 'px-6 py-2.5'}
        bg-info text-white border border-info
        hover:bg-info/90 focus:ring-info
        ${className}
      `}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Follow</span>
        </div>
      ) : (
        'Follow'
      )}
    </button>
  )
}