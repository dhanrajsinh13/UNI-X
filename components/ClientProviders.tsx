'use client';

import React from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { SocketProvider } from '../contexts/SocketContext';
import { ToastProvider } from '../contexts/ToastContext';
import { VideoProvider } from '../contexts/VideoContext';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <VideoProvider>
            {children}
          </VideoProvider>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
