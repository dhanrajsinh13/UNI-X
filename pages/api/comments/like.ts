import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, Comment, CommentLike, getNextSequenceValue } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })

    const { commentId } = req.body || {}
    const id = parseInt(commentId)
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'Comment ID is required' })

    const comments = await getCollection<Comment>(Collections.COMMENTS)
    const commentLikes = await getCollection<CommentLike>(Collections.COMMENT_LIKES)

    // Check comment exists and current like status
    const [comment, existing] = await Promise.all([
      comments.findOne({ id }),
      commentLikes.findOne({ user_id: auth.userId, comment_id: id })
    ])

    if (!comment) return res.status(404).json({ error: 'Comment not found' })

    // Toggle like
    if (existing) {
      await commentLikes.deleteOne({
        user_id: auth.userId,
        comment_id: id
      })
    } else {
      const likeId = await getNextSequenceValue('comment_likes')
      await commentLikes.insertOne({
        id: likeId,
        user_id: auth.userId,
        comment_id: id,
        created_at: new Date()
      } as any)
    }

    const newCount = await commentLikes.countDocuments({ comment_id: id })
    const liked = !existing

    return res.status(200).json({ likes: newCount, liked })
  } catch (error) {
    console.error('Toggle comment like error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}


