'use client';

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PostCard from '../components/PostCard';
import PostModal from '../components/PostModal';
import SwipeButton from '../components/SwipeButton';
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Swipe Button */}
      <SwipeButton />

      {/* Main content area: centered feed + right rail */}
      <div className="max-w-wide mx-auto px-0 md:px-6 lg:px-8 py-0 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[630px_1fr] gap-8 lg:gap-12">
          {/* Feed column */}
          <div className="lg:col-span-2">
            {/* Category Filter (sticky) */}
            <div className="bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/95 sticky top-0 z-sticky border-b border-border-light">
              <div className="px-4 md:px-0 py-4">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${selectedCategory === category.id
                          ? 'bg-text text-white shadow-sm'
                          : 'bg-gray-50 text-text hover:bg-gray-100'
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
            <div className="mt-4 md:mt-6 space-y-4 md:space-y-6 px-0">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-text rounded-full animate-spin"></div>
                </div>
              ) : error ? (
                <div className="text-center py-12 px-4">
                  <p className="text-text-secondary mb-4">Unable to load posts</p>
                  <button
                    onClick={refetch}
                    className="btn-secondary"
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
                    profilePic={post.author.profile_image}
                    mediaUrl={post.media_url}
                    mediaType={post.media_type as 'image' | 'video'}
                    userLiked={post.user_liked}
                    onPostClick={handlePostClick}
                  />
                ))
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="text-6xl mb-4">📱</div>
                  <h3 className="text-xl font-semibold text-text mb-2">No posts yet</h3>
                  <p className="text-text-secondary mb-6">
                    {selectedCategory === 'all'
                      ? 'Be the first to share something!'
                      : `No posts in ${categories.find(c => c.id === selectedCategory)?.name} category yet.`}
                  </p>
                  {user && (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('openCreatePost'))}
                      className="btn-primary"
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

      {/* Floating Messages button - Instagram style */}
      <Link href="/messages" className="fixed bottom-20 md:bottom-6 right-4 md:right-8 bg-white shadow-card hover:shadow-card-hover rounded-full p-4 transition-all hover:scale-105 z-sticky">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-text">
          <path d="M21 11.5C21 16.75 16.97 21 12 21C10.73 21 9.52 20.75 8.42 20.31L3 21.5L4.19 16.08C3.64 14.83 3.25 13.45 3.25 12C3.25 6.75 7.03 2.5 12 2.5C16.97 2.5 21 6.75 21 11.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
