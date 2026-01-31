import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, User, Post, Message, Comment, Aura, Follower, FollowRequest } from '../../../lib/mongodb'
import { getUserFromRequest, rateLimitMiddleware, getClientIp, verifyPassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Strict rate limiting for delete operations
  const clientIp = getClientIp(req)
  const { allowed, remaining, resetTime } = await rateLimitMiddleware(clientIp, 5, 3600) // 5 requests per hour
  
  res.setHeader('X-RateLimit-Limit', '5')
  res.setHeader('X-RateLimit-Remaining', remaining.toString())
  res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString())
  
  if (!allowed) {
    return res.status(429).json({ error: 'Too many delete requests. Please try again later.' })
  }
  
  // Authenticate user
  const auth = getUserFromRequest(req)
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  if (req.method === 'DELETE') {
    return handleDeleteAccount(req, res, auth.userId)
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleDeleteAccount(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const { password, confirmation } = req.body
    
    if (!password || confirmation !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({ 
        error: 'Password and confirmation text required',
        required_confirmation: 'DELETE MY ACCOUNT'
      })
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
    
    // Delete user data (GDPR compliance)
    await withRetry(async () => {
      const posts = await getCollection<Post>(Collections.POSTS)
      const messages = await getCollection<Message>(Collections.MESSAGES)
      const comments = await getCollection<Comment>(Collections.COMMENTS)
      const auras = await getCollection<Aura>(Collections.AURAS)
      const followers = await getCollection<Follower>(Collections.FOLLOWERS)
      const followRequests = await getCollection<FollowRequest>(Collections.FOLLOW_REQUESTS)
      
      // Delete in parallel for better performance
      await Promise.all([
        posts.deleteMany({ user_id: userId }),
        messages.deleteMany({ $or: [{ sender_id: userId }, { receiver_id: userId }] }),
        comments.deleteMany({ user_id: userId }),
        auras.deleteMany({ user_id: userId }),
        followers.deleteMany({ $or: [{ follower_id: userId }, { following_id: userId }] }),
        followRequests.deleteMany({ $or: [{ requester_id: userId }, { target_id: userId }] }),
        users.deleteOne({ id: userId })
      ])
    })
    
    res.status(200).json({ 
      message: 'Account permanently deleted',
      info: 'All your data has been removed from our servers'
    })
  } catch (error: any) {
    console.error('Delete account error:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
}
