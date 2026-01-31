/**
 * API Endpoint: Get Followers List
 * 
 * GET /api/graph/followers?userId=xxx - Get followers of a user
 * GET /api/graph/followers?userId=xxx&limit=20&offset=0 - With pagination
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { socialGraph } from '../../../lib/socialGraph'
import { withRetry } from '../../../lib/mongodb'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * Extract user ID from authorization header
 */
function getUserIdFromToken(req: NextApiRequest): string | null {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
        return null
    }

    try {
        const token = authHeader.split(' ')[1]
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
        return decoded.userId
    } catch {
        return null
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET'])
        return res.status(405).json({ error: `Method ${req.method} not allowed` })
    }

    // Authenticate the request
    const currentUserId = getUserIdFromToken(req)
    if (!currentUserId) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get query parameters
    const { userId, limit = '50', offset = '0' } = req.query

    // Default to current user if no userId specified
    const targetUserId = (userId as string) || currentUserId

    // Validate userId format
    if (!ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ error: 'Invalid userId format' })
    }

    // Parse pagination params
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 100)
    const offsetNum = Math.max(parseInt(offset as string, 10) || 0, 0)

    try {
        // Get followers list with user data and edge info
        const followers = await withRetry(() =>
            socialGraph.getFollowers(targetUserId, limitNum, offsetNum)
        )

        // Get total followers count for pagination
        const totalCount = await socialGraph.getFollowersCount(targetUserId)

        // Check if current user follows each follower (for follow back button)
        const followerIds = followers.map(f => f.user.userId)
        const followingStatus = await socialGraph.bulkCheckFollowing(
            currentUserId,
            followerIds
        )

        // Format response with follow status
        const formattedFollowers = followers.map(({ user, edge }) => ({
            id: user.userId.toString(),
            name: user.name,
            department: user.department,
            year: user.year,
            role: user.role,
            isActive: user.isActive,
            // Relationship info
            followedAt: edge.createdAt,
            interactionWeight: edge.interactionWeight,
            lastInteraction: edge.lastInteractionTimestamp,
            // Whether current user follows this person back
            isFollowedByMe: followingStatus.get(user.userId.toString()) || false,
        }))

        return res.status(200).json({
            success: true,
            data: {
                followers: formattedFollowers,
                pagination: {
                    total: totalCount,
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + followers.length < totalCount,
                }
            }
        })
    } catch (error: any) {
        console.error('Get followers error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
