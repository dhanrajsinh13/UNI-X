import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, connectToDatabase } from '../../../lib/mongodb'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Test database connection
    const { client } = await connectToDatabase()
    await client.db('admin').command({ ping: 1 })

    // Environment check
    const envCheck = {
      MONGODB_URI: !!process.env.MONGODB_URI ? 'SET' : 'MISSING',
      JWT_SECRET: !!process.env.JWT_SECRET ? 'SET' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV,
    }

    // Database query test
    const users = await getCollection(Collections.USERS)
    const userCount = await users.countDocuments()

    return res.status(200).json({
      success: true,
      message: 'Registration endpoint debug successful',
      environment: envCheck,
      userCount,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}