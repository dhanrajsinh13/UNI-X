'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import FollowButton from './FollowButton'
import { useAuth } from '../contexts/AuthContext'
import { fetchAPI } from '../lib/dataFetcher'

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
}

export default function SuggestedUsers() {
	const { token, user } = useAuth()
	const [loading, setLoading] = React.useState(true)
	const [error, setError] = React.useState<string>('')
	const [suggestions, setSuggestions] = React.useState<SuggestedUser[]>([])
	const router = useRouter()

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
				// Use the new intelligent suggestions API with caching
				const data = await fetchAPI<{ suggestions: any[] }>(
					'/api/users/suggestions?limit=10&algorithm=advanced',
					{ 
						token,
						cacheTTL: 300000 // Cache for 5 minutes
					}
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
					follower_count: s.follower_count
				}))

				if (!isCancelled) setSuggestions(suggestedUsers)
			} catch (e: any) {
				console.error('Failed to load suggestions:', e)
				if (!isCancelled) setError(e.message || 'Failed to load suggestions')
			} finally {
				if (!isCancelled) setLoading(false)
			}
		}
		load()
		return () => {
			isCancelled = true
		}
	}, [token, user?.id])

	const removeOnFollow = (userId: number) => {
		setSuggestions(prev => prev.filter(u => u.id !== userId))
	}

	const visible = suggestions.slice(0, 4)

	return (
		<div className="sticky top-20 lg:top-20">
			<div className="card overflow-hidden">
				<div className="px-4 py-3 flex items-center justify-between border-b border-border-light">
					<h3 className="text-sm font-semibold text-text">Suggested for you</h3>
					{suggestions.length > 4 && (
						<button onClick={() => router.push('/suggestions')} className="link-muted text-xs font-semibold">
							See all
						</button>
					)}
				</div>
				<div className="divide-y divide-border-light">
					{loading && (
						<div className="p-4 space-y-4">
							{[...Array(5)].map((_, i) => (
								<div key={i} className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="avatar avatar-md bg-gray-200 animate-pulse" />
										<div>
											<div className="h-3 w-32 bg-gray-200 rounded mb-2 animate-pulse" />
											<div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
										</div>
									</div>
									<div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse" />
								</div>
							))}
						</div>
					)}
					{!loading && suggestions.length === 0 && (
						<div className="p-4 text-sm text-text-secondary">No suggestions right now.</div>
					)}
					{!loading && visible.map(u => (
						<div key={u.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/profile/${u.id}`)}>
							<div className="flex items-center gap-3 min-w-0">
								<img 
									src={u.profile_image || '/uploads/DefaultProfile.jpg'} 
									alt={u.name} 
									className="avatar avatar-md object-cover" 
									onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
								/>
								<div className="min-w-0">
									<p className="text-sm font-semibold text-text truncate">{u.name}</p>
									<p className="text-xs text-text-secondary truncate">
										{u.reason || (u.department ? `${u.department}${u.year ? ` · Year ${u.year}` : ''}` : 'New to UNIX')}
									</p>
								</div>
							</div>
							<div onClick={(e) => e.stopPropagation()}>
								<FollowButton 
									userId={u.id} 
									isFollowing={false}
									size="sm"
									onFollowChange={(isFollowing) => { if (isFollowing) removeOnFollow(u.id) }}
								/>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Footer - Desktop only */}
			<div className="hidden lg:block mt-6 text-xxs text-text-tertiary space-y-2">
				<p>About · Help · Press · API  · Privacy · Terms · Locations · Language</p>
				<p>© 2026 UNI-X</p>
			</div>
		</div>
	)
}


