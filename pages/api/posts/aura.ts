import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, Post, Aura, withRetry, getNextSequenceValue } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { postId } = req.body

    // Enhanced validation
    if (!postId || (typeof postId !== 'number' && typeof postId !== 'string') || Number(postId) <= 0) {
      return res.status(400).json({ error: 'Valid post ID is required' })
    }

    const validPostId = typeof postId === 'number' ? postId : parseInt(postId, 10)
    if (isNaN(validPostId)) {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }

    const posts = await getCollection<Post>(Collections.POSTS)
    const auras = await getCollection<Aura>(Collections.AURAS)

    // Check if post exists and process aura
    const result = await withRetry(async () => {
      // Check if post exists
      const post = await posts.findOne({ id: validPostId })

      if (!post) {
        return { error: 'Post not found', status: 404 }
      }

      // Check if user already gave aura
      const existingAura = await auras.findOne({
        user_id: auth.userId,
        post_id: validPostId
      })

      let action: 'liked' | 'unliked'
      let isLiked: boolean

      if (existingAura) {
        // Remove aura  
        await auras.deleteOne({
          user_id: auth.userId,
          post_id: validPostId
        })
        action = 'unliked'
        isLiked = false
      } else {
        // Add aura
        const auraId = await getNextSequenceValue('auras')
        await auras.insertOne({
          id: auraId,
          user_id: auth.userId,
          post_id: validPostId,
          created_at: new Date()
        } as any)
        action = 'liked'
        isLiked = true
      }

      // Get updated aura count
      const auraCount = await auras.countDocuments({ post_id: validPostId })

      return {
        post: {
          id: validPostId,
          aura_count: auraCount,
          user_liked: isLiked
        },
        action,
        post_owner_id: post.user_id
      }
    })

    if ('status' in result && result.status === 404) {
      return res.status(404).json({ error: result.error })
    }

    // Send notification outside of transaction to avoid blocking
    if ('post_owner_id' in result && result.action === 'liked' && result.post_owner_id !== auth.userId) {
      try {
        if ((global as any).io) {
          ;(global as any).io.to(`user-${result.post_owner_id}`).emit('notification', {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'like',
            message: 'Someone liked your post',
            time: new Date().toISOString(),
            read: false,
            meta: { postId: validPostId, actorId: auth.userId }
          })
        }
      } catch (notificationError) {
        console.warn('Failed to send notification:', notificationError)
      }
    }

    res.status(200).json({ 
      post: result.post, 
      action: result.action,
      message: `Post ${result.action} successfully` 
    })
  } catch (error) {
    console.error('Toggle aura error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
