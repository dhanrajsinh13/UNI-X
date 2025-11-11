import { NextApiRequest, NextApiResponse } from 'next'
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
    // Verify authentication
    const auth = getUserFromRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Parse form data
    const { files } = await parseForm(req)
    
    if (!files.file) {
      return res.status(400).json({ error: 'No file provided' })
    }

    const file = Array.isArray(files.file) ? files.file[0] : files.file
    
    if (!file?.filepath) {
      return res.status(400).json({ error: 'Invalid file' })
    }

    // Get file type
    const fileType = getFileType(file.originalFilename || '')
    
    if (fileType !== 'image') {
      return res.status(400).json({ error: 'Only images are allowed' })
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(file.filepath, fileType)

    if (!uploadResult || !uploadResult.url) {
      return res.status(500).json({ error: 'Upload failed' })
    }

    return res.status(200).json({
      success: true,
      url: uploadResult.url,
      publicId: uploadResult.publicId
    })

  } catch (error) {
    console.error('Profile picture upload error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
