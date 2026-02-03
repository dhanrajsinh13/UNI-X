'use client'

import Image, { ImageProps } from 'next/image'
import { useState } from 'react'

interface SafeImageProps extends Omit<ImageProps, 'src'> {
  src?: string
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
    <Image
      {...props}
      src={imgSrc as string}
      alt={alt || ''}
      onError={handleError}
    />
  )
}
