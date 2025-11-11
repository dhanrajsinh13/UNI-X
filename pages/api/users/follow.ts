import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, User, Follower, getNextSequenceValue, serializeDoc } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    // Can't follow yourself
    if (parseInt(userId) === auth.userId) {
      return res.status(400).json({ error: 'You cannot follow yourself' })
    }

    const users = await getCollection<User>(Collections.USERS)
    const followers = await getCollection<Follower>(Collections.FOLLOWERS)

    // Check if target user exists
    const targetUser = await users.findOne({ id: parseInt(userId) })

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if already following
    const existingFollow = await followers.findOne({
      follower_id: auth.userId,
      following_id: parseInt(userId)
    })

    let action: 'followed' | 'unfollowed'

    if (existingFollow) {
      // Unfollow the user
      await followers.deleteOne({
        follower_id: auth.userId,
        following_id: parseInt(userId)
      })
      action = 'unfollowed'
    } else {
      // Follow the user
      const followId = await getNextSequenceValue('followers')
      await followers.insertOne({
        id: followId,
        follower_id: auth.userId,
        following_id: parseInt(userId),
        created_at: new Date()
      } as any)
      action = 'followed'

      // Emit follow notification to the followed user
      try {
        if ((global as any).io) {
          ;(global as any).io.to(`user-${parseInt(userId)}`).emit('notification', {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'follow',
            message: 'You have a new follower',
            time: new Date().toISOString(),
            read: false,
            meta: { actorId: auth.userId }
          })
        }
      } catch {}
    }

    // Get updated counts
    const [followerCount, followingCount] = await Promise.all([
      followers.countDocuments({ following_id: parseInt(userId) }),
      followers.countDocuments({ follower_id: parseInt(userId) })
    ])

    const serializedUser = serializeDoc(targetUser)
    
    res.status(200).json({
      action,
      message: `User ${action} successfully`,
      user: {
        ...serializedUser,
        follower_count: followerCount,
        following_count: followingCount,
        is_following: action === 'followed'
      }
    })
  } catch (error) {
    console.error('Follow/unfollow error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}