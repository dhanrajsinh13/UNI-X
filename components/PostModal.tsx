"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Image from 'next/image'

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: {
    id: number;
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
    location?: string;
    userLiked?: boolean;
    mediaCarousel?: Array<{
      url: string;
      type: 'image' | 'video';
    }>;
  };
  canManage?: boolean;
}

interface Comment {
  id: number;
  user: {
    id?: number;
    name: string;
    department?: string;
    year?: number;
    profile_image?: string | null;
  };
  text: string;
  timestamp: string;
  likes: number;
  userLiked: boolean;
}

const PostModal: React.FC<PostModalProps> = ({ isOpen, onClose, post, canManage }) => {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const [auraCount, setAuraCount] = useState(post.auraCount);
  const [hasAura, setHasAura] = useState(post.userLiked || false);
  const [isLiking, setIsLiking] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editCaption, setEditCaption] = useState(post.content);
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showOptions, setShowOptions] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [showFullCaption, setShowFullCaption] = useState(false);

  // Video progress and playback state for Instagram-like experience
  const [videoProgress, setVideoProgress] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [videoDuration, setVideoDuration] = useState(0);

  // Comments pagination state
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const COMMENTS_PAGE_SIZE = 20;

  // Helper function to convert enum category to readable format
  const formatCategory = (category?: string) => {
    if (!category) return '';

    const categoryMap: { [key: string]: string } = {
      'GENERAL': 'general',
      'ACADEMIC': 'academic',
      'EVENT': 'events',    // Singular form
      'EVENTS': 'events',   // Plural form
      'CLUBS': 'clubs',
      'SPORTS': 'sports',
      'SOCIAL': 'social',
      // Legacy values
      'INTERNSHIP': 'internship',
      'WORKSHOP': 'academic',
      'LIBRARY_MEMORY': 'library'
    };

    return categoryMap[category] || category.toLowerCase();
  };

  // Sync aura status when post data changes
  useEffect(() => {
    setAuraCount(post.auraCount);
    setHasAura(post.userLiked || false);
  }, [post.auraCount, post.userLiked]);

  // Listen for aura updates from PostCard
  useEffect(() => {
    const handleAuraUpdated = (event: any) => {
      if (event.detail.postId === post.id) {
        setAuraCount(event.detail.auraCount);
        setHasAura(event.detail.hasAura);
      }
    };

    window.addEventListener('auraUpdated', handleAuraUpdated);
    return () => window.removeEventListener('auraUpdated', handleAuraUpdated);
  }, [post.id]);

  // Get media items (either single media or carousel)
  const inferType = (url?: string, declared?: 'image' | 'video'): 'image' | 'video' | undefined => {
    if (!url) return undefined;
    if (declared === 'image' || declared === 'video') return declared;
    const lower = url.toLowerCase();
    if (lower.includes('/video/') || /(\.mp4|\.webm|\.mov|\.avi|\.wmv)$/i.test(lower)) {
      return 'video';
    }
    return 'image';
  };

  // Get media items (either single media or carousel)
  const mediaItems = post.mediaCarousel || (post.mediaUrl ? [{
    url: post.mediaUrl,
    type: inferType(post.mediaUrl, post.mediaType) || 'image'
  }] : []);

  const hasMultipleMedia = mediaItems.length > 1;

  // Auto-play video when modal opens (Instagram-like behavior)
  useEffect(() => {
    if (isOpen && videoRef.current) {
      // Small delay to ensure video is loaded
      const timer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(e => console.log('Auto-play failed:', e));
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentMediaIndex]);

  // Load comments from API
  useEffect(() => {
    if (isOpen && post.id) {
      // Reset pagination when opening
      setComments([]);
      setCommentsOffset(0);
      setHasMoreComments(true);
      loadComments(0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, post.id, token]);

  // Video progress tracking for Instagram-like progress chunks
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        const progress = (video.currentTime / video.duration) * 100;
        setVideoProgress(progress);
      }
    };

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
    };

    const handlePlay = () => setIsVideoPlaying(true);
    const handlePause = () => setIsVideoPlaying(false);

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [currentMediaIndex]);

  // Handle video tap to pause/play (Instagram-like)
  const handleVideoTap = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.log('Play failed:', e));
      }
    }
  };

  // Reset video progress when changing media
  useEffect(() => {
    setVideoProgress(0);
    setIsVideoPlaying(true);
  }, [currentMediaIndex]);

  const loadComments = async (offset: number, append: boolean) => {
    if (isLoadingComments) return;
    setIsLoadingComments(true);
    try {
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/comments?postId=${post.id}&limit=${COMMENTS_PAGE_SIZE}&offset=${offset}`, {
        headers
      });
      if (response.ok) {
        const data = await response.json();
        const fetched: Comment[] = data.comments || [];
        setHasMoreComments(fetched.length === COMMENTS_PAGE_SIZE);
        if (append) {
          setComments(prev => [...prev, ...fetched]);
        } else {
          setComments(fetched);
        }
        setCommentsOffset(offset);
      } else {
        const text = await response.text().catch(() => '');
        console.error('Failed to load comments:', response.status, text);
        // Fallback to empty array if API fails
        if (!append) setComments([]);
        setHasMoreComments(false);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      if (!append) setComments([]);
      setHasMoreComments(false);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleAuraClick = async () => {
    // Prevent multiple clicks while processing
    if (!token || isLiking) return;

    // Store the previous state for potential rollback
    const previousHasAura = hasAura;
    const previousAuraCount = auraCount;

    // Optimistic update - instant UI feedback
    const newHasAura = !hasAura;
    const newAuraCount = hasAura ? auraCount - 1 : auraCount + 1;

    setHasAura(newHasAura);
    setAuraCount(newAuraCount);
    setIsLiking(true);

    // Add visual feedback immediately
    const button = document.querySelector('[data-aura-button]') as HTMLElement;
    if (button) {
      button.style.transform = 'scale(1.15)';
      setTimeout(() => {
        if (button.style.transform === 'scale(1.15)') {
          button.style.transform = 'scale(1)';
        }
      }, 100);
    }

    try {
      const response = await fetch('/api/posts/aura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });

      if (response.ok) {
        const data = await response.json();
        // Sync with server response (in case there's a discrepancy)
        setAuraCount(data.post.aura_count);
        setHasAura(data.post.user_liked);

        // Broadcast aura change to PostCard component
        window.dispatchEvent(new CustomEvent('auraUpdated', {
          detail: {
            postId: post.id,
            auraCount: data.post.aura_count,
            hasAura: data.post.user_liked
          }
        }));
      } else {
        console.error('Failed to update aura');
        // Revert optimistic update if API fails
        setHasAura(previousHasAura);
        setAuraCount(previousAuraCount);
        showToast('Failed to update aura. Please try again.', 'error', 2000);
      }
    } catch (error) {
      console.error('Error updating aura:', error);
      // Revert optimistic update if API fails
      setHasAura(previousHasAura);
      setAuraCount(previousAuraCount);
      showToast('Network error. Please check your connection.', 'error', 2000);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCaptionSave = async () => {
    if (!token) return;
    const trimmed = editCaption.trim();

    // Validate caption is not empty
    if (!trimmed) {
      alert('Caption cannot be empty');
      return;
    }

    setIsSavingCaption(true);
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ caption: trimmed })
      });

      if (response.ok) {
        const data = await response.json();
        const newContent = data.post?.caption ?? trimmed;
        // Update the post content in the modal
        post.content = newContent;
        setEditCaption(newContent);
        setIsEditingCaption(false);
        // Dispatch event to update other components
        window.dispatchEvent(new CustomEvent('postUpdated', { detail: { id: post.id, content: newContent } }));
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Failed to update caption');
      }
    } catch (error) {
      console.error('Update caption failed', error);
      alert('Failed to update caption');
    } finally {
      setIsSavingCaption(false);
    }
  };

  const handleCommentButtonClick = useCallback(() => {
    try {
      commentInputRef.current?.focus();
      commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' } as any);
    } catch { }
  }, []);

  const handleShareClick = useCallback(async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.origin : '';
      const shareUrl = `${url}/post/${post.id}`;
      const shareText = post.content?.slice(0, 120) || 'Check this out';
      if ((navigator as any).share) {
        await (navigator as any).share({ title: `${post.authorName || 'User'} on UNIX`, text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard');
      }
    } catch (e) {
      try {
        const shareUrl = `${window.location.origin}/post/${post.id}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard');
      } catch { }
    }
  }, [post.id, post.content, post.authorName]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isPosting || !user || !token) return;

    const commentText = newComment.trim();
    const tempId = Date.now(); // Temporary ID for optimistic update

    // Optimistic update - add comment immediately
    const optimisticComment = {
      id: tempId,
      text: commentText,
      timestamp: 'Just now',
      likes: 0,
      userLiked: false,
      user: {
        id: user.id,
        name: user.name,
        avatar: null, // No avatar in User interface yet
      },
      parent_id: replyingTo || null,
    } as any;

    setComments(prev => [optimisticComment, ...prev]);
    setNewComment('');
    setReplyingTo(null);
    setIsPosting(true);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: post.id,
          comment_text: commentText,
          parent_id: replyingTo || undefined
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Replace optimistic comment with real one
        setComments(prev => prev.map(c =>
          c.id === tempId ? data.comment : c
        ));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error creating comment:', errorData.error);
        // Remove optimistic comment and restore input
        setComments(prev => prev.filter(c => c.id !== tempId));
        setNewComment(commentText);
        showToast(errorData.error || 'Failed to post comment', 'error');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      // Remove optimistic comment and restore input
      setComments(prev => prev.filter(c => c.id !== tempId));
      setNewComment(commentText);
      showToast('Failed to post comment. Please try again.', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    console.log('Emoji selected:', emoji); // Debug log
    const currentValue = newComment;
    const newValue = currentValue + emoji;
    console.log('Current value:', currentValue);
    console.log('New value:', newValue);
    setNewComment(newValue);
    setShowEmojiPicker(false);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker) {
        const target = event.target as Element;
        // Check if click is inside emoji picker or emoji button
        const emojiButton = target.closest('.emoji-picker-container');
        const emojiPicker = target.closest('.emoji-picker-dropdown');

        if (!emojiButton && !emojiPicker) {
          console.log('Clicking outside emoji picker, closing...');
          setShowEmojiPicker(false);
        }
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  if (!isOpen) return null;

  // Determine aspect ratio for media display based on Instagram specs
  const getMediaClasses = (mediaType?: string, mediaUrl?: string): string => {
    // For videos, check if it's Reels format (9:16) or feed format
    if (mediaType === 'video') {
      return 'w-full h-full object-contain'; // Let video maintain its natural ratio
    }

    // For images, default to Instagram's supported ratios
    // 1:1 (square), 4:5 (portrait), 1.91:1 (landscape)
    return 'w-full h-full object-contain';
  };

  // Helper function to get aspect ratio classes
  const getAspectRatio = (mediaType?: string) => {
    if (mediaType === 'image') {
      // Example: return square aspect ratio for images
      return 'aspect-square';
    }
    if (mediaType === 'video') {
      // Example: return portrait aspect ratio for videos
      return 'aspect-video';
    }
    return '';
  };

  // Parse caption for hashtags and mentions
  const parseCaption = (text: string) => {
    return text.replace(
      /(#[\w]+)|(@[\w]+)/g,
      (match) => {
        if (match.startsWith('#')) {
          return `<span class="text-blue-600 hover:underline cursor-pointer">${match}</span>`;
        } else {
          return `<span class="text-blue-600 hover:underline cursor-pointer font-semibold">${match}</span>`;
        }
      }
    );
  };

  // Truncate caption if longer than 125 characters
  const contentText = typeof post?.content === 'string' ? post.content : '';
  const shouldTruncate = contentText.length > 125;
  const displayContent = shouldTruncate && !showFullCaption
    ? contentText.substring(0, 125) + '...'
    : contentText;

  // Common emojis for picker
  const commonEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
    '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
    '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
    '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
    '😾', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍',
    '💯', '💫', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '💢', '💨',
    '👏', '🙌', '👐', '🤲', '🤝', '👍', '👎', '👊', '✊', '🤛',
    '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆',
    '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '💪', '🦾'
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-modal p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full h-[90vh] flex overflow-hidden shadow-2xl">
        {/* Left Side - Media */}
        <div className="flex-1 bg-black flex items-center justify-center relative">
          {mediaItems.length > 0 ? (
            <div className="w-full h-full flex items-center justify-center relative">
              {/* Current Media */}
              {mediaItems[currentMediaIndex].type === 'image' ? (
                <Image
                  src={mediaItems[currentMediaIndex].url}
                  alt="Post media"
                  className={getMediaClasses(mediaItems[currentMediaIndex].type, mediaItems[currentMediaIndex].url)}
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              ) : (
                <div className="relative w-full h-full">
                  {/* Instagram-style progress chunks at the top */}
                  <div className="absolute top-2 left-2 right-2 z-10 flex space-x-1">
                    {mediaItems.length > 1 ? (
                      // Multiple chunks for carousel
                      mediaItems.map((_, index) => (
                        <div
                          key={index}
                          className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
                        >
                          <div
                            className="h-full bg-white transition-all duration-100 ease-linear"
                            style={{
                              width: index === currentMediaIndex ? `${videoProgress}%` :
                                index < currentMediaIndex ? '100%' : '0%'
                            }}
                          />
                        </div>
                      ))
                    ) : (
                      // Single progress bar for single video
                      <div className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-100 ease-linear"
                          style={{ width: `${videoProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Video element with tap-to-pause */}
                  <video
                    ref={videoRef}
                    src={mediaItems[currentMediaIndex].url}
                    autoPlay
                    muted={false}
                    loop
                    playsInline
                    className={`${getMediaClasses(mediaItems[currentMediaIndex].type, mediaItems[currentMediaIndex].url)} cursor-pointer`}
                    onError={(e) => ((e.target as HTMLVideoElement).style.display = 'none')}
                    onLoadStart={() => console.log('Video loading started')}
                    onClick={handleVideoTap}
                    onCanPlay={() => {
                      console.log('Video ready to play');
                      // Ensure video plays on load like Instagram
                      if (videoRef.current) {
                        videoRef.current.play().catch(e => console.log('Auto-play failed:', e));
                      }
                    }}
                  >
                    <source src={mediaItems[currentMediaIndex].url} type="video/mp4" />
                    <track kind="captions" />
                    Your browser does not support the video tag.
                  </video>

                  {/* Play/Pause indicator (Instagram-like) */}
                  {!isVideoPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/50 rounded-full p-4">
                        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Carousel Navigation */}
              {hasMultipleMedia && (
                <>
                  {/* Previous Button */}
                  {currentMediaIndex > 0 && (
                    <button
                      onClick={() => setCurrentMediaIndex(currentMediaIndex - 1)}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      ‹
                    </button>
                  )}

                  {/* Next Button */}
                  {currentMediaIndex < mediaItems.length - 1 && (
                    <button
                      onClick={() => setCurrentMediaIndex(currentMediaIndex + 1)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    >
                      ›
                    </button>
                  )}

                  {/* Dots Indicator */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-1">
                    {mediaItems.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentMediaIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${index === currentMediaIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-white text-center p-8 flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-6">📝</div>
              <div className="max-w-md">
                <p
                  className="text-xl leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: parseCaption(contentText) }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Details & Comments */}
        <div className="w-96 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full overflow-hidden">
                <Image
                  src={post.profilePic || '/uploads/DefaultProfile.jpg'}
                  alt={post.authorName || 'User'}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                />
              </div>
              <div>
                <p className="font-semibold text-sm">{post.authorName || 'Unknown User'}</p>
                <p className="text-xs text-gray-500">{post.authorDept} • {post.authorYear}rd Year</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage && !isMobile && (
                <div className="relative">
                  <button
                    onClick={() => setShowOptions((v) => !v)}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                    title="Options"
                  >
                    <span className="text-xl leading-none">⋮</span>
                  </button>
                  {showOptions && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-lg z-20">
                      <button
                        onClick={() => { setIsEditingCaption(true); setShowOptions(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        Edit caption
                      </button>
                      <button
                        onClick={async () => {
                          if (!token) return;
                          try {
                            const resp = await fetch(`/api/posts/${post.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                            if (resp.status === 204) {
                              window.dispatchEvent(new CustomEvent('postDeleted', { detail: { id: post.id } }));
                              onClose();
                            } else {
                              const err = await resp.json().catch(() => ({} as any));
                              alert(err.error || 'Failed to delete post');
                            }
                          } catch (e) {
                            alert('Failed to delete post');
                          } finally {
                            setShowOptions(false);
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete post
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          {mediaItems.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-start space-x-3 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {post.authorName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <div className="flex items-start">
                    <span className="font-semibold text-sm mr-2">{post.authorName || 'Unknown User'}</span>
                    <div className="flex-1">
                      {!isEditingCaption ? (
                        <>
                          <span
                            className="text-sm text-gray-900 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: parseCaption(displayContent) }}
                          />
                          {shouldTruncate && (
                            <button
                              onClick={() => setShowFullCaption(!showFullCaption)}
                              className="text-gray-500 text-sm ml-1 hover:text-gray-700"
                            >
                              {showFullCaption ? ' less' : ' more'}
                            </button>
                          )}
                          {canManage && !isMobile && (
                            <button
                              onClick={() => setIsEditingCaption(true)}
                              className="text-gray-400 hover:text-gray-600 text-xs ml-2"
                              title="Edit caption"
                            >
                              ✏️
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="w-full">
                          <textarea
                            className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-300"
                            rows={3}
                            maxLength={2200}
                            value={editCaption}
                            onChange={(e) => setEditCaption(e.target.value)}
                          />
                          <div className="flex items-center space-x-2 mt-2">
                            <button
                              onClick={handleCaptionSave}
                              disabled={isSavingCaption || !editCaption.trim()}
                              className="px-3 py-1 rounded-md bg-[#02fa97] text-white text-sm disabled:opacity-60"
                            >
                              {isSavingCaption ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => { setIsEditingCaption(false); setEditCaption(post.content); }}
                              className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Location */}
                  {post.location && (
                    <div className="mt-1 ml-0">
                      <span className="text-xs text-gray-600">
                        📍 {post.location}
                      </span>
                    </div>
                  )}
                  {/* Category/Hashtag */}
                  {post.category && (
                    <div className="mt-2">
                      <span className="text-blue-600 text-sm hover:underline cursor-pointer">
                        #{formatCategory(post.category)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 ml-11">{post.timestamp}</p>
            </div>
          )}

          {/* Comments */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingComments && comments.length === 0 && (
              <div className="text-center text-gray-400 text-sm">Loading comments...</div>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0 overflow-hidden bg-gray-200">
                  {comment.user.profile_image ? (
                    <Image src={comment.user.profile_image} alt={comment.user.name} className="w-full h-full object-cover" />
                  ) : (
                    comment.user.name.charAt(0)
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start mb-1">
                    <span className="font-semibold text-sm mr-2">{comment.user.name}</span>
                    <span
                      className="text-sm text-gray-900 leading-relaxed flex-1"
                      dangerouslySetInnerHTML={{ __html: parseCaption(comment.text) }}
                    />
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span>{comment.timestamp}</span>
                    <button
                      onClick={async () => {
                        if (!token) return;

                        // Optimistic update - instant UI feedback
                        const currentLiked = comment.userLiked;
                        const currentLikes = comment.likes;
                        const newLiked = !currentLiked;
                        const newLikes = currentLiked ? currentLikes - 1 : currentLikes + 1;

                        // Update UI immediately
                        setComments(prev => prev.map(c => c.id === comment.id ? {
                          ...c,
                          likes: newLikes,
                          userLiked: newLiked
                        } : c));

                        try {
                          const resp = await fetch('/api/comments/like', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ commentId: comment.id })
                          });

                          if (resp.ok) {
                            const data = await resp.json();
                            // Update with server response (in case of discrepancy)
                            setComments(prev => prev.map(c => c.id === comment.id ? {
                              ...c,
                              likes: data.likes,
                              userLiked: data.liked
                            } : c));
                          } else {
                            // Rollback on error
                            setComments(prev => prev.map(c => c.id === comment.id ? {
                              ...c,
                              likes: currentLikes,
                              userLiked: currentLiked
                            } : c));
                            showToast('Failed to update comment like. Please try again.', 'error', 2000);
                            console.error('Like failed, rolled back');
                          }
                        } catch (e) {
                          // Rollback on error
                          setComments(prev => prev.map(c => c.id === comment.id ? {
                            ...c,
                            likes: currentLikes,
                            userLiked: currentLiked
                          } : c));
                          showToast('Network error. Please check your connection.', 'error', 2000);
                          console.error('Toggle like failed, rolled back', e);
                        }
                      }}
                      className={`flex items-center space-x-1 hover:scale-110 active:scale-95 transition-all duration-200 font-medium ${comment.userLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
                        }`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill={comment.userLiked ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.61C2.1283 5.6417 1.5487 7.04097 1.5487 8.5C1.5487 9.95903 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6053C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39467C21.7563 5.72723 21.351 5.1208 20.84 4.61V4.61Z" />
                      </svg>
                      <span>
                        {comment.likes > 0 && `${comment.likes} `}
                        {comment.likes === 1 ? 'like' : comment.likes > 1 ? 'likes' : 'Like'}
                      </span>
                    </button>
                    <button
                      onClick={() => { setReplyingTo(comment.id); setNewComment(`@${comment.user.name} `); }}
                      className="hover:text-gray-600 font-medium"
                    >
                      Reply
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const shareText = `${comment.user.name}: ${comment.text}`;
                          const shareUrl = window.location.href;
                          if ((navigator as any).share) {
                            await (navigator as any).share({ title: 'Comment', text: shareText, url: shareUrl });
                          } else {
                            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                            alert('Comment link copied');
                          }
                        } catch { }
                      }}
                      className="hover:text-gray-600 font-medium"
                    >
                      Share
                    </button>
                    {user && comment.user.id === user.id && (
                      <button
                        onClick={async () => {
                          if (!token) return;

                          // Optimistic update - remove comment immediately
                          setComments(prev => prev.filter(c => c.id !== comment.id));

                          try {
                            const resp = await fetch(`/api/comments?id=${comment.id}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });

                            if (resp.status !== 204) {
                              // Rollback if deletion failed
                              setComments(prev => {
                                // Re-add the comment back in its original position
                                const commentIndex = comments.findIndex(c => c.id === comment.id);
                                const newComments = [...prev];
                                newComments.splice(commentIndex, 0, comment);
                                return newComments;
                              });
                              showToast('Failed to delete comment', 'error');
                            }
                          } catch (e) {
                            console.error('Delete comment failed', e);
                            // Rollback on error
                            setComments(prev => {
                              const commentIndex = comments.findIndex(c => c.id === comment.id);
                              const newComments = [...prev];
                              newComments.splice(commentIndex, 0, comment);
                              return newComments;
                            });
                            showToast('Network error. Failed to delete comment.', 'error');
                          }
                        }}
                        className="text-red-500 hover:text-red-600 font-medium transition-colors"
                      >
                        Delete
                      </button>
                    )}
                    <button className="text-gray-300 hover:text-red-500">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.61C2.1283 5.6417 1.5487 7.04097 1.5487 8.5C1.5487 9.95903 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6053C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39467C21.7563 5.72723 21.351 5.1208 20.84 4.61V4.61Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!isLoadingComments && comments.length === 0 && (
              <div className="text-center text-gray-400 text-sm">No comments yet</div>
            )}
            {hasMoreComments && (
              <div className="pt-2">
                <button
                  onClick={() => loadComments(commentsOffset + COMMENTS_PAGE_SIZE, true)}
                  disabled={isLoadingComments}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 py-2 border border-gray-200 rounded-md disabled:opacity-50"
                >
                  {isLoadingComments ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 p-4">
            {!isMobile && (
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleAuraClick}
                    data-aura-button
                    className="flex items-center space-x-2 group hover:opacity-75 active:opacity-60 cursor-pointer"
                    style={{ transition: 'transform 0.2s ease-out' }}
                  >
                    <svg
                      width={24}
                      height={24}
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
                  </button>

                  <button onClick={handleCommentButtonClick} className="group transition-all duration-200 hover:scale-105" aria-label="Comment">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.5 12H8.51M12 12H12.01M15.5 12H15.51M21 12C21 16.418 16.97 20 12 20C10.89 20 9.84 19.79 8.88 19.42L3 21L4.58 15.12C4.21 14.16 4 13.11 4 12C4 7.582 8.03 4 12 4C16.97 4 21 7.582 21 12Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <button onClick={handleShareClick} className="group transition-all duration-200 hover:scale-105" aria-label="Share">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 13L10.5 9.5L13.5 12.5L17 9M21 12C21 16.418 16.97 20 12 20C7.03 20 3 16.418 3 12C3 7.582 7.03 4 12 4C16.97 4 21 7.582 21 12Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <button className="group transition-all duration-200 hover:scale-105" aria-label="Bookmark">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}

            <div className="text-sm font-semibold mb-1">
              {auraCount} {auraCount === 1 ? 'aura' : 'auras'}
            </div>

            <p className="text-xs text-gray-400 mb-3">
              {post.timestamp}
              {/* Add location if available */}
              {post.category && (
                <>
                  {' • '}
                  <span className="text-gray-600">#{formatCategory(post.category)}</span>
                </>
              )}
            </p>

            {/* Comment Input */}
            <div className="border-t border-gray-100 pt-3 relative">
              <form onSubmit={handleCommentSubmit} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {user?.name.charAt(0)}
                </div>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  maxLength={2200}
                  className="flex-1 border-none outline-none text-sm placeholder-gray-400"
                  disabled={isPosting}
                  ref={commentInputRef}
                />
                <div className="flex items-center space-x-2 emoji-picker-container">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🎯 Emoji button clicked! Current state:', showEmojiPicker);
                      setShowEmojiPicker(!showEmojiPicker);
                      console.log('🎯 Set showEmojiPicker to:', !showEmojiPicker);
                    }}
                    className="text-gray-400 hover:text-gray-600 relative text-lg"
                    title="Add emoji"
                  >
                    😊
                  </button>
                  {newComment.trim() && (
                    <button
                      type="submit"
                      disabled={isPosting}
                      className="text-[#02fa97] font-semibold text-sm hover:text-teal-600 disabled:opacity-50"
                    >
                      {isPosting ? 'Posting...' : 'Post'}
                    </button>
                  )}
                </div>
              </form>

              {/* Emoji Picker - Outside the form */}
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-white border-2 border-orange-100 rounded-lg shadow-xl p-3 w-80 h-48 overflow-y-auto emoji-picker-dropdown" style={{ zIndex: 10000 }}>
                  <div className="text-xs text-gray-500 mb-2">Click an emoji to add it: (Current: "{newComment}")</div>
                  <div className="grid grid-cols-8 gap-1">
                    {commonEmojis.map((emoji, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          console.log('Emoji div clicked:', emoji);
                          handleEmojiSelect(emoji);
                        }}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg transition-colors cursor-pointer border border-transparent hover:border-gray-300"
                        title={`Add ${emoji}`}
                      >
                        {emoji}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Character count for comments */}
              {newComment.length > 0 && (
                <div className="text-xs text-gray-400 mt-1 text-right">
                  {newComment.length}/2200
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostModal;