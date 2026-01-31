'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { fetchAPI } from '../lib/dataFetcher'
import FollowButton from './FollowButton'

interface SearchResult {
  users: SearchUser[]
  posts: SearchPost[]
}

interface SearchUser {
  id: number
  name: string
  username: string
  department?: string
  year?: number
  profile_image?: string
  college_name?: string
  mutualFriends?: number
  mutualFriendNames?: string[]
  interests?: string[]
  isFollowing?: boolean
}

interface SearchPost {
  id: number
  caption: string
  created_at: string
  user: {
    id: number
    name: string
    username: string
    profile_image?: string
  }
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const { token } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'people' | 'posts'>('people')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [] })
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Perform search
  useEffect(() => {
    let isCancelled = false

    const performSearch = async () => {
      if (!debouncedQuery.trim() || !token) {
        setResults({ users: [], posts: [] })
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await fetchAPI<SearchResult>(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          { token, cacheTTL: 60000 }
        )
        if (!isCancelled) {
          // Ensure data has the expected structure
          setResults({
            users: data?.users || [],
            posts: data?.posts || []
          })
        }
      } catch (error) {
        console.error('Search error:', error)
        if (!isCancelled) {
          setResults({ users: [], posts: [] })
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    performSearch()
    return () => {
      isCancelled = true
    }
  }, [debouncedQuery, token])

  const handleUserClick = useCallback((username: string) => {
    router.push(`/profile/${username}`)
    onClose()
  }, [router, onClose])

  const handlePostClick = useCallback((postId: number) => {
    // Assuming you have a post detail view
    router.push(`/?post=${postId}`)
    onClose()
  }, [router, onClose])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center pt-16 px-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header with Search Bar */}
        <div className="p-6 border-b border-border-light">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search people, interests, and content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-12 pr-12 py-3 bg-bg-secondary rounded-xl text-base placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-tertiary hover:text-text transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-light bg-white sticky top-0 z-10">
          <button
            onClick={() => setActiveTab('people')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'people' 
                ? 'text-text' 
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            People
            {activeTab === 'people' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'posts' 
                ? 'text-text' 
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Posts
            {activeTab === 'posts' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
            )}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <svg className="w-16 h-16 text-text-tertiary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-text mb-2">Discover UNI-X</h3>
              <p className="text-text-secondary text-sm max-w-sm">
                Search for people, interests, and content across your university network
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
            </div>
          ) : activeTab === 'people' ? (
            (results?.users?.length ?? 0) > 0 ? (
              <div className="divide-y divide-border-light">
                {results.users.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 hover:bg-bg-secondary transition-colors cursor-pointer"
                    onClick={() => handleUserClick(user.username)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={user.profile_image || '/default-avatar.png'}
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-border-light"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-text truncate">{user.name}</h4>
                        <p className="text-sm text-text-secondary truncate">@{user.username}</p>
                        {user.department && (
                          <p className="text-xs text-text-tertiary truncate">
                            {user.department}
                            {user.year && ` • Year ${user.year}`}
                            {user.college_name && ` • ${user.college_name}`}
                          </p>
                        )}
                        {user.mutualFriends && user.mutualFriends > 0 && (
                          <p className="text-xs text-accent mt-1">
                            {user.mutualFriends} mutual {user.mutualFriends === 1 ? 'friend' : 'friends'}
                            {user.mutualFriendNames && user.mutualFriendNames.length > 0 && (
                              <span className="text-text-tertiary">
                                {' • '}
                                {user.mutualFriendNames.slice(0, 2).join(', ')}
                                {user.mutualFriends > 2 && ` +${user.mutualFriends - 2} more`}
                              </span>
                            )}
                          </p>
                        )}
                        {user.interests && user.interests.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {user.interests.slice(0, 3).map((interest, idx) => (
                              <span key={idx} className="text-sm">{interest}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <FollowButton
                          userId={user.id}
                          isFollowing={user.isFollowing || false}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <svg className="w-12 h-12 text-text-tertiary mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-text-secondary">No people found</p>
              </div>
            )
          ) : (
            (results?.posts?.length ?? 0) > 0 ? (
              <div className="divide-y divide-border-light">
                {results.posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 hover:bg-bg-secondary transition-colors cursor-pointer"
                    onClick={() => handlePostClick(post.id)}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={post.user.profile_image || '/default-avatar.png'}
                        alt={post.user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-border-light flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <h4 className="font-semibold text-text text-sm">{post.user.name}</h4>
                          <span className="text-text-tertiary text-xs">@{post.user.username}</span>
                        </div>
                        <p className="text-text-secondary text-sm line-clamp-2">{post.caption}</p>
                        <p className="text-text-tertiary text-xs mt-1">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <svg className="w-12 h-12 text-text-tertiary mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-text-secondary">No posts found</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
