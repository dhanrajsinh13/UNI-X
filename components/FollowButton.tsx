'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

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
      const response = await fetch(`/api/users/${userId}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update follow status' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json()

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
    } catch (error) {
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
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }), []);

  const baseClasses = useMemo(() => `
    font-semibold rounded-lg transition-all duration-200 
    disabled:opacity-50 disabled:cursor-not-allowed
    focus:outline-none focus:ring-2 focus:ring-offset-2
    ${sizeClasses[size]}
  `, [sizeClasses, size]);

  if (followState) {
    return (
      <button
        onClick={handleFollowToggle}
        disabled={loading}
        className={`
          ${baseClasses}
          bg-gray-200 text-gray-800 border border-gray-300
          hover:bg-gray-300 focus:ring-gray-500
          ${className}
        `}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
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
          bg-yellow-100 text-yellow-800 border border-yellow-300
          hover:bg-yellow-200 focus:ring-yellow-500
          ${className}
        `}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin"></div>
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
        bg-green-600 text-white border border-green-600
        hover:bg-green-700 focus:ring-green-500
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