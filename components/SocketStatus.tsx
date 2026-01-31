'use client'

import { useSocket } from '@/contexts/SocketContext'
import { useEffect } from 'react'

export default function SocketStatus() {
  const { isConnected, isConnecting } = useSocket()

  // Log status changes to console
  useEffect(() => {
    if (isConnecting) {
      console.log('🟡 Socket Status: Connecting to server...')
    } else if (isConnected) {
      console.log('🟢 Socket Status: Connected')
    } else {
      console.log('🔴 Socket Status: Disconnected')
    }
  }, [isConnected, isConnecting])

  return null
}
