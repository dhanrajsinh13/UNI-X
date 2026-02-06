"use client";
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useVideoVisibility } from '../hooks/useVideoVisibility';
import { fetchAPI, dataFetcher } from '../lib/dataFetcher';
import Image from 'next/image';
import MobileCommentsSheet from './MobileCommentsSheet';
import ShareModal from './ShareModal';

interface PostCardProps {
  id: number;
  authorId?: number;
  authorName: string;
  authorDept: string;
  authorYear: number;
  content: string;
  category?: string;
  auraCount: number;
  commentCount: number;
  timestamp: string;
  profilePic?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  userLiked?: boolean;
  isFollowingUser?: boolean;
  onPostClick?: (post: PostCardProps) => void;
  edgeToEdge?: boolean;
  masonry?: boolean;
  isFirstPost?: boolean;
}

const PostCard: React.FC<PostCardProps> = memo(({
  id,
  authorId,
  authorName,
  authorDept,
  authorYear,
  content,
  category,
  auraCount: initialAuraCount,
  commentCount,
  timestamp,
  profilePic,
  mediaUrl,
  mediaType,
  userLiked,
  isFollowingUser,
  onPostClick,
  edgeToEdge,
  masonry,
  isFirstPost,
}) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const router = useRouter();
  const [auraCount, setAuraCount] = useState(initialAuraCount);
  const [hasAura, setHasAura] = useState(userLiked || false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isMuted, setIsMuted] = useState(!isFirstPost);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(isFollowingUser || false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [showPlayPauseIndicator, setShowPlayPauseIndicator] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showMobileComments, setShowMobileComments] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Use video visibility hook for auto-play/pause (feed video)
  const videoRef = useVideoVisibility({
    videoId: `post-${id}`,
    isFirstVideo: isFirstPost,
    isFeedVideo: true, // Mark as feed video (will pause when modal opens)
    threshold: 0.5,
    manuallyPaused,
    onVisibilityChange: (isVisible) => {
      // Auto-unmute first video when visible, mute when not
      if (isFirstPost && !isVisible && !isMuted) {
        setIsMuted(true);
      }
    }
  });

  // Sync aura state when props change (after refresh)
  useEffect(() => {
    setAuraCount(initialAuraCount);
    setHasAura(userLiked || false);
  }, [initialAuraCount, userLiked]);

  // Listen for aura updates from PostModal
  useEffect(() => {
    const handleAuraUpdated = (event: any) => {
      if (event.detail.postId === id) {
        setAuraCount(event.detail.auraCount);
        setHasAura(event.detail.hasAura);
      }
    };

    window.addEventListener('auraUpdated', handleAuraUpdated);
    return () => window.removeEventListener('auraUpdated', handleAuraUpdated);
  }, [id]);

  // Note: Follow status is managed optimistically
  // Initial state is false (not following), updates after user clicks follow

  const inferMediaType = useCallback((
    url?: string,
    declared?: 'image' | 'video'
  ): 'image' | 'video' | undefined => {
    if (!url) return undefined;
    if (declared === 'image' || declared === 'video') return declared;
    const lower = url.toLowerCase();
    if (lower.includes('/video/') || /(\.mp4|\.webm|\.mov|\.avi|\.wmv)$/i.test(lower)) {
      return 'video';
    }
    return 'image';
  }, []);

  const handleAuraClick = useCallback(async () => {
    // Prevent multiple clicks while processing
    if (!token || isLiking) return;

    // OPTIMISTIC UPDATE - Update UI immediately for instant feedback
    const previousHasAura = hasAura;
    const previousAuraCount = auraCount;

    // Update UI instantly (before API call)
    const newHasAura = !hasAura;
    const newAuraCount = hasAura ? auraCount - 1 : auraCount + 1;

    setHasAura(newHasAura);
    setAuraCount(newAuraCount);

    // Visual feedback - immediate scale and color change
    const button = document.getElementById(`aura-btn-${id}`);
    if (button) {
      button.style.transform = 'scale(1.2)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 150);
    }

    setIsLiking(true);

    try {
      const data = await fetchAPI<{ post: { aura_count: number; user_liked: boolean } }>(
        '/api/posts/aura',
        {
          method: 'POST',
          token: token || '',
          body: JSON.stringify({ postId: id }),
          skipCache: true
        }
      );

      // Validate response format
      if (!data?.post || typeof data.post.aura_count !== 'number') {
        throw new Error('Invalid response format');
      }

      // Sync with server response (in case there's a discrepancy)
      setAuraCount(data.post.aura_count);
      setHasAura(data.post.user_liked);

      // Clear post cache
      dataFetcher.clearCache('/api/posts');
      dataFetcher.clearCache(`/api/posts/${id}`);

      // Broadcast aura change to PostModal
      window.dispatchEvent(new CustomEvent('auraUpdated', {
        detail: {
          postId: id,
          auraCount: data.post.aura_count,
          hasAura: data.post.user_liked
        }
      }));
    } catch (error: any) {
      console.error('Error updating aura:', error);
      // Revert optimistic update if API fails
      setHasAura(previousHasAura);
      setAuraCount(previousAuraCount);

      const errorMessage = error instanceof Error ? error.message : 'Failed to update Aura. Please try again.';
      showToast(errorMessage, 'error', 2000);

      // Show error feedback
      if (button) {
        button.style.filter = 'brightness(0.5)';
        setTimeout(() => {
          button.style.filter = 'brightness(1)';
        }, 200);
      }
    } finally {
      setIsLiking(false);
    }
  }, [token, id, hasAura, auraCount, isLiking, showToast]);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering play/pause
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVideoClick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsVideoPlaying(true);
      setManuallyPaused(false); // User resumed playback
    } else {
      video.pause();
      setIsVideoPlaying(false);
      setManuallyPaused(true); // User manually paused
    }

    // Show play/pause indicator briefly
    setShowPlayPauseIndicator(true);
    setTimeout(() => setShowPlayPauseIndicator(false), 500);
  }, [videoRef]);

  const handleCommentClick = useCallback(() => {
    // On mobile, open comments sheet instead of full modal
    if (isMobile) {
      setShowMobileComments(true);
      return;
    }

    // On desktop, open full post modal
    if (onPostClick) {
      onPostClick({
        id,
        authorId,
        authorName,
        authorDept,
        authorYear,
        content: editText,
        category,
        auraCount,
        commentCount,
        timestamp,
        profilePic,
        mediaUrl,
        mediaType,
        userLiked: hasAura,
        onPostClick,
        edgeToEdge,
        masonry,
      });
    } else {
      alert('Comments feature is coming soon! 💬');
    }
  }, [isMobile, onPostClick, id, authorId, authorName, authorDept, authorYear, editText, category, auraCount, commentCount, timestamp, profilePic, mediaUrl, mediaType, hasAura, edgeToEdge, masonry]);

  const handleShareClick = useCallback(async () => {
    setShowShareModal(true);
  }, []);

  const handlePostClick = useCallback(() => {
    if (onPostClick) {
      onPostClick({
        id,
        authorId,
        authorName,
        authorDept,
        authorYear,
        content: editText,
        category,
        auraCount,
        commentCount,
        timestamp,
        profilePic,
        mediaUrl,
        mediaType,
        userLiked: hasAura, // Pass current aura status
        onPostClick,
        edgeToEdge,
        masonry,
      });
    }
  }, [onPostClick, id, authorId, authorName, authorDept, authorYear, editText, category, auraCount, commentCount, timestamp, profilePic, mediaUrl, mediaType, hasAura, edgeToEdge, masonry]);

  const handleEditSave = useCallback(async () => {
    if (!token) return;
    const trimmed = (editText || '').trim();

    // Validate caption is not empty
    if (!trimmed) {
      alert('Caption cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const data = await fetchAPI<{ post: { caption: string } }>(
        `/api/posts/${id}`,
        {
          method: 'PUT',
          token: token || '',
          body: JSON.stringify({ caption: trimmed }),
          skipCache: true
        }
      );

      const newContent = data.post?.caption ?? trimmed;
      setEditText(newContent);
      setIsEditing(false);
      setShowOptions(false);

      // Clear caches
      dataFetcher.clearCache('/api/posts');
      dataFetcher.clearCache(`/api/posts/${id}`);
      dataFetcher.clearCache('/api/users/me');

      window.dispatchEvent(new CustomEvent('postUpdated', { detail: { id, content: newContent } }));
    } catch (error: any) {
      console.error('Update post failed', error);
      alert(error.message || 'Failed to update post');
    } finally {
      setIsSaving(false);
    }
  }, [token, id, editText]);

  const handleDelete = useCallback(async () => {
    if (!token || isDeleting) return;
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await fetchAPI(`/api/posts/${id}`, {
        method: 'DELETE',
        token: token || '',
        skipCache: true
      });

      // Clear caches
      dataFetcher.clearCache('/api/posts');
      dataFetcher.clearCache(`/api/posts/${id}`);
      dataFetcher.clearCache('/api/users/me');

      window.dispatchEvent(new CustomEvent('postDeleted', { detail: { id } }));
      setIsDeleted(true);
    } catch (error: any) {
      console.error('Delete post failed', error);
      alert(error.message || 'Failed to delete post');
    } finally {
      setIsDeleting(false);
      setShowOptions(false);
    }
  }, [token, id]);

  const handleAuthorClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (authorId) {
      if (user && user.id === authorId) {
        router.push('/profile/me');
      } else {
        router.push(`/profile/${authorId}`);
      }
    }
  }, [authorId, user, router]);

  const handleFollowClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !authorId || isFollowLoading) return;

    setIsFollowLoading(true);
    const previousFollowState = isFollowing;

    // Optimistic update
    setIsFollowing(!isFollowing);

    try {
      await fetchAPI('/api/users/follow', {
        method: 'POST',
        token,
        body: JSON.stringify({ userId: authorId }),
        skipCache: true
      });

      // Clear relevant caches
      dataFetcher.clearCache('/api/users/suggestions');
      dataFetcher.clearCache(`/api/users/${authorId}`);
    } catch (error: any) {
      console.error('Follow/unfollow error:', error);
      // Revert on error
      setIsFollowing(previousFollowState);
      showToast(error.message || 'Failed to update follow status', 'error');
    } finally {
      setIsFollowLoading(false);
    }
  }, [token, authorId, isFollowing, isFollowLoading, showToast]);

  const getCategoryColor = useMemo(() => (cat?: string) => {
    switch (cat?.toLowerCase()) {
      case 'event':
      case 'events':
        return 'badge-error';
      case 'internship':
      case 'academic':
        return 'badge-primary';
      case 'workshop':
        return 'badge-success';
      case 'library':
        return 'badge-warning';
      case 'clubs':
      case 'sports':
        return 'badge-success';
      case 'social':
        return 'badge-gray';
      default:
        return 'badge-primary';
    }
  }, []);

  if (isDeleted) return null;

  return (
    <div ref={containerRef} className={`${edgeToEdge ? 'bg-white border-b border-border-light' : 'bg-white border border-border-light rounded-xl mb-4'} overflow-hidden`}>
      {/* Header - Instagram Style */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="cursor-pointer"
            onClick={handleAuthorClick}
          >
            <Image
              src={profilePic || '/uploads/DefaultProfile.jpg'}
              alt={authorName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover border border-border-light"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
            />
          </div>
          <div
            className="cursor-pointer"
            onClick={handleAuthorClick}
          >
            <p className="font-semibold text-sm text-gray-900">
              {authorName}
              {user && authorId && user.id !== authorId && !isFollowingUser && (
                <>
                  <span className="text-gray-400 mx-1">•</span>
                  <button
                    onClick={handleFollowClick}
                    disabled={isFollowLoading}
                    className="text-info hover:text-info/80 font-semibold transition-colors disabled:opacity-50"
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="6" cy="12" r="1.5" />
            <circle cx="18" cy="12" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Media - Instagram Style */}
      {mediaUrl && (
        <div className="w-full">
          {inferMediaType(mediaUrl, mediaType) === 'image' ? (
            <div className={`relative w-full ${imageAspectRatio && Math.abs(imageAspectRatio - 1) < 0.1 ? 'bg-gray-100' : 'bg-black'}`} style={{ maxHeight: '600px' }}>
              {!mediaError ? (
                <Image
                  src={mediaUrl}
                  alt="Post media"
                  width={600}
                  height={600}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: '600px' }}
                  onLoad={(e) => {
                    setMediaLoaded(true);
                    const img = e.currentTarget as HTMLImageElement;
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    setImageAspectRatio(aspectRatio);
                  }}
                  onError={() => setMediaError(true)}
                />
              ) : (
                <div className="w-full h-96 flex items-center justify-center text-gray-400 bg-gray-100">
                  <span>Media unavailable</span>
                </div>
              )}
            </div>
          ) : inferMediaType(mediaUrl, mediaType) === 'video' ? (
            <div className="relative w-full bg-black" style={{ maxHeight: '600px' }}>
              {!mediaError ? (
                <div className="relative w-full">
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    muted={isMuted}
                    loop
                    playsInline
                    preload="metadata"
                    className="w-full h-auto object-contain cursor-pointer"
                    style={{ maxHeight: '600px' }}
                    onCanPlay={() => setMediaLoaded(true)}
                    onError={() => setMediaError(true)}
                    onClick={handleVideoClick}
                  />

                  {/* Play/Pause Indicator */}
                  {showPlayPauseIndicator && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/70 rounded-full p-4 animate-fade-in">
                        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                          {isVideoPlaying ? (
                            <path d="M8 5v14l11-7z" />
                          ) : (
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                          )}
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Mute/Unmute button */}
                  <button
                    onClick={handleMuteToggle}
                    className="absolute bottom-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-all"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <div className="w-full h-96 flex items-center justify-center text-gray-400 bg-gray-100">
                  <span>Video unavailable</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Actions - Instagram Style */}
      <div className="px-4 pt-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            {/* Aura/Like Button */}
            <button
              id={`aura-btn-${id}`}
              onClick={handleAuraClick}
              data-aura-button
              className="hover:opacity-60 transition-all duration-fast active:scale-110"
            >
              <svg
                width={24}
                height={24}
                viewBox="0 0 100 100"
                style={{
                  fill: hasAura ? '#FFAF50' : 'transparent',
                  stroke: hasAura ? '#FFAF50' : '#262626',
                  strokeWidth: '3',
                }}
              >
                <polygon
                  points="77.333,33.31 55.438,33.31 75.43,1.829 47.808,1.829 23.198,51.05 41.882,51.05 21.334,99.808"
                />
              </svg>
            </button>

            {/* Comment Button */}
            <button
              onClick={handleCommentClick}
              className="hover:opacity-60 transition-opacity duration-fast"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShareClick}
              className="hover:opacity-60 transition-opacity duration-fast"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {/* Bookmark Button */}
          <button className="hover:opacity-60 transition-opacity duration-fast">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        {/* Like Count */}
        {auraCount > 0 && (
          <div className="mb-2">
            <span className="font-semibold text-sm text-gray-900">{auraCount} {auraCount === 1 ? 'Aura' : 'Auras'}</span>
          </div>
        )}
      </div>

      {/* Caption - Instagram Style */}
      <div className="px-4 pb-2">
        {!isEditing ? (
          <>
            <p className="text-sm text-gray-900 leading-tight">
              <span className="font-semibold mr-1.5">{authorName}</span>
              <span className={!isExpanded && editText && editText.length > 150 ? 'line-clamp-2' : ''}>
                {editText}
              </span>
            </p>
            {editText && editText.length > 150 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-text-tertiary text-sm mt-1 hover:text-text-secondary transition-colors"
              >
                {isExpanded ? 'less' : 'more'}
              </button>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full p-2 border border-gray-300 rounded text-sm"
              rows={3}
              maxLength={2200}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleEditSave}
                disabled={isSaving || !editText.trim()}
                className="px-4 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditText(content); }}
                className="px-4 py-1 bg-gray-200 text-gray-900 text-sm rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-2">
          <span className="text-xs text-text-tertiary">{timestamp}</span>
        </div>
      </div>

      {/* Mobile Comments Sheet */}
      {showMobileComments && (
        <MobileCommentsSheet
          isOpen={showMobileComments}
          onClose={() => setShowMobileComments(false)}
          postId={id}
          authorName={authorName}
          authorProfilePic={profilePic}
          content={editText}
          timestamp={timestamp}
          auraCount={auraCount}
          hasAura={hasAura}
          onAuraClick={handleAuraClick}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        postId={id}
        postContent={editText}
        postMediaUrl={mediaUrl}
        postMediaType={mediaType}
        authorName={authorName}
        authorId={authorId}
      />
    </div>
  );
});

PostCard.displayName = 'PostCard';

export default PostCard;
