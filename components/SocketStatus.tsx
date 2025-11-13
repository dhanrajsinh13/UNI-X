'use client'

import { useSocket } from '@/contexts/SocketContext'
import { useEffect, useState } from 'react'

export default function SocketStatus() {
  const { isConnected, isConnecting } = useSocket()
  const [show, setShow] = useState(true)

  // Auto-hide after 5 seconds when connected
  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => setShow(false), 5000)
      return () => clearTimeout(timer)
    } else {
      setShow(true)
    }
  }, [isConnected])

  if (!show && !isConnecting) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isConnecting && (
        <div className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          <span className="text-sm font-medium">Connecting to server...</span>
        </div>
      )}
      
      {isConnected && show && (
        <div className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Connected</span>
        </div>
      )}
      
      {!isConnected && !isConnecting && (
        <div className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="h-2 w-2 bg-white rounded-full"></div>
          <span className="text-sm font-medium">Disconnected</span>
        </div>
      )}
    </div>
  )
}
