import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, serializeDoc } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'

interface User {
  id: number
  name: string
  username: string
  college_id: string
  department: string
  year: string
  bio: string | null
  profile_image: string | null
  is_private: boolean
  created_at: Date
}

interface Post {
  id: number
  user_id: number
  caption: string
  category: string
  media_url: string
  media_type: string
  created_at: Date
}

interface Aura {
  id: number
  user_id: number
  post_id: number
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGetUser(req, res)
  }
  
  if (req.method === 'PUT') {
    return handleUpdateUser(req, res)
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGetUser(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId } = req.query
    const auth = getUserFromRequest(req)

    // If userId is 'me', get current user
    let targetUserId: number
    if (userId === 'me') {
      if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      targetUserId = auth.userId
    } else {
      targetUserId = parseInt(userId as string)
    }

    if (isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    const users = await getCollection<User>(Collections.USERS)
    const posts = await getCollection<Post>(Collections.POSTS)
    const auras = await getCollection<Aura>(Collections.AURAS)
    const comments = await getCollection(Collections.COMMENTS)
    const followers = await getCollection(Collections.FOLLOWERS)
    const followRequests = await getCollection(Collections.FOLLOW_REQUESTS)
    const blocks = await getCollection(Collections.BLOCKS)

    // Get user
    const user = await withRetry(async () => {
      return users.findOne({ id: targetUserId })
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if either user has blocked the other
    if (auth && auth.userId !== targetUserId) {
      const blockExists = await blocks.findOne({
        $or: [
          { blocker_id: auth.userId, blocked_user_id: targetUserId },
          { blocker_id: targetUserId, blocked_user_id: auth.userId }
        ]
      })

      if (blockExists) {
        return res.status(403).json({ 
          error: 'User not accessible',
          blocked: true 
        })
      }
    }

    // Get user's posts
    const userPosts = await withRetry(async () => {
      console.log('🔍 Fetching posts for user:', targetUserId)
      const foundPosts = await posts.find({ user_id: targetUserId }).sort({ created_at: -1 }).limit(20).toArray()
      console.log('📝 Found', foundPosts.length, 'posts for user', targetUserId)
      
      // Debug: Check if posts exist with different field
      const allPosts = await posts.find({}).limit(5).toArray()
      console.log('📊 Sample posts in DB:', allPosts.map(p => ({ id: p.id, user_id: p.user_id, _id: p._id })))
      
      return foundPosts
    })

    // Get auras for these posts
    const postIds = userPosts.map(p => p.id)
    const postAuras = postIds.length > 0 ? await auras.find({ post_id: { $in: postIds } as any }).toArray() : []

    // Get comment counts for posts
    const commentCounts = new Map<number, number>()
    if (postIds.length > 0) {
      const postComments = await comments.find({ post_id: { $in: postIds } as any }).toArray()
      postComments.forEach((c: any) => {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1)
      })
    }

    // Get follower/following counts and status
    const [
      followerCount,
      followingCount,
      isFollowingDoc,
      pendingRequestDoc
    ] = await Promise.all([
      followers.countDocuments({ following_id: targetUserId }),
      followers.countDocuments({ follower_id: targetUserId }),
      auth ? followers.findOne({
        follower_id: auth.userId,
        following_id: targetUserId
      }) : null,
      auth ? followRequests.findOne({
        requester_id: auth.userId,
        target_id: targetUserId
      }) : null
    ])

    // Gate posts if target user is private and viewer is not following
    let canViewPrivate = true
    if (user.is_private) {
      canViewPrivate = !!isFollowingDoc || (!!auth && auth.userId === targetUserId)
    }

    // Transform posts
    const transformedPosts = (canViewPrivate ? userPosts : []).map((post) => {
      const postAuraList = postAuras.filter(a => a.post_id === post.id)
      const auraCount = postAuraList.length
      const commentCount = commentCounts.get(post.id) || 0
      const userLiked = auth ? postAuraList.some(a => a.user_id === auth.userId) : false

      return {
        id: post.id,
        user_id: post.user_id,
        caption: post.caption,
        category: post.category,
        media_url: post.media_url,
        media_type: post.media_type,
        created_at: post.created_at,
        content: post.caption || '',
        aura_count: auraCount,
        comment_count: commentCount,
        user_liked: userLiked,
      }
    })

    const postCount = await posts.countDocuments({ user_id: targetUserId })

    const transformedUser = {
      ...serializeDoc(user),
      posts: transformedPosts,
      follower_count: followerCount,
      following_count: followingCount,
      post_count: postCount,
      is_following: !!isFollowingDoc,
      is_private: user.is_private,
      can_view: canViewPrivate,
      requested: !!pendingRequestDoc && !isFollowingDoc,
    }

    res.status(200).json({ user: transformedUser })
  } catch (error: any) {
    console.error('Get user error:', error.message)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleUpdateUser(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { userId } = req.query
    
    // Users can only update their own profile
    if (userId !== 'me' && parseInt(userId as string) !== auth.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { name, department, year, bio, profile_image, is_private } = req.body

    const users = await getCollection<User>(Collections.USERS)

    const updateData: any = {}
    if (name) updateData.name = name
    if (department) updateData.department = department
    if (year) updateData.year = parseInt(year)
    if (bio !== undefined) updateData.bio = bio
    if (profile_image) updateData.profile_image = profile_image
    if (typeof is_private === 'boolean') updateData.is_private = is_private

    await users.updateOne(
      { id: auth.userId },
      { $set: updateData }
    )

    const updatedUser = await users.findOne({ id: auth.userId })

    res.status(200).json({
      user: {
        id: updatedUser?.id,
        name: updatedUser?.name,
        college_id: updatedUser?.college_id,
        department: updatedUser?.department,
        year: updatedUser?.year,
        bio: updatedUser?.bio,
        profile_image: updatedUser?.profile_image,
        created_at: updatedUser?.created_at,
      },
      message: 'Profile updated successfully'
    })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
