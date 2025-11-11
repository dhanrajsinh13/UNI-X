import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections, connectToDatabase } from '../../../lib/mongodb'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const maskedUrl = process.env.MONGODB_URI?.replace(/:[^:@]*@/, ':***@')
    const status: any = {
      env: {
        MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'MISSING',
        NODE_ENV: process.env.NODE_ENV,
      },
      maskedUrl,
      diagnostics: {},
    }

    // Try connection
    const { db, client } = await connectToDatabase()
    status.diagnostics.connected = !!db

    // Count users as a simple query
    const users = await getCollection(Collections.USERS)
    const userCount = await users.countDocuments()
    status.diagnostics.userCount = userCount

    // Simple ping command
    const admin = client.db('admin')
    const ping = await admin.command({ ping: 1 })
    status.diagnostics.ping = ping

    return res.status(200).json({ ok: true, status })
  } catch (error: any) {
    return res.status(200).json({ ok: false, error: error?.message, code: error?.code })
  }
}
