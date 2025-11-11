import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, withRetry, User, Post, Aura, Comment, Follower, getNextSequenceValue, serializeDoc } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'
import { parseForm, uploadToCloudinary, getFileType } from '../../../lib/upload'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGetPosts(req, res)
  }

  if (req.method === 'POST') {
    return handleCreatePost(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGetPosts(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Authentication optional for reading posts
    const auth = getUserFromRequest(req)

    const { category, limit = '20', offset = '0' } = req.query

    // Map frontend category values to database enum values
    const categoryMap: { [key: string]: string } = {
      'general': 'GENERAL',
      'academic': 'ACADEMIC',
      'events': 'EVENTS',
      'event': 'EVENT', // Support both singular and plural
      'clubs': 'CLUBS',
      'sports': 'SPORTS',
      'social': 'SOCIAL',
      'internship': 'INTERNSHIP',
      'workshop': 'WORKSHOP',
      'library': 'LIBRARY_MEMORY',
      'library_memory': 'LIBRARY_MEMORY',
      'memory': 'LIBRARY_MEMORY',
    }

    const posts = await getCollection<Post>(Collections.POSTS)
    const users = await getCollection<User>(Collections.USERS)
    const comments = await getCollection<Comment>(Collections.COMMENTS)
    const auras = await getCollection<Aura>(Collections.AURAS)
    const followers = await getCollection<Follower>(Collections.FOLLOWERS)

    // Convert category using mapping instead of just uppercase
    const filter: any = {}
    if (category && category !== 'all') {
      filter.category = categoryMap[(category as string).toLowerCase()] || 'GENERAL'
    }

    // If viewing another user's posts and they are private and not followed, gate results
    const viewingUserId = (req.query as any).userId ? parseInt((req.query as any).userId) : undefined
    if (viewingUserId && !isNaN(viewingUserId)) {
      const target = await users.findOne({ id: viewingUserId })
      if (target?.is_private) {
        const following = auth ? await followers.findOne({ 
          follower_id: auth.userId, 
          following_id: viewingUserId 
        }) : null
        if (!following && (!auth || auth.userId !== viewingUserId)) {
          // Return empty posts for unauthorized viewers of private profile
          res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
          return res.status(200).json({ posts: [] })
        }
      }
      filter.user_id = viewingUserId
    }

    const postList = await withRetry(async () => {
      return posts.find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(offset as string))
        .toArray()
    })

    if (postList.length === 0) {
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
      return res.status(200).json({ posts: [] })
    }

    // Get all unique user IDs and post IDs
    const userIds = [...new Set(postList.map(p => p.user_id))].filter(Boolean) as number[]
    const postIds = postList.map(p => p.id).filter(Boolean) as number[]
    
    console.log('📊 Posts data:', {
      totalPosts: postList.length,
      userIds: userIds,
      postIds: postIds,
      samplePost: postList[0] ? { id: postList[0].id, user_id: postList[0].user_id, caption: postList[0].caption?.substring(0, 30) } : null
    })

    // Fetch related data in parallel
    const [postUsers, postComments, postAuras, likedPosts] = await Promise.all([
      users.find({ id: { $in: userIds } as any }).toArray(),
      comments.find({ post_id: { $in: postIds } as any }).toArray(),
      auras.find({ post_id: { $in: postIds } as any }).toArray(),
      auth ? auras.find({ user_id: auth.userId, post_id: { $in: postIds } as any }).toArray() : Promise.resolve([])
    ])

    // Create lookup maps
    const userMap = new Map(postUsers.map(u => [u.id, u]))
    const likedPostIdSet = new Set(likedPosts.map(l => l.post_id))
    
    console.log('👥 Users fetched:', {
      totalUsers: postUsers.length,
      userMapKeys: Array.from(userMap.keys()),
      sampleUser: postUsers[0] ? { id: postUsers[0].id, name: postUsers[0].name } : null
    })

    // Get comment users
    const commentUserIds = [...new Set(postComments.map(c => c.user_id))].filter(Boolean) as number[]
    const commentUsers = commentUserIds.length > 0
      ? await users.find({ id: { $in: commentUserIds } as any }).toArray()
      : []
    const commentUserMap = new Map(commentUsers.map(u => [u.id, u]))

    // Transform posts with all related data
    const transformedPosts = postList.map((post: any) => {
      const author = userMap.get(post.user_id)
      
      // Debug logging for missing authors
      if (!author) {
        console.warn('⚠️ Missing author for post:', post.id, 'user_id:', post.user_id)
        console.warn('Available users in map:', Array.from(userMap.keys()))
      }
      
      const postCommentsData = postComments
        .filter(c => c.post_id === post.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .map(c => {
          const commentUser = commentUserMap.get(Number(c.user_id))
          return {
            id: c.id,
            comment_text: c.comment_text,
            created_at: c.created_at,
            user: {
              id: commentUser?.id,
              name: commentUser?.name || 'Unknown User',
              department: commentUser?.department || 'Unknown',
              year: commentUser?.year || 1,
            }
          }
        })

      const auraCount = postAuras.filter(a => a.post_id === post.id).length
      const commentCount = postComments.filter(c => c.post_id === post.id).length

      return {
        ...serializeDoc(post),
        content: post.caption || '',
        user: {
          id: author?.id || post.user_id,
          name: author?.name || 'Unknown User',
          department: author?.department || 'Unknown',
          year: author?.year || 1,
          profile_image: author?.profile_image || null,
        },
        author: {
          id: author?.id || post.user_id,
          name: author?.name || 'Unknown User',
          department: author?.department || 'Unknown',
          year: author?.year || 1,
          profile_image: author?.profile_image || null,
        },
        aura_count: auraCount,
        comment_count: commentCount,
        user_liked: auth ? likedPostIdSet.has(post.id) : false,
        recent_comments: postCommentsData,
        comments: postCommentsData,
        _count: {
          comments: commentCount,
          auras: auraCount,
        }
      }
    })

    // Small cache to improve perceived performance
    res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
    res.status(200).json({ posts: transformedPosts })
  } catch (error) {
    console.error('Get posts error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleCreatePost(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔄 Post creation started at:', new Date().toISOString())
  console.log('📊 Environment check:', {
    CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING',
    CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING',
    CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING',
  })

  try {
    // Verify authentication
    const auth = getUserFromRequest(req)
    if (!auth) {
      console.log('❌ Authentication failed')
      return res.status(401).json({ error: 'Unauthorized' })
    }
    console.log('✅ Authentication successful for user:', auth.userId)

    // Parse form data
    console.log('📝 Parsing form data...')
    const { fields, files } = await parseForm(req)
    console.log('✅ Form parsed. Fields:', Object.keys(fields), 'Files:', Object.keys(files))

    // Accept either caption or legacy content field
    const captionField = Array.isArray(fields.caption) ? fields.caption[0] : fields.caption
    const legacyContentField = Array.isArray(fields.content) ? fields.content[0] : fields.content
    const caption = (captionField ?? legacyContentField ?? '').toString()
    const categoryInput = Array.isArray(fields.category) ? fields.category[0] : fields.category || 'general'

    console.log('📝 Parsed data:', { caption: caption.substring(0, 50) + '...', categoryInput })

    // Map category to valid enum values
    const categoryMap: { [key: string]: string } = {
      'general': 'GENERAL',
      'academic': 'ACADEMIC',
      'events': 'EVENTS',
      'event': 'EVENT',
      'clubs': 'CLUBS',
      'sports': 'SPORTS',
      'social': 'SOCIAL',
      'internship': 'INTERNSHIP',
      'workshop': 'WORKSHOP',
      'library': 'LIBRARY_MEMORY',
      'library_memory': 'LIBRARY_MEMORY',
      'memory': 'LIBRARY_MEMORY',
    }

    const category = categoryMap[categoryInput.toLowerCase()] || 'GENERAL'

    let mediaUrl = null
    let mediaType = 'NONE'

    // Handle file upload if present
    if (files.media) {
      console.log('📁 Processing file upload...')
      const file = Array.isArray(files.media) ? files.media[0] : files.media
      if (file && file.filepath) {
        console.log('📁 File details:', {
          originalFilename: file.originalFilename,
          filepath: file.filepath,
          size: file.size
        })

        const fileType = getFileType(file.originalFilename || '')
        console.log('📁 File type detected:', fileType)

        if (fileType !== 'unknown') {
          try {
            console.log('☁️ Uploading to Cloudinary...')
            const uploadResult = await uploadToCloudinary(file.filepath, fileType)

            if (uploadResult && uploadResult.url) {
              mediaUrl = uploadResult.url
              mediaType = fileType === 'image' ? 'IMAGE' : 'VIDEO'
              console.log('✅ Upload successful:', mediaUrl)
            } else {
              console.warn('⚠️ Upload returned invalid result:', uploadResult)
              mediaUrl = null
              mediaType = 'NONE'
            }
          } catch (uploadError) {
            console.error('❌ Upload failed:', uploadError)
            return res.status(500).json({
              error: 'File upload failed',
              details: uploadError instanceof Error ? uploadError.message : 'Unknown upload error',
              cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
            })
          }
        } else {
          console.log('❌ Unknown file type')
          return res.status(400).json({ error: 'Unsupported file type' })
        }
      }
    }

    // Validate required fields
    if (!caption || caption.trim().length === 0) {
      console.log('❌ Validation failed: Caption is required')
      return res.status(400).json({ error: 'Caption is required' })
    }
    if (!mediaUrl) {
      console.log('❌ Validation failed: Media file is required')
      return res.status(400).json({ error: 'Media file is required for posts' })
    }
    if (!auth.userId) {
      console.log('❌ Validation failed: User ID is required')
      return res.status(400).json({ error: 'User ID is required' })
    }
    if (!category) {
      console.log('❌ Validation failed: Category is required')
      return res.status(400).json({ error: 'Category is required' })
    }

    console.log('✅ All validations passed')

    // Create post in MongoDB
    console.log('🗄️ Creating post in database...')
    const posts = await getCollection<Post>(Collections.POSTS)
    const users = await getCollection<User>(Collections.USERS)
    
    let post
    try {
      const postId = await getNextSequenceValue('posts')
      const newPost: Post = {
        id: postId,
        user_id: auth.userId,
        caption: caption.trim(),
        category: category as any,
        media_url: String(mediaUrl),
        media_type: mediaType as any,
        created_at: new Date(),
      }

      await withRetry(async () => {
        return posts.insertOne(newPost as any)
      })

      // Fetch the created post with user data
      const createdPost = await posts.findOne({ id: postId })
      const postUser = await users.findOne({ id: auth.userId })

      post = {
        ...serializeDoc(createdPost),
        user: postUser ? {
          id: postUser.id,
          name: postUser.name,
          department: postUser.department,
          year: postUser.year,
          profile_image: postUser.profile_image,
        } : null,
        _count: {
          auras: 0,
          comments: 0,
        }
      }

      console.log('✅ Post created successfully with ID:', postId)
    } catch (mongoError: any) {
      console.error('❌ MongoDB create error:', mongoError)
      return res.status(400).json({ error: 'Failed to create post', details: mongoError.message })
    }

    const transformedPost = {
      ...post,
      content: post.caption || '',
      author: post.user,
      aura_count: 0,
      comment_count: 0,
      user_liked: false,
    }

    console.log('✅ Post creation completed successfully')
    res.status(201).json({ post: transformedPost, message: 'Post created successfully' })
  } catch (error) {
    console.error('❌ Create post error:', error)
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}
