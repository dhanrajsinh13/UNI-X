/**
 * API Endpoint: Graph Statistics
 * 
 * GET /api/graph/stats - Get overall graph statistics
 * 
 * Useful for admin dashboards and analytics
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { socialGraph } from '../../../lib/socialGraph'
import { withRetry } from '../../../lib/mongodb'
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

    try {
        // Get overall graph statistics
        const stats = await withRetry(() => socialGraph.getGraphStats())

        // Get current user's specific stats
        const [followersCount, followingCount] = await Promise.all([
            socialGraph.getFollowersCount(currentUserId),
            socialGraph.getFollowingCount(currentUserId),
        ])

        return res.status(200).json({
            success: true,
            data: {
                // Global stats
                global: {
                    totalUsers: stats.totalNodes,
                    totalConnections: stats.totalEdges,
                    avgFollowersPerUser: Math.round(stats.avgFollowersPerUser * 100) / 100,
                    avgFollowingPerUser: Math.round(stats.avgFollowingPerUser * 100) / 100,
                    networkDensity: stats.totalNodes > 1
                        ? Math.round((stats.totalEdges / (stats.totalNodes * (stats.totalNodes - 1))) * 10000) / 100
                        : 0,
                },
                // Current user stats
                user: {
                    userId: currentUserId,
                    followers: followersCount,
                    following: followingCount,
                    // Engagement ratio (followers/following)
                    engagementRatio: followingCount > 0
                        ? Math.round((followersCount / followingCount) * 100) / 100
                        : followersCount,
                }
            }
        })
    } catch (error: any) {
        console.error('Get stats error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
