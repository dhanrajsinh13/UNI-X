import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections } from '../../../../lib/mongodb'
import { getUserFromRequest } from '../../../../lib/auth'

interface Message {
  id: number
  sender_id: number
  receiver_id: number
  message_text: string
  media_url: string | null
  reply_to_id?: number | null
  reaction?: string | null
  deleted_for?: number[]
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

    const { userId } = req.query
    const { page = '1', limit = '50' } = req.query

    // Enhanced validation
    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required' })
    }

    const otherUserId = parseInt(userId as string, 10)
    if (isNaN(otherUserId) || otherUserId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID format' })
    }

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50))
    const offset = (pageNum - 1) * limitNum

    const messages = await getCollection<Message>(Collections.MESSAGES)
    const users = await getCollection<User>(Collections.USERS)

    // Get messages between current user and specified user
    const messageList = await messages.find({
      $or: [
        { sender_id: auth.userId, receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: auth.userId }
      ]
    }).sort({ created_at: -1 }).skip(offset).limit(limitNum).toArray()

    // Get total count for pagination
    const totalCount = await messages.countDocuments({
      $or: [
        { sender_id: auth.userId, receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: auth.userId }
      ]
    })

    // Get user details
    const userIds = [auth.userId, otherUserId]
    const messageUsers = await users.find({ id: { $in: userIds } as any }).toArray()
    const userMap = new Map(messageUsers.map(u => [u.id, u]))

    const otherUser = userMap.get(otherUserId)

    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Build replyTo data for messages
    const messagesWithReply = await Promise.all(messageList.map(async (msg) => {
      let replyTo = null
      if (msg.reply_to_id) {
        const replyToMsg = await messages.findOne({ id: msg.reply_to_id })
        if (replyToMsg) {
          const replyToSender = userMap.get(replyToMsg.sender_id)
          replyTo = {
            id: replyToMsg.id,
            text: replyToMsg.message_text,
            senderName: replyToSender?.name || 'Unknown'
          }
        }
      }

      return {
        id: msg.id,
        senderId: msg.sender_id,
        receiverId: msg.receiver_id,
        messageText: msg.message_text,
        mediaUrl: msg.media_url,
        reaction: msg.reaction || null,
        deleted_for: msg.deleted_for || [],
        createdAt: msg.created_at.toISOString(),
        sender: userMap.get(msg.sender_id) || null,
        receiver: userMap.get(msg.receiver_id) || null,
        replyTo
      }
    }))

    // Create conversation ID
    const conversationId = [auth.userId, otherUserId].sort().join('-')

    res.status(200).json({
      messages: messagesWithReply.reverse(),
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        profile_image: otherUser.profile_image
      },
      conversationId: conversationId,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        hasMore: offset + limitNum < totalCount
      }
    })
  } catch (error) {
    console.error('Get conversation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}