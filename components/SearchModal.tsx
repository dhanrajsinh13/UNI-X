'use client'
import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { fetchAPI } from '../lib/dataFetcher'
import FollowButton from './FollowButton'
import Image from 'next/image'
// Types for search results
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
    isFollowing?: boolean
}
interface SearchPost {
    id: number
    caption: string
    media_url?: string
    media_type?: 'image' | 'video'
    created_at: string
    user: {
        id: number
        name: string
        username: string
        profile_image?: string
    }
}
interface SearchHashtag {
    tag: string
    count: number
}
interface SearchLocation {
    id: string
    name: string
    count: number
}
interface SearchResult {
    users: SearchUser[]
    posts: SearchPost[]
    hashtags?: SearchHashtag[]
    locations?: SearchLocation[]
}
interface RecentSearch {
    type: 'user' | 'hashtag' | 'location' | 'keyword'
    id?: number
    value: string
    displayName: string
    image?: string
    timestamp: number
}
type SearchTab = 'all' | 'accounts' | 'hashtags'
interface SearchModalProps {
    isOpen: boolean
    onClose: () => void
    variant?: 'modal' | 'panel' | 'embedded'
}
// Storage key for recent searches
const RECENT_SEARCHES_KEY = 'unix_recent_searches'
const MAX_RECENT_SEARCHES = 20
// Helper to get recent searches from localStorage
const getRecentSearches = (): RecentSearch[] => {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}
// Helper to save recent search
const saveRecentSearch = (search: RecentSearch) => {
    if (typeof window === 'undefined') return
    try {
        const existing = getRecentSearches()
        const filtered = existing.filter(s =>
            !(s.type === search.type && s.value === search.value)
        )
        const updated = [search, ...filtered].slice(0, MAX_RECENT_SEARCHES)
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (e) {
        console.error('Failed to save recent search:', e)
    }
}
// Helper to remove a recent search
const removeRecentSearch = (search: RecentSearch) => {
    if (typeof window === 'undefined') return
    try {
        const existing = getRecentSearches()
        const updated = existing.filter(s =>
            !(s.type === search.type && s.value === search.value)
        )
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (e) {
        console.error('Failed to remove recent search:', e)
    }
}
// Helper to clear all recent searches
const clearAllRecentSearches = () => {
    if (typeof window === 'undefined') return
    try {
        localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch (e) {
        console.error('Failed to clear recent searches:', e)
    }
}
// Search Result Grid Item for Posts/Reels
const MediaGridItem = memo(({ post, onClick }: { post: SearchPost; onClick: () => void }) => {
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState(false)
    const isVideo = post.media_type === 'video'
    return (
        <button
            onClick={onClick}
            className="relative aspect-square bg-gray-100 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm"
        >
            {post.media_url && !error ? (
                <>
                    {isVideo ? (
                        <video
                            src={post.media_url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedData={() => setLoaded(true)}
                            onError={() => setError(true)}
                        />
                    ) : (
                        <Image
                            src={post.media_url}
                            alt={post.caption || 'Post'}
                            fill
                            className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                            sizes="(max-width: 640px) 33vw, 200px"
                            onLoad={() => setLoaded(true)}
                            onError={() => setError(true)}
                        />
                    )}
                    {!loaded && (
                        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" />
                    {isVideo && (
                        <div className="absolute top-2 right-2">
                            <svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5.5 12.5L16 12l-5.5-3.5v7z" />
                            </svg>
                        </div>
                    )}
                </>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <span className="text-2xl">{isVideo ? '🎥' : '🖼️'}</span>
                </div>
            )}
        </button>
    )
})
MediaGridItem.displayName = 'MediaGridItem'
// User Result Item
const UserResultItem = memo(({
    user,
    onClick,
    showFollowButton = true
}: {
    user: SearchUser
    onClick: () => void
    showFollowButton?: boolean
}) => (
    <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onClick}
    >
        <div className="relative flex-shrink-0">
            <Image
                src={user.profile_image || '/default-avatar.png'}
                alt={user.name}
                width={44}
                height={44}
                className="w-11 h-11 rounded-full object-cover border border-gray-200"
            />
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{user.username}</p>
            <p className="text-gray-500 text-sm truncate">{user.name}</p>
            {user.mutualFriends && user.mutualFriends > 0 && (
                <p className="text-xs text-gray-400 truncate">
                    {user.mutualFriends} mutual {user.mutualFriends === 1 ? 'connection' : 'connections'}
                </p>
            )}
        </div>
        {showFollowButton && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <FollowButton
                    userId={user.id}
                    isFollowing={user.isFollowing || false}
                    size="sm"
                />
            </div>
        )}
    </div>
))
UserResultItem.displayName = 'UserResultItem'
// Recent Search Item
const RecentSearchItem = memo(({
    search,
    onClick,
    onRemove
}: {
    search: RecentSearch
    onClick: () => void
    onRemove: () => void
}) => (
    <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors group"
        onClick={onClick}
    >
        <div className="relative flex-shrink-0">
            {search.image ? (
                <Image
                    src={search.image}
                    alt={search.displayName}
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-full object-cover border border-gray-200"
                />
            ) : (
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center">
                    {search.type === 'hashtag' ? (
                        <span className="text-xl font-bold text-gray-600">#</span>
                    ) : search.type === 'location' ? (
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    )}
                </div>
            )}
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{search.displayName}</p>
            <p className="text-gray-500 text-xs capitalize">{search.type}</p>
        </div>
        <button
            onClick={(e) => {
                e.stopPropagation()
                onRemove()
            }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    </div>
))
RecentSearchItem.displayName = 'RecentSearchItem'
export default function SearchModal({ isOpen, onClose, variant = 'modal' }: SearchModalProps) {
    const { token } = useAuth()
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState<SearchTab>('all')
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<SearchResult>({ users: [], posts: [] })
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    // Load recent searches on mount
    useEffect(() => {
        setRecentSearches(getRecentSearches())
    }, [])
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
                const typeParam = activeTab === 'accounts' ? 'users' :
                    activeTab === 'hashtags' ? 'hashtags' : 'all'
                const data = await fetchAPI<{ results: SearchResult }>(
                    `/api/search?q=${encodeURIComponent(debouncedQuery)}&type=${typeParam}`,
                    { token, cacheTTL: 60000 }
                )
                if (!isCancelled) {
                    setResults({
                        users: data?.results?.users || [],
                        posts: data?.results?.posts || [],
                        hashtags: data?.results?.hashtags || [],
                        locations: data?.results?.locations || []
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
    }, [debouncedQuery, token, activeTab])
    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])
    const handleUserClick = useCallback((user: SearchUser) => {
        saveRecentSearch({
            type: 'user',
            id: user.id,
            value: user.username,
            displayName: user.username,
            image: user.profile_image,
            timestamp: Date.now()
        })
        setRecentSearches(getRecentSearches())
        router.push(`/profile/${user.username}`)
        onClose()
    }, [router, onClose])

    const handleRecentSearchClick = useCallback((search: RecentSearch) => {
        if (search.type === 'user') {
            router.push(`/profile/${search.value}`)
        } else if (search.type === 'hashtag') {
            router.push(`/explore/tags/${search.value}`)
        } else if (search.type === 'location') {
            router.push(`/explore/locations/${search.value}`)
        } else {
            setSearchQuery(search.value)
        }
        onClose()
    }, [router, onClose])
    const handleRemoveRecentSearch = useCallback((search: RecentSearch) => {
        removeRecentSearch(search)
        setRecentSearches(getRecentSearches())
    }, [])
    const handleClearAllRecent = useCallback(() => {
        clearAllRecentSearches()
        setRecentSearches([])
    }, [])
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }, [onClose])
    // Filter results based on active tab
    const filteredResults = useMemo(() => {
        return {
            users: activeTab === 'accounts' ? results.users : (activeTab === 'all' ? results.users : []),
            posts: [], // Posts are not searchable
            hashtags: activeTab === 'hashtags' ? (results.hashtags || []) : (activeTab === 'all' ? (results.hashtags || []) : []),
            locations: results.locations || []
        }
    }, [results, activeTab])
    const hasResults = useMemo(() => {
        if (activeTab === 'all') {
            return filteredResults.users.length > 0 || filteredResults.hashtags.length > 0
        }
        if (activeTab === 'accounts') return filteredResults.users.length > 0
        if (activeTab === 'hashtags') return filteredResults.hashtags.length > 0
        return false
    }, [filteredResults, activeTab])
    const showRecentSearches = !searchQuery.trim() && recentSearches.length > 0
    if (!isOpen) return null
    // For panel variant, render content directly (wrapper is in DesktopSearchPanel)
    if (variant === 'panel') {
        return (
            <div className="h-full flex flex-col overflow-hidden">
                {/* Search Input */}
                <div className="flex-shrink-0 px-4 pb-3">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-lg text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                                <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Recent Searches */}
                    {showRecentSearches && (
                        <div>
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="font-semibold text-gray-900">Recent</span>
                                <button
                                    onClick={handleClearAllRecent}
                                    className="text-blue-500 text-sm font-semibold hover:text-blue-600"
                                >
                                    Clear all
                                </button>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {recentSearches.map((search, index) => (
                                    <RecentSearchItem
                                        key={`${search.type}-${search.value}-${index}`}
                                        search={search}
                                        onClick={() => handleRecentSearchClick(search)}
                                        onRemove={() => handleRemoveRecentSearch(search)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* No recent searches state */}
                    {!searchQuery.trim() && recentSearches.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-gray-500">
                            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-sm">No recent searches.</p>
                        </div>
                    )}
                    {/* Loading State */}
                    {loading && searchQuery.trim() && (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    )}
                    {/* Search Results */}
                    {!loading && searchQuery.trim() && (
                        <>
                            {!hasResults ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-gray-500">
                                    <p className="text-sm">No results found for &ldquo;{searchQuery}&rdquo;</p>
                                </div>
                            ) : (
                                <div>
                                    {filteredResults.users.length > 0 && (
                                        <div>
                                            {filteredResults.users.map((user) => (
                                                <UserResultItem
                                                    key={user.id}
                                                    user={user}
                                                    onClick={() => handleUserClick(user)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {filteredResults.hashtags.length > 0 && (
                                        <div className="mt-2">
                                            {filteredResults.hashtags.map((hashtag) => (
                                                <div
                                                    key={hashtag.tag}
                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        saveRecentSearch({
                                                            type: 'hashtag',
                                                            value: hashtag.tag,
                                                            displayName: `#${hashtag.tag}`,
                                                            timestamp: Date.now()
                                                        })
                                                        router.push(`/explore/tags/${hashtag.tag}`)
                                                        onClose()
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900">#{hashtag.tag}</p>
                                                            <p className="text-gray-500 text-sm">{hashtag.count} posts</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    }
    // Modal variant - full screen overlay
    return (
        <div
            className="fixed inset-0 bg-black/65 backdrop-blur-md z-[9999] flex items-start justify-center pt-0 md:pt-8 animate-fade-in"
            onClick={handleBackdropClick}
        >
            <div ref={containerRef} className="bg-white w-full h-full md:h-auto md:max-h-[85vh] md:w-full md:max-w-2xl md:rounded-2xl md:shadow-modal flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-gray-100">
                    {/* Mobile Header with close button */}
                    <div className="flex items-center gap-3 mb-3 md:hidden">
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors duration-fast"
                            aria-label="Close search"
                        >
                            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-semibold text-gray-900">Search</h1>
                    </div>
                    {/* Desktop Header */}
                    <div className="hidden md:flex items-center justify-between mb-3">
                        <h2 className="text-xl font-semibold text-gray-900">Search</h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                            aria-label="Close search"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    {/* Search Input */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-lg text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                                <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Recent Searches */}
                    {showRecentSearches && (
                        <div>
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="font-semibold text-gray-900">Recent</span>
                                <button
                                    onClick={handleClearAllRecent}
                                    className="text-blue-500 text-sm font-semibold hover:text-blue-600"
                                >
                                    Clear all
                                </button>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {recentSearches.map((search, index) => (
                                    <RecentSearchItem
                                        key={`${search.type}-${search.value}-${index}`}
                                        search={search}
                                        onClick={() => handleRecentSearchClick(search)}
                                        onRemove={() => handleRemoveRecentSearch(search)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* No recent searches state */}
                    {!searchQuery.trim() && recentSearches.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-gray-500">
                            <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-sm">No recent searches.</p>
                        </div>
                    )}
                    {/* Loading State */}
                    {loading && searchQuery.trim() && (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    )}
                    {/* Search Results */}
                    {!loading && searchQuery.trim() && (
                        <>
                            {!hasResults ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-gray-500">
                                    <p className="text-sm">No results found for &ldquo;{searchQuery}&rdquo;</p>
                                </div>
                            ) : (
                                <div>
                                    {filteredResults.users.length > 0 && (
                                        <div>
                                            {filteredResults.users.map((user) => (
                                                <UserResultItem
                                                    key={user.id}
                                                    user={user}
                                                    onClick={() => handleUserClick(user)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {filteredResults.hashtags.length > 0 && (
                                        <div className="mt-2">
                                            {filteredResults.hashtags.map((hashtag) => (
                                                <div
                                                    key={hashtag.tag}
                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        saveRecentSearch({
                                                            type: 'hashtag',
                                                            value: hashtag.tag,
                                                            displayName: `#${hashtag.tag}`,
                                                            timestamp: Date.now()
                                                        })
                                                        router.push(`/explore/tags/${hashtag.tag}`)
                                                        onClose()
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900">#{hashtag.tag}</p>
                                                            <p className="text-gray-500 text-sm">{hashtag.count} posts</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
// Desktop Search Panel Component (for sidebar)
export function DesktopSearchPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 bg-black/20 z-[98] hidden md:block"
                onClick={onClose}
            />
            {/* Search Panel */}
            <div
                className="fixed top-0 left-[80px] bottom-0 w-[400px] bg-white border-r border-gray-200 z-[99] shadow-2xl rounded-r-2xl animate-slide-in-left"
            >
                <div className="h-full flex flex-col pt-6">
                    {/* Header */}
                    <div className="px-6 pb-6 border-b border-gray-100">
                        <h2 className="text-2xl font-bold text-gray-900">Search</h2>
                    </div>

                    {/* Search Content */}
                    <div className="flex-1 overflow-hidden">
                        <SearchModal isOpen={isOpen} onClose={onClose} variant="panel" />
                    </div>
                </div>
            </div>
        </>
    )
}
// Embedded Search Component for Mobile UniWall
export function EmbeddedSearch({ className = '' }: { className?: string }) {
    const { token } = useAuth()
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')
    const [isExpanded, setIsExpanded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<SearchResult>({ users: [], posts: [] })
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    // Load recent searches on mount
    useEffect(() => {
        setRecentSearches(getRecentSearches())
    }, [])
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
                const data = await fetchAPI<{ results: SearchResult }>(
                    `/api/search?q=${encodeURIComponent(debouncedQuery)}&type=all`,
                    { token, cacheTTL: 60000 }
                )
                if (!isCancelled) {
                    setResults({
                        users: data?.results?.users || [],
                        posts: data?.results?.posts || [],
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
    // Handle click outside to collapse
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsExpanded(false)
            }
        }
        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isExpanded])
    const handleUserClick = useCallback((user: SearchUser) => {
        saveRecentSearch({
            type: 'user',
            id: user.id,
            value: user.username,
            displayName: user.username,
            image: user.profile_image,
            timestamp: Date.now()
        })
        setRecentSearches(getRecentSearches())
        setIsExpanded(false)
        setSearchQuery('')
        router.push(`/profile/${user.username}`)
    }, [router])

    const handleRecentSearchClick = useCallback((search: RecentSearch) => {
        if (search.type === 'user') {
            router.push(`/profile/${search.value}`)
        } else if (search.type === 'hashtag') {
            router.push(`/explore/tags/${search.value}`)
        } else {
            setSearchQuery(search.value)
        }
        setIsExpanded(false)
    }, [router])
    const handleRemoveRecentSearch = useCallback((search: RecentSearch) => {
        removeRecentSearch(search)
        setRecentSearches(getRecentSearches())
    }, [])
    const showRecentSearches = isExpanded && !searchQuery.trim() && recentSearches.length > 0
    const showResults = isExpanded && searchQuery.trim()

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Search Input */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsExpanded(true)}
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-xl text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-gray-50 focus:ring-2 focus:ring-gray-200 transition-all"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                        <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                    </button>
                )}
            </div>
            {/* Dropdown Results */}
            {isExpanded && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-[70vh] overflow-y-auto z-50">
                    {/* Recent Searches */}
                    {showRecentSearches && (
                        <div className="py-2">
                            <div className="flex items-center justify-between px-4 py-2">
                                <span className="font-semibold text-gray-900 text-sm">Recent</span>
                            </div>
                            {recentSearches.slice(0, 5).map((search, index) => (
                                <RecentSearchItem
                                    key={`${search.type}-${search.value}-${index}`}
                                    search={search}
                                    onClick={() => handleRecentSearchClick(search)}
                                    onRemove={() => handleRemoveRecentSearch(search)}
                                />
                            ))}
                        </div>
                    )}
                    {/* Loading */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    )}
                    {/* Search Results */}
                    {showResults && !loading && (
                        <>
                            {results.users.length === 0 && (results.hashtags || []).length === 0 ? (
                                <div className="py-8 text-center text-gray-500 text-sm">
                                    No results found
                                </div>
                            ) : (
                                <>
                                    {results.users.slice(0, 8).map((user) => (
                                        <UserResultItem
                                            key={user.id}
                                            user={user}
                                            onClick={() => handleUserClick(user)}
                                            showFollowButton={false}
                                        />
                                    ))}
                                    {(results.hashtags || []).length > 0 && (
                                        <div className="border-t border-gray-100">
                                            {(results.hashtags || []).slice(0, 5).map((hashtag) => (
                                                <div
                                                    key={hashtag.tag}
                                                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        saveRecentSearch({
                                                            type: 'hashtag',
                                                            value: hashtag.tag,
                                                            displayName: `#${hashtag.tag}`,
                                                            timestamp: Date.now()
                                                        })
                                                        setIsExpanded(false)
                                                        setSearchQuery('')
                                                        router.push(`/explore/tags/${hashtag.tag}`)
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900 text-sm">#{hashtag.tag}</p>
                                                            <p className="text-gray-500 text-xs">{hashtag.count} posts</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    {/* Empty state when focused but no recent */}
                    {isExpanded && !searchQuery.trim() && recentSearches.length === 0 && (
                        <div className="py-8 text-center text-gray-400 text-sm">
                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Search usernames and hashtags
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
