import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '../../../../lib/auth';
import { getCollection, Collections } from '../../../../lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    console.log(`[UNSEND] Looking for message ID: ${numericMessageId}`);
    
    if (!message) {
      console.log(`[UNSEND] Message ${numericMessageId} not found in database`);
      // Message might have already been deleted - return success anyway
      return res.status(200).json({ success: true, message: 'Message already removed' });
    }

    console.log(`[UNSEND] Found message from ${message.sender_id} to ${message.receiver_id}`);

    // Check if the user is the sender (MongoDB uses snake_case)
    if (message.sender_id !== decoded.userId) {
      return res.status(403).json({ error: 'You can only unsend your own messages' });
    }

    // Delete the message (unsend for everyone)
    const deleteResult = await messagesCollection.deleteOne({ id: numericMessageId });
    console.log(`[UNSEND] Delete result: ${deleteResult.deletedCount} document(s) deleted`);

    // Get receiver ID for socket event (from message we found earlier)
    const receiverId = message.receiver_id;

    // Emit socket event to notify both users
    try {
      // Use the internal socket server URL (not the public one)
      const socketUrl = process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
      
      console.log(`[UNSEND] Emitting socket event to: ${socketUrl}/emit-message-unsend`);
      
      const socketResponse = await fetch(`${socketUrl}/emit-message-unsend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: numericMessageId,
          senderId: decoded.userId,
          receiverId: receiverId
        })
      });
      
      if (socketResponse.ok) {
        console.log(`[UNSEND] Socket event emitted successfully`);
      } else {
        console.error(`[UNSEND] Socket event failed: ${socketResponse.status}`);
      }
    } catch (e: any) {
      console.error('Socket notification error:', e.message);
      // Socket notification failed, but message was deleted
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error unsending message:', error);
    res.status(500).json({ error: 'Failed to unsend message' });
  }
}
