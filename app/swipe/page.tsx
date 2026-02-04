'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { fetchAPI, dataFetcher } from '../../lib/dataFetcher'
import Image from 'next/image'

interface SwipeUser {
  id: number
  name: string
  username: string
  department?: string
  year?: number
  bio?: string
  profile_image?: string
  college_name?: string
  interests?: string[]
  mutualFriends?: number
  mutualFriendNames?: string[]
  reason?: string
  images?: string[]
}

export default function SwipePage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<SwipeUser[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [history, setHistory] = useState<{ user: SwipeUser; action: 'skip' | 'connect' }[]>([])
  const cardRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!user) {
      router.push('/landing')
      return
    }

    let isCancelled = false

    const loadUsers = async () => {
      if (!token) return

      setLoading(true)
      setError('')

      try {
        const data = await fetchAPI<{ suggestions: any[] }>(
          '/api/users/suggestions?limit=20&algorithm=advanced',
          {
            token,
            cacheTTL: 300000
          }
        )

        if (!isCancelled) {
          // Filter for users with mutual connections or interests
          const eligibleUsers: SwipeUser[] = (data.suggestions || [])
            .filter((s: any) =>
              (s.mutualFriends && s.mutualFriends > 0) ||
              (s.interests && s.interests.length > 0)
            )
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              username: s.username,
              department: s.department,
              year: s.year,
              bio: s.bio,
              profile_image: s.profile_image,
              college_name: s.college_name,
              interests: s.interests || [],
              mutualFriends: s.mutualFriends,
              mutualFriendNames: s.mutualFriendNames,
              reason: s.reason,
              images: s.profile_image ? [s.profile_image] : []
            }))

          setUsers(eligibleUsers)

          if (eligibleUsers.length === 0) {
            setError('No eligible users found. Check back later!')
          }
        }
      } catch (e: any) {
        console.error('Failed to load users:', e)
        if (!isCancelled) {
          setError(e.message || 'Failed to load users')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadUsers()

    return () => {
      isCancelled = true
    }
  }, [token, user, router])

  const handleSwipe = useCallback(async (direction: 'left' | 'right') => {
    const currentUser = users[currentIndex]
    if (!currentUser || !token) return

    setSwipeDirection(direction)

    // Add to history for undo
    setHistory(prev => [...prev, { user: currentUser, action: direction === 'right' ? 'connect' : 'skip' }])

    // If swiping right, follow the user
    if (direction === 'right') {
      try {
        await fetchAPI(`/api/users/${currentUser.id}/follow`, {
          method: 'POST',
          token,
          skipCache: true
        })

        // Clear caches
        dataFetcher.clearCache('/api/users/suggestions')
        dataFetcher.clearCache('/api/users/me/following')

        // Vibrate on success (if supported)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      } catch (error) {
        console.error('Follow error:', error)
      }
    }

    // Move to next card after animation
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1)
      setSwipeDirection(null)
      setDragOffset({ x: 0, y: 0 })
    }, 300)
  }, [users, currentIndex, token])

  const handleUndo = useCallback(() => {
    if (history.length === 0) return

    const lastAction = history[history.length - 1]
    setHistory(prev => prev.slice(0, -1))
    setCurrentIndex(prev => prev - 1)

    // If last action was connect, unfollow
    if (lastAction.action === 'connect' && token) {
      fetchAPI(`/api/users/${lastAction.user.id}/follow`, {
        method: 'DELETE',
        token,
        skipCache: true
      }).catch(console.error)
    }
  }, [history, token])

  // Touch/Mouse event handlers
  const handleStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true)
    startPosRef.current = { x: clientX, y: clientY }
  }, [])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return

    const deltaX = clientX - startPosRef.current.x
    const deltaY = clientY - startPosRef.current.y
    setDragOffset({ x: deltaX, y: deltaY })
  }, [isDragging])

  const handleEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 100
    if (Math.abs(dragOffset.x) > threshold) {
      handleSwipe(dragOffset.x > 0 ? 'right' : 'left')
    } else {
      setDragOffset({ x: 0, y: 0 })
    }
  }, [isDragging, dragOffset, handleSwipe])

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY)
  }

  const onMouseUp = () => {
    handleEnd()
  }

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }

  const onTouchEnd = () => {
    handleEnd()
  }

  useEffect(() => {
    if (isDragging) {
      const onMouseMoveGlobal = (e: MouseEvent) => handleMove(e.clientX, e.clientY)
      const onMouseUpGlobal = () => handleEnd()
      
      document.addEventListener('mousemove', onMouseMoveGlobal)
      document.addEventListener('mouseup', onMouseUpGlobal)
      
      return () => {
        document.removeEventListener('mousemove', onMouseMoveGlobal)
        document.removeEventListener('mouseup', onMouseUpGlobal)
      }
    }
  }, [isDragging, handleMove, handleEnd])

  const currentUser = users[currentIndex]
  const rotation = isDragging ? dragOffset.x / 20 : 0
  const opacity = isDragging ? Math.max(0.5, 1 - Math.abs(dragOffset.x) / 300) : 1

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-bg-secondary to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-accent mx-auto mb-4"></div>
          <p className="text-text-secondary">Finding connections...</p>
        </div>
      </div>
    )
  }

  if (error || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-bg-secondary to-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <svg className="w-20 h-20 text-text-tertiary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-text mb-2">
            {currentIndex >= users.length ? "That's everyone!" : "No Connections Yet"}
          </h2>
          <p className="text-text-secondary mb-6">
            {error || "Connect with more people to unlock swipe discovery. Build your network by following friends and joining communities."}
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-secondary to-white pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-border-light sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-50 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
            Discover
          </h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Card Stack */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-4">
        <div className="relative" style={{ height: 'calc(100vh - 240px)', maxHeight: '600px', minHeight: '500px' }}>
          {/* Next card (preview) */}
          {users[currentIndex + 1] && (
            <div className="absolute inset-0 bg-white rounded-3xl shadow-md scale-95 opacity-50"></div>
          )}

          {/* Current card */}
          <div
            ref={cardRef}
            className="absolute inset-0 bg-white rounded-3xl shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing transition-transform"
            style={{
              transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${rotation}deg)`,
              opacity,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s',
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Swipe indicators */}
            {isDragging && (
              <>
                <div
                  className="absolute top-8 right-8 bg-error text-white px-6 py-3 rounded-full font-bold text-xl transform rotate-12 border-4 border-white shadow-lg z-10"
                  style={{ opacity: dragOffset.x < -50 ? Math.min(1, -dragOffset.x / 100) : 0 }}
                >
                  SKIP
                </div>
                <div
                  className="absolute top-8 left-8 bg-success text-white px-6 py-3 rounded-full font-bold text-xl transform -rotate-12 border-4 border-white shadow-lg z-10"
                  style={{ opacity: dragOffset.x > 50 ? Math.min(1, dragOffset.x / 100) : 0 }}
                >
                  CONNECT
                </div>
              </>
            )}

            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-emerald-50"></div>

            {/* Profile Picture - Centered & Round */}
            <div className="relative pt-8 pb-4 flex justify-center">
              <div className="relative">
                <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                  <Image
                    src={currentUser.profile_image || '/default-avatar.png'}
                    alt={currentUser.name}
                    fill
                    className="object-cover rounded-full"
                  />
                </div>
                {/* Active indicator */}
                <div className="absolute bottom-2 right-2 w-8 h-8 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full border-4 border-white shadow-lg"></div>
              </div>
            </div>

            {/* User Info */}
            <div className="px-6 pb-6 space-y-3 relative">
              <div className="text-center">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1">{currentUser.name}</h2>
                <p className="text-sm text-gray-500">@{currentUser.username}</p>
              </div>

              {currentUser.department && (
                <div className="flex items-center justify-center gap-2 text-gray-600 bg-gray-50 rounded-full px-4 py-2 mx-auto w-fit">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-sm font-medium">
                    {currentUser.department}
                    {currentUser.year && ` • Year ${currentUser.year}`}
                  </span>
                </div>
              )}

              {currentUser.bio && (
                <p className="text-gray-600 text-sm text-center px-4 line-clamp-2 italic">{currentUser.bio}</p>
              )}

              {/* Mutual Friends */}
              {currentUser.mutualFriends && currentUser.mutualFriends > 0 && (
                <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 rounded-2xl p-3 border border-teal-200/50">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    <p className="text-teal-700 font-bold text-sm">
                      {currentUser.mutualFriends} mutual {currentUser.mutualFriends === 1 ? 'friend' : 'friends'}
                    </p>
                  </div>
                  {currentUser.mutualFriendNames && currentUser.mutualFriendNames.length > 0 && (
                    <p className="text-gray-600 text-xs text-center">
                      {currentUser.mutualFriendNames.slice(0, 2).join(', ')}
                      {currentUser.mutualFriends > 2 && ` +${currentUser.mutualFriends - 2} more`}
                    </p>
                  )}
                </div>
              )}

              {/* Interests */}
              {currentUser.interests && currentUser.interests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 text-center uppercase tracking-wide">Common Interests</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {currentUser.interests.slice(0, 4).map((interest, idx) => (
                      <span
                        key={idx}
                        className="px-4 py-1.5 bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-700 shadow-sm"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <button
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 rounded-full bg-white shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center border-2 border-error text-error"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {history.length > 0 && (
            <button
              onClick={handleUndo}
              className="w-12 h-12 rounded-full bg-white shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center text-text-secondary"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          )}

          <button
            onClick={() => handleSwipe('right')}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-95 flex items-center justify-center text-white"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>

        {/* Progress indicator */}
        <div className="mt-4 text-center">
          <p className="text-text-tertiary text-sm">
            {currentIndex + 1} / {users.length}
          </p>
        </div>
      </div>
    </div>
  )
}
