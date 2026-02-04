'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import PostCard from '../../../components/PostCard';
import PostModal from '../../../components/PostModal';
import FollowButton from '../../../components/FollowButton';
import FollowersListModal from '../../../components/FollowersListModal';
import MiniChatWindow from '../../../components/MiniChatWindow';
import { fetchAPI, dataFetcher } from '../../../lib/dataFetcher';

// User profile from API
interface UserProfile {
  id: number;
  name: string;
  username?: string;
  college_id?: string;
  department: string;
  year: number;
  created_at: string;
  bio?: string | null;
  profile_image?: string | null;
  posts?: Post[];
  follower_count?: number;
  following_count?: number;
  post_count?: number;
  is_following?: boolean;
  is_private?: boolean;
  requested?: boolean;
  can_view?: boolean;
}

// Post from API
interface Post {
  id: number;
  content: string;
  category: string;
  media_url?: string;
  media_type?: string;
  aura_count: number;
  comment_count: number;
  user_liked: boolean;
  created_at: string;
  user_id: number;
}

const ProfilePage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const id = params?.id ? String(params.id) : '';
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFollowModal, setShowFollowModal] = useState<{ open: boolean; type: 'followers' | 'following' } | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMiniChat, setShowMiniChat] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (id && token) {
      fetchUserProfile();
    }
  }, [id, token]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setIsBlocked(false);
      const data = await fetchAPI<{ user: UserProfile }>(
        `/api/users/${id}`,
        { token: token || undefined, cacheTTL: 60000 } // Cache for 1 minute
      );

      setUserProfile(data.user);
    } catch (error: any) {
      console.error('Error fetching user profile:', error.message);
      if (error.message?.includes('not accessible') || error.message?.includes('blocked')) {
        setIsBlocked(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollowChange = (isFollowing: boolean, followerCount: number) => {
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        is_following: isFollowing,
        follower_count: followerCount
      });
      // Clear profile cache after follow/unfollow
      dataFetcher.clearCache(`/api/users/${id}`);
    }
  };

  const handlePostClick = (post: Post) => {
    const modalPost = {
      id: post.id,
      authorId: userProfile?.id,
      authorName: userProfile?.name || '',
      authorDept: userProfile?.department || '',
      authorYear: userProfile?.year || 1,
      content: post.content,
      category: post.category,
      auraCount: post.aura_count,
      commentCount: post.comment_count || 0,
      timestamp: new Date(post.created_at).toLocaleDateString(),
      profilePic: userProfile?.profile_image || undefined,
      mediaUrl: post.media_url,
      mediaType: post.media_type?.toLowerCase() as 'image' | 'video',
      userLiked: post.user_liked
    };
    setSelectedPost(modalPost);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
  };

  const handleMessage = () => {
    // On mobile, open the full messages page directly. On desktop, open mini chat.
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push(`/messages?user=${userProfile?.id}`);
      return;
    }

    // Open mini chat window
    setShowMiniChat(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FFAF50] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">User not found</p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M4.93 4.93L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">User Not Accessible</h2>
          <p className="text-gray-600 mb-6">
            You cannot view this profile. This may be because you or this user has blocked the other.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const isOwnProfile = user && user.id === userProfile.id;

  return (
    <div className='bg-white'>
      <div className=" bg-white max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start gap-8 mb-6">
            {/* Avatar */}
            <div className="mx-auto md:mx-0">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-[#FFAF50] to-orange-400 rounded-full overflow-hidden ring-4 ring-white shadow-xl">
                <Image
                  src={userProfile.profile_image || '/uploads/DefaultProfile.jpg'}
                  alt={userProfile.name}
                  width={160}
                  height={160}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                />
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left w-full">
              {/* Username and Actions */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h1 className="text-xl md:text-2xl font-light">{userProfile.username || userProfile.name}</h1>
                </div>

                {/* Action Buttons - only show if not own profile and user is logged in */}
                {!isOwnProfile && user && (
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <FollowButton
                      userId={userProfile.id}
                      isFollowing={userProfile.is_following || false}
                      requested={userProfile.requested || false}
                      onFollowChange={handleFollowChange}
                      size="md"
                    />
                    {/* Message Button - hidden if profile is private and not following */}
                    {(!userProfile.is_private || userProfile.is_following) && (
                      <button
                        onClick={handleMessage}
                        className="flex items-center gap-2 px-4 py-2 bg-[#FFAF50] hover:bg-orange-400 text-black font-medium text-sm rounded-lg transition-all duration-200 hover:shadow-md active:scale-95"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M8.5 19H8C4 19 2 17 2 13V8C2 4 4 2 8 2H16C20 2 22 4 22 8V13C22 17 20 19 16 19H15.5C15.19 19 14.89 19.15 14.7 19.4L13.2 21.4C12.54 22.28 11.46 22.28 10.8 21.4L9.3 19.4C9.14 19.18 8.77 19 8.5 19Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M15.9965 11H16.0054" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M11.9955 11H12.0045" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M7.99451 11H8.00349" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Message
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-center md:justify-start gap-8 mb-4">
                <div className="text-center md:text-left">
                  <span className="font-semibold text-gray-900">{userProfile.post_count || userProfile.posts?.length || 0}</span>
                  <span className="text-gray-600 ml-1">posts</span>
                </div>
                <button
                  onClick={() => setShowFollowModal({ open: true, type: 'followers' })}
                  className="text-center md:text-left hover:underline"
                >
                  <span className="font-semibold text-gray-900">{userProfile.follower_count || 0}</span>
                  <span className="text-gray-600 ml-1">followers</span>
                </button>
                <button
                  onClick={() => setShowFollowModal({ open: true, type: 'following' })}
                  className="text-center md:text-left hover:underline"
                >
                  <span className="font-semibold text-gray-900">{userProfile.following_count || 0}</span>
                  <span className="text-gray-600 ml-1">following</span>
                </button>
              </div>

              {/* Bio */}
              <div className="text-center md:text-left">
                <h2 className="font-semibold text-gray-900 mb-1">{userProfile.name}</h2>
                <p className="text-gray-600 text-sm mb-1">{userProfile.department} • {userProfile.year}rd Year</p>
                {userProfile.bio && (
                  <p className="text-gray-800 text-sm leading-relaxed mb-2">{userProfile.bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-gray-200">
          <div className="flex items-center justify-center gap-16 pt-4">
            <button
              onClick={() => { setActiveTab('posts'); setViewMode('grid'); }}
              className={`flex items-center gap-2 pb-3 px-1 text-xs font-medium uppercase tracking-wide ${activeTab === 'posts'
                ? 'border-t-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" />
              </svg>
              Posts
            </button>

            {/* Only show saved/tagged tabs for own profile */}
            {isOwnProfile && (
              <>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`flex items-center gap-2 pb-3 px-1 text-xs font-medium uppercase tracking-wide ${activeTab === 'saved'
                    ? 'border-t-2 border-gray-900 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  Saved
                </button>

                <button
                  onClick={() => setActiveTab('tagged')}
                  className={`flex items-center gap-2 pb-3 px-1 text-xs font-medium uppercase tracking-wide ${activeTab === 'tagged'
                    ? 'border-t-2 border-gray-900 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.25 6.75L22.5 12L17.25 17.25H4.5V6.75H17.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 9.75L12 12.75L15 9.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Tagged
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'posts' && (
            <div className="space-y-6">
              {/* Private account gate */}
              {!isOwnProfile && userProfile.is_private && userProfile.can_view === false && (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🔒</div>
                  <div className="text-gray-900 text-lg font-semibold mb-1">This account is private</div>
                  <div className="text-gray-500 text-sm">Follow to see their photos and videos.</div>
                </div>
              )}

              {(!userProfile.is_private || isOwnProfile || userProfile.can_view) && (
                <>
                  {/* View Toggle */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-gray-500' : 'hover:bg-gray-50'}`}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </button>
                  </div>

                  {userProfile.posts && userProfile.posts.length > 0 ? (
                    viewMode === 'grid' ? (
                      <div className="grid grid-cols-3 gap-1 md:gap-4">
                        {userProfile.posts.map(post => (
                          <div
                            key={post.id}
                            className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-none md:rounded-lg overflow-hidden group cursor-pointer relative"
                            onClick={() => handlePostClick(post)}
                          >
                            {post.media_url ? (
                              post.media_type?.toLowerCase() === 'video' ? (
                                <video
                                  src={post.media_url}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  muted
                                  preload="metadata"
                                  onError={(e) => {
                                    console.error('Video load error:', e);
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Image
                                  src={post.media_url}
                                  alt={post.content || 'Post image'}
                                  fill
                                  sizes="(max-width: 768px) 33vw, 25vw"
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    console.error('Image load error:', e);
                                    e.currentTarget.style.display = 'none';
                                  }}
                                  onLoad={() => {
                                    console.log('Image loaded successfully:', post.media_url);
                                  }}
                                />
                              )
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[#FFAF50]/20 to-orange-200 flex flex-col items-center justify-center p-4">
                                <p className="text-gray-700 text-sm text-center line-clamp-3">{post.content}</p>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-4 text-white">
                                <div className="flex items-center gap-1">
                                  <svg width="20" height="20" viewBox="0 0 100 100" fill="white">
                                    <polygon points="77.333,33.31 55.438,33.31 75.43,1.829 47.808,1.829 23.198,51.05 41.882,51.05 21.334,99.808" />
                                  </svg>
                                  <span className="font-semibold">{post.aura_count}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M8.5 12H8.51M12 12H12.01M15.5 12H15.51M21 12C21 16.418 16.97 20 12 20C10.89 20 9.84 19.79 8.88 19.42L3 21L4.58 15.12C4.21 14.16 4 13.11 4 12C4 7.582 8.03 4 12 4C16.97 4 21 7.582 21 12Z"
                                      stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  <span className="font-semibold">{post.comment_count || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {userProfile.posts.map(post => (
                          <PostCard
                            key={post.id}
                            id={post.id}
                            authorId={userProfile.id}
                            authorName={userProfile.name}
                            authorDept={userProfile.department}
                            authorYear={userProfile.year}
                            content={post.content}
                            category={post.category}
                            auraCount={post.aura_count}
                            commentCount={post.comment_count || 0}
                            timestamp={new Date(post.created_at).toLocaleDateString()}
                            mediaUrl={post.media_url}
                            mediaType={post.media_type as 'image' | 'video'}
                            userLiked={post.user_liked}
                            isFollowingUser={!isOwnProfile && userProfile.is_following}
                            profilePic={userProfile.profile_image || undefined}
                            onPostClick={(postData) => handlePostClick(post)}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-gray-600 text-lg font-light mb-2">No posts yet</div>
                      <div className="text-gray-500 text-sm">When {userProfile.name} shares posts, they'll appear here.</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="text-center py-16">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 text-gray-300">
                <path d="M5 7.8C5 6.11984 5 5.27976 5.32698 4.63803C5.6146 4.07354 6.07354 3.6146 6.63803 3.32698C7.27976 3 8.11984 3 9.8 3H14.2C15.8802 3 16.7202 3 17.362 3.32698C17.9265 3.6146 18.3854 4.07354 18.673 4.63803C19 5.27976 19 6.11984 19 7.8V21L12 17L5 21V7.8Z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved posts yet</h3>
              <p className="text-gray-600">Save posts to see them here</p>
            </div>
          )}

          {activeTab === 'tagged' && (
            <div className="text-center py-16">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-4 text-gray-300">
                <path d="M17.25 6.75L22.5 12L17.25 17.25H4.5V6.75H17.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No tagged posts</h3>
              <p className="text-gray-600">When people tag {userProfile.name} in posts, they&apos;ll appear here</p>
            </div>
          )}
        </div>

        {/* Followers/Following Modal */}
        {showFollowModal?.open && (
          <FollowersListModal
            isOpen={showFollowModal.open}
            onClose={() => setShowFollowModal(null)}
            userId={userProfile.id}
            type={showFollowModal.type}
          />
        )}

        {/* Post Modal */}
        {isModalOpen && selectedPost && (
          <PostModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            post={selectedPost}
            canManage={false}
          />
        )}

        {/* Mini Chat Window */}
        {showMiniChat && userProfile && (
          <MiniChatWindow
            isOpen={showMiniChat}
            onClose={() => setShowMiniChat(false)}
            otherUser={{
              id: userProfile.id,
              name: userProfile.name,
              profile_image: userProfile.profile_image,
              department: userProfile.department,
              year: userProfile.year
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
