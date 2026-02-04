"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

interface VideoContextType {
  currentPlayingId: string | null;
  setCurrentPlaying: (id: string | null) => void;
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const setCurrentPlaying = useCallback((id: string | null) => {
    setCurrentPlayingId(id);
  }, []);

  const setModalOpen = useCallback((open: boolean) => {
    setIsModalOpen(open);
    // When modal opens, pause all feed videos
    if (open) {
      setCurrentPlayingId(null);
    }
  }, []);

  return (
    <VideoContext.Provider value={{ currentPlayingId, setCurrentPlaying, isModalOpen, setModalOpen }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideoContext() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideoContext must be used within VideoProvider');
  }
  return context;
}
