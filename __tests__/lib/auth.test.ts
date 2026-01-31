import { hashPassword, verifyPassword, generateToken, verifyToken } from '@/lib/auth'

describe('Authentication Library', () => {
  describe('Password Hashing', () => {
    it('should hash a password successfully', async () => {
      const password = 'TestPassword123!'
      const hashed = await hashPassword(password)
      
      expect(hashed).toBeDefined()
      expect(hashed).not.toBe(password)
      expect(hashed.length).toBeGreaterThan(20)
    })
    
    it('should reject passwords shorter than 8 characters', async () => {
      await expect(hashPassword('short')).rejects.toThrow('Password must be at least 8 characters')
    })
    
    it('should verify correct password', async () => {
      const password = 'TestPassword123!'
      const hashed = await hashPassword(password)
      const isValid = await verifyPassword(password, hashed)
      
      expect(isValid).toBe(true)
    })
    
    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!'
      const hashed = await hashPassword(password)
      const isValid = await verifyPassword('WrongPassword123!', hashed)
      
      expect(isValid).toBe(false)
    })
  })
  
  describe('JWT Token Operations', () => {
    it('should generate a valid JWT token', () => {
      const userId = 123
      const token = generateToken(userId)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })
    
    it('should verify a valid token', () => {
      const userId = 456
      const token = generateToken(userId)
      const decoded = verifyToken(token)
      
      expect(decoded).toBeDefined()
      expect(decoded?.userId).toBe(userId)
      expect(decoded?.jti).toBeDefined()
    })
    
    it('should reject an invalid token', () => {
      const invalidToken = 'invalid.token.here'
      const decoded = verifyToken(invalidToken)
      
      expect(decoded).toBeNull()
    })
    
    it('should reject a token with wrong secret', () => {
      // Create token with different secret
      const jwt = require('jsonwebtoken')
      const token = jwt.sign({ userId: 789 }, 'wrong-secret', { expiresIn: '1h' })
      const decoded = verifyToken(token)
      
      expect(decoded).toBeNull()
    })
  })
})
