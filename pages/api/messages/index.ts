import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, getNextSequenceValue } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

interface Message {
  id: number
  sender_id: number
  receiver_id: number
  message_text: string
  media_url: string | null
  reply_to_id?: number | null
  created_at: Date
}

interface User {
  id: number
  name: string
  department: string
  year: string
  profile_image: string | null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGetMessages(req, res)
  }
  
  if (req.method === 'POST') {
    return handleSendMessage(req, res)
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGetMessages(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { userId } = req.query
    const messages = await getCollection<Message>(Collections.MESSAGES)
    const users = await getCollection<User>(Collections.USERS)

    if (!userId) {
      // Get all conversations for the user
      const allMessages = await messages.find({
        $or: [
          { sender_id: auth.userId },
          { receiver_id: auth.userId }
        ]
      }).sort({ created_at: -1 }).limit(50).toArray()

      // Get unique user IDs
      const userIds = new Set<number>()
      allMessages.forEach(m => {
        userIds.add(m.sender_id)
        userIds.add(m.receiver_id)
      })

      const messageUsers = await users.find({ id: { $in: Array.from(userIds) } as any }).toArray()
      const userMap = new Map(messageUsers.map(u => [u.id, u]))

      const conversations = allMessages.map(m => ({
        ...m,
        sender: userMap.get(m.sender_id) || null,
        receiver: userMap.get(m.receiver_id) || null,
      }))

      return res.status(200).json({ conversations })
    }

    // Get messages between current user and specific user
    const targetUserId = parseInt(userId as string)
    const messageList = await messages.find({
      $or: [
        { sender_id: auth.userId, receiver_id: targetUserId },
        { sender_id: targetUserId, receiver_id: auth.userId }
      ]
    }).sort({ created_at: 1 }).toArray()

    // Get user details
    const messageUsers = await users.find({
      id: { $in: [auth.userId, targetUserId] } as any
    }).toArray()
    const userMap = new Map(messageUsers.map(u => [u.id, u]))

    const result = messageList.map(m => ({
      ...m,
      sender: userMap.get(m.sender_id) || null,
      receiver: userMap.get(m.receiver_id) || null,
    }))

    res.status(200).json({ messages: result })
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleSendMessage(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { receiverId, messageText, replyToId, isMeta = false } = req.body

    if (!receiverId || !messageText) {
      return res.status(400).json({ error: 'Receiver ID and message text are required' })
    }

    const users = await getCollection<User>(Collections.USERS)
    const messages = await getCollection<Message>(Collections.MESSAGES)

    // Check if receiver exists
    const receiver = await users.findOne({ id: parseInt(receiverId) })

    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' })
    }

    // Get sender
    const sender = await users.findOne({ id: auth.userId })

    // If replying, get the original message
    let replyToMessage = null
    if (replyToId) {
      replyToMessage = await messages.findOne({ id: parseInt(replyToId) })
      if (replyToMessage) {
        const replyToSender = await users.findOne({ id: replyToMessage.sender_id })
        replyToMessage = {
          id: replyToMessage.id,
          text: replyToMessage.message_text,
          senderName: replyToSender?.name || 'Unknown'
        }
      }
    }

    // Create message
    const messageId = await getNextSequenceValue('messages')
    const newMessage: Message = {
      id: messageId,
      sender_id: auth.userId,
      receiver_id: parseInt(receiverId),
      message_text: messageText,
      media_url: null,
      reply_to_id: replyToId ? parseInt(replyToId) : null,
      created_at: new Date()
    }

    await messages.insertOne(newMessage as any)

    const result = {
      ...newMessage,
      sender: sender ? {
        id: sender.id,
        name: sender.name,
        department: sender.department,
        year: sender.year,
        profile_image: sender.profile_image
      } : null,
      receiver: {
        id: receiver.id,
        name: receiver.name,
        department: receiver.department,
        year: receiver.year,
        profile_image: receiver.profile_image
      },
      replyTo: replyToMessage
    }

    res.status(201).json({ message: result, success: 'Message sent successfully' })
  } catch (error) {
    console.error('Send message error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}