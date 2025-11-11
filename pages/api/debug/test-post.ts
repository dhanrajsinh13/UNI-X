import { NextApiRequest, NextApiResponse } from 'next'
import { getCollection, Collections } from '../../../lib/mongodb'
import { getUserFromRequest } from '../../../lib/auth'
import { parseForm, uploadToCloudinary, getFileType } from '../../../lib/upload'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Environment check
    const envCheck = {
      MONGODB_URI: !!process.env.MONGODB_URI ? 'SET' : 'MISSING',
      JWT_SECRET: !!process.env.JWT_SECRET ? 'SET' : 'MISSING',
      CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'MISSING',
      CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY ? 'SET' : 'MISSING',
      CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET ? 'SET' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV,
    }

    // Authentication test
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(200).json({
        success: false,
        step: 'authentication',
        error: 'No authentication provided - add Authorization header',
        environment: envCheck,
      })
    }

    // Database connection test
    const users = await getCollection(Collections.USERS)
    const userCount = await users.countDocuments()

    // User validation
    const user = await users.findOne({ id: auth.userId })
    
    if (!user) {
      return res.status(200).json({
        success: false,
        step: 'user_validation',
        error: 'User not found',
        userId: auth.userId,
        environment: envCheck
      })
    }

    // Form parsing test
    let fields, files
    try {
      const parsed = await parseForm(req)
      fields = parsed.fields
      files = parsed.files
    } catch (parseError) {
      return res.status(200).json({
        success: false,
        step: 'form_parsing',
        error: parseError instanceof Error ? parseError.message : 'Form parsing failed',
        environment: envCheck
      })
    }

    // Cloudinary upload test (if file provided)
    let uploadResult = null
    if (files.media) {
      try {
        const file = Array.isArray(files.media) ? files.media[0] : files.media
        if (file?.filepath) {
          const fileType = getFileType(file.originalFilename || '')
          if (fileType !== 'unknown') {
            uploadResult = await uploadToCloudinary(file.filepath, fileType)
          }
        }
      } catch (uploadError) {
        return res.status(200).json({
          success: false,
          step: 'cloudinary_upload',
          error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
          environment: envCheck,
        })
      }
    }

    const caption = fields.caption ? (Array.isArray(fields.caption) ? fields.caption[0] : fields.caption).toString() : 'Debug test post'
    
    return res.status(200).json({
      success: true,
      message: 'Post debug test successful',
      environment: envCheck,
      user: {
        id: user.id,
        name: user.name,
        department: user.department,
        year: user.year
      },
      uploadResult: uploadResult,
      caption: caption.trim(),
      recommendations: [
        uploadResult ? '✅ File upload working' : '⚠️ No file provided for upload test',
        envCheck.CLOUDINARY_CLOUD_NAME === 'SET' ? '✅ Cloudinary configured' : '❌ Add Cloudinary environment variables',
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}