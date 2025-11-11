import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, withRetry, Collections, User, serializeDoc } from '../../../lib/mongodb'
import { verifyPassword, generateToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { college_id, password } = req.body

    if (!college_id || !password) {
      return res.status(400).json({ error: 'College ID and password are required' })
    }

    // Find user
    const user = await withRetry(async () => {
      const users = await getCollection<User>(Collections.USERS)
      return users.findOne({ college_id })
    })

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Generate token
    const userId = user.id || user._id?.toString()
    const token = generateToken(userId as any)

    // Return user data without password
    const { password_hash: _, ...userWithoutPassword } = serializeDoc(user)

    res.status(200).json({
      user: userWithoutPassword,
      token,
      message: 'Login successful'
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
