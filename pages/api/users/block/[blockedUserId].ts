import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '../../../../lib/mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JwtPayload {
  userId: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    const userId = decoded.userId;

    const { blockedUserId } = req.query;

    if (!blockedUserId || typeof blockedUserId !== 'string') {
      return res.status(400).json({ message: 'Blocked user ID is required' });
    }

    const blockedUserIdNum = parseInt(blockedUserId);

    const { db } = await connectToDatabase();

    // Remove the block
    const result = await db.collection('blocks').deleteOne({
      blocker_id: userId,
      blocked_user_id: blockedUserIdNum
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Block not found' });
    }

    return res.status(200).json({ message: 'User unblocked successfully' });
  } catch (error: any) {
    console.error('Error unblocking user:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
