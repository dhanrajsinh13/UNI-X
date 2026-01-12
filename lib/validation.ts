/**
 * Input validation and sanitization utilities
 * Prevents XSS, injection attacks, and validates data types
 */

// Email validation (RFC 5322 compliant)
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return emailRegex.test(email) && email.length <= 254
}

// Password strength validation
export function isStrongPassword(password: string): { valid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' }
  }
  
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' }
  }
  
  if (password.length > 128) {
    return { valid: false, message: 'Password is too long' }
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain lowercase letters' }
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain uppercase letters' }
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain numbers' }
  }
  
  return { valid: true }
}

// Sanitize string input to prevent XSS
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return ''
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
}

// Sanitize HTML content (more permissive for rich text)
export function sanitizeHtml(html: string, maxLength: number = 10000): string {
  if (!html || typeof html !== 'string') return ''
  
  const cleaned = html
    .trim()
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframes
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
  
  return cleaned
}

// Validate and sanitize username
export function validateUsername(username: string): { valid: boolean; sanitized?: string; message?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: 'Username is required' }
  }
  
  const sanitized = username.trim().toLowerCase()
  
  if (sanitized.length < 3) {
    return { valid: false, message: 'Username must be at least 3 characters' }
  }
  
  if (sanitized.length > 30) {
    return { valid: false, message: 'Username is too long' }
  }
  
  if (!/^[a-z0-9_-]+$/.test(sanitized)) {
    return { valid: false, message: 'Username can only contain letters, numbers, underscores, and hyphens' }
  }
  
  return { valid: true, sanitized }
}

// Validate integer input
export function validateInteger(value: any, min?: number, max?: number): { valid: boolean; value?: number; message?: string } {
  const num = parseInt(value)
  
  if (isNaN(num)) {
    return { valid: false, message: 'Invalid number' }
  }
  
  if (min !== undefined && num < min) {
    return { valid: false, message: `Value must be at least ${min}` }
  }
  
  if (max !== undefined && num > max) {
    return { valid: false, message: `Value must be at most ${max}` }
  }
  
  return { valid: true, value: num }
}

// Prevent NoSQL injection in MongoDB queries
export function sanitizeMongoQuery(obj: any): any {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'string') {
    // Prevent injection operators
    if (obj.startsWith('$')) {
      return obj.substring(1)
    }
    return obj
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeMongoQuery)
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      // Remove MongoDB operators from user input
      if (!key.startsWith('$') && !key.includes('.')) {
        sanitized[key] = sanitizeMongoQuery(value)
      }
    }
    return sanitized
  }
  
  return obj
}

// Validate URL
export function isValidUrl(url: string, allowedProtocols: string[] = ['http', 'https']): boolean {
  if (!url || typeof url !== 'string') return false
  
  try {
    const parsed = new URL(url)
    return allowedProtocols.includes(parsed.protocol.replace(':', ''))
  } catch {
    return false
  }
}

// Rate limit helper (returns true if allowed)
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
  store: Map<string, { count: number; resetTime: number }>
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = store.get(identifier)
  
  if (!record || now > record.resetTime) {
    store.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true }
  }
  
  if (record.count >= limit) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((record.resetTime - now) / 1000) 
    }
  }
  
  record.count++
  return { allowed: true }
}

// Validate file upload
export function validateFileUpload(
  file: { size: number; mimetype?: string; originalFilename?: string },
  options: {
    maxSize?: number
    allowedTypes?: string[]
    allowedExtensions?: string[]
  } = {}
): { valid: boolean; message?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  } = options
  
  if (!file) {
    return { valid: false, message: 'No file provided' }
  }
  
  if (file.size > maxSize) {
    return { valid: false, message: `File size exceeds ${Math.floor(maxSize / 1024 / 1024)}MB limit` }
  }
  
  if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
    return { valid: false, message: 'File type not allowed' }
  }
  
  if (file.originalFilename) {
    const ext = file.originalFilename.toLowerCase().match(/\.[^.]+$/)?.[0]
    if (ext && !allowedExtensions.includes(ext)) {
      return { valid: false, message: 'File extension not allowed' }
    }
  }
  
  return { valid: true }
}

// Sanitize object for API response (remove sensitive fields)
export function sanitizeApiResponse<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: string[] = ['password', 'passwordHash', 'token', 'secret']
): Partial<T> {
  if (!obj || typeof obj !== 'object') return obj
  
  const sanitized = { ...obj }
  
  for (const field of sensitiveFields) {
    delete sanitized[field]
  }
  
  return sanitized
}
