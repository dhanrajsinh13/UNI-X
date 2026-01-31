/**
 * API Endpoint: Get Mutual Connections
 * 
 * GET /api/graph/mutual?userId=xxx - Get mutual connections with another user
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

    const { userId, type = 'following' } = req.query

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
    }

    // Validate userId format
    if (!ObjectId.isValid(userId as string)) {
        return res.status(400).json({ error: 'Invalid userId format' })
    }

    try {
        let mutualConnections

        if (type === 'followers') {
            // Get users that follow both current user and target user
            mutualConnections = await withRetry(() =>
                socialGraph.getMutualFollowers(currentUserId, userId as string)
            )
        } else {
            // Get users that both current user and target user follow
            mutualConnections = await withRetry(() =>
                socialGraph.getMutualConnections(currentUserId, userId as string)
            )
        }

        // Format response
        const formattedConnections = mutualConnections.map(user => ({
            id: user.userId.toString(),
            name: user.name,
            department: user.department,
            year: user.year,
            role: user.role,
            isActive: user.isActive,
        }))

        return res.status(200).json({
            success: true,
            data: {
                type: type === 'followers' ? 'mutual_followers' : 'mutual_following',
                mutualConnections: formattedConnections,
                count: formattedConnections.length,
            }
        })
    } catch (error: any) {
        console.error('Get mutual connections error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
