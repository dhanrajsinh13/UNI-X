'use client'

import { useState } from 'react'

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string
}

export default function SafeImage({ 
  src, 
  fallback = '/uploads/DefaultProfile.jpg',
  alt,
  ...props 
}: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src || fallback)
  const [hasError, setHasError] = useState(false)

  const handleError = () => {
    if (!hasError && imgSrc !== fallback) {
      setHasError(true)
      setImgSrc(fallback)
    }
  }

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      onError={handleError}
    />
  )
}
