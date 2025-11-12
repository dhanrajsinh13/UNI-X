import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '../../../lib/mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JwtPayload {
  userId: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

    const { db } = await connectToDatabase();

    // Get blocked users with their details
    const blockedUsers = await db.collection('blocks').aggregate([
      { $match: { blocker_id: userId } },
      {
        $lookup: {
          from: 'users',
          localField: 'blocked_user_id',
          foreignField: 'id',
          as: 'blocked_user'
        }
      },
      { $unwind: '$blocked_user' },
      {
        $project: {
          id: '$_id',
          blocked_user_id: 1,
          created_at: 1,
          'blocked_user.id': 1,
          'blocked_user.name': 1,
          'blocked_user.username': 1,
          'blocked_user.profile_image': 1
        }
      },
      { $sort: { created_at: -1 } }
    ]).toArray();

    return res.status(200).json({ blockedUsers });
  } catch (error: any) {
    console.error('Error fetching blocked users:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
