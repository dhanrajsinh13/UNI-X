import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

interface User {
  id: number
  name: string
  department: string
  year: string
  profile_image: string | null
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
  const auth = getUserFromRequest(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    // List incoming follow requests for current user
    const followRequests = await getCollection<FollowRequest>(Collections.FOLLOW_REQUESTS)
    const users = await getCollection<User>(Collections.USERS)

    const requests = await followRequests.find({ target_id: auth.userId }).toArray()
    
    // Get requester details
    const requesterIds = requests.map(r => r.requester_id)
    const requesters = requesterIds.length > 0 
      ? await users.find({ id: { $in: requesterIds } as any }).toArray()
      : []

    const requesterMap = new Map(requesters.map(u => [u.id, u]))

    const result = requests.map(r => ({
      ...r,
      requester: requesterMap.get(r.requester_id) || null
    }))

    return res.status(200).json({ requests: result })
  }

  if (req.method === 'POST') {
    const { requestId, action } = req.body as { requestId?: number, action?: 'approve' | 'reject' }
    if (!requestId || !action) return res.status(400).json({ error: 'requestId and action required' })

    const followRequests = await getCollection<FollowRequest>(Collections.FOLLOW_REQUESTS)
    const followers = await getCollection<Follower>(Collections.FOLLOWERS)

    const fr = await followRequests.findOne({ id: requestId })
    if (!fr || fr.target_id !== auth.userId) return res.status(404).json({ error: 'Request not found' })

    if (action === 'reject') {
      await followRequests.deleteOne({ id: requestId })
      return res.status(200).json({ message: 'Request rejected' })
    }

    // Approve: create follower and delete request
    const exists = await followers.findOne({
      follower_id: fr.requester_id,
      following_id: fr.target_id
    })

    if (!exists) {
      await followers.insertOne({
        follower_id: fr.requester_id,
        following_id: fr.target_id
      } as any)
    }

    await followRequests.deleteOne({ id: requestId })

    return res.status(200).json({ message: 'Request approved' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
