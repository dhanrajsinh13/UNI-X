import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string, limit: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip)
    }
  }
}, 60000)

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security Headers - Apply to all routes
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Content Security Policy
  const isDev = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.cloudinary.com wss://* ws://* ${isDev ? 'http://localhost:* ws://localhost:*' : ''}`,
    "media-src 'self' https: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? "" : "upgrade-insecure-requests"
  ].filter(Boolean).join('; ')
  response.headers.set('Content-Security-Policy', csp)

  // API Routes - Enhanced security
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Rate limiting - get IP from headers or fallback
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(ip, 100, 60000)) {
      return new NextResponse('Too Many Requests', { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'Content-Type': 'application/json'
        }
      })
    }

    // CORS - Strict whitelist (configure based on your domains)
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].filter(Boolean) as string[]

    const origin = request.headers.get('origin')
    if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    response.headers.set('Access-Control-Max-Age', '86400')
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers })
    }
    
    return response
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)', '/api/:path*'],
}
