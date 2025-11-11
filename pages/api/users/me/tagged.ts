import { NextApiRequest, NextApiResponse } from 'next'
import { getUserFromRequest } from '../../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // For now, return empty array since we don't have user tagging functionality yet
    // TODO: Implement user tagging feature
    const posts: any[] = []

    res.status(200).json({ posts })
  } catch (error) {
    console.error('Get tagged posts error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}