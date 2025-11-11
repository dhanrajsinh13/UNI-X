import { NextApiRequest, NextApiResponse } from 'next'
import { ensureDatabaseConnection } from '../../lib/mongodb'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Simple database connectivity check
    const isConnected = await ensureDatabaseConnection()
    
    if (isConnected) {
      res.status(200).json({ 
        status: 'healthy', 
        database: 'connected',
        timestamp: new Date().toISOString()
      })
    } else {
      res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(503).json({ 
      status: 'unhealthy', 
      error: 'Database check failed',
      timestamp: new Date().toISOString()
    })
  }
}