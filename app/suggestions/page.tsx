'use client'

import Image from 'next/image'
import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import FollowButton from '../../components/FollowButton'
import { fetchAPI } from '../../lib/dataFetcher'

interface SuggestedUser {
  id: number
  name: string
  username?: string
  department?: string
  year?: number
  profile_image?: string
  mutualFriends?: number
  mutualFriendNames?: string[]
  reason?: string
  follower_count?: number
  score?: number
}

export default function SuggestionsPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string>('')
  const [suggestions, setSuggestions] = React.useState<SuggestedUser[]>([])

  React.useEffect(() => {
    let isCancelled = false
    const load = async () => {
      if (!token) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const data = await fetchAPI<{ suggestions: any[] }>(
          '/api/users/suggestions?limit=50&algorithm=advanced',
          { token, cacheTTL: 300000 } // Cache for 5 minutes
        )

        const suggestedUsers: SuggestedUser[] = (data.suggestions || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          username: s.username,
          department: s.department,
          year: s.year,
          profile_image: s.profile_image,
          mutualFriends: s.mutualFriends,
          mutualFriendNames: s.mutualFriendNames,
          reason: s.reason,
          follower_count: s.follower_count,
          score: s.score
        }))

        if (!isCancelled) setSuggestions(suggestedUsers)
      } catch (e: any) {
        if (!isCancelled) setError(e.message || 'Failed to load suggestions')
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }
    load()
    return () => { isCancelled = true }
  }, [token, user?.id])

  const removeOnFollow = (userId: number) => {
    setSuggestions(prev => prev.filter(u => u.id !== userId))
  }

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Suggested for you</h1>
          <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => router.back()}>Back</button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                  <div>
                    <div className="h-3 w-32 bg-gray-200 rounded mb-2 animate-pulse" />
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-4 text-sm text-red-600 border border-red-200 rounded-lg">{error}</div>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <div className="p-6 text-center text-gray-500">No suggestions right now.</div>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/profile/${u.id}`)}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Image
                    src={u.profile_image || '/uploads/DefaultProfile.jpg'}
                    alt={u.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {u.username && <span className="text-gray-400">@{u.username} · </span>}
                      {u.department && `${u.department} · Year ${u.year}`}
                    </p>
                    {u.reason && (
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {u.reason}
                      </p>
                    )}
                    {u.follower_count !== undefined && u.follower_count > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        {u.follower_count} follower{u.follower_count !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <FollowButton
                    userId={u.id}
                    isFollowing={false}
                    size="md"
                    onFollowChange={(isFollowing) => { if (isFollowing) removeOnFollow(u.id) }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


