import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, Comment, CommentLike, Post, User, getNextSequenceValue, serializeDoc } from '../../lib/mongodb'
import { getUserFromRequest } from '../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Get comments for a specific post
    try {
      const { postId, limit = '20', offset = '0' } = req.query

      if (!postId) {
        return res.status(400).json({ error: 'Post ID is required' })
      }

      console.log('📝 Fetching comments for post:', postId)

      // Get current user for like status
      const auth = getUserFromRequest(req)
      const currentUserId = auth?.userId
      console.log('👤 Current user:', currentUserId)

      const comments = await getCollection<Comment>(Collections.COMMENTS)
      const commentLikes = await getCollection<CommentLike>(Collections.COMMENT_LIKES)
      const users = await getCollection<User>(Collections.USERS)

      // Get top-level comments
      const topComments = await comments.find({
        post_id: parseInt(postId as string),
        parent_id: { $exists: false }
      })
        .sort({ created_at: 1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(offset as string))
        .toArray()

      console.log('💬 Found', topComments.length, 'top-level comments')

      // Get all comment IDs for replies and likes
      const commentIds = topComments.map(c => c.id).filter(Boolean) as number[]
      console.log('🔢 Comment IDs:', commentIds)
      
      // Get replies for these comments
      const replies = commentIds.length > 0 
        ? await comments.find({ parent_id: { $in: commentIds } } as any).sort({ created_at: 1 }).toArray()
        : []
      
      // Get all likes for comments and replies
      const allCommentIds = [...commentIds, ...replies.map(r => r.id).filter(Boolean)] as number[]
      const likes = allCommentIds.length > 0
        ? await commentLikes.find({ comment_id: { $in: allCommentIds } } as any).toArray()
        : []

      
      // Get all unique user IDs
      const userIds = [...new Set([
        ...topComments.map(c => c.user_id),
        ...replies.map(r => r.user_id)
      ])].filter(Boolean) as number[]
      
      console.log('👥 Fetching users:', userIds)
      const usersData = await users.find({ id: { $in: userIds } } as any).toArray()
      console.log('✅ Found', usersData.length, 'users')
      const userMap = new Map(usersData.map(u => [u.id, u]))      // Transform data to match frontend expectations
      const transformedComments = topComments.map((comment: any) => {
        const user = userMap.get(comment.user_id)
        const commentLikesData = likes.filter(l => l.comment_id === comment.id)
        const userLiked = currentUserId ? 
          commentLikesData.some(like => like.user_id === currentUserId) : false
        
        const commentReplies = replies.filter(r => r.parent_id === comment.id)
        
        return {
          id: comment.id,
          user: {
            id: user?.id,
            name: user?.name,
            department: user?.department,
            year: user?.year,
            profile_image: user?.profile_image,
          },
          text: comment.comment_text,
          timestamp: getTimeAgo(comment.created_at),
          created_at: comment.created_at,
          likes: commentLikesData.length,
          userLiked: userLiked,
          replies: commentReplies.map((r: any) => {
            const replyUser = userMap.get(r.user_id)
            const replyLikes = likes.filter(l => l.comment_id === r.id)
            return {
              id: r.id,
              text: r.comment_text,
              user: { 
                id: replyUser?.id, 
                name: replyUser?.name, 
                profile_image: replyUser?.profile_image 
              },
              created_at: r.created_at,
              timestamp: getTimeAgo(r.created_at),
              likes: replyLikes.length,
              userLiked: currentUserId ? 
                replyLikes.some(like => like.user_id === currentUserId) : false
            }
          })
        }
      })

      console.log('📤 Returning', transformedComments.length, 'comments')
      res.status(200).json({ comments: transformedComments })
    } catch (error) {
      console.error('❌ Error fetching comments:', error)
      res.status(500).json({ error: 'Failed to fetch comments' })
    }
  } else if (req.method === 'POST') {
    // Create a new comment
    try {
      const auth = getUserFromRequest(req)
      if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const { postId, comment_text, parent_id } = req.body

      if (!postId || !comment_text) {
        return res.status(400).json({ error: 'Post ID and comment text are required' })
      }

      if (comment_text.trim().length === 0) {
        return res.status(400).json({ error: 'Comment cannot be empty' })
      }

      if (comment_text.length > 2200) {
        return res.status(400).json({ error: 'Comment too long (max 2200 characters)' })
      }

      const posts = await getCollection<Post>(Collections.POSTS)
      const comments = await getCollection<Comment>(Collections.COMMENTS)
      const users = await getCollection<User>(Collections.USERS)

      // Check if post exists
      const post = await posts.findOne({ id: parseInt(postId) })

      if (!post) {
        return res.status(404).json({ error: 'Post not found' })
      }

      // Create the comment
      const commentId = await getNextSequenceValue('comments')
      const newComment: Comment = {
        id: commentId,
        post_id: parseInt(postId),
        user_id: auth.userId,
        comment_text: comment_text.trim(),
        created_at: new Date(),
        ...(parent_id && { parent_id: parseInt(parent_id) })
      }

      await comments.insertOne(newComment as any)

      // Get user data
      const user = await users.findOne({ id: auth.userId })

      // Transform data to match frontend expectations
      const transformedComment = {
        id: commentId,
        user: {
          id: user?.id,
          name: user?.name,
          department: user?.department,
          year: user?.year,
          profile_image: user?.profile_image,
        },
        text: newComment.comment_text,
        timestamp: 'now',
        created_at: newComment.created_at,
      }

      // Notify post owner if commenter is not the owner
      try {
        if (post.user_id && post.user_id !== auth.userId && (global as any).io) {
          ;(global as any).io.to(`user-${post.user_id}`).emit('notification', {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'comment',
            message: 'Someone commented on your post',
            time: new Date().toISOString(),
            read: false,
            meta: { postId: parseInt(postId), actorId: auth.userId, commentId: commentId }
          })
        }
      } catch {}

      res.status(201).json({ comment: transformedComment })
    } catch (error) {
      console.error('Error creating comment:', error)
      res.status(500).json({ error: 'Failed to create comment' })
    }
  } else if (req.method === 'DELETE') {
    try {
      const auth = getUserFromRequest(req)
      if (!auth) return res.status(401).json({ error: 'Unauthorized' })

      const { id } = req.query
      if (!id) return res.status(400).json({ error: 'Comment ID required' })

      const comments = await getCollection<Comment>(Collections.COMMENTS)
      const comment = await comments.findOne({ id: parseInt(id as string) })
      
      if (!comment) return res.status(404).json({ error: 'Comment not found' })
      if (comment.user_id !== auth.userId) return res.status(403).json({ error: 'Forbidden' })

      await comments.deleteOne({ id: comment.id })
      return res.status(204).end()
    } catch (error) {
      console.error('Delete comment error:', error)
      res.status(500).json({ error: 'Failed to delete comment' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
    res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const commentDate = new Date(date)
  const diffInMinutes = Math.floor((now.getTime() - commentDate.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return 'now'
  if (diffInMinutes < 60) return `${diffInMinutes}m`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d`
  
  const diffInWeeks = Math.floor(diffInDays / 7)
  return `${diffInWeeks}w`
}