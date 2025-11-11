import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, serializeDoc } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

interface Post {
  id: number
  user_id: number
  caption: string
  category: string
  media_url: string
  media_type: string
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
  const { postId } = req.query

  if (!postId || Array.isArray(postId)) {
    return res.status(400).json({ error: 'Invalid post id' })
  }

  const id = parseInt(postId)
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid post id' })

  if (req.method === 'PUT') {
    try {
      const auth = getUserFromRequest(req)
      if (!auth) return res.status(401).json({ error: 'Unauthorized' })

      const { caption } = req.body || {}
      if (typeof caption !== 'string' || caption.trim().length === 0) {
        return res.status(400).json({ error: 'Caption is required' })
      }

      const posts = await getCollection<Post>(Collections.POSTS)
      const users = await getCollection<User>(Collections.USERS)

      const post = await withRetry(async () => {
        return posts.findOne({ id })
      })
      if (!post) return res.status(404).json({ error: 'Post not found' })
      if (post.user_id !== auth.userId) return res.status(403).json({ error: 'Forbidden' })

      await withRetry(async () => {
        return posts.updateOne({ id }, { $set: { caption: caption.trim() } })
      })

      // Fetch updated post with user data
      const updated = await posts.findOne({ id })
      const user = await users.findOne({ id: updated?.user_id })

      // Get counts
      const auras = await getCollection(Collections.AURAS)
      const comments = await getCollection(Collections.COMMENTS)
      const auraCount = await auras.countDocuments({ post_id: id })
      const commentCount = await comments.countDocuments({ post_id: id })

      const transformed = {
        ...serializeDoc(updated),
        content: updated?.caption || '',
        author: user ? {
          id: user.id,
          name: user.name,
          department: user.department,
          year: user.year,
          profile_image: user.profile_image,
        } : null,
        aura_count: auraCount,
        comment_count: commentCount,
      }

      return res.status(200).json({ post: transformed, message: 'Post updated' })
    } catch (error) {
      console.error('Update post error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const auth = getUserFromRequest(req)
      if (!auth) return res.status(401).json({ error: 'Unauthorized' })

      const posts = await getCollection<Post>(Collections.POSTS)
      
      const post = await withRetry(async () => {
        return posts.findOne({ id })
      })
      if (!post) return res.status(404).json({ error: 'Post not found' })
      if (post.user_id !== auth.userId) return res.status(403).json({ error: 'Forbidden' })

      await withRetry(async () => {
        return posts.deleteOne({ id })
      })
      return res.status(204).end()
    } catch (error) {
      console.error('Delete post error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
