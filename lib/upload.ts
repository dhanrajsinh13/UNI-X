import { v2 as cloudinary } from 'cloudinary'
import formidable from 'formidable'
import { NextApiRequest } from 'next'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Configure Cloudinary (you'll need to set these environment variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export interface UploadResult {
  url: string
  publicId: string
  type: 'image' | 'video'
}

// Allowed file types for security
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm']

export async function parseForm(req: NextApiRequest): Promise<{
  fields: formidable.Fields
  files: formidable.Files
}> {
  // Validate content-type header - must be multipart/form-data
  const contentType = req.headers['content-type'] || ''
  if (!contentType.includes('multipart/form-data')) {
    throw new Error(`Invalid content type. Expected multipart/form-data, got: ${contentType}`)
  }

  // On Vercel and other serverless platforms, the project filesystem is read-only.
  // Use the OS temporary directory for uploads.
  const uploadDir = path.join(os.tmpdir(), 'unix-uploads')

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
  } catch (e) {
    // As a final fallback, use the bare tmp dir
    console.warn('Failed to create upload subdirectory, falling back to os.tmpdir():', e)
  }

  const form = formidable({
    uploadDir: fs.existsSync(uploadDir) ? uploadDir : os.tmpdir(),
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
    maxFiles: 1, // Only allow single file uploads
    multiples: false,
    allowEmptyFiles: false,
    // Explicitly disable JSON parsing - we only want multipart form data
    hashAlgorithm: false,
    filter: function ({ mimetype, originalFilename }) {
      // Validate file type and extension
      const isValidMime = mimetype && (
        ALLOWED_IMAGE_TYPES.includes(mimetype) ||
        ALLOWED_VIDEO_TYPES.includes(mimetype)
      )

      const ext = originalFilename ? path.extname(originalFilename).toLowerCase() : ''
      const isValidExt = ALLOWED_EXTENSIONS.includes(ext)

      return !!(isValidMime && isValidExt)
    },
  })

  return new Promise((resolve, reject) => {
    // Check if request body was already consumed (common issue with Next.js)
    if ((req as any).body && Object.keys((req as any).body).length > 0) {
      console.warn('Request body appears to have been pre-parsed. This may cause issues.')
    }

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err)

        // Provide more helpful error messages
        if (err.message?.includes('JSON')) {
          reject(new Error('File upload failed: Request was incorrectly parsed as JSON. Ensure Content-Type is multipart/form-data and bodyParser is disabled for this route.'))
        } else if (err.message?.includes('maxFileSize')) {
          reject(new Error('File upload failed: File size exceeds 10MB limit'))
        } else if (err.message?.includes('maxFiles')) {
          reject(new Error('File upload failed: Only one file upload is allowed'))
        } else {
          reject(new Error('File upload failed: ' + err.message))
        }
      } else {
        resolve({ fields, files })
      }
    })
  })
}



export async function uploadToCloudinary(filePath: string, resourceType: 'image' | 'video' = 'image'): Promise<UploadResult> {
  // Fast-path fallback in development to avoid Cloudinary latency
  const devFallbackEnabled = process.env.NODE_ENV !== 'production' && process.env.CLOUDINARY_DEV_FALLBACK === 'true'
  if (devFallbackEnabled) {
    try {
      const result = saveToLocalUploads(filePath, resourceType)
      cleanupFile(filePath)
      return result
    } catch {
      // If local fallback fails, proceed to Cloudinary attempt below
    }
  }

  try {
    // Check if Cloudinary is properly configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('Cloudinary not configured - missing environment variables')
      cleanupFile(filePath)
      throw new Error('Cloudinary configuration missing. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.')
    }

    console.log(`Uploading ${resourceType} to Cloudinary:`, filePath)

    // Optional timeout for uploads to prevent long hangs in poor networks
    const timeoutMs = (() => {
      const raw = process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS
      const parsed = raw ? parseInt(raw, 10) : NaN
      // Default: shorter timeout in dev, longer in prod
      return Number.isFinite(parsed) ? parsed : (process.env.NODE_ENV !== 'production' ? 8000 : 30000)
    })()

    const uploadPromise = cloudinary.uploader.upload(filePath, {
      resource_type: resourceType,
      folder: 'unix-social',
      quality: 'auto',
      fetch_format: 'auto',
    })

    const result = await Promise.race([
      uploadPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Upload timeout')), timeoutMs))
    ]) as any

    // Clean up local file after successful upload
    cleanupFile(filePath)

    // Validate result
    if (!result || !result.secure_url) {
      throw new Error('Invalid upload result from Cloudinary')
    }

    console.log(`✅ Successfully uploaded to Cloudinary:`, result.secure_url)

    return {
      url: result.secure_url,
      publicId: result.public_id,
      type: resourceType,
    }
  } catch (error) {
    console.error('Cloudinary upload failed:', error)

    // Normalize Cloudinary error objects (which may not be real Error instances)
    const anyError: any = error
    const message: string | undefined =
      (anyError && (anyError.message || anyError.error?.message || anyError.error?.error || anyError.error?.error_message)) ||
      (error instanceof Error ? error.message : undefined)

    const isStale = !!(message && message.includes('Stale request'))

    // DEV fallback: if clock skew causes Cloudinary failure, save to /public/uploads for local use
    if (isStale && process.env.NODE_ENV !== 'production') {
      try {
        const fallback = saveToLocalUploads(filePath, resourceType)
        cleanupFile(filePath)
        console.warn('Using local uploads fallback (dev mode):', fallback.url)
        return fallback
      } catch (fallbackError: any) {
        console.error('Local uploads fallback failed:', fallbackError)
        // Continue to throw the normalized error below
      }
    }

    // Clean up tmp file if still present
    cleanupFile(filePath)

    const normalizedMessage = (() => {
      if (isStale) {
        return 'Upload failed due to system time mismatch. Please sync your device clock and try again.'
      }
      if (message && message.includes('Invalid API key')) {
        return 'Invalid Cloudinary API credentials. Please check your environment variables.'
      }
      if (message) {
        return `Upload failed: ${message}`
      }
      try {
        return `Upload failed: ${JSON.stringify(anyError)}`
      } catch {
        return 'Upload failed: Unknown error'
      }
    })()

    throw new Error(normalizedMessage)
  }
}

// Helper function to safely clean up files
function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.warn('Failed to cleanup file:', filePath, error)
  }
}

// Save the uploaded tmp file into public/uploads (dev-only fallback)
function saveToLocalUploads(filePath: string, resourceType: 'image' | 'video'): UploadResult {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
  } catch (e) {
    throw new Error('Failed to create local uploads directory')
  }

  const extFromPath = path.extname(filePath)
  const defaultExt = resourceType === 'image' ? '.jpg' : '.mp4'
  const ext = extFromPath && extFromPath.length <= 6 ? extFromPath : defaultExt
  const filename = `local-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  const destPath = path.join(uploadsDir, filename)

  fs.copyFileSync(filePath, destPath)

  return {
    url: `/uploads/${filename}`,
    publicId: filename,
    type: resourceType,
  }
}

// Cache for file extensions to avoid repeated array operations
const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'])
const videoExts = new Set(['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'])

export function getFileType(filename: string): 'image' | 'video' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop()

  if (!ext) return 'unknown'
  if (imageExts.has(ext)) return 'image'
  if (videoExts.has(ext)) return 'video'
  return 'unknown'
}
