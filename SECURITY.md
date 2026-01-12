# Security Enhancements Guide

## Overview
This document outlines the security improvements implemented in UNI-X to protect against common vulnerabilities and enhance overall system security.

## Security Improvements Implemented

### 1. Authentication & Authorization ✅

#### Enhanced JWT Security
- **Algorithm**: Using HS256 with strict validation
- **Token Structure**: Includes user ID, issued-at time, and unique token ID (jti) for revocation
- **Expiration**: 7-day token expiration with refresh capability
- **Validation**: 
  - Token size limits (max 1000 characters)
  - Issuer and audience verification
  - Proper error handling for expired/invalid tokens

#### Password Security
- **Hashing**: bcrypt with 12 rounds (highly secure)
- **Validation**: Minimum 8 characters with complexity requirements
- **Storage**: Only hashed passwords stored, never plain text

### 2. Input Validation & Sanitization ✅

#### New Validation Library (`lib/validation.ts`)
- **Email Validation**: RFC 5322 compliant
- **Password Strength**: Enforces lowercase, uppercase, numbers
- **XSS Prevention**: HTML sanitization for user input
- **Username Validation**: Alphanumeric + underscore/hyphen only
- **NoSQL Injection Prevention**: Sanitizes MongoDB queries to prevent injection attacks
- **URL Validation**: Whitelisted protocols only (http, https)
- **File Upload Validation**: Type, size, and extension checking

### 3. Security Headers ✅

#### Middleware Security Headers
```typescript
X-Content-Type-Options: nosniff          // Prevent MIME sniffing
X-Frame-Options: DENY                    // Prevent clickjacking
X-XSS-Protection: 1; mode=block         // XSS filter
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

#### Content Security Policy (CSP)
- Restricts script sources to prevent XSS
- Blocks inline scripts (except where necessary)
- Whitelists trusted CDNs
- Prevents frame embedding
- Enforces HTTPS upgrade

#### HSTS (HTTP Strict Transport Security)
- Enforces HTTPS connections
- 2-year max-age with subdomain inclusion
- Preload ready

### 4. CORS (Cross-Origin Resource Sharing) ✅

#### Strict Origin Whitelisting
```typescript
// Only allowed origins can access the API
- http://localhost:3000 (development)
- http://localhost:3001 (socket server)
- Your production domain (configured via env)
- Vercel preview URLs
```

#### CORS Headers
- `Access-Control-Allow-Origin`: Whitelist only
- `Access-Control-Allow-Credentials`: true
- `Access-Control-Max-Age`: 24 hours

### 5. Rate Limiting ✅

#### API Rate Limiting
- **Default Limit**: 100 requests per minute per IP
- **Implementation**: In-memory store (upgrade to Redis for production scale)
- **Response**: HTTP 429 with Retry-After header
- **Cleanup**: Automatic cleanup every minute

#### Usage
```typescript
// Automatically applied to all /api/* routes
// Returns 429 Too Many Requests if exceeded
```

### 6. File Upload Security ✅

#### Restrictions
- **Max Size**: 10MB per file
- **Allowed Types**: 
  - Images: JPEG, PNG, GIF, WebP
  - Videos: MP4, QuickTime, WebM
- **Extension Validation**: Double-check (MIME type + extension)
- **File Filtering**: Formidable filters invalid files before processing

#### Upload Flow
1. Validate MIME type
2. Validate file extension
3. Check file size
4. Sanitize filename
5. Upload to Cloudinary (secure cloud storage)
6. Delete temporary file

### 7. MongoDB Security ✅

#### Connection Security
- **URI Validation**: Ensures proper mongodb:// or mongodb+srv:// format
- **TLS/SSL**: Enforced for Atlas connections
- **Authentication**: Required for all connections
- **Connection Pooling**: 
  - Production: 10 connections max
  - Development: 5 connections max
  - Minimum: 2 connections
- **Health Checks**: Automatic ping verification
- **Retry Logic**: Exponential backoff (max 3 attempts)

#### Query Security
- **NoSQL Injection Prevention**: Input sanitization removes $ operators
- **Parameterized Queries**: Using MongoDB driver's safe methods
- **Write Concern**: `w: majority` ensures data safety

### 8. API Security Best Practices ✅

#### Request Validation
- All API routes validate authentication
- Input validation before database operations
- Type checking for all parameters
- Size limits on request bodies

#### Error Handling
- Generic error messages to prevent information leakage
- Detailed logs server-side only
- No stack traces in production responses

#### Response Sanitization
- Sensitive fields removed (passwords, tokens)
- Consistent response format
- Proper HTTP status codes

## Configuration Required

### Environment Variables
Create a `.env.local` file with these **required** variables:

```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=unix

# Authentication (CRITICAL - must be 32+ characters)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_SOCKET_URL=wss://your-socket-server.com

# Node Environment
NODE_ENV=production
```

### Security Checklist

- [ ] Generate strong JWT_SECRET (32+ characters, random)
- [ ] Configure MongoDB IP whitelist (or 0.0.0.0/0 for testing)
- [ ] Set up Cloudinary account for file uploads
- [ ] Configure allowed CORS origins in middleware
- [ ] Enable HTTPS in production
- [ ] Set up MongoDB user with limited permissions (not admin)
- [ ] Review and test all API endpoints
- [ ] Enable error logging/monitoring (Sentry, LogRocket, etc.)
- [ ] Set up rate limiting with Redis in production
- [ ] Configure backup strategy for MongoDB
- [ ] Enable 2FA for admin accounts
- [ ] Regular dependency updates (`npm audit`)

## Testing Security

### Manual Tests

1. **XSS Testing**
   ```javascript
   // Try posting: <script>alert('XSS')</script>
   // Should be sanitized
   ```

2. **SQL/NoSQL Injection**
   ```javascript
   // Try searching: {"$gt": ""}
   // Should be sanitized
   ```

3. **Rate Limiting**
   ```bash
   # Send 101 requests in 1 minute
   for i in {1..101}; do curl http://localhost:3000/api/health; done
   # Should get 429 on request 101
   ```

4. **File Upload**
   ```bash
   # Try uploading .exe, .php files
   # Should be rejected
   ```

5. **Authentication**
   ```bash
   # Try accessing /api/users/me without token
   # Should get 401 Unauthorized
   ```

## Vulnerability Prevention

### ✅ Protected Against
- **XSS (Cross-Site Scripting)**: Input sanitization + CSP
- **CSRF (Cross-Site Request Forgery)**: SameSite cookies + CORS
- **SQL/NoSQL Injection**: Query parameterization + sanitization
- **Clickjacking**: X-Frame-Options + CSP
- **MIME Sniffing**: X-Content-Type-Options
- **Directory Traversal**: Input validation
- **File Upload Attacks**: Type/size validation
- **Brute Force**: Rate limiting
- **Session Hijacking**: Secure JWT tokens
- **Man-in-the-Middle**: HTTPS + HSTS

### ⚠️ Additional Recommendations

1. **Implement CAPTCHA** for registration/login
2. **Add 2FA** for sensitive operations
3. **Use Redis** for distributed rate limiting
4. **Set up WAF** (Web Application Firewall)
5. **Enable DDoS protection** (Cloudflare, etc.)
6. **Implement audit logging** for security events
7. **Regular penetration testing**
8. **Security headers testing** (securityheaders.com)
9. **Dependency scanning** (Snyk, Dependabot)
10. **Code review** before deployment

## Performance Optimizations

### Connection Pooling
- Reuses database connections
- Reduces connection overhead
- Improves response times

### Compression
- Snappy and zlib compression for MongoDB
- Reduces network bandwidth
- Faster data transfer

### Caching
- Connection caching
- Health check optimization
- Reduces redundant database calls

### Read Preferences
- `primaryPreferred` for better performance
- Falls back to secondary if primary unavailable

## Monitoring & Alerts

### Recommended Tools
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **New Relic**: Performance monitoring
- **Datadog**: Infrastructure monitoring
- **PagerDuty**: Incident management

### Key Metrics to Monitor
- API response times
- Error rates
- Authentication failures
- Rate limit hits
- Database connection pool usage
- File upload success/failure rates

## Incident Response

### If Security Breach Detected

1. **Immediate Actions**
   - Rotate JWT_SECRET immediately
   - Invalidate all active sessions
   - Review access logs
   - Identify affected users

2. **Investigation**
   - Check error logs
   - Review recent code changes
   - Analyze attack patterns
   - Document findings

3. **Remediation**
   - Patch vulnerability
   - Update dependencies
   - Deploy fixes
   - Test thoroughly

4. **Communication**
   - Notify affected users
   - Provide timeline
   - Explain actions taken
   - Offer support

## Regular Maintenance

### Weekly
- [ ] Review error logs
- [ ] Check rate limit hits
- [ ] Monitor failed login attempts

### Monthly
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Review access logs
- [ ] Test backup restoration
- [ ] Update dependencies

### Quarterly
- [ ] Security audit
- [ ] Penetration testing
- [ ] Review and update security policies
- [ ] Training for development team

## Contact

For security issues, please email: security@your-domain.com

**Do NOT** open public GitHub issues for security vulnerabilities.

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
