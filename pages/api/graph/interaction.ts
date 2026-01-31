/**
 * API Endpoint: Record Interaction (Update Edge Weight)
 * 
 * POST /api/graph/interaction - Record an interaction between users
 * 
 * This endpoint is called internally when users like, comment, message, etc.
 * It updates the edge weight in the social graph.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { socialGraph, InteractionType } from '../../../lib/socialGraph'
import { withRetry } from '../../../lib/mongodb'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Valid interaction types
const VALID_INTERACTION_TYPES: InteractionType[] = [
    'like', 'comment', 'message', 'share', 'mention'
]

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
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ error: `Method ${req.method} not allowed` })
    }

    // Authenticate the request
    const currentUserId = getUserIdFromToken(req)
    if (!currentUserId) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const { targetUserId, interactionType } = req.body

    // Validate required fields
    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required' })
    }

    if (!interactionType) {
        return res.status(400).json({ error: 'interactionType is required' })
    }

    // Validate targetUserId format
    if (!ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ error: 'Invalid targetUserId format' })
    }

    // Validate interaction type
    if (!VALID_INTERACTION_TYPES.includes(interactionType)) {
        return res.status(400).json({
            error: `Invalid interactionType. Must be one of: ${VALID_INTERACTION_TYPES.join(', ')}`
        })
    }

    // Prevent self-interaction tracking (optional)
    if (currentUserId === targetUserId) {
        return res.status(200).json({
            success: true,
            message: 'Self-interactions are not tracked'
        })
    }

    try {
        // Update edge weight for this interaction
        await withRetry(() =>
            socialGraph.updateEdgeWeight(
                currentUserId,
                targetUserId,
                interactionType as InteractionType
            )
        )

        return res.status(200).json({
            success: true,
            message: 'Interaction recorded',
            data: {
                sourceUserId: currentUserId,
                targetUserId,
                interactionType,
                recordedAt: new Date(),
            }
        })
    } catch (error: any) {
        console.error('Record interaction error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
