import {
  isValidEmail,
  isStrongPassword,
  sanitizeString,
  validateUsername,
  validateInteger,
  sanitizeMongoQuery,
  isValidUrl,
  validatePrivacySettings
} from '@/lib/validation'

describe('Validation Library', () => {
  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('test.user@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@example.com')).toBe(true)
    })
    
    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })
  })
  
  describe('Password Strength', () => {
    it('should validate strong passwords', () => {
      const result = isStrongPassword('StrongP@ss123')
      expect(result.valid).toBe(true)
    })
    
    it('should reject weak passwords', () => {
      expect(isStrongPassword('short').valid).toBe(false)
      expect(isStrongPassword('nouppercase123').valid).toBe(false)
      expect(isStrongPassword('NOLOWERCASE123').valid).toBe(false)
      expect(isStrongPassword('NoNumbers!').valid).toBe(false)
    })
  })
  
  describe('String Sanitization', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello'
      const sanitized = sanitizeString(input)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('Hello')
    })
    
    it('should remove javascript: protocol', () => {
      const input = 'javascript:alert(1)'
      const sanitized = sanitizeString(input)
      expect(sanitized).not.toContain('javascript:')
    })
    
    it('should respect max length', () => {
      const input = 'a'.repeat(2000)
      const sanitized = sanitizeString(input, 100)
      expect(sanitized.length).toBeLessThanOrEqual(100)
    })
  })
  
  describe('Username Validation', () => {
    it('should validate correct usernames', () => {
      const result = validateUsername('john_doe')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('john_doe')
    })
    
    it('should reject invalid usernames', () => {
      expect(validateUsername('ab').valid).toBe(false) // too short
      expect(validateUsername('a'.repeat(50)).valid).toBe(false) // too long
      expect(validateUsername('user@name').valid).toBe(false) // invalid chars
    })
    
    it('should sanitize username to lowercase', () => {
      const result = validateUsername('JohnDoe')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('johndoe')
    })
  })
  
  describe('MongoDB Query Sanitization', () => {
    it('should remove $ operators from user input', () => {
      const malicious = { $where: 'malicious code' }
      const sanitized = sanitizeMongoQuery(malicious)
      expect(sanitized.$where).toBeUndefined()
    })
    
    it('should preserve safe values', () => {
      const safe = { username: 'john', age: 25 }
      const sanitized = sanitizeMongoQuery(safe)
      expect(sanitized.username).toBe('john')
      expect(sanitized.age).toBe(25)
    })
  })
  
  describe('URL Validation', () => {
    it('should validate HTTP and HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://example.com')).toBe(true)
    })
    
    it('should reject invalid protocols', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(false)
      expect(isValidUrl('ftp://example.com')).toBe(false)
    })
  })
  
  describe('Privacy Settings Validation', () => {
    it('should validate correct privacy settings', () => {
      const settings = {
        is_private: true,
        show_online_status: false,
        who_can_message: 'followers'
      }
      const result = validatePrivacySettings(settings)
      expect(result.valid).toBe(true)
    })
    
    it('should reject invalid who_can_message values', () => {
      const settings = { who_can_message: 'invalid' }
      const result = validatePrivacySettings(settings)
      expect(result.valid).toBe(false)
    })
    
    it('should reject non-boolean values for boolean fields', () => {
      const settings = { is_private: 'yes' }
      const result = validatePrivacySettings(settings)
      expect(result.valid).toBe(false)
    })
  })
})
