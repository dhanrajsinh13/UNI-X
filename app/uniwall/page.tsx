'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import MasonryTile from '../../components/MasonryTile';
import PostModal from '../../components/PostModal';
import PostCard from '../../components/PostCard';
import { EmbeddedSearch } from '../../components/SearchModal';
import { usePosts } from '../../hooks/usePosts';
import { useAuth } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useIsMobile';

// PostModal expected type
interface PostModalData {
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
  location?: string;
  userLiked?: boolean;
  mediaCarousel?: Array<{
    url: string;
    type: 'image' | 'video';
  }>;
}

// Post from API
interface Post {
  id: number;
  content: string;
  category: string;
  media_url?: string;
  media_type?: string;
  aura_count: number;
  user_liked: boolean;
  created_at: string;
  author: {
    id: number;
    name: string;
    department: string;
    year: number;
    profile_image?: string;
  };
}

// Helper to infer media type reliably
function inferPostType(post: Post): 'image' | 'video' {
  const declared = (post.media_type || '').toLowerCase();
  if (declared === 'image' || declared === 'video') return declared as 'image' | 'video';
  const url = (post.media_url || '').toLowerCase();
  if (!url) return 'image';
  if (url.includes('/video/') || /(\.mp4|\.webm|\.mov|\.avi|\.wmv)$/i.test(url)) return 'video';
  return 'image';
}

// Video Grid Tile Component with hover-to-play and duration badge
interface VideoGridTileProps {
  post: Post;
  onClick: () => void;
}

const VideoGridTile: React.FC<VideoGridTileProps> = ({ post, onClick }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoHovered, setIsVideoHovered] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoMouseEnter = () => {
    setIsVideoHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch(console.error);
    }
  };

  const handleVideoMouseLeave = () => {
    setIsVideoHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setVideoLoaded(true);
    }
  };

  const kind = inferPostType(post);

  return (
    <button onClick={onClick} className="group relative aspect-square bg-gray-100 overflow-hidden">
      {post.media_url ? (
        kind === 'video' ? (
          !videoError ? (
            <div
              className="relative w-full h-full"
              onMouseEnter={handleVideoMouseEnter}
              onMouseLeave={handleVideoMouseLeave}
            >
              {/* Loading state for videos */}
              {!videoLoaded && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🎥</div>
                    <div className="text-sm text-gray-500">Loading...</div>
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                src={post.media_url}
                className="w-full h-full object-cover"
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={handleVideoLoadedMetadata}
                onError={() => setVideoError(true)}
              />
              {/* Duration badge - hidden on hover */}
              {videoDuration && !isVideoHovered && videoLoaded && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(videoDuration)}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
              <div className="text-center">
                <div className="text-2xl mb-2">🎥</div>
                <div className="text-sm">Video unavailable</div>
              </div>
            </div>
          )
        ) : (
          <img
            src={post.media_url}
            alt={post.content?.slice(0, 40) || 'Post image'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm p-4">{post.content}</div>
      )}
    </button>
  );
};

export default function UniWallPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<PostModalData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { posts, loading, error, refetch } = usePosts(
    selectedCategory === 'all' ? undefined : selectedCategory,
    50
  );
  
  // Mobile fullscreen overlay state
  const [isFullscreenListOpen, setIsFullscreenListOpen] = useState(false);
  const [fullscreenPostId, setFullscreenPostId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Sync feed with inline updates/deletes
  React.useEffect(() => {
    const handleUpdated = (e: any) => {
      const { id, content } = e.detail || {};
      if (!id) return;
      // Optimistically update selected modal content if open
      if (selectedPost && selectedPost.id === id) {
        setSelectedPost({ ...selectedPost, content: content ?? selectedPost.content });
      }
    };
    const handleDeleted = (e: any) => {
      const { id } = e.detail || {};
      if (selectedPost && selectedPost.id === id) {
        setIsModalOpen(false);
        setSelectedPost(null);
      }
      // Let usePosts hook handle list removal
    };
    window.addEventListener('postUpdated', handleUpdated as EventListener);
    window.addEventListener('postDeleted', handleDeleted as EventListener);
    return () => {
      window.removeEventListener('postUpdated', handleUpdated as EventListener);
      window.removeEventListener('postDeleted', handleDeleted as EventListener);
    };
  }, [selectedPost]);

  // No need for scroll to post in single post view
  useEffect(() => {
    // Lock body scroll when fullscreen overlay is open
    if (isFullscreenListOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [isFullscreenListOpen]);

  // Filter posts that have media only
  const mediaOnlyPosts = useMemo(() =>
    posts.filter((post: Post) => post.media_url),
    [posts]
  );

  const openPost = useCallback((post: Post) => {
    // On mobile, open fullscreen single PostCard
    if (isMobile) {
      setFullscreenPostId(post.id);
      setIsFullscreenListOpen(true);
      return;
    }

    // On desktop, open modal
    const modalPost: PostModalData = {
      id: post.id,
      authorName: post.author.name,
      authorDept: post.author.department,
      authorYear: post.author.year,
      content: post.content,
      category: post.category,
      auraCount: post.aura_count,
      commentCount: 0,
      timestamp: new Date(post.created_at).toLocaleDateString(),
      profilePic: post.author.profile_image,
      mediaUrl: post.media_url,
      mediaType: post.media_type as 'image' | 'video',
      userLiked: post.user_liked,
    };
    setSelectedPost(modalPost);
    setIsModalOpen(true);
  }, [isMobile]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedPost(null);
  }, []);

  const categories = [
    { id: 'all', name: 'All', emoji: '🔥' },
    { id: 'academic', name: 'Academic', emoji: '📚' },
    { id: 'events', name: 'Events', emoji: '🎉' },
    { id: 'clubs', name: 'Clubs', emoji: '👥' },
    { id: 'sports', name: 'Sports', emoji: '⚽' },
    { id: 'social', name: 'Social', emoji: '💬' },
    { id: 'general', name: 'General', emoji: '💭' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Please log in to view the wall</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Mobile Search Bar - Instagram Style (visible only on mobile) */}
        <div className="md:hidden mb-4">
          <EmbeddedSearch className="w-full" />
        </div>

        {/* Header with title and categories */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Uniwall</h1>

          {/* Category filters - scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full border text-sm transition-all duration-200 ${selectedCategory === category.id
                  ? 'border-gray-900 text-gray-900 bg-gray-50 shadow-sm'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <span className="mr-1">{category.emoji}</span>
                <span className="hidden sm:inline">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-[#FFAF50] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Unable to load posts</p>
            <button
              onClick={refetch}
              className="text-[#FFAF50] font-semibold hover:text-orange-600"
            >
              Try Again
            </button>
          </div>
        ) : mediaOnlyPosts.length > 0 ? (
          <>
            {/* Mobile Grid - Instagram Style 3-column layout */}
            <div className="md:hidden">
              <div className="grid grid-cols-3 gap-0.5">
                {mediaOnlyPosts.map((post: Post) => (
                  <VideoGridTile
                    key={post.id}
                    post={post}
                    onClick={() => openPost(post)}
                  />
                ))}
              </div>
            </div>

            {/* Desktop Masonry Layout */}
            <div className="hidden md:block [column-fill:_balance] gap-4 columns-[16rem] lg:columns-[18rem] xl:columns-[20rem] 2xl:columns-[22rem]">
              {mediaOnlyPosts.map((post: Post) => (
                <div key={post.id} className="mb-4 break-inside-avoid">
                  <MasonryTile
                    id={post.id}
                    mediaUrl={post.media_url!}
                    mediaType={(post.media_type?.toLowerCase() as 'image' | 'video') || 'image'}
                    title={post.content}
                    onClick={() => openPost(post)}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No media posts yet</h3>
            <p className="text-gray-600">Be the first to share a photo or video!</p>
          </div>
        )}
      </div>

      {selectedPost && (
        <PostModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          post={selectedPost}
        />
      )}

      {/* Mobile Fullscreen Single Post View */}
      {isFullscreenListOpen && isMobile && fullscreenPostId && (
        <div className="fixed inset-0 z-[60] bg-white overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-[61] bg-white/90 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-gray-200">
            <button
              onClick={() => setIsFullscreenListOpen(false)}
              className="text-gray-900 text-sm font-medium"
            >
              ← Back
            </button>
            <div className="text-sm text-gray-600">Post</div>
            <div className="w-10" />
          </div>

          {/* Single Post */}
          <div className="h-[calc(100%-57px)] overflow-y-auto overflow-x-hidden overscroll-contain">
            {(() => {
              const post = mediaOnlyPosts.find((p: Post) => p.id === fullscreenPostId);
              if (!post) return null;
              
              return (
                <PostCard
                  id={post.id}
                  authorId={post.author.id}
                  authorName={post.author.name}
                  authorDept={post.author.department}
                  authorYear={post.author.year}
                  content={post.content}
                  category={post.category}
                  auraCount={post.aura_count || 0}
                  commentCount={0}
                  timestamp={new Date(post.created_at).toLocaleDateString()}
                  profilePic={post.author.profile_image || undefined}
                  mediaUrl={post.media_url}
                  mediaType={(post.media_type as 'image' | 'video') || undefined}
                  userLiked={post.user_liked}
                  onPostClick={(pc) => {
                    const modalPost: PostModalData = {
                      id: pc.id,
                      authorName: pc.authorName,
                      authorDept: pc.authorDept,
                      authorYear: pc.authorYear,
                      content: pc.content,
                      category: pc.category,
                      auraCount: pc.auraCount,
                      commentCount: pc.commentCount,
                      timestamp: pc.timestamp,
                      profilePic: pc.profilePic,
                      mediaUrl: pc.mediaUrl,
                      mediaType: pc.mediaType,
                      userLiked: pc.userLiked,
                    };
                    setSelectedPost(modalPost);
                    setIsModalOpen(true);
                  }}
                  edgeToEdge
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}