import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, User, Post } from '../../../lib/mongodb'

// Define search results interface
interface SearchResults {
  users?: Array<{
    id: number;
    name: string;
    department: string;
    year: number;
  }>;
  posts?: Array<{
    id: number;
    content: string;
    category: string;
    author: {
      id: number;
      name: string;
      department: string;
      year: number;
    };
  }>;
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

    // Search users
    if (type === 'all' || type === 'users') {
      const users = await getCollection<User>(Collections.USERS)
      const userResults = await users.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { username: { $regex: searchTerm, $options: 'i' } },
          { department: { $regex: searchTerm, $options: 'i' } },
          { college_id: { $regex: searchTerm, $options: 'i' } },
        ]
      })
        .limit(10)
        .toArray()
      
      results.users = userResults.map(u => ({
        id: u.id!,
        name: u.name,
        username: u.username,
        department: u.department,
        year: u.year,
      }))
    }

    // Search posts
    if (type === 'all' || type === 'posts') {
      try {
        const posts = await getCollection<Post>(Collections.POSTS)
        const users = await getCollection<User>(Collections.USERS)
        
        const postResults = await posts.find({
          caption: { $regex: searchTerm, $options: 'i' }
        })
          .sort({ created_at: -1 })
          .limit(20)
          .toArray()
        
        // Get user data for posts
        const userIds = [...new Set(postResults.map(p => p.user_id))].filter(Boolean) as number[]
        const postUsers = userIds.length > 0
          ? await users.find({ id: { $in: userIds } as any }).toArray()
          : []
        const userMap = new Map(postUsers.map(u => [u.id, u]))
        
        results.posts = postResults.map((post: any) => {
          const author = userMap.get(post.user_id)
          return {
            id: post.id,
            content: post.caption || '',
            category: post.category,
            author: {
              id: author?.id || 0,
              name: author?.name || '',
              department: author?.department || '',
              year: author?.year || 0,
            }
          }
        })
      } catch (error) {
        console.error('Post search error:', error)
        // Skip posts if there's an error
      }
    }

    res.status(200).json({ results })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
