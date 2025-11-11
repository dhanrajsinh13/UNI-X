import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, withRetry, Collections, User, getNextSequenceValue, serializeDoc } from '../../../lib/mongodb'
import { hashPassword, generateToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('🔄 Registration attempt started at:', new Date().toISOString())
  console.log('📊 Environment check:', {
    MONGODB_URI: !!process.env.MONGODB_URI ? 'SET' : 'MISSING',
    JWT_SECRET: !!process.env.JWT_SECRET ? 'SET' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV
  })

  try {
    const { name, username, email, college_id, password, department, year, bio, profile_image } = req.body
    console.log('📝 Registration data received:', { name, username, email, college_id, department, year })

    // Validate required fields
    if (!name || !username || !email || !college_id || !password || !department || !year) {
      console.log('❌ Validation failed: Missing required fields')
      return res.status(400).json({ error: 'All fields are required' })
    }

    console.log('🔍 Checking for existing user with college_id:', college_id)
    
    const users = await getCollection<User>(Collections.USERS)
    
    // Check if user already exists
    const existingUser = await withRetry(async () => {
      return users.findOne({ college_id })
    })

    if (existingUser) {
      console.log('❌ User already exists with college_id:', college_id)
      return res.status(400).json({ error: 'User already exists with this college ID' })
    }

    console.log('🔍 Checking username uniqueness:', username)
    // Check username uniqueness
    if (username) {
      const existingUsername = await withRetry(async () => {
        return users.findOne({ username })
      })
      if (existingUsername) {
        console.log('❌ Username already taken:', username)
        return res.status(400).json({ error: 'Username is already taken' })
      }
    }

    console.log('🔍 Checking email uniqueness:', email)
    // Check email uniqueness
    if (email) {
      const existingEmail = await withRetry(async () => {
        return users.findOne({ email })
      })
      if (existingEmail) {
        console.log('❌ Email already registered:', email)
        return res.status(400).json({ error: 'Email is already registered' })
      }
    }

    console.log('🔐 Hashing password...')
    // Hash password
    const hashedPassword = await hashPassword(password)

    console.log('👤 Creating user in database...')
    // Get next sequential ID
    const userId = await getNextSequenceValue('users')
    
    // Create user
    const newUser: User = {
      id: userId,
      name,
      username,
      email,
      college_id,
      password_hash: hashedPassword,
      department,
      year: parseInt(year),
      bio: bio || undefined,
      profile_image: String(profile_image || '/uploads/DefaultProfile.jpg'),
      is_private: false,
      followers_count: 0,
      following_count: 0,
      created_at: new Date(),
    }

    const result = await withRetry(async () => {
      return users.insertOne(newUser as any)
    })

    const createdUser = await users.findOne({ _id: result.insertedId })
    
    if (!createdUser) {
      throw new Error('Failed to retrieve created user')
    }

    console.log('🎫 Generating JWT token...')
    // Generate token
    const token = generateToken(userId)

    const userResponse = serializeDoc(createdUser)
    delete userResponse.password_hash

    console.log('✅ Registration successful for user:', userId)
    res.status(201).json({
      user: userResponse,
      token,
      message: 'User created successfully'
    })
  } catch (error) {
    console.error('❌ Registration error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })
    res.status(500).json({ error: 'Internal server error' })
  }
}
