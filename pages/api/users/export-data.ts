import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, User, Post, Message, Comment, serializeDocs } from '../../../lib/mongodb'
import { getUserFromRequest, rateLimitMiddleware, getClientIp } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rate limiting for data export
  const clientIp = getClientIp(req)
  const { allowed, remaining, resetTime } = await rateLimitMiddleware(clientIp, 3, 3600) // 3 requests per hour
  
  res.setHeader('X-RateLimit-Limit', '3')
  res.setHeader('X-RateLimit-Remaining', remaining.toString())
  res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString())
  
  if (!allowed) {
    return res.status(429).json({ error: 'Too many export requests. Please try again later.' })
  }
  
  // Authenticate user
  const auth = getUserFromRequest(req)
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  if (req.method === 'GET') {
    return handleDataExport(req, res, auth.userId)
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleDataExport(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const users = await getCollection<User>(Collections.USERS)
    const posts = await getCollection<Post>(Collections.POSTS)
    const messages = await getCollection<Message>(Collections.MESSAGES)
    const comments = await getCollection<Comment>(Collections.COMMENTS)
    
    // Fetch all user data
    const [user, userPosts, sentMessages, receivedMessages, userComments] = await Promise.all([
      withRetry(async () => users.findOne({ id: userId })),
      withRetry(async () => posts.find({ user_id: userId }).toArray()),
      withRetry(async () => messages.find({ sender_id: userId }).toArray()),
      withRetry(async () => messages.find({ receiver_id: userId }).toArray()),
      withRetry(async () => comments.find({ user_id: userId }).toArray())
    ])
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Remove sensitive data from export
    const { password_hash, ...userWithoutPassword } = user
    
    // Prepare export data (GDPR compliant)
    const exportData = {
      export_date: new Date().toISOString(),
      user_data: userWithoutPassword,
      posts: serializeDocs(userPosts),
      sent_messages: serializeDocs(sentMessages),
      received_messages: serializeDocs(receivedMessages),
      comments: serializeDocs(userComments),
      statistics: {
        total_posts: userPosts.length,
        total_messages_sent: sentMessages.length,
        total_messages_received: receivedMessages.length,
        total_comments: userComments.length
      }
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="uni-x-data-export-${userId}-${Date.now()}.json"`)
    
    res.status(200).json(exportData)
  } catch (error: any) {
    console.error('Data export error:', error)
    res.status(500).json({ error: 'Failed to export data' })
  }
}
