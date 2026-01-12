# Security Quick Reference

## Quick Security Checklist

### ✅ Implemented
- [x] JWT authentication with strong validation
- [x] Password hashing (bcrypt, 12 rounds)
- [x] Input validation and sanitization
- [x] XSS protection (CSP, sanitization)
- [x] NoSQL injection prevention
- [x] Rate limiting (100 req/min)
- [x] CORS whitelist
- [x] Security headers (HSTS, X-Frame-Options, etc.)
- [x] File upload restrictions (type, size)
- [x] MongoDB connection pooling
- [x] TLS/SSL for database connections
- [x] Error handling (no info leakage)

### 🔧 Usage Examples

#### Validate User Input
```typescript
import { sanitizeString, isValidEmail, validateUsername } from '@/lib/validation'

// Sanitize text input
const cleanText = sanitizeString(userInput, 500)

// Validate email
if (!isValidEmail(email)) {
  return res.status(400).json({ error: 'Invalid email' })
}

// Validate username
const { valid, sanitized, message } = validateUsername(username)
if (!valid) {
  return res.status(400).json({ error: message })
}
```

#### Protect API Routes
```typescript
import { getUserFromRequest } from '@/lib/auth'

export default async function handler(req, res) {
  // Authenticate user
  const auth = getUserFromRequest(req)
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // Use auth.userId for user-specific operations
  const userId = auth.userId
}
```

#### Validate File Uploads
```typescript
import { validateFileUpload } from '@/lib/validation'
import { parseForm } from '@/lib/upload'

const { files } = await parseForm(req)
const file = Array.isArray(files.file) ? files.file[0] : files.file

const { valid, message } = validateFileUpload(file, {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png'],
  allowedExtensions: ['.jpg', '.png']
})

if (!valid) {
  return res.status(400).json({ error: message })
}
```

#### Sanitize MongoDB Queries
```typescript
import { sanitizeMongoQuery } from '@/lib/validation'

// User input
const searchQuery = req.query.search

// Sanitize before using in MongoDB query
const safeQuery = sanitizeMongoQuery(searchQuery)

const results = await collection.find({ name: safeQuery })
```

## Common Vulnerabilities & Fixes

### 1. XSS (Cross-Site Scripting)
**Vulnerable:**
```typescript
<div>{userInput}</div>  // Direct HTML insertion
```

**Secured:**
```typescript
import { sanitizeHtml } from '@/lib/validation'
<div>{sanitizeHtml(userInput)}</div>
```

### 2. NoSQL Injection
**Vulnerable:**
```typescript
const user = await users.findOne({ username: req.body.username })
```

**Secured:**
```typescript
import { sanitizeString } from '@/lib/validation'
const username = sanitizeString(req.body.username, 30)
const user = await users.findOne({ username })
```

### 3. Weak Passwords
**Vulnerable:**
```typescript
// Accepting any password
await hashPassword(password)
```

**Secured:**
```typescript
import { isStrongPassword } from '@/lib/validation'

const { valid, message } = isStrongPassword(password)
if (!valid) {
  return res.status(400).json({ error: message })
}
```

### 4. Unrestricted File Uploads
**Vulnerable:**
```typescript
// Accepting any file type
const result = await uploadToCloudinary(file.filepath)
```

**Secured:**
```typescript
const { valid, message } = validateFileUpload(file, {
  allowedTypes: ['image/jpeg', 'image/png'],
  maxSize: 5 * 1024 * 1024
})
if (!valid) {
  return res.status(400).json({ error: message })
}
```

## Security Headers Reference

```typescript
// Already configured in middleware.ts
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains
Content-Security-Policy: [comprehensive policy]
```

## Rate Limiting

**Automatic:** All `/api/*` routes are rate-limited to 100 requests/minute per IP.

**Custom Rate Limiting:**
```typescript
import { checkRateLimit } from '@/lib/validation'

const rateLimitStore = new Map()
const { allowed, retryAfter } = checkRateLimit(
  req.ip || 'unknown',
  10,        // 10 requests
  60000,     // per minute
  rateLimitStore
)

if (!allowed) {
  return res.status(429).json({ 
    error: 'Too many requests',
    retryAfter 
  })
}
```

## Environment Variables Security

### Critical Variables (Keep Secret!)
```bash
JWT_SECRET=           # 32+ random characters
MONGODB_URI=          # Contains credentials
CLOUDINARY_API_SECRET=
```

### Generate Secure JWT Secret
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Testing Security

### Test Rate Limiting
```powershell
for ($i=1; $i -le 101; $i++) { 
  curl http://localhost:3000/api/health 
}
# Request 101 should return 429
```

### Test Authentication
```powershell
# Should return 401
curl http://localhost:3000/api/users/me

# Should return 200 (with valid token)
curl http://localhost:3000/api/users/me `
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test XSS Protection
```javascript
// Try posting this in a text field:
<script>alert('XSS')</script>
// Should be sanitized
```

### Test File Upload
```powershell
# Try uploading .exe or .php file
# Should be rejected with 400 Bad Request
```

## Emergency Security Actions

### If JWT_SECRET is Compromised
1. Generate new JWT_SECRET immediately
2. Update .env.local with new secret
3. Restart application
4. All users will need to re-login

### If Database Credentials are Leaked
1. Rotate MongoDB password immediately
2. Update MONGODB_URI in environment variables
3. Review database access logs
4. Check for unauthorized data access

### If API is Under Attack
1. Lower rate limits in middleware.ts
2. Add IP blocking if necessary
3. Enable DDoS protection (Cloudflare, etc.)
4. Monitor error logs

## Performance Tips

### Database Queries
```typescript
// Use indexes for frequently queried fields
await collection.createIndex({ user_id: 1 })
await collection.createIndex({ created_at: -1 })

// Use projection to limit returned fields
await collection.find({}, { 
  projection: { password_hash: 0 } 
})
```

### Caching
```typescript
// Cache frequently accessed data
const cache = new Map()

if (cache.has(key)) {
  return cache.get(key)
}

const data = await fetchData()
cache.set(key, data)
```

## Resources

- Full Documentation: [SECURITY.md](./SECURITY.md)
- Environment Template: [.env.template](./.env.template)
- Validation Utils: [lib/validation.ts](./lib/validation.ts)
- Auth Utils: [lib/auth.ts](./lib/auth.ts)

## Report Security Issues

**Email:** security@your-domain.com  
**Do NOT** create public GitHub issues for vulnerabilities.
