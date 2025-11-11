'use client';

import React, { useState, useCallback, useMemo } from 'react';
import MasonryTile from '../../components/MasonryTile';
import PostModal from '../../components/PostModal';
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
      profilePic: undefined,
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
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Uniwall</h1>
          <div className="flex items-center space-x-2 text-sm">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-3 py-1 rounded-full border transition-colors ${
                  selectedCategory === category.id 
                    ? 'border-gray-900 text-gray-900 bg-gray-50' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="mr-1">{category.emoji}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-8 h-8 border-4 border-[#02fa97] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">Unable to load posts</p>
            <button 
              onClick={refetch}
              className="text-[#02fa97] font-semibold hover:text-teal-600"
            >
              Try Again
            </button>
          </div>
        ) : mediaOnlyPosts.length > 0 ? (
          <div className="[column-fill:_balance] gap-4 sm:columns-[14rem] md:columns-[16rem] lg:columns-[18rem] xl:columns-[20rem] 2xl:columns-[22rem]">
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