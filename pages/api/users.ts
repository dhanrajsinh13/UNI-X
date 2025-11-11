import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, User, Follower } from '../../lib/mongodb'
import { getUserFromRequest } from '../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { search, q, department, year, limit = '50', offset = '0' } = req.query
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)))
    const offsetNum = Math.max(0, parseInt(offset as string))

    // Build query filter
    const filter: any = {
      id: { $ne: auth.userId } // Exclude current user
    }

    const queryText = (typeof q === 'string' && q.trim()) ? q.trim() : (typeof search === 'string' ? search : '')
    if (queryText) {
      filter.$or = [
        { name: { $regex: queryText, $options: 'i' } },
        { college_id: { $regex: queryText, $options: 'i' } },
        { department: { $regex: queryText, $options: 'i' } }
      ]
    }
    if (typeof department === 'string' && department.trim()) {
      filter.department = department.trim()
    }
    if (typeof year === 'string' && year.trim() && !Number.isNaN(parseInt(year))) {
      filter.year = parseInt(year)
    }

    const usersCollection = await getCollection<User>(Collections.USERS)
    const users = await usersCollection.find(filter)
      .sort({ name: 1 })
      .limit(limitNum)
      .skip(offsetNum)
      .toArray()

    // Include follow-state for the requester
    let followingSet: Set<number> = new Set()
    if (users.length > 0) {
      const ids = users.map(u => u.id).filter(Boolean) as number[]
      const followers = await getCollection<Follower>(Collections.FOLLOWERS)
      const myFollowing = await followers.find({
        follower_id: auth.userId,
        following_id: { $in: ids } as any
      }).toArray()
      followingSet = new Set(myFollowing.map(r => r.following_id as number))
    }

    res.status(200).json({
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.college_id, // ContactsList compatibility
        department: user.department,
        year: user.year,
        bio: user.bio,
        profileImageUrl: user.profile_image, // existing consumers
        profile_image: user.profile_image,   // new Connect page
        createdAt: user.created_at,
        is_following: followingSet.has(user.id!)
      }))
    })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}