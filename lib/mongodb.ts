import { MongoClient, Db, Collection, ObjectId, WithId, Document } from 'mongodb'

// MongoDB Connection URI - Validate format
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || ''
const DB_NAME = process.env.MONGODB_DB_NAME || 'unix'

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI or DATABASE_URL environment variable')
}

// Validate MongoDB URI format for security
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://')
}

// Global cached connection with connection pooling
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null
let connectionAttempts = 0
const MAX_RETRY_ATTEMPTS = 3
let isConnecting = false

// Connect to MongoDB with enhanced security and performance
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Return cached connection if available
  if (cachedClient && cachedDb && !isConnecting) {
    try {
      // Quick check - just return cached connection
      return { client: cachedClient, db: cachedDb }
    } catch (error) {
      console.warn('⚠️ Cached MongoDB connection error, reconnecting...')
      cachedClient = null
      cachedDb = null
    }
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (cachedClient && cachedDb) {
      return { client: cachedClient, db: cachedDb }
    }
  }

  isConnecting = true

  // Retry logic for connection
  while (connectionAttempts < MAX_RETRY_ATTEMPTS) {
    try {
      connectionAttempts++
      
      // Check if using local MongoDB
      const isLocalMongo = MONGODB_URI.includes('127.0.0.1') || MONGODB_URI.includes('localhost')
      
      // Enhanced connection options
      const connectionOptions: any = {
        // Connection pool settings
        maxPoolSize: process.env.NODE_ENV === 'production' ? 10 : 5,
        minPoolSize: 1,
        maxIdleTimeMS: 30000,
        
        // Timeout settings - more lenient for Atlas with better DNS handling
        serverSelectionTimeoutMS: 30000, // Increased from 10s to 30s for better Atlas compatibility
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000, // Increased from 10s to 30s
        
        // Reliability
        retryWrites: true,
        retryReads: true,
        
        // Compression for better performance
        compressors: ['zlib'],
      }
      
      // SSL/TLS options for Atlas
      if (!isLocalMongo) {
        Object.assign(connectionOptions, {
          tls: true,
          // For production, enforce strict TLS validation
          tlsAllowInvalidCertificates: false,
          tlsAllowInvalidHostnames: false,
        })
      } else {
        connectionOptions.directConnection = true
      }
      
      const client = await MongoClient.connect(MONGODB_URI, connectionOptions)
      const db = client.db(DB_NAME)

      // Verify connection with ping
      await db.admin().ping()

      // Cache the connection
      cachedClient = client
      cachedDb = db
      connectionAttempts = 0 // Reset on success
      isConnecting = false

      console.log('✅ Connected to MongoDB database:', DB_NAME)
      
      return { client, db }
      
    } catch (error: any) {
      console.error(`❌ MongoDB connection attempt ${connectionAttempts} failed:`, error.message)
      
      if (connectionAttempts >= MAX_RETRY_ATTEMPTS) {
        connectionAttempts = 0 // Reset for next attempt
        isConnecting = false
        
        // Provide helpful error messages
        if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED') || error.message?.includes('querySrv')) {
          console.error('💡 DNS resolution failed. Possible solutions:')
          console.error('   1. Check your internet connection')
          console.error('   2. Try using Google DNS (8.8.8.8) or Cloudflare DNS (1.1.1.1)')
          console.error('   3. Check if VPN/proxy is blocking MongoDB Atlas')
          console.error('   4. Verify MongoDB URI is correct')
          console.error('   5. Try flushing DNS cache: ipconfig /flushdns')
        } else if (error.message?.includes('ETIMEDOUT')) {
          console.error('💡 Connection timed out. Check if your IP is whitelisted in MongoDB Atlas.')
        } else if (error.message?.includes('SSL') || error.message?.includes('TLS')) {
          console.error('💡 SSL/TLS error. Try:')
          console.error('   1. Check if MongoDB Atlas cluster is running')
          console.error('   2. Verify your IP is whitelisted (or use 0.0.0.0/0 for testing)')
          console.error('   3. Check your network firewall settings')
        } else if (error.message?.includes('Authentication failed')) {
          console.error('💡 Authentication failed. Check your MongoDB username and password.')
        }
        
        throw error
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, connectionAttempts) * 1000))
    }
  }
  
  throw new Error('Failed to connect to MongoDB after maximum retry attempts')
}

// Get database instance
export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase()
  return db
}

// Collection helpers
export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await getDb()
  return db.collection<T>(name)
}

// Type definitions for collections
export interface User {
  _id?: ObjectId
  id?: number
  college_id: string
  username?: string
  username_changed_at?: Date
  email?: string
  password_hash: string
  name: string
  department: string
  year: number
  bio?: string
  profile_image?: string
  is_private: boolean
  is_deactivated?: boolean
  deactivated_at?: Date
  followers_count: number
  following_count: number
  created_at: Date
  // Privacy settings
  show_online_status?: boolean
  show_read_receipts?: boolean
  who_can_message?: 'everyone' | 'followers'
  who_can_comment?: 'everyone' | 'followers'
}

export interface Post {
  _id?: ObjectId
  id?: number
  user_id: number | ObjectId
  caption?: string
  media_url: string
  media_type: 'IMAGE' | 'VIDEO' | 'NONE'
  category: 'INTERNSHIP' | 'WORKSHOP' | 'LIBRARY_MEMORY' | 'ACADEMIC' | 'EVENT' | 'EVENTS' | 'CLUBS' | 'SPORTS' | 'SOCIAL' | 'GENERAL'
  created_at: Date
}

export interface Aura {
  _id?: ObjectId
  id?: number
  user_id: number | ObjectId
  post_id: number | ObjectId
  created_at: Date
}

export interface Comment {
  _id?: ObjectId
  id?: number
  post_id: number | ObjectId
  user_id: number | ObjectId
  comment_text: string
  created_at: Date
  parent_id?: number | ObjectId
}

export interface CommentLike {
  _id?: ObjectId
  id?: number
  user_id: number | ObjectId
  comment_id: number | ObjectId
  created_at: Date
}

export interface Follower {
  _id?: ObjectId
  id?: number
  follower_id: number | ObjectId
  following_id: number | ObjectId
  created_at: Date
}

export interface FollowRequest {
  _id?: ObjectId
  id?: number
  requester_id: number | ObjectId
  target_id: number | ObjectId
  created_at: Date
}

export interface Message {
  _id?: ObjectId
  id?: number
  sender_id: number | ObjectId
  receiver_id: number | ObjectId
  message_text: string
  media_url?: string
  reaction?: string | null
  reply_to_id?: number | null
  deleted_for?: number[] // Array of user IDs who deleted this message
  created_at: Date
}

export interface PasswordReset {
  _id?: ObjectId
  id?: number
  user_id: number | ObjectId
  token: string
  expires_at: Date
  used: boolean
  created_at: Date
}

// Collection names
export const Collections = {
  USERS: 'users',
  POSTS: 'posts',
  AURAS: 'auras',
  COMMENTS: 'comments',
  COMMENT_LIKES: 'comment_likes',
  FOLLOWERS: 'followers',
  FOLLOW_REQUESTS: 'follow_requests',
  MESSAGES: 'messages',
  PASSWORD_RESETS: 'password_resets',
  CLUBS: 'clubs',
  CLUB_MEMBERS: 'club_members',
  CLUB_DISCUSSIONS: 'club_discussions',
  CLUB_COMMENTS: 'club_comments',
  BLOCKS: 'blocks',
}

// Helper function to get next sequential ID
export async function getNextSequenceValue(sequenceName: string): Promise<number> {
  const db = await getDb()
  const counters = db.collection<{ _id: string; sequence_value: number }>('counters')
  
  const result = await counters.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { sequence_value: 1 } },
    { upsert: true, returnDocument: 'after' }
  ) as WithId<{ _id: string; sequence_value: number }> | { value?: WithId<{ _id: string; sequence_value: number }> } | null
  
  // Support both typings: some driver versions return the document directly, others return { value: document }.
  const doc = (result as any)?.value ?? result
  return (doc as { sequence_value: number } )?.sequence_value ?? 1
}

// Retry logic for operations (similar to Prisma's withRetry)
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      console.error(`MongoDB operation failed (attempt ${i + 1}/${maxRetries}):`, error.message)
      
      const shouldRetry = (
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('timeout') ||
        error.message?.includes('connection') ||
        error.message?.includes('SSL') ||
        error.message?.includes('TLS') ||
        error.message?.includes('EHOSTUNREACH') ||
        error.message?.includes('ENOTFOUND')
      ) && i < maxRetries - 1
      
      if (shouldRetry) {
        // Clear cached connection on connection errors
        if (error.message?.includes('connection') || error.message?.includes('SSL') || error.message?.includes('TLS')) {
          cachedClient = null
          cachedDb = null
          console.log('🔄 Cleared cached MongoDB connection')
        }
        
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000
        console.log(`⏳ Retrying MongoDB operation in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      throw error
    }
  }
  
  throw lastError
}

// Ensure database connection
export async function ensureDatabaseConnection(): Promise<boolean> {
  try {
    const db = await getDb()
    await db.admin().ping()
    return true
  } catch (error) {
    console.error('Database connection check failed:', error)
    return false
  }
}

// Initialize indexes for better performance
export async function initializeIndexes(): Promise<void> {
  try {
    const db = await getDb()
    
    // Users indexes
    const users = db.collection(Collections.USERS)
    await users.createIndex({ college_id: 1 }, { unique: true })
    await users.createIndex({ username: 1 }, { unique: true, sparse: true })
    await users.createIndex({ email: 1 }, { unique: true, sparse: true })
    await users.createIndex({ name: 'text', username: 'text' })
    
    // Posts indexes
    const posts = db.collection(Collections.POSTS)
    await posts.createIndex({ user_id: 1 })
    await posts.createIndex({ category: 1 })
    await posts.createIndex({ created_at: -1 })
    
    // Auras indexes
    const auras = db.collection(Collections.AURAS)
    await auras.createIndex({ user_id: 1, post_id: 1 }, { unique: true })
    await auras.createIndex({ post_id: 1 })
    
    // Comments indexes
    const comments = db.collection(Collections.COMMENTS)
    await comments.createIndex({ post_id: 1 })
    await comments.createIndex({ user_id: 1 })
    await comments.createIndex({ parent_id: 1 })
    
    // Comment Likes indexes
    const commentLikes = db.collection(Collections.COMMENT_LIKES)
    await commentLikes.createIndex({ user_id: 1, comment_id: 1 }, { unique: true })
    
    // Followers indexes
    const followers = db.collection(Collections.FOLLOWERS)
    await followers.createIndex({ follower_id: 1, following_id: 1 }, { unique: true })
    await followers.createIndex({ follower_id: 1 })
    await followers.createIndex({ following_id: 1 })
    
    // Follow Requests indexes
    const followRequests = db.collection(Collections.FOLLOW_REQUESTS)
    await followRequests.createIndex({ requester_id: 1, target_id: 1 }, { unique: true })
    await followRequests.createIndex({ target_id: 1 })
    
    // Messages indexes
    const messages = db.collection(Collections.MESSAGES)
    await messages.createIndex({ sender_id: 1, receiver_id: 1 })
    await messages.createIndex({ created_at: -1 })
    
    // Password Resets indexes
    const passwordResets = db.collection(Collections.PASSWORD_RESETS)
    await passwordResets.createIndex({ token: 1 }, { unique: true })
    await passwordResets.createIndex({ user_id: 1 })
    await passwordResets.createIndex({ expires_at: 1 })
    
    console.log('✅ MongoDB indexes initialized')
  } catch (error) {
    console.error('Error initializing indexes:', error)
  }
}

// Helper to convert ObjectId to number (for compatibility with existing code)
export function toNumber(value: ObjectId | number | undefined): number | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return value
  // Use timestamp portion of ObjectId as numeric ID
  return parseInt(value.toString().substring(0, 8), 16)
}

// Helper to serialize MongoDB documents for API responses
export function serializeDoc<T extends Document>(doc: WithId<T> | null): any {
  if (!doc) return null
  
  const serialized: any = {}
  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id') {
      // Convert _id to id
      const objId = value as ObjectId
      serialized.id = toNumber(objId) || objId.toString()
    } else if (value instanceof ObjectId) {
      serialized[key] = toNumber(value)
    } else if (value instanceof Date) {
      serialized[key] = value
    } else {
      serialized[key] = value
    }
  }
  return serialized
}

export function serializeDocs<T extends Document>(docs: WithId<T>[]): any[] {
  return docs.map(serializeDoc)
}
