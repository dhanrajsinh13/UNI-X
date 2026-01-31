/**
 * API Endpoint: Follow/Unfollow User
 * 
 * POST /api/graph/follow - Follow a user
 * DELETE /api/graph/follow - Unfollow a user
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { socialGraph } from '../../../lib/socialGraph'
import { getCollection, Collections, withRetry } from '../../../lib/mongodb'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

// JWT secret for auth verification
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
    // Authenticate the request
    const userId = getUserIdFromToken(req)
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const { targetUserId } = req.body || req.query

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required' })
    }

    // Validate targetUserId format
    if (!ObjectId.isValid(targetUserId as string)) {
        return res.status(400).json({ error: 'Invalid targetUserId format' })
    }

    try {
        // Verify target user exists
        const usersCollection = await getCollection(Collections.USERS)
        const targetUser = await usersCollection.findOne({
            _id: new ObjectId(targetUserId as string)
        })

        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' })
        }

        switch (req.method) {
            case 'POST': {
                // Follow the user
                const edge = await withRetry(() =>
                    socialGraph.followUser(userId, targetUserId as string)
                )

                return res.status(200).json({
                    success: true,
                    message: 'Successfully followed user',
                    data: {
                        sourceUserId: userId,
                        targetUserId,
                        createdAt: edge.createdAt,
                    }
                })
            }

            case 'DELETE': {
                // Unfollow the user
                const unfollowed = await withRetry(() =>
                    socialGraph.unfollowUser(userId, targetUserId as string)
                )

                if (!unfollowed) {
                    return res.status(400).json({
                        error: 'Not following this user'
                    })
                }

                return res.status(200).json({
                    success: true,
                    message: 'Successfully unfollowed user',
                })
            }

            default:
                res.setHeader('Allow', ['POST', 'DELETE'])
                return res.status(405).json({ error: `Method ${req.method} not allowed` })
        }
    } catch (error: any) {
        console.error('Follow/Unfollow error:', error)

        if (error.message === 'Users cannot follow themselves') {
            return res.status(400).json({ error: error.message })
        }

        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
