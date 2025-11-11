import { NextApiRequest, NextApiResponse } from 'next';
import { verify } from 'jsonwebtoken';
import { getCollection, Collections } from '../../../../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { authorization } = req.headers;
    const { id: conversationId } = req.query;

    if (!authorization) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    // Verify token
    const decoded = verify(token, process.env.JWT_SECRET!) as { userId: number };
    const userId = decoded.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Parse conversation ID to get user IDs
    const userIds = conversationId.split('-').map(id => parseInt(id));
    
    if (userIds.length !== 2 || !userIds.includes(userId)) {
      return res.status(403).json({ error: 'You can only delete your own conversations' });
    }

    const otherUserId = userIds.find(id => id !== userId);
    const messages = await getCollection(Collections.MESSAGES);

    // Delete all messages between these users
    await messages.deleteMany({
      $or: [
        { sender_id: userId, receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: userId }
      ]
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Conversation deleted successfully' 
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}