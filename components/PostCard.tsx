"use client";
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { fetchAPI, dataFetcher } from '../lib/dataFetcher';

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
  onPostClick?: (post: PostCardProps) => void;
  edgeToEdge?: boolean;
  masonry?: boolean;
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
  onPostClick,
  edgeToEdge,
  masonry,
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
  const [isMuted, setIsMuted] = useState(true);

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
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to update like. Please try again.';
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
    e.stopPropagation(); // Prevent triggering modal
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleCommentClick = useCallback(() => {
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
    } else {
      alert('Comments feature is coming soon! 💬');
    }
  }, [onPostClick, id, authorId, authorName, authorDept, authorYear, editText, category, auraCount, commentCount, timestamp, profilePic, mediaUrl, mediaType, hasAura, edgeToEdge, masonry]);

  const handleShareClick = useCallback(async () => {
    const shareUrl = `${window.location.origin}/post/${id}`;
    const shareText = content?.slice(0, 120) || 'Check out this post';
    const shareData: ShareData = {
      title: `${authorName} on UNIX`,
      text: shareText,
      url: shareUrl,
    };

    try {
      if (navigator.share && typeof navigator.share === 'function') {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      // If Web Share fails, fall back to modal
      console.warn('Web Share failed, falling back:', err);
    }

    setShowShareModal(true);
  }, [content, id]);

  const copyToClipboard = useCallback(() => {
    const url = `${window.location.origin}/post/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Post link copied to clipboard! 📋');
      setShowShareModal(false);
    });
  }, [id]);

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

  const getCategoryColor = useMemo(() => (cat?: string) => {
    switch (cat?.toLowerCase()) {
      case 'event': return 'bg-red-100 text-red-800';
      case 'internship': return 'bg-blue-100 text-blue-800';
      case 'workshop': return 'bg-green-100 text-green-800';
      case 'library': return 'bg-purple-100 text-purple-800';
      default: return 'bg-teal-100 text-teal-800';
    }
  }, []);

  if (isDeleted) return null;

  return (
    <div className={`${edgeToEdge ? 'bg-white rounded-none border-0 shadow-none' : 'group bg-white rounded-3xl shadow-sm hover:shadow-xl border border-gray-100 hover:border-[#02fa97]/20 hover:-translate-y-1'} transition-all duration-300 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 relative">
        <div className="flex items-center space-x-3">
          <div 
            className="relative cursor-pointer"
            onClick={handleAuthorClick}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full overflow-hidden ring-2 ring-white shadow-md hover:ring-[#02fa97] transition-all duration-200">
              <img 
                src={profilePic || '/uploads/DefaultProfile.jpg'} 
                alt={authorName} 
                className="w-full h-full object-cover" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"></div>
          </div>
          <div 
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleAuthorClick}
          >
            <p className="font-semibold text-gray-900 text-sm hover:underline">{authorName}</p>
            <p className="text-xs text-gray-500">{authorDept} • {authorYear}rd Year</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {category && (
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${getCategoryColor(category)}`}>
              {category}
            </span>
          )}
          <span className="text-xs text-gray-400">{timestamp}</span>
          {/* In-feed edit/delete disabled: manage via profile modal only */}
        </div>
      </div>

      {/* Media - variable height for masonry, square otherwise */}
      {mediaUrl && (
        <div 
          className={`${!isMobile ? 'cursor-pointer' : ''}`}
          onClick={!isMobile && inferMediaType(mediaUrl, mediaType) !== 'video' ? handlePostClick : undefined}
        >
          {inferMediaType(mediaUrl, mediaType) === 'image' ? (
            <div className={`overflow-hidden bg-gray-100 ${mediaLoaded ? '' : 'animate-pulse'}`}>
              <div className={`${masonry ? '' : 'relative w-full aspect-square'} bg-gray-100`}>
                {!mediaError ? (
                  <img 
                    src={mediaUrl} 
                    alt="Post media" 
                    className={`${masonry ? 'w-full h-auto object-cover' : 'absolute inset-0 w-full h-full object-cover'}`}
                    onLoad={() => setMediaLoaded(true)}
                    onError={() => setMediaError(true)}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-white">
                    <span>Media unavailable</span>
                  </div>
                )}
              </div>
            </div>
          ) : inferMediaType(mediaUrl, mediaType) === 'video' ? (
            <div className="bg-black relative">
                            <div className={`${masonry ? '' : 'relative w-full aspect-square'} bg-black`}>
                {!mediaError ? (
                  <div className="relative w-full h-full">
                    <video 
                      src={mediaUrl} 
                      autoPlay
                      muted={isMuted}
                      loop
                      playsInline
                      preload="metadata"
                      className={`${masonry ? 'w-full h-auto' : 'absolute inset-0 w-full h-full object-cover'}`}
                      onCanPlay={() => setMediaLoaded(true)}
                      onError={() => setMediaError(true)}
                      onClick={handlePostClick}
                    />
                    
                    {/* Mute/Unmute button - only control allowed */}
                    <button
                      onClick={handleMuteToggle}
                      className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-all z-10"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                      )}
                    </button>

                    {/* Click to view modal hint */}
                    <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Tap to view
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-white">
                    <span>Video unavailable</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Caption - Instagram Style: Caption comes after media */}
      <div 
        className={`px-4 pb-3 ${!isMobile ? 'cursor-pointer' : ''}`}
        onClick={!isMobile ? handlePostClick : undefined}
      >
        {!isEditing ? (
          <>
            <p className={`text-sm text-gray-800 leading-relaxed ${!isExpanded && editText && editText.length > 150 ? 'line-clamp-3' : ''}`}>
              <span className="font-semibold text-gray-900 mr-1">{authorName}</span>
              {editText}
            </p>
            {editText && editText.length > 150 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-gray-500 text-xs font-medium mt-1 hover:underline"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </>
        ) : (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
              rows={3}
              maxLength={2200}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="flex items-center space-x-2">
              <button
                onClick={handleEditSave}
                disabled={isSaving || !editText.trim()}
                className="px-3 py-1 rounded-md bg-[#02fa97] text-white text-sm disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setIsEditing(false); setEditText(content); }}
                className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center space-x-6">
          {/* Aura/Like Button */}
          <button 
            id={`aura-btn-${id}`}
            onClick={handleAuraClick}
            data-aura-button
            className="flex items-center space-x-2 group hover:opacity-75 active:opacity-60 cursor-pointer"
            style={{ transition: 'transform 0.2s ease-out' }}
          >
            <svg 
              width={20} 
              height={20}
              viewBox="0 0 100 100"
              style={{
                fill: hasAura ? '#02fa97' : 'transparent',
                stroke: hasAura ? '#02fa97' : '#000000',
                strokeWidth: '2',
              }}
            >
              <polygon 
                points="77.333,33.31 55.438,33.31 75.43,1.829 47.808,1.829 23.198,51.05 41.882,51.05 21.334,99.808"
              />
            </svg>
            {auraCount > 0 && (
              <span className={`text-sm font-medium ${
                hasAura ? 'text-[#02fa97]' : 'text-gray-900'
              }`}>
                {auraCount}
              </span>
            )}
          </button>
          
          {/* Comment Button */}
          <button 
            onClick={handleCommentClick}
            className="flex items-center space-x-2 group transition-all duration-200 hover:scale-105"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
              <path d="M8.5 12H8.51M12 12H12.01M15.5 12H15.51M21 12C21 16.418 16.97 20 12 20C10.89 20 9.84 19.79 8.88 19.42L3 21L4.58 15.12C4.21 14.16 4 13.11 4 12C4 7.582 8.03 4 12 4C16.97 4 21 7.582 21 12Z" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-black"
              />
            </svg>
            {commentCount > 0 && (
              <span className="text-sm font-medium text-gray-900">{commentCount}</span>
            )}
          </button>
          
          {/* Share Button */}
          <button 
            onClick={handleShareClick}
            className="group transition-all duration-200 hover:scale-105"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
              <path d="M7 13L10.5 9.5L13.5 12.5L17 9M21 12C21 16.418 16.97 20 12 20C7.03 20 3 16.418 3 12C3 7.582 7.03 4 12 4C16.97 4 21 7.582 21 12Z" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-black"
              />
            </svg>
          </button>
        </div>
        
        {/* Bookmark Button */}
        <button className="group transition-all duration-200 hover:scale-105">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
            <path d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-black"
            />
          </svg>
        </button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Share Post</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/post/${id}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
                }}
                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg"
              >
                <span>Share to WhatsApp</span>
              </button>
              <button
                onClick={copyToClipboard}
                className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2V5L12 9L16 5V2H8Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M16 4H20V20H4V4H8" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <span>Copy Link</span>
              </button>
              <div className="text-xs text-gray-500 px-3">Tip: You can also use your device share menu.</div>
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full p-2 text-gray-500 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default PostCard;
