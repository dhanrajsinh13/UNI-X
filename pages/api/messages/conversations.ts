import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

interface Message {
  id: number
  sender_id: number
  receiver_id: number
  message_text: string
  media_url: string | null
  created_at: Date
}

interface User {
  id: number
  name: string
  profile_image: string | null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const messages = await getCollection<Message>(Collections.MESSAGES)
    const users = await getCollection<User>(Collections.USERS)

    // Get all messages where user is sender or receiver
    const conversations = await messages.find({
      $or: [
        { sender_id: auth.userId },
        { receiver_id: auth.userId }
      ]
    }).sort({ created_at: -1 }).toArray()

    // Get unique user IDs
    const userIds = new Set<number>()
    conversations.forEach(m => {
      userIds.add(m.sender_id)
      userIds.add(m.receiver_id)
    })

    const messageUsers = await users.find({ id: { $in: Array.from(userIds) } as any }).toArray()
    const userMap = new Map(messageUsers.map(u => [u.id, u]))

    // Group messages by conversation partner
    const conversationMap = new Map()

    conversations.forEach(message => {
      const otherUserId = message.sender_id === auth.userId ? message.receiver_id : message.sender_id
      const otherUser = userMap.get(otherUserId)

      if (!conversationMap.has(otherUserId) && otherUser) {
        const conversationId = [auth.userId, otherUserId].sort().join('-')
        
        conversationMap.set(otherUserId, {
          conversationId: conversationId,
          otherUser: {
            id: otherUser.id,
            name: otherUser.name,
            profile_image: otherUser.profile_image
          },
          lastMessage: {
            id: message.id,
            text: message.message_text || '',
            mediaUrl: message.media_url,
            createdAt: message.created_at.toISOString(),
            senderId: message.sender_id,
            isFromMe: message.sender_id === auth.userId
          },
          unreadCount: 0 // TODO: Implement read status tracking
        })
      }
    })

    // Convert map to array
    const conversationList = Array.from(conversationMap.values())

    res.status(200).json({
      conversations: conversationList
    })
  } catch (error) {
    console.error('Get conversations error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}