import { NextApiRequest, NextApiResponse } from 'next';
import { verify } from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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
      return res.status(403).json({ error: 'Invalid conversation' });
    }

    // For now, just return success
    // In a real app, you'd remove the read status for this user on recent messages
    return res.status(200).json({ 
      success: true, 
      message: 'Conversation marked as unread' 
    });

  } catch (error) {
    console.error('Mark as unread error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}