import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, User, serializeDoc } from '../../../lib/mongodb'
import { getUserFromRequest, rateLimitMiddleware, getClientIp } from '../../../lib/auth'
import { validatePrivacySettings } from '../../../lib/validation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rate limiting
  const clientIp = getClientIp(req)
  const { allowed, remaining, resetTime } = await rateLimitMiddleware(clientIp, 100, 60)
  
  res.setHeader('X-RateLimit-Limit', '100')
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
  
  if (req.method === 'GET') {
    return handleGetPrivacySettings(req, res, auth.userId)
  }
  
  if (req.method === 'PUT') {
    return handleUpdatePrivacySettings(req, res, auth.userId)
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGetPrivacySettings(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const users = await getCollection<User>(Collections.USERS)
    
    const user = await withRetry(async () => {
      return users.findOne({ id: userId })
    })
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Return privacy settings (with defaults if not set)
    const privacySettings = {
      is_private: user.is_private || false,
      show_online_status: (user as any).show_online_status !== false, // Default true
      show_read_receipts: (user as any).show_read_receipts !== false, // Default true
      who_can_message: (user as any).who_can_message || 'everyone', // 'everyone' | 'followers'
      who_can_comment: (user as any).who_can_comment || 'everyone', // 'everyone' | 'followers'
    }
    
    res.status(200).json({ privacy: privacySettings })
  } catch (error: any) {
    console.error('Get privacy settings error:', error)
    res.status(500).json({ error: 'Failed to retrieve privacy settings' })
  }
}

async function handleUpdatePrivacySettings(req: NextApiRequest, res: NextApiResponse, userId: number) {
  try {
    const updates = req.body
    
    // Validate input
    const validation = validatePrivacySettings(updates)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }
    
    const users = await getCollection<User>(Collections.USERS)
    
    // Build update object
    const updateDoc: any = {}
    if (typeof updates.is_private === 'boolean') {
      updateDoc.is_private = updates.is_private
    }
    if (typeof updates.show_online_status === 'boolean') {
      updateDoc.show_online_status = updates.show_online_status
    }
    if (typeof updates.show_read_receipts === 'boolean') {
      updateDoc.show_read_receipts = updates.show_read_receipts
    }
    if (updates.who_can_message && ['everyone', 'followers'].includes(updates.who_can_message)) {
      updateDoc.who_can_message = updates.who_can_message
    }
    if (updates.who_can_comment && ['everyone', 'followers'].includes(updates.who_can_comment)) {
      updateDoc.who_can_comment = updates.who_can_comment
    }
    
    // Update user
    const result = await withRetry(async () => {
      return users.findOneAndUpdate(
        { id: userId },
        { $set: updateDoc },
        { returnDocument: 'after' }
      )
    })
    
    if (!result) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Return updated privacy settings
    const updatedUser = result as any
    const privacySettings = {
      is_private: updatedUser.is_private || false,
      show_online_status: updatedUser.show_online_status !== false,
      show_read_receipts: updatedUser.show_read_receipts !== false,
      who_can_message: updatedUser.who_can_message || 'everyone',
      who_can_comment: updatedUser.who_can_comment || 'everyone',
    }
    
    res.status(200).json({ 
      privacy: privacySettings,
      message: 'Privacy settings updated successfully'
    })
  } catch (error: any) {
    console.error('Update privacy settings error:', error)
    res.status(500).json({ error: 'Failed to update privacy settings' })
  }
}
