import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, getNextSequenceValue } from '../../../../lib/mongodb'
import { getUserFromRequest } from '../../../../lib/auth'

interface User {
  id: number
  is_private: boolean
}

interface FollowRequest {
  id: number
  requester_id: number
  target_id: number
}

interface Follower {
  follower_id: number
  following_id: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query

  if (req.method === 'POST') {
    // Follow user
    try {
      const auth = getUserFromRequest(req)
      if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const targetUserId = parseInt(userId as string, 10)
      if (isNaN(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID format' })
      }

      // Can't follow yourself
      if (targetUserId === auth.userId) {
        return res.status(400).json({ error: 'You cannot follow yourself' })
      }

      const users = await getCollection<User>(Collections.USERS)
      const followers = await getCollection<Follower>(Collections.FOLLOWERS)
      const followRequests = await getCollection<FollowRequest>(Collections.FOLLOW_REQUESTS)

      // Check if target user exists
      const targetUser = await withRetry(async () => {
        return users.findOne({ id: targetUserId })
      })

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' })
      }

      // If target is private, create or confirm a pending request
      if (targetUser.is_private) {
        const existingRequest = await followRequests.findOne({
          requester_id: auth.userId,
          target_id: targetUserId
        })

        if (!existingRequest) {
          const requestId = await getNextSequenceValue('follow_requests')
          await withRetry(async () => {
            return followRequests.insertOne({
              id: requestId,
              requester_id: auth.userId,
              target_id: targetUserId
            } as any)
          })
        }

        const followerCount = await withRetry(async () => {
          return followers.countDocuments({ following_id: targetUserId })
        })
        const followingCount = await withRetry(async () => {
          return followers.countDocuments({ follower_id: auth.userId })
        })

        return res.status(200).json({
          message: 'Follow request sent',
          requested: true,
          is_following: false,
          follower_count: followerCount,
          following_count: followingCount
        })
      }

      // Public account: follow immediately
      const existingFollow = await followers.findOne({
        follower_id: auth.userId,
        following_id: targetUserId
      })

      if (existingFollow) {
        const followerCount = await followers.countDocuments({ following_id: targetUserId })
        const followingCount = await followers.countDocuments({ follower_id: auth.userId })
        return res.status(200).json({
          message: 'Already following',
          is_following: true,
          follower_count: followerCount,
          following_count: followingCount
        })
      }

      await withRetry(async () => {
        return followers.insertOne({
          follower_id: auth.userId,
          following_id: targetUserId
        } as any)
      })

      const followerCount = await followers.countDocuments({ following_id: targetUserId })
      const followingCount = await followers.countDocuments({ follower_id: auth.userId })

      res.status(200).json({
        message: 'User followed successfully',
        is_following: true,
        follower_count: followerCount,
        following_count: followingCount
      })
    } catch (error) {
      console.error('Follow error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else if (req.method === 'DELETE') {
    // Unfollow user
    try {
      const auth = getUserFromRequest(req)
      if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const targetUserId = parseInt(userId as string, 10)
      if (isNaN(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID format' })
      }

      const followers = await getCollection<Follower>(Collections.FOLLOWERS)
      const followRequests = await getCollection<FollowRequest>(Collections.FOLLOW_REQUESTS)

      // If there is a pending follow request, cancel it
      const request = await withRetry(async () => {
        return followRequests.findOne({
          requester_id: auth.userId,
          target_id: targetUserId
        })
      })

      if (request) {
        await withRetry(async () => {
          return followRequests.deleteOne({ id: request.id })
        })
        const followerCount = await followers.countDocuments({ following_id: targetUserId })
        const followingCount = await followers.countDocuments({ follower_id: auth.userId })
        return res.status(200).json({
          message: 'Follow request cancelled',
          requested: false,
          is_following: false,
          follower_count: followerCount,
          following_count: followingCount
        })
      }

      // Unfollow
      const existingFollow = await followers.findOne({
        follower_id: auth.userId,
        following_id: targetUserId
      })

      if (!existingFollow) {
        const followerCount = await followers.countDocuments({ following_id: targetUserId })
        const followingCount = await followers.countDocuments({ follower_id: auth.userId })
        return res.status(200).json({
          message: 'Not following',
          is_following: false,
          follower_count: followerCount,
          following_count: followingCount
        })
      }

      await withRetry(async () => {
        return followers.deleteOne({
          follower_id: auth.userId,
          following_id: targetUserId
        })
      })

      const followerCount = await followers.countDocuments({ following_id: targetUserId })
      const followingCount = await followers.countDocuments({ follower_id: auth.userId })

      res.status(200).json({
        message: 'User unfollowed successfully',
        is_following: false,
        follower_count: followerCount,
        following_count: followingCount
      })
    } catch (error) {
      console.error('Unfollow error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}