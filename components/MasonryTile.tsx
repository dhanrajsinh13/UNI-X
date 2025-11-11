"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';

interface MasonryTileProps {
  id: number;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  title?: string;
  onClick?: () => void;
}

const MENU_WIDTH_PX = 176; // 11rem
const MENU_HEIGHT_PX = 160; // approx height incl. padding

const MasonryTile: React.FC<MasonryTileProps> = ({ id, mediaUrl, mediaType = 'image', title, onClick }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isVideoHovered, setIsVideoHovered] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const share = useCallback(async () => {
    const url = `${window.location.origin}/post/${id}`;
    const text = title || 'Check this out on UNIX';
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'UNIX', text, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Post link copied');
      }
    } catch {}
    setMenuOpen(false);
  }, [id, title]);

  const bookmark = useCallback(async () => {
    const existing = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    if (!existing.includes(id)) existing.push(id);
    localStorage.setItem('bookmarks', JSON.stringify(existing));
    alert('Saved locally');
    setMenuOpen(false);
  }, [id]);

  const report = useCallback(async () => {
    alert('Thanks for the report. We will review this content.');
    setMenuOpen(false);
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `0:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleVideoLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setVideoLoaded(true);
      console.log('Video loaded successfully:', mediaUrl);
    }
  }, [mediaUrl]);

  const handleVideoCanPlay = useCallback(() => {
    setVideoLoaded(true);
    console.log('Video can play:', mediaUrl);
  }, [mediaUrl]);

  // Add timeout for video loading
  useEffect(() => {
    if (mediaType === 'video' && !videoLoaded && !videoError) {
      const timeout = setTimeout(() => {
        if (!videoLoaded) {
          console.warn('Video loading timeout:', mediaUrl);
          setVideoError(true);
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [mediaType, videoLoaded, videoError, mediaUrl]);

  const handleVideoMouseEnter = useCallback(() => {
    setIsVideoHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0; // Reset to start
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleVideoMouseLeave = useCallback(() => {
    setIsVideoHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // Reset to start
    }
  }, []);

  const computeMenuPosition = useCallback(() => {
    const btn = menuBtnRef.current;
    if (!btn) return { top: 0, left: 0 };
    const rect = btn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal position (align right edge, keep within viewport)
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH_PX, viewportWidth - MENU_WIDTH_PX - 8));

    // Decide to open up or down based on available space
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const openUp = spaceBelow < MENU_HEIGHT_PX;
    const desiredTop = openUp ? rect.top - MENU_HEIGHT_PX - 8 : rect.bottom + 8;
    const top = Math.max(8, Math.min(desiredTop, viewportHeight - MENU_HEIGHT_PX - 8));

    return { top, left };
  }, []);

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos(computeMenuPosition());
    setMenuOpen((v) => !v);
  }, [computeMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClose = () => setMenuOpen(false);
    const handleRecalc = () => setMenuPos(computeMenuPosition());
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleRecalc);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleRecalc);
    };
  }, [menuOpen, computeMenuPosition]);

  return (
    <div className="bg-white transition-shadow relative">
      <button onClick={onClick} className="block w-full text-left">
        {mediaType === 'video' ? (
          !videoError ? (
            <div 
              className="relative rounded-2xl overflow-hidden"
              onMouseEnter={handleVideoMouseEnter}
              onMouseLeave={handleVideoMouseLeave}
            >
              {!videoLoaded && (
                <div className="absolute inset-0 bg-gray-100 rounded-2xl flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🎥</div>
                    <div className="text-sm text-gray-500">Loading video...</div>
                  </div>
                </div>
              )}
              <video 
                ref={videoRef}
                src={mediaUrl} 
                className="w-full h-auto rounded-2xl block" 
                muted 
                playsInline 
                preload="metadata"
                style={{ maxHeight: '80vh' }}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onCanPlay={handleVideoCanPlay}
                onError={() => {
                  console.error('Video failed to load:', mediaUrl);
                  setVideoError(true);
                }}
                onLoadStart={() => {
                  console.log('Video loading started:', mediaUrl);
                }}
              />
              {videoDuration && !isVideoHovered && videoLoaded && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(videoDuration)}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-48 flex items-center justify-center text-gray-400 rounded-2xl bg-gray-100">
              <div className="text-center">
                <div className="text-2xl mb-2">🎥</div>
                <div className="text-sm">Video unavailable</div>
              </div>
            </div>
          )
        ) : (
          <div className={`bg-gray-100 rounded-2xl ${imgLoaded ? '' : 'animate-pulse'}`}>
            {!imgError ? (
              <img 
                src={mediaUrl}
                alt={title || 'post image'}
                className="w-full h-auto object-cover rounded-2xl"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center text-gray-400 rounded-2xl bg-gray-100">
                <div className="text-center">
                  <div className="text-2xl mb-2">🖼️</div>
                  <div className="text-sm">Image unavailable</div>
                </div>
              </div>
            )}
          </div>
        )}
      </button>

      <div className="p-3 flex items-center justify-between">
        <div className="text-sm text-gray-900 truncate max-w-[85%]">
          {title || ''}
        </div>
        <div>
          <button
            ref={menuBtnRef}
            onClick={openMenu}
            className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center"
            aria-label="More options"
          >
            <span className="text-xl text-zinc-500 leading-none">⋮</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          {/* click-away overlay */}
          <button
            aria-hidden
            className="fixed inset-0 z-[95] cursor-default"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); }}
          />
          <div
            className="fixed w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-[100]"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={share} className="w-full text-zinc-900 text-left px-4 py-2 text-sm hover:bg-gray-50">Share</button>
            <button onClick={bookmark} className="w-full text-zinc-900 text-left px-4 py-2 text-sm hover:bg-gray-50">Bookmark</button>
            <button onClick={report} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Report</button>
          </div>
        </>
      )}
    </div>
  );
};

export default memo(MasonryTile);
