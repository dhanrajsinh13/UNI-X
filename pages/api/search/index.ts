import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, User, Post } from '../../../lib/mongodb'

// Define search results interface
interface SearchUser {
  id: number
  name: string
  username: string
  department?: string
  year?: number
  profile_image?: string
  college_name?: string
  mutualFriends?: number
  isFollowing?: boolean
}

interface SearchPost {
  id: number
  caption: string
  media_url?: string
  media_type?: 'image' | 'video'
  created_at: string
  user: {
    id: number
    name: string
    username: string
    profile_image?: string
  }
}

interface SearchHashtag {
  tag: string
  count: number
}

interface SearchLocation {
  id: string
  name: string
  count: number
}

interface SearchResults {
  users?: SearchUser[]
  posts?: SearchPost[]
  hashtags?: SearchHashtag[]
  locations?: SearchLocation[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { q, type = 'all' } = req.query

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const searchTerm = q.toLowerCase()
    const results: SearchResults = {}

    // Search users - Only search by username (like Instagram web)
    if (type === 'all' || type === 'users') {
      const users = await getCollection<User>(Collections.USERS)
      const userResults = await users.find({
        $or: [
          { username: { $regex: searchTerm, $options: 'i' } },
          { name: { $regex: searchTerm, $options: 'i' } }
        ]
      })
        .limit(15)
        .toArray()

      results.users = userResults.map(u => ({
        id: u.id!,
        name: u.name,
        username: u.username || '',
        department: u.department,
        year: u.year,
        profile_image: u.profile_image,
      }))
    }

    // Posts are not searchable (like Instagram web app)
    // Users can only search for usernames and hashtags
    results.posts = []

    // Search hashtags (extract from post captions)
    if (type === 'all' || type === 'hashtags') {
      try {
        const posts = await getCollection<Post>(Collections.POSTS)

        // Find posts with hashtags matching the search term
        const hashtagRegex = new RegExp(`#${searchTerm}\\w*`, 'gi')
        const postsWithHashtags = await posts.find({
          caption: { $regex: hashtagRegex }
        })
          .limit(100)
          .toArray()

        // Extract and count hashtags
        const hashtagCounts: Record<string, number> = {}
        postsWithHashtags.forEach(post => {
          const hashtags = post.caption?.match(/#\w+/g) || []
          hashtags.forEach(tag => {
            const cleanTag = tag.slice(1).toLowerCase()
            if (cleanTag.includes(searchTerm)) {
              hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1
            }
          })
        })

        results.hashtags = Object.entries(hashtagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      } catch (error) {
        console.error('Hashtag search error:', error)
        results.hashtags = []
      }
    }

    // Search locations (from post locations)
    // Location search - currently disabled as Post model doesn't have location field
    // Uncomment when location field is added to the Post model
    if (type === 'locations') {
      // Placeholder - return empty array for now
      results.locations = []
    }

    res.status(200).json({ results })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
