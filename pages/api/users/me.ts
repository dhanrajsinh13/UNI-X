import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, User, Post, Aura, Comment, Follower, serializeDoc, withRetry } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = getUserFromRequest(req)
  if (!auth) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      res.setHeader('Cache-Control', 'private, max-age=30') // Cache for 30 seconds
      
      // Use withRetry for critical database operations
      const [users, posts, auras, comments, followers] = await Promise.all([
        withRetry(() => getCollection<User>(Collections.USERS)),
        withRetry(() => getCollection<Post>(Collections.POSTS)),
        withRetry(() => getCollection<Aura>(Collections.AURAS)),
        withRetry(() => getCollection<Comment>(Collections.COMMENTS)),
        withRetry(() => getCollection<Follower>(Collections.FOLLOWERS))
      ])

      // Load current user
      const rawUser = await withRetry(() => users.findOne({ id: auth.userId }))
      
      if (!rawUser) return res.status(404).json({ error: 'User not found' })

      // Get user's posts with retry
      const userPosts = await withRetry(() => 
        posts.find({ user_id: auth.userId })
          .sort({ created_at: -1 })
          .limit(20)
          .toArray()
      )

      // Get counts for each post
      const postIds = userPosts.map(p => p.id).filter(Boolean) as number[]
      
      const [postAuras, postComments, followerCount, followingCount, postCount] = await Promise.all([
        postIds.length > 0 
          ? withRetry(() => auras.find({ post_id: { $in: postIds } as any }).toArray())
          : Promise.resolve([]),
        postIds.length > 0
          ? withRetry(() => comments.find({ post_id: { $in: postIds } as any }).toArray())
          : Promise.resolve([]),
        withRetry(() => followers.countDocuments({ following_id: auth.userId })),
        withRetry(() => followers.countDocuments({ follower_id: auth.userId })),
        withRetry(() => posts.countDocuments({ user_id: auth.userId }))
      ])

      // Transform posts with counts
      const transformedPosts = userPosts.map((post: any) => {
        const auraCount = postAuras.filter(a => a.post_id === post.id).length
        const commentCount = postComments.filter(c => c.post_id === post.id).length
        
        return {
          ...serializeDoc(post),
          content: post.caption || '',
          aura_count: auraCount,
          comment_count: commentCount,
          user_liked: false,
        }
      })

      const user = {
        ...serializeDoc(rawUser),
        posts: transformedPosts,
        follower_count: followerCount,
        following_count: followingCount,
        post_count: postCount,
        is_following: false,
        can_view: true,
      }

      return res.status(200).json({ user })
    } catch (e: any) {
      console.error('❌ Error loading user profile:', e.message)
      
      // Try to at least return basic user info
      try {
        const users = await withRetry(() => getCollection<User>(Collections.USERS))
        const base = await withRetry(() => users.findOne({ id: auth.userId }))
        
        if (!base) return res.status(404).json({ error: 'User not found' })
        
        return res.status(200).json({ 
          user: { 
            ...serializeDoc(base), 
            posts: [], 
            follower_count: 0, 
            following_count: 0, 
            post_count: 0, 
            is_following: false, 
            is_private: false, 
            can_view: true 
          } 
        })
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError)
        return res.status(500).json({ error: 'Failed to load profile' })
      }
    }
  }

  if (req.method === 'PUT') {
    const { name, bio, profile_image, username, is_private } = req.body as any

    const users = await getCollection<User>(Collections.USERS)

    // Enforce username cooldown (30 days)
    if (typeof username === 'string') {
      const current = await users.findOne({ id: auth.userId })
      
      // Only check cooldown if username is actually being changed
      if (current?.username && username !== current.username) {
        const now = new Date()
        const last = current?.username_changed_at ? new Date(current.username_changed_at) : null
        
        // Only enforce cooldown if user has changed username before
        if (last) {
          const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < 30) {
            return res.status(400).json({ error: `You can change your username again in ${30 - diffDays} days` })
          }
        }
        
        // Check uniqueness only if username is changing
        const exists = await users.findOne({ username, id: { $ne: auth.userId } as any })
        if (exists) return res.status(400).json({ error: 'Username is already taken' })
      }
    }

    // Build update object
    const updateData: any = {}
    if (typeof name === 'string' && name.trim()) updateData.name = name.trim()
    if (typeof bio === 'string') updateData.bio = bio
    if (typeof profile_image === 'string') updateData.profile_image = profile_image
    if (typeof is_private === 'boolean') updateData.is_private = is_private
    
    // Only update username_changed_at if username is actually being changed
    if (typeof username === 'string') {
      const current = await users.findOne({ id: auth.userId })
      if (!current?.username || username !== current.username) {
        // Username is being set for first time or is being changed
        updateData.username = username
        updateData.username_changed_at = new Date()
      }
    }

    // Update user
    await users.updateOne(
      { id: auth.userId },
      { $set: updateData }
    )

    // Fetch updated user
    const updated = await users.findOne({ id: auth.userId })
    
    return res.status(200).json({ 
      user: serializeDoc(updated), 
      message: 'Profile updated successfully' 
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}


