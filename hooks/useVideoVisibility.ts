"use client";

import { useEffect, useRef } from 'react';
import { useVideoContext } from '../contexts/VideoContext';

interface UseVideoVisibilityOptions {
  videoId: string;
  isFirstVideo?: boolean;
  isFeedVideo?: boolean; // Distinguishes feed videos from modal videos
  threshold?: number;
  onVisibilityChange?: (isVisible: boolean) => void;
  manuallyPaused?: boolean; // Track if user manually paused the video
}

export function useVideoVisibility({
  videoId,
  isFirstVideo = false,
  isFeedVideo = true,
  threshold = 0.5,
  onVisibilityChange,
  manuallyPaused = false
}: UseVideoVisibilityOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentPlayingId, setCurrentPlaying, isModalOpen } = useVideoContext();
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.isIntersecting;
          isVisibleRef.current = isVisible;
          
          onVisibilityChange?.(isVisible);

          if (isVisible) {
            // Feed videos should NOT play if modal is open
            if (isFeedVideo && isModalOpen) {
              if (!video.paused) {
                video.pause();
              }
              return;
            }

            // Don't auto-play if user manually paused
            if (manuallyPaused) {
              return;
            }

            // Only play if this video should be the current one
            setCurrentPlaying(videoId);
            
            // Try to play, handle autoplay restrictions
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                // Autoplay was prevented (common on mobile Safari)
                // Try muted autoplay instead
                console.log('Autoplay prevented, trying muted:', error);
                video.muted = true;
                video.play().catch((e) => console.log('Muted autoplay also failed:', e));
              });
            }
          } else {
            // Pause when not visible
            if (!video.paused) {
              video.pause();
            }
          }
        });
      },
      {
        threshold,
        rootMargin: '0px'
      }
    );

    observer.observe(video);

    // Cleanup on unmount
    return () => {
      observer.disconnect();
      if (currentPlayingId === videoId) {
        setCurrentPlaying(null);
      }
    };
  }, [videoId, threshold, onVisibilityChange, setCurrentPlaying, currentPlayingId, isModalOpen, isFeedVideo, manuallyPaused]);

  // Pause this video when another video starts playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (currentPlayingId !== null && currentPlayingId !== videoId && !video.paused) {
      video.pause();
    }
  }, [currentPlayingId, videoId]);

  // Pause feed videos when modal opens
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isFeedVideo) return;

    if (isModalOpen && !video.paused) {
      video.pause();
    } else if (!isModalOpen && isVisibleRef.current) {
      // Resume only if visible when modal closes
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => console.log('Resume playback failed:', e));
      }
    }
  }, [isModalOpen, isFeedVideo]);

  return videoRef;
}
