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
    const { emoji } = req.body;

    const numericMessageId = parseInt(messageId as string);

    if (isNaN(numericMessageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    // Allow null to remove reaction
    if (emoji !== null && (typeof emoji !== 'string' || !emoji)) {
      return res.status(400).json({ error: 'Emoji must be a string or null' });
    }

    const messagesCollection = await getCollection(Collections.MESSAGES);

    // Find the message
    const message = await messagesCollection.findOne({ id: numericMessageId });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Update message with reaction (or remove if null)
    const updatedMessage = await messagesCollection.findOneAndUpdate(
      { id: numericMessageId },
      emoji === null 
        ? { $unset: { reaction: "" } }
        : { $set: { reaction: emoji } },
      { returnDocument: 'after' }
    );

    res.status(200).json({ message: updatedMessage });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
}
