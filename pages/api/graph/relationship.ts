/**
 * API Endpoint: Check Relationship Strength
 * 
 * GET /api/graph/relationship?targetUserId=xxx - Get relationship strength with another user
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

    const { targetUserId } = req.query

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required' })
    }

    // Validate targetUserId format
    if (!ObjectId.isValid(targetUserId as string)) {
        return res.status(400).json({ error: 'Invalid targetUserId format' })
    }

    try {
        // Get relationship strength between current user and target
        const relationship = await withRetry(() =>
            socialGraph.getRelationshipStrength(currentUserId, targetUserId as string)
        )

        return res.status(200).json({
            success: true,
            data: {
                sourceUserId: currentUserId,
                targetUserId,
                // Follow status
                isFollowing: relationship.isFollowing,
                isFollowedBy: relationship.isFollowedBy,
                isMutual: relationship.isMutual,
                // Strength metrics
                interactionWeight: Math.round(relationship.interactionWeight * 100) / 100,
                strengthCategory: relationship.strengthCategory,
                lastInteraction: relationship.lastInteraction,
                // Human-readable description
                description: getRelationshipDescription(relationship),
            }
        })
    } catch (error: any) {
        console.error('Get relationship error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}

/**
 * Generate human-readable relationship description
 */
function getRelationshipDescription(relationship: {
    isFollowing: boolean
    isFollowedBy: boolean
    isMutual: boolean
    strengthCategory: string
}): string {
    if (!relationship.isFollowing && !relationship.isFollowedBy) {
        return 'No connection'
    }

    if (relationship.isMutual) {
        switch (relationship.strengthCategory) {
            case 'strong':
                return 'Close mutual connection with frequent interactions'
            case 'moderate':
                return 'Mutual connection with regular interactions'
            default:
                return 'Mutual connection'
        }
    }

    if (relationship.isFollowing && !relationship.isFollowedBy) {
        return 'You follow them, but they don\'t follow back'
    }

    if (!relationship.isFollowing && relationship.isFollowedBy) {
        return 'They follow you, but you don\'t follow back'
    }

    return 'Connected'
}
