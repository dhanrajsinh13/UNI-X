/**
 * API Endpoint: Get User Suggestions
 * 
 * GET /api/graph/suggestions - Get personalized user suggestions
 * 
 * Query params:
 * - sameDepartment: boolean - Limit to same department
 * - sameYear: boolean - Limit to same year
 * - limit: number - Max suggestions (default 20)
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

    // Parse query parameters
    const {
        sameDepartment = 'false',
        sameYear = 'false',
        limit = '20'
    } = req.query

    const filters = {
        sameDepartment: sameDepartment === 'true',
        sameYear: sameYear === 'true',
    }

    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 50)

    try {
        // Get personalized suggestions
        const suggestions = await withRetry(() =>
            socialGraph.getSuggestions(currentUserId, filters, limitNum)
        )

        // Format response
        const formattedSuggestions = suggestions.map(suggestion => ({
            id: suggestion.userId.toString(),
            name: suggestion.name,
            department: suggestion.department,
            year: suggestion.year,
            role: suggestion.role,
            // Suggestion metadata
            mutualConnections: suggestion.mutualConnectionsCount,
            relevanceScore: Math.round(suggestion.relevanceScore),
            reason: suggestion.reason,
            // Connection path for "through X, Y, Z" display
            connectionPath: suggestion.connectionPath,
        }))

        // Group suggestions by category for better UX
        const categorizedSuggestions = {
            highRelevance: formattedSuggestions.filter(s => s.relevanceScore >= 70),
            mediumRelevance: formattedSuggestions.filter(s => s.relevanceScore >= 40 && s.relevanceScore < 70),
            lowRelevance: formattedSuggestions.filter(s => s.relevanceScore < 40),
        }

        return res.status(200).json({
            success: true,
            data: {
                suggestions: formattedSuggestions,
                categorized: categorizedSuggestions,
                total: formattedSuggestions.length,
                filters: {
                    sameDepartment: filters.sameDepartment,
                    sameYear: filters.sameYear,
                }
            }
        })
    } catch (error: any) {
        console.error('Get suggestions error:', error)
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
}
