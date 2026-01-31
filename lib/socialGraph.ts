/**
 * Social Graph System for College Social Networking Application
 * 
 * This module implements a graph-based social network structure where:
 * - Users are represented as nodes with metadata
 * - Relationships (follow/unfollow) are directed edges
 * - Edge weights are calculated based on interaction frequency
 * 
 * Performance optimizations:
 * - Adjacency list structure for O(1) neighbor lookups
 * - Indexed MongoDB collections for fast queries
 * - Caching layer for frequently accessed data
 */

import { ObjectId, Document, WithId, Collection } from 'mongodb'
import { getDb, getCollection, Collections, User, withRetry } from './mongodb'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * User role in the college ecosystem
 */
export type UserRole = 'student' | 'faculty' | 'staff' | 'alumni'

/**
 * Interaction types that affect edge weight
 */
export type InteractionType = 'like' | 'comment' | 'message' | 'share' | 'mention'

/**
 * User node metadata stored in the graph
 */
export interface UserNode {
    userId: string | ObjectId          // Unique identifier
    role: UserRole                      // User's role in the college
    department: string                  // Academic department
    year?: number                       // Year/batch (for students)
    college?: string                    // College identifier (for multi-college support)
    name?: string                       // Display name for quick access
    isActive: boolean                   // Whether account is active
    lastActiveAt?: Date                 // Last activity timestamp
}

/**
 * Edge representing a directed relationship between users
 * Stored in MongoDB for persistence
 */
export interface GraphEdge {
    _id?: ObjectId
    sourceUserId: string | ObjectId     // User who initiated the follow
    targetUserId: string | ObjectId     // User being followed
    interactionWeight: number           // Normalized weight (0-1) based on interactions
    lastInteractionTimestamp: Date      // When the last interaction occurred
    interactionCounts: {                // Breakdown of interaction types
        likes: number
        comments: number
        messages: number
        shares: number
        mentions: number
    }
    createdAt: Date                     // When the follow relationship was created
    updatedAt: Date                     // Last update to edge data
}

/**
 * User suggestion with relevance score
 */
export interface UserSuggestion {
    userId: string | ObjectId
    name: string
    department: string
    year?: number
    role: UserRole
    mutualConnectionsCount: number      // Number of mutual connections
    relevanceScore: number              // Computed relevance (0-100)
    connectionPath: string[]            // Path from current user to suggested user
    reason: string                      // Human-readable suggestion reason
}

/**
 * Relationship strength analysis result
 */
export interface RelationshipStrength {
    sourceUserId: string | ObjectId
    targetUserId: string | ObjectId
    isFollowing: boolean                // Does source follow target?
    isFollowedBy: boolean               // Does target follow source?
    isMutual: boolean                   // Is it a mutual follow?
    interactionWeight: number           // Edge weight (0-1)
    strengthCategory: 'strong' | 'moderate' | 'weak' | 'none'
    lastInteraction?: Date
}

// ============================================================================
// COLLECTION NAME CONSTANTS
// ============================================================================

export const GraphCollections = {
    GRAPH_EDGES: 'graph_edges',           // Edge data with interaction weights
    USER_GRAPH_CACHE: 'user_graph_cache', // Cached adjacency lists for fast reads
}

// ============================================================================
// SOCIAL GRAPH CLASS
// ============================================================================

/**
 * Main SocialGraph class implementing all graph operations
 * Uses adjacency list internally with MongoDB backing store
 */
export class SocialGraph {
    // In-memory adjacency list cache for fast lookups
    // Key: userId, Value: Set of followed userIds
    private adjacencyList: Map<string, Set<string>> = new Map()

    // Reverse adjacency list for follower lookups
    // Key: userId, Value: Set of follower userIds
    private reverseAdjacencyList: Map<string, Set<string>> = new Map()

    // Cache expiry tracking
    private cacheTimestamps: Map<string, number> = new Map()
    private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache TTL

    // --------------------------------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------------------------------

    /**
     * Initialize the graph indexes for optimal query performance
     */
    async initializeIndexes(): Promise<void> {
        const db = await getDb()
        const edgesCollection = db.collection(GraphCollections.GRAPH_EDGES)

        // Compound index for relationship lookups
        await edgesCollection.createIndex(
            { sourceUserId: 1, targetUserId: 1 },
            { unique: true }
        )

        // Index for fetching all users someone follows
        await edgesCollection.createIndex({ sourceUserId: 1 })

        // Index for fetching all followers of a user
        await edgesCollection.createIndex({ targetUserId: 1 })

        // Index for sorting by interaction weight (heavy/active relationships)
        await edgesCollection.createIndex({ sourceUserId: 1, interactionWeight: -1 })

        // Index for time-based queries
        await edgesCollection.createIndex({ lastInteractionTimestamp: -1 })

        console.log('✅ Social graph indexes initialized')
    }

    // --------------------------------------------------------------------------
    // CORE OPERATIONS: FOLLOW/UNFOLLOW
    // --------------------------------------------------------------------------

    /**
     * Follow a user - creates a directed edge from source to target
     * 
     * @param sourceUserId - The user initiating the follow
     * @param targetUserId - The user being followed
     * @returns The created edge document
     */
    async followUser(
        sourceUserId: string | ObjectId,
        targetUserId: string | ObjectId
    ): Promise<GraphEdge> {
        // Prevent self-follow
        if (sourceUserId.toString() === targetUserId.toString()) {
            throw new Error('Users cannot follow themselves')
        }

        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        const now = new Date()
        const newEdge: GraphEdge = {
            sourceUserId: new ObjectId(sourceUserId.toString()),
            targetUserId: new ObjectId(targetUserId.toString()),
            interactionWeight: 0.1, // Initial weight for new connections
            lastInteractionTimestamp: now,
            interactionCounts: {
                likes: 0,
                comments: 0,
                messages: 0,
                shares: 0,
                mentions: 0,
            },
            createdAt: now,
            updatedAt: now,
        }

        // Use upsert to handle duplicate follow attempts gracefully
        const result = await edgesCollection.findOneAndUpdate(
            {
                sourceUserId: newEdge.sourceUserId,
                targetUserId: newEdge.targetUserId,
            },
            { $setOnInsert: newEdge },
            { upsert: true, returnDocument: 'after' }
        )

        // Also update the standard followers collection for compatibility
        const followersCollection = db.collection(Collections.FOLLOWERS)
        await followersCollection.updateOne(
            {
                follower_id: newEdge.sourceUserId,
                following_id: newEdge.targetUserId,
            },
            {
                $setOnInsert: {
                    follower_id: newEdge.sourceUserId,
                    following_id: newEdge.targetUserId,
                    created_at: now,
                }
            },
            { upsert: true }
        )

        // Invalidate cache for both users
        this.invalidateCache(sourceUserId.toString())
        this.invalidateCache(targetUserId.toString())

        // Update user counts
        await this.updateFollowCounts(sourceUserId, targetUserId, 'increment')

        return (result as any)?.value ?? (result as GraphEdge)
    }

    /**
     * Unfollow a user - removes the directed edge from source to target
     * 
     * @param sourceUserId - The user initiating the unfollow
     * @param targetUserId - The user being unfollowed
     * @returns Whether the edge was successfully removed
     */
    async unfollowUser(
        sourceUserId: string | ObjectId,
        targetUserId: string | ObjectId
    ): Promise<boolean> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        const result = await edgesCollection.deleteOne({
            sourceUserId: new ObjectId(sourceUserId.toString()),
            targetUserId: new ObjectId(targetUserId.toString()),
        })

        // Also remove from standard followers collection
        const followersCollection = db.collection(Collections.FOLLOWERS)
        await followersCollection.deleteOne({
            follower_id: new ObjectId(sourceUserId.toString()),
            following_id: new ObjectId(targetUserId.toString()),
        })

        // Invalidate cache for both users
        this.invalidateCache(sourceUserId.toString())
        this.invalidateCache(targetUserId.toString())

        // Update user counts
        if (result.deletedCount > 0) {
            await this.updateFollowCounts(sourceUserId, targetUserId, 'decrement')
        }

        return result.deletedCount > 0
    }

    /**
     * Update follower/following counts on user documents
     */
    private async updateFollowCounts(
        sourceUserId: string | ObjectId,
        targetUserId: string | ObjectId,
        operation: 'increment' | 'decrement'
    ): Promise<void> {
        const db = await getDb()
        const usersCollection = db.collection(Collections.USERS)
        const delta = operation === 'increment' ? 1 : -1

        // Update following_count for source user
        await usersCollection.updateOne(
            { _id: new ObjectId(sourceUserId.toString()) },
            { $inc: { following_count: delta } }
        )

        // Update followers_count for target user
        await usersCollection.updateOne(
            { _id: new ObjectId(targetUserId.toString()) },
            { $inc: { followers_count: delta } }
        )
    }

    // --------------------------------------------------------------------------
    // QUERY OPERATIONS: FOLLOWERS & FOLLOWING
    // --------------------------------------------------------------------------

    /**
     * Get all followers of a user (users who follow them)
     * 
     * @param userId - The user whose followers to retrieve
     * @param limit - Maximum number of followers to return
     * @param offset - Pagination offset
     * @returns Array of follower user nodes with edge data
     */
    async getFollowers(
        userId: string | ObjectId,
        limit: number = 50,
        offset: number = 0
    ): Promise<{ user: UserNode; edge: GraphEdge }[]> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)
        const usersCollection = db.collection<User>(Collections.USERS)

        // Find all edges where this user is the target (being followed)
        const edges = await edgesCollection
            .find({ targetUserId: new ObjectId(userId.toString()) })
            .sort({ interactionWeight: -1, createdAt: -1 }) // Prioritize strong connections
            .skip(offset)
            .limit(limit)
            .toArray()

        // Fetch user data for each follower
        const followerIds = edges.map(e => new ObjectId(e.sourceUserId.toString()))
        const users = await usersCollection
            .find({ _id: { $in: followerIds } })
            .toArray()

        // Map users by ID for quick lookup
        const userMap = new Map(users.map(u => [u._id!.toString(), u]))

        // Combine user data with edge data
        return edges.map(edge => ({
            user: this.userToNode(userMap.get(edge.sourceUserId.toString())!),
            edge,
        })).filter(item => item.user) // Filter out any missing users
    }

    /**
     * Get all users that a user is following
     * 
     * @param userId - The user whose following list to retrieve
     * @param limit - Maximum number of following to return
     * @param offset - Pagination offset
     * @returns Array of followed user nodes with edge data
     */
    async getFollowing(
        userId: string | ObjectId,
        limit: number = 50,
        offset: number = 0
    ): Promise<{ user: UserNode; edge: GraphEdge }[]> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)
        const usersCollection = db.collection<User>(Collections.USERS)

        // Find all edges where this user is the source (following others)
        const edges = await edgesCollection
            .find({ sourceUserId: new ObjectId(userId.toString()) })
            .sort({ interactionWeight: -1, lastInteractionTimestamp: -1 })
            .skip(offset)
            .limit(limit)
            .toArray()

        // Fetch user data for each followed user
        const followingIds = edges.map(e => new ObjectId(e.targetUserId.toString()))
        const users = await usersCollection
            .find({ _id: { $in: followingIds } })
            .toArray()

        // Map users by ID for quick lookup
        const userMap = new Map(users.map(u => [u._id!.toString(), u]))

        // Combine user data with edge data
        return edges.map(edge => ({
            user: this.userToNode(userMap.get(edge.targetUserId.toString())!),
            edge,
        })).filter(item => item.user)
    }

    /**
     * Check if sourceUser follows targetUser
     */
    async isFollowing(
        sourceUserId: string | ObjectId,
        targetUserId: string | ObjectId
    ): Promise<boolean> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        const edge = await edgesCollection.findOne({
            sourceUserId: new ObjectId(sourceUserId.toString()),
            targetUserId: new ObjectId(targetUserId.toString()),
        })

        return edge !== null
    }

    // --------------------------------------------------------------------------
    // RELATIONSHIP STRENGTH
    // --------------------------------------------------------------------------

    /**
     * Calculate relationship strength between two users
     * Considers: follow direction, interaction weight, and recency
     * 
     * @param sourceUserId - First user
     * @param targetUserId - Second user
     * @returns Detailed relationship analysis
     */
    async getRelationshipStrength(
        sourceUserId: string | ObjectId,
        targetUserId: string | ObjectId
    ): Promise<RelationshipStrength> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        // Check both directions of the relationship
        const [outgoingEdge, incomingEdge] = await Promise.all([
            edgesCollection.findOne({
                sourceUserId: new ObjectId(sourceUserId.toString()),
                targetUserId: new ObjectId(targetUserId.toString()),
            }),
            edgesCollection.findOne({
                sourceUserId: new ObjectId(targetUserId.toString()),
                targetUserId: new ObjectId(sourceUserId.toString()),
            }),
        ])

        const isFollowing = outgoingEdge !== null
        const isFollowedBy = incomingEdge !== null
        const isMutual = isFollowing && isFollowedBy

        // Calculate combined interaction weight
        let interactionWeight = 0
        let lastInteraction: Date | undefined

        if (outgoingEdge) {
            interactionWeight += outgoingEdge.interactionWeight
            lastInteraction = outgoingEdge.lastInteractionTimestamp
        }
        if (incomingEdge) {
            interactionWeight += incomingEdge.interactionWeight
            if (!lastInteraction || incomingEdge.lastInteractionTimestamp > lastInteraction) {
                lastInteraction = incomingEdge.lastInteractionTimestamp
            }
        }

        // Normalize weight (max 1.0 for both directions)
        interactionWeight = Math.min(interactionWeight / 2, 1)

        // Categorize relationship strength
        let strengthCategory: 'strong' | 'moderate' | 'weak' | 'none'
        if (!isFollowing && !isFollowedBy) {
            strengthCategory = 'none'
        } else if (isMutual && interactionWeight >= 0.7) {
            strengthCategory = 'strong'
        } else if (isMutual || interactionWeight >= 0.4) {
            strengthCategory = 'moderate'
        } else {
            strengthCategory = 'weak'
        }

        return {
            sourceUserId,
            targetUserId,
            isFollowing,
            isFollowedBy,
            isMutual,
            interactionWeight,
            strengthCategory,
            lastInteraction,
        }
    }

    // --------------------------------------------------------------------------
    // EDGE WEIGHT UPDATES
    // --------------------------------------------------------------------------

    /**
     * Update edge weight based on an interaction
     * Uses exponential decay to prioritize recent interactions
     * 
     * @param sourceUserId - User who performed the interaction
     * @param targetUserId - User who received the interaction
     * @param interactionType - Type of interaction
     */
    async updateEdgeWeight(
        sourceUserId: string | ObjectId,
        targetUserId: string | ObjectId,
        interactionType: InteractionType
    ): Promise<void> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        // Weight increments for different interaction types
        const weightIncrements: Record<InteractionType, number> = {
            like: 0.02,
            comment: 0.05,
            message: 0.08,
            share: 0.03,
            mention: 0.04,
        }

        const increment = weightIncrements[interactionType]
        const countField = `interactionCounts.${interactionType}s` as const

        // Update the edge with new interaction data
        await edgesCollection.updateOne(
            {
                sourceUserId: new ObjectId(sourceUserId.toString()),
                targetUserId: new ObjectId(targetUserId.toString()),
            },
            {
                $inc: {
                    interactionWeight: increment,
                    [countField]: 1,
                },
                $set: {
                    lastInteractionTimestamp: new Date(),
                    updatedAt: new Date(),
                },
                $min: { interactionWeight: 1.0 }, // Cap at 1.0
            }
        )

        // Invalidate cache
        this.invalidateCache(sourceUserId.toString())
    }

    /**
     * Apply time-based decay to edge weights
     * Should be run periodically (e.g., daily) to keep weights relevant
     */
    async applyWeightDecay(decayFactor: number = 0.99): Promise<number> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        // Apply decay to all edges, with minimum threshold
        const result = await edgesCollection.updateMany(
            { interactionWeight: { $gt: 0.05 } }, // Only decay edges above threshold
            [
                {
                    $set: {
                        interactionWeight: {
                            $max: [0.05, { $multiply: ['$interactionWeight', decayFactor] }]
                        },
                        updatedAt: new Date(),
                    }
                }
            ]
        )

        return result.modifiedCount
    }

    // --------------------------------------------------------------------------
    // GRAPH TRAVERSAL: MUTUAL CONNECTIONS
    // --------------------------------------------------------------------------

    /**
     * Find mutual connections between two users
     * (Users that both source and target follow)
     * 
     * @param userId1 - First user
     * @param userId2 - Second user
     * @returns Array of users that both follow
     */
    async getMutualConnections(
        userId1: string | ObjectId,
        userId2: string | ObjectId
    ): Promise<UserNode[]> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)
        const usersCollection = db.collection<User>(Collections.USERS)

        // Get users that user1 follows
        const user1Following = await edgesCollection
            .find({ sourceUserId: new ObjectId(userId1.toString()) })
            .project({ targetUserId: 1 })
            .toArray()

        const user1FollowingIds = new Set(
            user1Following.map(e => e.targetUserId.toString())
        )

        // Get users that user2 follows and check intersection
        const user2Following = await edgesCollection
            .find({ sourceUserId: new ObjectId(userId2.toString()) })
            .project({ targetUserId: 1 })
            .toArray()

        const mutualIds = user2Following
            .filter(e => user1FollowingIds.has(e.targetUserId.toString()))
            .map(e => new ObjectId(e.targetUserId.toString()))

        if (mutualIds.length === 0) {
            return []
        }

        // Fetch user details for mutual connections
        const users = await usersCollection
            .find({ _id: { $in: mutualIds } })
            .toArray()

        return users.map(u => this.userToNode(u))
    }

    /**
     * Get mutual followers (users who follow both userId1 and userId2)
     */
    async getMutualFollowers(
        userId1: string | ObjectId,
        userId2: string | ObjectId
    ): Promise<UserNode[]> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)
        const usersCollection = db.collection<User>(Collections.USERS)

        // Get followers of user1
        const user1Followers = await edgesCollection
            .find({ targetUserId: new ObjectId(userId1.toString()) })
            .project({ sourceUserId: 1 })
            .toArray()

        const user1FollowerIds = new Set(
            user1Followers.map(e => e.sourceUserId.toString())
        )

        // Get followers of user2 and check intersection
        const user2Followers = await edgesCollection
            .find({ targetUserId: new ObjectId(userId2.toString()) })
            .project({ sourceUserId: 1 })
            .toArray()

        const mutualIds = user2Followers
            .filter(e => user1FollowerIds.has(e.sourceUserId.toString()))
            .map(e => new ObjectId(e.sourceUserId.toString()))

        if (mutualIds.length === 0) {
            return []
        }

        // Fetch user details
        const users = await usersCollection
            .find({ _id: { $in: mutualIds } })
            .toArray()

        return users.map(u => this.userToNode(u))
    }

    // --------------------------------------------------------------------------
    // USER SUGGESTIONS
    // --------------------------------------------------------------------------

    /**
     * Suggest users based on second-degree connections
     * Prioritizes users from the same department/college
     * 
     * @param userId - User to generate suggestions for
     * @param filters - Optional filters (department, college, role)
     * @param limit - Maximum suggestions to return
     * @returns Ranked list of user suggestions
     */
    async getSuggestions(
        userId: string | ObjectId,
        filters: {
            sameDepartment?: boolean
            sameCollege?: boolean
            sameYear?: boolean
            role?: UserRole
        } = {},
        limit: number = 20
    ): Promise<UserSuggestion[]> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)
        const usersCollection = db.collection<User>(Collections.USERS)

        // Get current user's data for filtering
        const currentUser = await usersCollection.findOne({
            _id: new ObjectId(userId.toString())
        })

        if (!currentUser) {
            throw new Error('User not found')
        }

        // Get users the current user already follows
        const alreadyFollowing = await edgesCollection
            .find({ sourceUserId: new ObjectId(userId.toString()) })
            .project({ targetUserId: 1 })
            .toArray()

        const alreadyFollowingSet = new Set(
            alreadyFollowing.map(e => e.targetUserId.toString())
        )
        alreadyFollowingSet.add(userId.toString()) // Exclude self

        // Get first-degree connections (users the current user follows)
        const firstDegree = await edgesCollection
            .find({ sourceUserId: new ObjectId(userId.toString()) })
            .sort({ interactionWeight: -1 })
            .limit(100) // Limit to top connections
            .toArray()

        // Get second-degree connections (friends of friends)
        const secondDegreeMap = new Map<string, {
            count: number
            connectors: string[]
        }>()

        for (const edge of firstDegree) {
            // Get who this first-degree connection follows
            const friendsOfFriend = await edgesCollection
                .find({ sourceUserId: edge.targetUserId })
                .project({ targetUserId: 1 })
                .limit(50)
                .toArray()

            for (const fof of friendsOfFriend) {
                const fofId = fof.targetUserId.toString()

                // Skip if already following or is self
                if (alreadyFollowingSet.has(fofId)) continue

                // Track mutual connection count
                const existing = secondDegreeMap.get(fofId) || { count: 0, connectors: [] }
                existing.count++
                existing.connectors.push(edge.targetUserId.toString())
                secondDegreeMap.set(fofId, existing)
            }
        }

        // Fetch user data for potential suggestions
        const potentialSuggestionIds = Array.from(secondDegreeMap.keys())
            .map(id => new ObjectId(id))

        if (potentialSuggestionIds.length === 0) {
            // Fall back to users from same department if no second-degree connections
            return this.getFallbackSuggestions(currentUser, alreadyFollowingSet, limit)
        }

        const potentialUsers = await usersCollection
            .find({ _id: { $in: potentialSuggestionIds } })
            .toArray()

        // Score and filter suggestions
        const suggestions: UserSuggestion[] = []

        for (const user of potentialUsers) {
            const connectionData = secondDegreeMap.get(user._id!.toString())!

            // Apply filters
            if (filters.sameDepartment && user.department !== currentUser.department) continue
            if (filters.sameYear && user.year !== currentUser.year) continue

            // Calculate relevance score
            let score = 0

            // Mutual connections (most important factor)
            score += connectionData.count * 15

            // Same department bonus
            if (user.department === currentUser.department) {
                score += 25
            }

            // Same year bonus (for students)
            if (user.year && currentUser.year && user.year === currentUser.year) {
                score += 15
            }

            // Active user bonus
            if (user.followers_count > 10) {
                score += Math.min(user.followers_count / 10, 10)
            }

            // Generate suggestion reason
            let reason = ''
            if (connectionData.count >= 3) {
                reason = `${connectionData.count} mutual connections`
            } else if (user.department === currentUser.department) {
                reason = `From your department (${user.department})`
            } else if (connectionData.count > 0) {
                reason = 'Suggested based on your network'
            }

            suggestions.push({
                userId: user._id!,
                name: user.name,
                department: user.department,
                year: user.year,
                role: this.inferRole(user),
                mutualConnectionsCount: connectionData.count,
                relevanceScore: Math.min(score, 100),
                connectionPath: connectionData.connectors.slice(0, 3),
                reason,
            })
        }

        // Sort by relevance score and return top results
        return suggestions
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit)
    }

    /**
     * Fallback suggestions when no second-degree connections exist
     * Suggests users from the same department/college
     */
    private async getFallbackSuggestions(
        currentUser: User,
        alreadyFollowingSet: Set<string>,
        limit: number
    ): Promise<UserSuggestion[]> {
        const db = await getDb()
        const usersCollection = db.collection<User>(Collections.USERS)

        // Find users from same department
        const sameDeptUsers = await usersCollection
            .find({
                department: currentUser.department,
                is_deactivated: { $ne: true },
            })
            .sort({ followers_count: -1 })
            .limit(limit * 2)
            .toArray()

        const suggestions: UserSuggestion[] = []

        for (const user of sameDeptUsers) {
            if (alreadyFollowingSet.has(user._id!.toString())) continue

            suggestions.push({
                userId: user._id!,
                name: user.name,
                department: user.department,
                year: user.year,
                role: this.inferRole(user),
                mutualConnectionsCount: 0,
                relevanceScore: user.department === currentUser.department ? 50 : 30,
                connectionPath: [],
                reason: `Popular in ${user.department}`,
            })
        }

        return suggestions.slice(0, limit)
    }

    // --------------------------------------------------------------------------
    // HELPER METHODS
    // --------------------------------------------------------------------------

    /**
     * Convert MongoDB User document to UserNode
     */
    private userToNode(user: User | null): UserNode {
        if (!user) {
            return {
                userId: '',
                role: 'student',
                department: '',
                isActive: false,
            }
        }

        return {
            userId: user._id!,
            role: this.inferRole(user),
            department: user.department,
            year: user.year,
            name: user.name,
            isActive: !user.is_deactivated,
        }
    }

    /**
     * Infer user role from user document
     */
    private inferRole(user: User): UserRole {
        // This could be enhanced based on your user schema
        // Currently inferring from year field
        if (!user.year || user.year === 0) {
            return 'faculty'
        }
        if (user.year < new Date().getFullYear() - 4) {
            return 'alumni'
        }
        return 'student'
    }

    /**
     * Invalidate cache for a user
     */
    private invalidateCache(userId: string): void {
        this.adjacencyList.delete(userId)
        this.reverseAdjacencyList.delete(userId)
        this.cacheTimestamps.delete(userId)
    }

    /**
     * Get followers count for a user (optimized)
     */
    async getFollowersCount(userId: string | ObjectId): Promise<number> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        return edgesCollection.countDocuments({
            targetUserId: new ObjectId(userId.toString()),
        })
    }

    /**
     * Get following count for a user (optimized)
     */
    async getFollowingCount(userId: string | ObjectId): Promise<number> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        return edgesCollection.countDocuments({
            sourceUserId: new ObjectId(userId.toString()),
        })
    }

    /**
     * Bulk check follow status for multiple users
     * Optimized for feed/list views
     */
    async bulkCheckFollowing(
        sourceUserId: string | ObjectId,
        targetUserIds: (string | ObjectId)[]
    ): Promise<Map<string, boolean>> {
        const db = await getDb()
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        const edges = await edgesCollection
            .find({
                sourceUserId: new ObjectId(sourceUserId.toString()),
                targetUserId: {
                    $in: targetUserIds.map(id => new ObjectId(id.toString()))
                },
            })
            .project({ targetUserId: 1 })
            .toArray()

        const followingSet = new Set(edges.map(e => e.targetUserId.toString()))

        const result = new Map<string, boolean>()
        for (const targetId of targetUserIds) {
            result.set(targetId.toString(), followingSet.has(targetId.toString()))
        }

        return result
    }

    /**
     * Get graph statistics for analytics
     */
    async getGraphStats(): Promise<{
        totalNodes: number
        totalEdges: number
        avgFollowersPerUser: number
        avgFollowingPerUser: number
    }> {
        const db = await getDb()
        const usersCollection = db.collection<User>(Collections.USERS)
        const edgesCollection = db.collection<GraphEdge>(GraphCollections.GRAPH_EDGES)

        const [totalNodes, totalEdges] = await Promise.all([
            usersCollection.countDocuments({ is_deactivated: { $ne: true } }),
            edgesCollection.countDocuments(),
        ])

        return {
            totalNodes,
            totalEdges,
            avgFollowersPerUser: totalNodes > 0 ? totalEdges / totalNodes : 0,
            avgFollowingPerUser: totalNodes > 0 ? totalEdges / totalNodes : 0,
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

// Export singleton instance for consistent usage across the application
export const socialGraph = new SocialGraph()

// Initialize indexes on module load (in production)
if (process.env.NODE_ENV === 'production') {
    socialGraph.initializeIndexes().catch(console.error)
}
