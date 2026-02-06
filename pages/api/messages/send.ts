import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, getNextSequenceValue } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

// Extend global to include io
declare global {
  var io: any
}

interface Message {
  id: number
  sender_id: number
  receiver_id: number
  message_text: string
  media_url: string | null
  post_id?: number | null
  created_at: Date
}

interface User {
  id: number
  name: string
  profile_image: string | null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { receiverId, messageText, mediaUrl, postId } = req.body

    if (!receiverId || (!messageText && !mediaUrl && !postId)) {
      return res.status(400).json({ error: 'Receiver ID and message content are required' })
    }

    const users = await getCollection<User>(Collections.USERS)
    const messages = await getCollection<Message>(Collections.MESSAGES)
    const blocks = await getCollection(Collections.BLOCKS)

    // Verify receiver exists
    const receiver = await users.findOne({ id: parseInt(receiverId) })

    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' })
    }

    // Can't message yourself
    if (parseInt(receiverId) === auth.userId) {
      return res.status(400).json({ error: 'Cannot send message to yourself' })
    }

    // Check if either user has blocked the other
    const blockExists = await blocks.findOne({
      $or: [
        { blocker_id: auth.userId, blocked_user_id: parseInt(receiverId) },
        { blocker_id: parseInt(receiverId), blocked_user_id: auth.userId }
      ]
    })

    if (blockExists) {
      return res.status(403).json({ error: 'Cannot send message to this user' })
    }

    // Get sender info
    const sender = await users.findOne({ id: auth.userId })

    // Create the message
    const messageId = await getNextSequenceValue('messages')
    const newMessage: Message = {
      id: messageId,
      sender_id: auth.userId,
      receiver_id: parseInt(receiverId),
      message_text: messageText || '',
      media_url: mediaUrl || null,
      post_id: postId ? parseInt(postId) : null,
      created_at: new Date()
    }

    await messages.insertOne(newMessage as any)

    // Create conversation ID (consistent regardless of who sends first)
    const conversationId = [auth.userId, parseInt(receiverId)].sort().join('-')

    // Emit real-time message via Socket.io
    if (global.io) {
      const messageData = {
        id: newMessage.id,
        senderId: newMessage.sender_id,
        receiverId: newMessage.receiver_id,
        messageText: newMessage.message_text,
        mediaUrl: newMessage.media_url,
        postId: newMessage.post_id,
        createdAt: newMessage.created_at.toISOString(),
        sender: sender,
        receiver: receiver,
        conversationId: conversationId
      }

      // Send to conversation room
      global.io.to(`conversation-${conversationId}`).emit('new-message', messageData)
      
      // Send notification to receiver
      global.io.to(`user-${receiverId}`).emit('message-notification', {
        ...messageData,
        type: 'new-message'
      })
    }

    res.status(201).json({
      message: 'Message sent successfully',
      data: {
        id: newMessage.id,
        senderId: newMessage.sender_id,
        receiverId: newMessage.receiver_id,
        messageText: newMessage.message_text,
        mediaUrl: newMessage.media_url,
        postId: newMessage.post_id,
        createdAt: newMessage.created_at.toISOString(),
        sender: sender,
        receiver: receiver,
        conversationId: conversationId
      }
    })
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}