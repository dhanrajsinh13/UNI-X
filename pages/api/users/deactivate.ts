import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, User, Post, Message, Comment, Aura, Follower, FollowRequest } from '../../../lib/mongodb'
import { getUserFromRequest, rateLimitMiddleware, getClientIp, verifyPassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rate limiting
  const clientIp = getClientIp(req)
  const { allowed, remaining, resetTime } = await rateLimitMiddleware(clientIp, 20, 60)
  
  res.setHeader('X-RateLimit-Limit', '20')
  res.setHeader('X-RateLimit-Remaining', remaining.toString())
  res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString())
  
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }
  
  // Authenticate user
  const auth = getUserFromRequest(req)
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  if (req.method === 'POST') {
    return handleDeactivateAccount(req, res, auth.userId)
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleDeactivateAccount(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const { password } = req.body
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required to deactivate account' })
    }
    
    const users = await getCollection<User>(Collections.USERS)
    
    // Verify user and password
    const user = await withRetry(async () => {
      return users.findOne({ id: userId })
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const isValidPassword = await verifyPassword(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' })
    }
    
    // Mark account as deactivated (soft delete)
    await withRetry(async () => {
      return users.updateOne(
        { id: userId },
        { 
          $set: { 
            is_deactivated: true,
            deactivated_at: new Date()
          } 
        }
      )
    })
    
    res.status(200).json({ 
      message: 'Account deactivated successfully',
      info: 'You can reactivate your account by logging in again within 30 days'
    })
  } catch (error: any) {
    console.error('Deactivate account error:', error)
    res.status(500).json({ error: 'Failed to deactivate account' })
  }
}
