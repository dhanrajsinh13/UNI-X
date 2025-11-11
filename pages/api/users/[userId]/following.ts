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

    // Following of targetId (people targetId is following)
    const followingDocs = await followers
      .find({ follower_id: targetId })
      .skip(parseInt(offset as string))
      .limit(parseInt(limit as string))
      .toArray()

    const followingIds = followingDocs.map(f => f.following_id)

    if (followingIds.length === 0) {
      return res.status(200).json({ users: [] })
    }

    // Get user details
    const followingUsers = await users.find({ id: { $in: followingIds } as any }).toArray()

    // For requester's follow state of each listed user
    let followingSet: Set<number> = new Set()
    if (auth && followingUsers.length > 0) {
      const myFollowing = await followers.find({
        follower_id: auth.userId,
        following_id: { $in: followingIds } as any
      }).toArray()
      followingSet = new Set(myFollowing.map(r => r.following_id))
    }

    const result = followingUsers.map(u => ({
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
    console.error('Get following error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
