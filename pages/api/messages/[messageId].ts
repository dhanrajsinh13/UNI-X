import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../lib/auth';
import { getCollection, Collections } from '../../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { messageId } = req.query;
    const numericMessageId = parseInt(messageId as string);

    if (isNaN(numericMessageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const messagesCollection = await getCollection(Collections.MESSAGES);

    // Find the message
    const message = await messagesCollection.findOne({ id: numericMessageId });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify the user is part of the conversation
    if (message.sender_id !== decoded.userId && message.receiver_id !== decoded.userId) {
      return res.status(403).json({ error: 'You cannot delete this message' });
    }

    // Mark message as deleted for this user (not removing from database)
    // This way it stays visible for the other person
    await messagesCollection.updateOne(
      { id: numericMessageId },
      { $addToSet: { deleted_for: decoded.userId } }
    );

    // Emit socket event to notify the other user to update their UI
    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.API_BASE_URL || '';
      if (socketUrl) {
        await fetch(`${socketUrl}/emit-message-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: numericMessageId,
            userId: decoded.userId,
            senderId: message.sender_id,
            receiverId: message.receiver_id
          })
        }).catch(() => {}); // Ignore errors
      }
    } catch (e) {
      // Socket notification failed, but message was deleted
    }

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
}
