'use client';

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PostCard from '../components/PostCard';
import PostModal from '../components/PostModal';
import { usePosts } from '../hooks/usePosts';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

// Lazy load suggestion components to speed up initial load
const SuggestionsSection = lazy(() => import('../components/SuggestionsSection'));
const SuggestedUsers = lazy(() => import('../components/SuggestedUsers'));

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

// PostCard props type (same as PostModal but without onPostClick)
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
}

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPost, setSelectedPost] = useState<PostModalData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const { posts, loading, error, refetch } = usePosts(
    selectedCategory === 'all' ? undefined : selectedCategory,
    20
  );
  const router = useRouter();

  // Move all hooks before any conditional logic
  const handlePostClick = useCallback((postCardData: PostCardProps) => {
    // Convert PostCard props to PostModal expected type
    const modalPost: PostModalData = {
      id: postCardData.id,
      authorName: postCardData.authorName,
      authorDept: postCardData.authorDept,
      authorYear: postCardData.authorYear,
      content: postCardData.content,
      category: postCardData.category,
      auraCount: postCardData.auraCount,
      commentCount: postCardData.commentCount,
      timestamp: postCardData.timestamp,
      profilePic: postCardData.profilePic,
      mediaUrl: postCardData.mediaUrl,
      mediaType: postCardData.mediaType,
      userLiked: postCardData.userLiked,
      location: undefined // PostCard doesn't provide location
    };
    setSelectedPost(modalPost);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedPost(null);
  }, []);

  // Redirect to landing page if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/landing');
    }
  }, [user, isLoading, router]);

  const categories = [
    { id: 'all', name: 'All', emoji: '🔥' },
    { id: 'academic', name: 'Academic', emoji: '📚' },
    { id: 'events', name: 'Events', emoji: '🎉' },
    { id: 'clubs', name: 'Clubs', emoji: '👥' },
    { id: 'sports', name: 'Sports', emoji: '⚽' },
    { id: 'social', name: 'Social', emoji: '💬' },
  ];

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#02fa97] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Main content area: centered feed + right rail */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Feed column */}
          <div className="lg:col-span-2">
            {/* Category Filter (sticky) */}
            <div className="bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white sticky top-0 z-30 border-b border-gray-100">
              <div className="px-2 sm:px-0 py-3">
                <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                        selectedCategory === category.id
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{category.emoji}</span>
                      <span>{category.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instagram-like Suggestions Section - Mobile Only */}
            <div className="lg:hidden mt-4">
              <Suspense fallback={
                <div className="bg-white rounded-lg p-4">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto"></div>
                </div>
              }>
                <SuggestionsSection />
              </Suspense>
            </div>

            {/* Feed */}
            <div className="mt-6 space-y-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">Unable to load posts</p>
                  <button 
                    onClick={refetch}
                    className="text-gray-900 font-semibold hover:opacity-80"
                  >
                    Try Again
                  </button>
                </div>
              ) : posts.length > 0 ? (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    id={post.id}
                    authorId={post.author.id}
                    authorName={post.author.name}
                    authorDept={post.author.department}
                    authorYear={post.author.year}
                    content={post.content}
                    category={post.category}
                    auraCount={post.aura_count}
                    commentCount={0}
                    timestamp={new Date(post.created_at).toLocaleDateString()}
                    mediaUrl={post.media_url}
                    mediaType={post.media_type as 'image' | 'video'}
                    userLiked={post.user_liked}
                    onPostClick={handlePostClick}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📱</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No posts yet</h3>
                  <p className="text-gray-600 mb-6">
                    {selectedCategory === 'all' 
                      ? 'Be the first to share something!'
                      : `No posts in ${categories.find(c => c.id === selectedCategory)?.name} category yet.`}
                  </p>
                  {user && (
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('openCreatePost'))}
                      className="bg-gray-900 text-white px-6 py-3 rounded-full font-semibold hover:bg-black transition-colors"
                    >
                      Create Post
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right rail suggestions - Desktop only */}
          <div className="hidden lg:block">
            <Suspense fallback={
              <div className="sticky top-20 bg-white rounded-xl border border-gray-100 p-4">
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                      <div className="flex-1">
                        <div className="h-3 w-32 bg-gray-200 rounded mb-2 animate-pulse" />
                        <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }>
              <SuggestedUsers />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Floating Messages button */}
      <Link href="/messages" className="fixed bottom-6 right-6 md:right-10 bg-white border border-gray-200 shadow-lg rounded-full px-4 py-3 flex items-center gap-2 hover:shadow-xl transition-shadow">
        <span className="text-xl">💬</span>
        <span className="font-semibold text-gray-700 hidden sm:inline">Messages</span>
      </Link>

      {/* Post Modal */}
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
