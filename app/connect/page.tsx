'use client'

import React, { useCallback, useMemo, memo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import FollowButton from '../../components/FollowButton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fetchAPI, dataFetcher, debounce } from '../../lib/dataFetcher'

interface Student {
  id: number
  name: string
  username?: string
  department?: string
  year?: number
  bio?: string | null
  profile_image?: string | null
  is_following?: boolean
  college_name?: string
  interests?: string[]
  mutual_friends?: number
  mutualFriendNames?: string[]
}

type ViewMode = 'swipe' | 'explore'

export default function ConnectPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string>('')
  const [students, setStudents] = React.useState<Student[]>([])
  const [query, setQuery] = React.useState('')
  const [department, setDepartment] = React.useState('')
  const [year, setYear] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [suggestions, setSuggestions] = React.useState<Student[]>([])
  const [intelligentSuggestions, setIntelligentSuggestions] = React.useState<any[]>([])
  const [history, setHistory] = React.useState<{ user: Student; action: 'skip' | 'like' }[]>([])
  const [viewMode, setViewMode] = React.useState<ViewMode>('swipe')
  const [exploreSearchQuery, setExploreSearchQuery] = React.useState('')
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0)
  const [exploreUsers, setExploreUsers] = React.useState<Student[]>([])

  // Drag state
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragDX, setDragDX] = React.useState(0)
  const [dragDY, setDragDY] = React.useState(0)
  const startRef = React.useRef<{ x: number; y: number } | null>(null)
  const [animating, setAnimating] = React.useState(false)
  const [animateDir, setAnimateDir] = React.useState<null | 'left' | 'right'>(null)
  const dismissingRef = React.useRef(false)

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (department.trim()) params.set('department', department.trim())
      if (year.trim()) params.set('year', year.trim())
      params.set('limit', '100')

      const hasFilters = Boolean(query.trim() || department.trim() || year.trim())

      // Use batch fetching with caching
      const requests = [
        {
          url: `/api/users?${params.toString()}`,
          options: { token, cacheTTL: 60000 } // Cache for 1 minute
        },
        {
          url: '/api/users/me/following?limit=200',
          options: { token, cacheTTL: 120000 } // Cache following list for 2 minutes
        }
      ]

      if (!hasFilters) {
        requests.push({
          url: '/api/users/suggestions?limit=20&algorithm=advanced',
          options: { token, cacheTTL: 300000 } // Cache suggestions for 5 minutes
        })
      }

      const results = await dataFetcher.fetchBatch(requests)
      const usersData = results[0] as any
      const followingData = (results[1] || { users: [] }) as any
      const suggestionsData = results[2] as any
      
      const followingSet = new Set<number>((followingData.users || []).map((u: any) => u.id))

      const list: Student[] = (usersData.users || []).filter((u: any) => u.id !== user?.id)
      const notFollowing = list.filter((u: any) => !followingSet.has(u.id))
      setStudents(list)
      setExploreUsers(notFollowing.slice(0, 50))
      
      const deck = hasFilters ? list : notFollowing
      setSuggestions(deck.slice(0, hasFilters ? 100 : 20))
      
      // Load intelligent suggestions
      if (suggestionsData) {
        setIntelligentSuggestions(suggestionsData.suggestions || [])
      } else {
        setIntelligentSuggestions([])
      }
      
      setActiveIndex(0)
    } catch (e: any) {
      setError(e.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [token, query, department, year, user?.id])

  React.useEffect(() => {
    const t = setTimeout(() => { load() }, 250)
    return () => clearTimeout(t)
  }, [load])

  const currentCard = useMemo(() => suggestions[activeIndex], [suggestions, activeIndex])
  
  // Preload next images for smoother swipes
  React.useEffect(() => {
    const next = suggestions.slice(activeIndex, activeIndex + 4)
    next.forEach(u => {
      if (u?.profile_image) {
        const img = new Image()
        img.src = u.profile_image
      }
    })
  }, [suggestions, activeIndex])

  const onFollowSuccess = useCallback((studentId: number) => {
    setSuggestions(prev => {
      const filtered = prev.filter(s => s.id !== studentId)
      setActiveIndex(i => Math.min(i, Math.max(0, filtered.length - 1)))
      return filtered
    })
    setIntelligentSuggestions(prev => prev.filter(s => s.id !== studentId))
  }, [])

  const swipeLeft = useCallback(() => {
    if (!currentCard) return
    setHistory(prev => [{ user: currentCard, action: 'skip' }, ...prev])
    setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
  }, [currentCard, suggestions.length])

  const swipeRight = useCallback(() => {
    if (!currentCard) return
    // Optimistically remove and trigger follow
    setHistory(prev => [{ user: currentCard, action: 'like' }, ...prev])
    onFollowSuccess(currentCard.id)
    
    // Fire and forget follow with new data fetcher
    fetchAPI(`/api/users/${currentCard.id}/follow`, {
      method: 'POST',
      token: token || '',
      skipCache: true
    })
    .then(() => {
      // Clear caches after follow action
      dataFetcher.clearCache('/api/users/suggestions')
      dataFetcher.clearCache('/api/users/me/following')
    })
    .catch(err => {
      console.error('Follow request error:', err)
    })
  }, [currentCard, token, onFollowSuccess])

  const undo = useCallback(() => {
    const last = history[0]
    if (!last) return
    setHistory(prev => prev.slice(1))
    setSuggestions(prev => [last.user, ...prev])
    setActiveIndex(0)
  }, [history])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !startRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    setDragDX(dx)
    setDragDY(dy)
  }, [isDragging])

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return
    const thresholdX = 120
    const dx = dragDX
    setIsDragging(false)
    setDragDX(0)
    setDragDY(0)
    if (dx > thresholdX) {
      performDismiss('right')
    } else if (dx < -thresholdX) {
      performDismiss('left')
    }
  }, [isDragging, dragDX])

  const vibrate = useCallback((ms: number) => {
    try { (navigator as any).vibrate?.(ms) } catch {}
  }, [])

  const performDismiss = useCallback((dir: 'left' | 'right') => {
    if (!currentCard || dismissingRef.current) return
    dismissingRef.current = true
    setAnimateDir(dir)
    setAnimating(true)
    if (dir === 'right') vibrate(15)
    if (dir === 'left') vibrate(10)
  }, [currentCard, vibrate])

  const getInitials = useCallback((name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }, [])

  // Search functionality for explore mode with debouncing
  const performExploreSearch = useCallback(async (searchText: string) => {
    if (!searchText.trim() || !token) {
      // Reset to default explore users
      load()
      return
    }
    
    try {
      const params = new URLSearchParams()
      params.set('q', searchText.trim())
      params.set('limit', '50')
      
      const data = await fetchAPI<{ users: any[] }>(
        `/api/users?${params.toString()}`,
        { token, cacheTTL: 120000 } // Cache search results for 2 minutes
      )
      
      const filtered = (data.users || []).filter((u: any) => u.id !== user?.id)
      setExploreUsers(filtered)
    } catch (err) {
      console.error('Search error:', err)
    }
  }, [token, user?.id, load])

  const debouncedExploreSearch = useMemo(
    () => debounce((searchText: string) => performExploreSearch(searchText), 300),
    [performExploreSearch]
  )

  const handleExploreSearch = useCallback((searchText: string) => {
    setExploreSearchQuery(searchText)
    debouncedExploreSearch(searchText)
  }, [debouncedExploreSearch])

  // Image carousel for swipe mode
  const images = useMemo(() => {
    if (!currentCard?.profile_image) return []
    // For now just use single image, can extend to multiple later
    return [currentCard.profile_image]
  }, [currentCard])

  const nextImage = useCallback(() => {
    if (images.length <= 1) return
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }, [images.length])

  const prevImage = useCallback(() => {
    if (images.length <= 1) return
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }, [images.length])

  return (
    <div className="w-full h-screen flex flex-col relative bg-gradient-to-br from-gray-50 via-white to-gray-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 backdrop-blur-xl bg-white/90 border-b border-gray-200 shadow-sm">
        <div className="mx-auto w-full px-4 md:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">
              🔍 Connect
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/messages')}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                title="Messages"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 pb-3 max-w-md">
            <button
              onClick={() => {
                setViewMode('swipe')
                setExploreSearchQuery('')
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                viewMode === 'swipe'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Swipe
            </button>
            <button
              onClick={() => {
                setViewMode('explore')
                setExploreSearchQuery('')
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                viewMode === 'explore'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full h-full px-4 md:px-6 lg:px-8 py-6">
        {/* SWIPE MODE */}
        {viewMode === 'swipe' && (
          <div className="flex flex-col items-center justify-start h-full max-w-lg mx-auto pt-4">
            {/* Card counter */}
            <div className="mb-4 text-xs font-medium text-gray-500 bg-white rounded-full px-5 py-2 shadow-sm border border-gray-100">
              <span className="text-teal-600 font-semibold">{activeIndex + 1}</span>
              <span className="mx-1.5 text-gray-300">/</span>
              <span>{suggestions.length || 1}</span>
            </div>
            
            <div className="relative w-full aspect-[3/4] max-h-[calc(100vh-300px)]">
              {/* Background cards */}
              {suggestions.slice(activeIndex + 1, activeIndex + 3).map((c, idx) => (
                <div
                  key={c.id}
                  className="absolute inset-0 rounded-[2rem] overflow-hidden shadow-xl bg-white"
                  style={{
                    transform: `translateY(${8 * (idx + 1)}px) scale(${1 - 0.02 * (idx + 1)})`,
                    opacity: 0.6 - idx * 0.2,
                    zIndex: 10 - idx,
                  }}
                >
                  <div className="relative w-full h-full">
                    <img
                      src={c.profile_image || '/uploads/DefaultProfile.jpg'}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent" />
                  </div>
                </div>
              ))}

              {/* Top card */}
              <div
                className="absolute inset-0 rounded-[2rem] overflow-hidden shadow-2xl bg-white select-none touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  transform: (() => {
                    if (animating && animateDir) {
                      const w = typeof window !== 'undefined' ? window.innerWidth : 1000
                      const h = typeof window !== 'undefined' ? window.innerHeight : 800
                      if (animateDir === 'right') return `translate(${w}px, -40px) rotate(25deg)`
                      if (animateDir === 'left') return `translate(${-w}px, -40px) rotate(-25deg)`
                      return `translate(0px, ${-h}px) scale(1.1)`
                    }
                    return `translate(${dragDX}px, ${dragDY}px) rotate(${dragDX * 0.06}deg) scale(${1 + Math.abs(dragDX) * 0.00008})`
                  })(),
                  transition: isDragging ? 'none' : (animating ? 'transform 450ms cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)'),
                  zIndex: 20,
                }}
                onTransitionEnd={() => {
                  if (!animating || !animateDir) return
                  const dir = animateDir
                  setAnimating(false)
                  setAnimateDir(null)
                  dismissingRef.current = false
                  if (dir === 'right') {
                    swipeRight()
                  } else if (dir === 'left') {
                    swipeLeft()
                  }
                }}
              >
                {loading && (
                  <div className="w-full h-full">
                    <div className="animate-pulse bg-gradient-to-br from-teal-50 via-blue-50 to-purple-50 w-full h-full" />
                  </div>
                )}

                {!loading && currentCard && (
                  <>
                    {/* Profile Image Carousel */}
                    <div className="relative w-full h-full">
                      {images.length > 0 ? (
                        <>
                          <img
                            src={images[currentImageIndex]}
                            alt={currentCard.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'
                            }}
                          />
                          {images.length > 1 && (
                            <>
                              <button
                                onClick={prevImage}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-all"
                              >
                                ‹
                              </button>
                              <button
                                onClick={nextImage}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-all"
                              >
                                ›
                              </button>
                              {/* Image indicators */}
                              <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 px-4">
                                {images.map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`h-1 flex-1 rounded-full transition-all ${
                                      idx === currentImageIndex ? 'bg-white' : 'bg-white/40'
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-teal-400 via-blue-400 to-purple-400 flex items-center justify-center">
                          <div className="text-7xl font-bold text-white/90">{getInitials(currentCard.name)}</div>
                        </div>
                      )}
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    </div>

                    {/* Action indicators */}
                    {dragDX > 50 && (
                      <div className="absolute top-6 left-6 animate-in fade-in zoom-in duration-150">
                        <div className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 text-white font-bold text-base shadow-lg backdrop-blur-sm">
                          ✓ CONNECT
                        </div>
                      </div>
                    )}

                    {dragDX < -50 && (
                      <div className="absolute top-6 right-6 animate-in fade-in zoom-in duration-150">
                        <div className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-400 to-rose-500 text-white font-bold text-base shadow-lg backdrop-blur-sm">
                          SKIP ✕
                        </div>
                      </div>
                    )}

                    {/* Info section */}
                    <Link 
                      href={`/profile/${currentCard.id}`}
                      className="absolute bottom-0 left-0 right-0 p-6 text-white hover:bg-black/5 transition-colors duration-200"
                    >
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2.5">
                          <div className="text-2xl font-bold tracking-tight">{currentCard.name}</div>
                          {currentCard.year && (
                            <div className="text-base opacity-80">{getYearSuffix(currentCard.year)} Year</div>
                          )}
                        </div>

                        {currentCard.college_name && (
                          <div className="flex items-center gap-2 text-sm opacity-95">
                            <span>🎓</span>
                            <span>{currentCard.college_name}</span>
                          </div>
                        )}

                        {currentCard.department && (
                          <div className="text-xs font-semibold opacity-90 tracking-wide uppercase">{currentCard.department}</div>
                        )}

                        {currentCard.interests && currentCard.interests.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap pt-2">
                            <span className="text-sm">💬 Common Interests:</span>
                            {currentCard.interests.slice(0, 3).map((interest, idx) => (
                              <span key={idx} className="text-lg">{interest}</span>
                            ))}
                          </div>
                        )}

                        {currentCard.mutual_friends && currentCard.mutual_friends > 0 && (
                          <div className="flex items-center gap-2 text-sm opacity-95 pt-1">
                            <span>👥</span>
                            <span>
                              {currentCard.mutual_friends} Mutual Friend{currentCard.mutual_friends > 1 ? 's' : ''}
                              {currentCard.mutualFriendNames && currentCard.mutualFriendNames.length > 0 && (
                                <span className="opacity-80 ml-1">
                                  · {currentCard.mutualFriendNames.slice(0, 2).join(', ')}
                                  {currentCard.mutualFriendNames.length > 2 && ` +${currentCard.mutualFriendNames.length - 2} more`}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </>
                )}

                {!loading && !currentCard && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-white p-8">
                    <div className="text-7xl mb-6">✨</div>
                    <div className="text-2xl font-bold text-gray-800 mb-3">You're all caught up!</div>
                    <div className="text-gray-600 text-center text-sm max-w-sm leading-relaxed">
                      You've connected with everyone available right now. Check back later for new members!
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="mt-6 mb-4 flex items-center justify-center gap-4">
              <button 
                onClick={undo} 
                disabled={history.length === 0}
                className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-800 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed border border-gray-100"
                title="Undo"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              
              <button 
                onClick={swipeLeft}
                disabled={!currentCard || loading}
                className="w-14 h-14 rounded-full bg-gradient-to-r from-red-400 to-rose-500 shadow-xl flex items-center justify-center text-white text-2xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Skip"
              >
                ✕
              </button>
              
              <button 
                onClick={swipeRight}
                disabled={!currentCard || loading}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 text-white shadow-xl flex items-center justify-center text-3xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Connect"
              >
                ♥
              </button>
            </div>
          </div>
        )}

        {/* EXPLORE MODE */}
        {viewMode === 'explore' && (
          <div className="space-y-6 h-full">
            {/* Search bar for explore */}
            <div className="relative max-w-3xl mx-auto">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={exploreSearchQuery}
                onChange={e => handleExploreSearch(e.target.value)}
                placeholder="🔍 Search people, college, interest"
                className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-gray-300 text-base placeholder:text-gray-500 focus:outline-none focus:border-teal-400 transition-all shadow-sm"
              />
            </div>

            {/* Results display */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                    <div className="aspect-square bg-gray-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-gray-200 rounded" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : exploreUsers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {exploreUsers.map((user) => (
                  <div key={user.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <Link href={`/profile/${user.id}`}>
                      <div className="relative aspect-square overflow-hidden group">
                        <img 
                          src={user.profile_image || '/uploads/DefaultProfile.jpg'} 
                          alt={user.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }} 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                    <div className="p-3">
                      <Link href={`/profile/${user.id}`} className="text-sm font-bold text-gray-900 hover:text-teal-600 transition-colors block mb-1 truncate">
                        {user.name}
                      </Link>
                      {user.college_name && (
                        <div className="text-xs text-gray-600 mb-2 flex items-center gap-1 truncate">
                          <span>🎓</span>
                          <span className="truncate">{user.college_name}</span>
                        </div>
                      )}
                      {user.department && (
                        <div className="text-[11px] text-gray-500 truncate mb-2">
                          {user.department} {user.year && `• ${getYearSuffix(user.year)} Year`}
                        </div>
                      )}
                      <FollowButton 
                        userId={user.id} 
                        isFollowing={false}
                        size="sm"
                        onFollowChange={(isFollowing) => { 
                          if (isFollowing) {
                            setExploreUsers(prev => prev.filter(u => u.id !== user.id))
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : exploreUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">
                  {exploreSearchQuery.trim() ? '😕' : '👥'}
                </div>
                <div className="text-xl font-bold text-gray-800 mb-2">
                  {exploreSearchQuery.trim() ? 'No results found' : 'No users available'}
                </div>
                <div className="text-gray-600 text-sm">
                  {exploreSearchQuery.trim() 
                    ? 'Try searching with different keywords' 
                    : 'Check back later for new members'}
                </div>
              </div>
            ) : null}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// Helper function for year suffix
function getYearSuffix(year: number): string {
  if (year === 1) return '1st';
  if (year === 2) return '2nd';
  if (year === 3) return '3rd';
  return `${year}th`;
}

