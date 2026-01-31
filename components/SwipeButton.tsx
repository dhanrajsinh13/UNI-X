'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { fetchAPI } from '../lib/dataFetcher'

interface SuggestedUser {
  id: number
  mutualFriends?: number
  interests?: string[]
}

export default function SwipeButton() {
  const { token } = useAuth()
  const router = useRouter()
  const [isEligible, setIsEligible] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const checkEligibility = async () => {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        // Fetch suggestions to check if user has mutual connections or common interests
        const data = await fetchAPI<{ suggestions: SuggestedUser[] }>(
          '/api/users/suggestions?limit=10&algorithm=advanced',
          { 
            token,
            cacheTTL: 300000 // Cache for 5 minutes
          }
        )

        if (!isCancelled) {
          // Check if any suggestion has mutual friends or interests
          const hasEligibleUsers = (data.suggestions || []).some(
            user => (user.mutualFriends && user.mutualFriends > 0) || 
                    (user.interests && user.interests.length > 0)
          )
          setIsEligible(hasEligibleUsers)
        }
      } catch (error) {
        console.error('Failed to check swipe eligibility:', error)
        if (!isCancelled) {
          setIsEligible(false)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    checkEligibility()

    return () => {
      isCancelled = true
    }
  }, [token])

  const handleClick = () => {
    router.push('/swipe')
  }

  // Don't render if not eligible or still loading
  if (loading || !isEligible) {
    return null
  }

  return (
    <button
      onClick={handleClick}
      className="group fixed top-20 right-6 md:top-6 md:right-6 z-50 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 px-5 py-3"
      aria-label="Discover connections"
    >
      <svg 
        className="w-5 h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M13 10V3L4 14h7v7l9-11h-7z" 
        />
      </svg>
      <span className="font-semibold text-sm hidden md:inline">Discover</span>
    </button>
  )
}
