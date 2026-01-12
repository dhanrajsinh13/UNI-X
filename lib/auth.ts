import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextApiRequest } from 'next'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!')
  throw new Error('JWT_SECRET environment variable is required for authentication')
}

if (JWT_SECRET.length < 32) {
  console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters for security')
}

// Type assertion since we've verified JWT_SECRET exists
const jwtSecret: string = JWT_SECRET

// Password hashing with increased rounds for better security
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  if (!password || !hashedPassword) return false
  return await bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: number): string {
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomBytes(16).toString('hex'), // Unique token ID for revocation
  }
  
  return jwt.sign(payload, jwtSecret, {
    expiresIn: '7d',
    algorithm: 'HS256',
    issuer: 'unix-social',
    audience: 'unix-api'
  })
}

export function verifyToken(token: string): { userId: number; iat: number; jti: string } | null {
  try {
    if (!token || token.length > 1000) return null // Prevent oversized tokens
    
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'unix-social',
      audience: 'unix-api'
    }) as { userId: number; iat: number; jti: string }
    
    // Additional validation
    if (!decoded.userId || typeof decoded.userId !== 'number') {
      return null
    }
    
    return decoded
  } catch (error) {
    // Log token verification failures for security monitoring
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn('Invalid token signature')
    } else if (error instanceof jwt.TokenExpiredError) {
      console.warn('Token expired')
    }
    return null
  }
}

export function getUserFromRequest(req: NextApiRequest): { userId: number; iat: number; jti: string } | null {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  
  return verifyToken(token)
}

// Secure token refresh (generate new token before old one expires)
export function refreshToken(oldToken: string): string | null {
  const decoded = verifyToken(oldToken)
  if (!decoded) return null
  
  // Only allow refresh if token is still valid
  return generateToken(decoded.userId)
}
