import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { NextApiRequest } from 'next'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!')
  throw new Error('JWT_SECRET environment variable is required for authentication')
}

// Type assertion since we've verified JWT_SECRET exists
const jwtSecret: string = JWT_SECRET

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, jwtSecret) as { userId: number }
  } catch {
    return null
  }
}

export function getUserFromRequest(req: NextApiRequest): { userId: number } | null {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  return verifyToken(token)
}
