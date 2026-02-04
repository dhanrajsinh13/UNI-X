'use client';

import React, { useState, useCallback, useMemo } from 'react';
import MasonryTile from '../../components/MasonryTile';
import PostModal from '../../components/PostModal';
import { EmbeddedSearch } from '../../components/SearchModal';
import { usePosts } from '../../hooks/usePosts';
import { useAuth } from '../../contexts/AuthContext';

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

export default function UniWallPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<PostModalData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const { posts, loading, error, refetch } = usePosts(
    selectedCategory === 'all' ? undefined : selectedCategory,
    50
  );

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

  // Filter posts that have media only
  const mediaOnlyPosts = useMemo(() =>
    posts.filter((post: Post) => post.media_url),
    [posts]
  );

  const openPost = useCallback((post: Post) => {
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
  }, []);

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
                  <button
                    key={post.id}
                    onClick={() => openPost(post)}
                    className="relative aspect-square bg-gray-100 overflow-hidden group focus:outline-none"
                  >
                    {post.media_type === 'video' ? (
                      <>
                        <video
                          src={post.media_url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        {/* Video indicator */}
                        <div className="absolute top-1.5 right-1.5">
                          <svg className="w-4 h-4 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5.5 12.5L16 12l-5.5-3.5v7z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <img
                        src={post.media_url}
                        alt={post.content || 'Post'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {/* Carousel indicator */}
                    {/* Hover overlay for desktop */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center">
                      <div className="flex items-center gap-4 text-white">
                        <span className="flex items-center text-sm font-semibold">
                          ❤️ {post.aura_count || 0}
                        </span>
                      </div>
                    </div>
                  </button>
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
    </div>
  );
}