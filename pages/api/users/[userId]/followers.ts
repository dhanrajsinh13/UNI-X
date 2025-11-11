import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections } from '../../../../lib/mongodb'
import { getUserFromRequest } from '../../../../lib/auth'

interface User {
  id: number
  name: string
  username: string
  department: string
  year: string
  profile_image: string | null
}

interface Follower {
  follower_id: number
  following_id: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: `Method ${req.method} not allowed` })
  }

  try {
    const { userId, limit = '20', offset = '0' } = req.query
    const auth = getUserFromRequest(req)

    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ error: 'Invalid user id' })
    }

    const targetId = userId === 'me' ? auth?.userId : parseInt(userId)
    if (!targetId || Number.isNaN(targetId)) {
      return res.status(400).json({ error: 'Invalid user id' })
    }

    const followers = await getCollection<Follower>(Collections.FOLLOWERS)
    const users = await getCollection<User>(Collections.USERS)

    // Followers of targetId (people who follow targetId)
    const followerDocs = await followers
      .find({ following_id: targetId })
      .skip(parseInt(offset as string))
      .limit(parseInt(limit as string))
      .toArray()

    const followerIds = followerDocs.map(f => f.follower_id)

    if (followerIds.length === 0) {
      return res.status(200).json({ users: [] })
    }

    // Get user details
    const followerUsers = await users.find({ id: { $in: followerIds } as any }).toArray()

    // For requester's follow state of each listed user
    let followingSet: Set<number> = new Set()
    if (auth && followerUsers.length > 0) {
      const myFollowing = await followers.find({
        follower_id: auth.userId,
        following_id: { $in: followerIds } as any
      }).toArray()
      followingSet = new Set(myFollowing.map(r => r.following_id))
    }

    const result = followerUsers.map(u => ({
      id: u.id,
      name: u.name,
      username: u.username,
      department: u.department,
      year: u.year,
      profile_image: u.profile_image,
      is_following: auth ? followingSet.has(u.id) : false
    }))

    return res.status(200).json({ users: result })
  } catch (error) {
    console.error('Get followers error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
