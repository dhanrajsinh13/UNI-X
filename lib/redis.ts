import { createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

// Redis client instance
let redisClient: RedisClient | null = null
let isConnecting = false

// In-memory fallback for rate limiting when Redis is not available
class InMemoryStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map()
  
  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    
    // Check if expired
    if (Date.now() > entry.resetTime) {
      this.store.delete(key)
      return null
    }
    
    return entry.count
  }
  
  async set(key: string, value: number, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      count: value,
      resetTime: Date.now() + ttlSeconds * 1000
    })
  }
  
  async incr(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry || Date.now() > entry.resetTime) {
      return 1
    }
    entry.count++
    return entry.count
  }
  
  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) {
      entry.resetTime = Date.now() + seconds * 1000
    }
  }
  
  // Cleanup expired entries periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.resetTime) {
          this.store.delete(key)
        }
      }
    }, 60000) // Clean up every minute
  }
}

const inMemoryStore = new InMemoryStore()
inMemoryStore.startCleanup()

// Connect to Redis
export async function connectToRedis(): Promise<RedisClient | null> {
  const REDIS_URL = process.env.REDIS_URL
  
  // If no Redis URL, use in-memory store
  if (!REDIS_URL) {
    console.log('⚠️ No REDIS_URL configured, using in-memory rate limiting (not recommended for production)')
    return null
  }
  
  // Return cached connection
  if (redisClient?.isOpen) {
    return redisClient
  }
  
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (redisClient?.isOpen) {
      return redisClient
    }
    return null
  }
  
  isConnecting = true
  
  try {
    const client = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: Too many reconnection attempts, giving up')
            return new Error('Too many reconnection attempts')
          }
          // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc. (max 5s)
          return Math.min(retries * 100, 5000)
        }
      }
    })
    
    client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message)
    })
    
    client.on('connect', () => {
      console.log('🔄 Redis: Connecting...')
    })
    
    client.on('ready', () => {
      console.log('✅ Redis: Connected and ready')
    })
    
    client.on('reconnecting', () => {
      console.log('🔄 Redis: Reconnecting...')
    })
    
    await client.connect()
    
    redisClient = client
    isConnecting = false
    
    return client
  } catch (error: any) {
    console.error('❌ Failed to connect to Redis:', error.message)
    console.log('⚠️ Falling back to in-memory rate limiting')
    isConnecting = false
    return null
  }
}

// Rate limiting helper
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  try {
    const client = await connectToRedis()
    
    if (client) {
      // Use Redis for distributed rate limiting
      const count = await client.incr(key)
      
      // Set expiry on first request
      if (count === 1) {
        await client.expire(key, windowSeconds)
      }
      
      const ttl = await client.ttl(key)
      const resetTime = Date.now() + ttl * 1000
      
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetTime
      }
    } else {
      // Fallback to in-memory store
      let count = await inMemoryStore.get(key)
      
      if (count === null) {
        count = 0
        await inMemoryStore.set(key, 0, windowSeconds)
      }
      
      count = await inMemoryStore.incr(key)
      
      if (count === 1) {
        await inMemoryStore.expire(key, windowSeconds)
      }
      
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetTime: Date.now() + windowSeconds * 1000
      }
    }
  } catch (error: any) {
    console.error('Rate limit check error:', error.message)
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: limit,
      resetTime: Date.now() + windowSeconds * 1000
    }
  }
}

// Cache helper functions
export async function cacheGet(key: string): Promise<string | null> {
  try {
    const client = await connectToRedis()
    if (!client) return null
    
    return await client.get(key)
  } catch (error: any) {
    console.error('Cache get error:', error.message)
    return null
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    const client = await connectToRedis()
    if (!client) return
    
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, value)
    } else {
      await client.set(key, value)
    }
  } catch (error: any) {
    console.error('Cache set error:', error.message)
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const client = await connectToRedis()
    if (!client) return
    
    await client.del(key)
  } catch (error: any) {
    console.error('Cache delete error:', error.message)
  }
}

// Disconnect Redis (for graceful shutdown)
export async function disconnectRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit()
    redisClient = null
    console.log('👋 Redis: Disconnected')
  }
}
