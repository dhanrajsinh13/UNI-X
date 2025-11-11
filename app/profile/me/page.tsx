'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/../../contexts/AuthContext';
import PostCard from '@/../../components/PostCard';
import PostModal from '@/../../components/PostModal';
import FollowersListModal from '@/../../components/FollowersListModal';
import { useIsMobile } from '@/../../hooks/useIsMobile';

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
  _count?: {
    posts: number;
    followers: number;
    following: number;
  };
  follower_count?: number;
  following_count?: number;
  post_count?: number;
  is_private?: boolean;
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

// Helper to infer media type reliably
function inferPostType(post: Post): 'image' | 'video' {
  const declared = (post.media_type || '').toLowerCase();
  if (declared === 'image' || declared === 'video') return declared as 'image' | 'video';
  const url = (post.media_url || '').toLowerCase();
  if (!url) return 'image';
  if (url.includes('/video/') || /(\.mp4|\.webm|\.mov|\.avi|\.wmv)$/i.test(url)) return 'video';
  return 'image';
}

// PostModal expected type
interface PostModalData {
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
}

// Video Grid Tile Component with hover-to-play
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
      console.log('Profile video loaded successfully:', post.media_url);
    }
  };

  const kind = inferPostType(post);

  return (
    <button onClick={onClick} className="group relative aspect-square bg-gray-100 overflow-hidden rounded-2xl">
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
                <div className="absolute inset-0 bg-gray-100 rounded-2xl flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🎥</div>
                    <div className="text-sm text-gray-500">Loading...</div>
                  </div>
                </div>
              )}
              <video
                ref={videoRef}
                src={post.media_url}
                className="w-full h-full object-cover rounded-2xl"
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={handleVideoLoadedMetadata}
                onError={(e) => { 
                  console.error('Profile video error:', post.media_url);
                  setVideoError(true);
                }}
                onLoadStart={() => {
                  console.log('Profile video loading started:', post.media_url);
                }}
              />
              {/* Duration badge - hidden on hover */}
              {videoDuration && !isVideoHovered && videoLoaded && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatDuration(videoDuration)}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 rounded-2xl">
              <div className="text-center">
                <div className="text-2xl mb-2">🎥</div>
                <div className="text-sm">Video unavailable</div>
              </div>
            </div>
          )
        ) : (
          <img src={post.media_url} alt={post.content?.slice(0, 40)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 rounded-2xl" />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm p-4 rounded-2xl">{post.content}</div>
      )}
    </button>
  );
};

export default function ProfilePage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'tagged'>('posts');
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PostModalData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState<{ open: boolean; type: 'followers' | 'following' } | null>(null);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    department: user?.department || '',
    year: user?.year || 1
  });
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPfp, setEditPfp] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadingPfp, setUploadingPfp] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New: media filter for posts (All / Images / Reels)
  const [postMediaFilter, setPostMediaFilter] = useState<'all' | 'images' | 'reels'>('all');

  // Mobile fullscreen overlay state
  const [isFullscreenListOpen, setIsFullscreenListOpen] = useState(false);
  const [fullscreenStartPostId, setFullscreenStartPostId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  const [optionsPostId, setOptionsPostId] = useState<number | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
  const [isSavingId, setIsSavingId] = useState<number | null>(null);

  // Scroll to tapped post when overlay opens (must be before any early returns)
  useEffect(() => {
    if (isFullscreenListOpen && fullscreenStartPostId && scrollRef.current) {
      const el = scrollRef.current.querySelector<HTMLDivElement>(`[data-post-id="${fullscreenStartPostId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' } as any);
      }
    }
  }, [isFullscreenListOpen, fullscreenStartPostId]);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const loadProfileFromCache = () => {
    try {
      const raw = localStorage.getItem('me_profile_cache');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { timestamp: number; user: UserProfile };
      if (parsed?.user) {
        setUserProfile(parsed.user as any);
        setPosts(parsed.user.posts || []);
        return parsed.user;
      }
    } catch {}
    return null;
  };

  const saveProfileToCache = (profile: UserProfile) => {
    try {
      const payload = JSON.stringify({ timestamp: Date.now(), user: profile });
      localStorage.setItem('me_profile_cache', payload);
    } catch {}
  };

  useEffect(() => {
    if (user && token) {
      const cached = loadProfileFromCache();
      if (cached) {
        setLoading(false);
        fetchUserProfile(true);
      } else {
        fetchUserProfile(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const fetchUserProfile = async (background: boolean) => {
    setProfileError(null);
    if (!background) setLoading(true);

    const maxAttempts = 3; // Reduced to 3 attempts
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // Increased to 60s total
    
    console.log('Starting profile fetch...');
    
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`Profile fetch attempt ${attempt}/${maxAttempts}`);
          
          // Progressive timeout per attempt: 20s, 25s, 30s
          const attemptController = new AbortController();
          const attemptTimeout = setTimeout(() => attemptController.abort(), 15000 + (attempt * 10000));
          
          const response = await fetch('/api/users/me', {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: attemptController.signal,
          });

          clearTimeout(attemptTimeout);

          if (response.ok) {
            const data = await response.json();
            if (!isMountedRef.current) return;
            console.log('Profile fetched successfully on attempt', attempt);
            setUserProfile(data.user);
            setEditUsername(data.user?.username || '');
            setEditBio(data.user?.bio || '');
            setEditPfp(data.user?.profile_image || null);
            setPosts(data.user.posts || []);
            saveProfileToCache(data.user);
            return;
          } else {
            const text = await response.text().catch(() => '');
            console.error(`Profile fetch failed (attempt ${attempt}):`, response.status, text);
            
            // Check if error is retryable
            const isRetryable = response.status >= 500 || response.status === 503 || response.status === 504;
            
            if (attempt === maxAttempts || !isRetryable) {
              setProfileError(`Profile load failed (${response.status}). ${isRetryable ? 'Please try again.' : ''}`);
            } else {
              // Exponential backoff with jitter
              const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 8000);
              console.log(`Retrying profile fetch in ${Math.round(delay)}ms...`);
              await new Promise(res => setTimeout(res, delay));
            }
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            console.error(`Profile request timed out on attempt ${attempt}`);
          } else {
            console.error(`Profile fetch error on attempt ${attempt}:`, err.message);
          }
          
          if (attempt === maxAttempts) {
            const errorMsg = err?.name === 'AbortError' 
              ? 'Profile load timed out. Please check your connection.' 
              : 'Network error loading profile. Please try again.';
            setProfileError(errorMsg);
          } else {
            // Exponential backoff with jitter
            const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 8000);
            console.log(`Retrying profile fetch after error in ${Math.round(delay)}ms...`);
            await new Promise(res => setTimeout(res, delay));
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      if (!isMountedRef.current) return;
      if (!background) setLoading(false);
      console.log('Profile fetch completed');
    }
  };

  const fetchSavedPosts = async () => {
    setTabLoading(true);
    try {
      const response = await fetch('/api/users/me/saved', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSavedPosts(data.posts || []);
      } else {
        console.error('Failed to fetch saved posts');
        setSavedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching saved posts:', error);
      setSavedPosts([]);
    } finally {
      setTabLoading(false);
    }
  };

  const fetchTaggedPosts = async () => {
    setTabLoading(true);
    try {
      const response = await fetch('/api/users/me/tagged', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTaggedPosts(data.posts || []);
      } else {
        console.error('Failed to fetch tagged posts');
        setTaggedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching tagged posts:', error);
      setTaggedPosts([]);
    } finally {
      setTabLoading(false);
    }
  };

  const handleTabChange = (tab: 'posts' | 'saved' | 'tagged') => {
    setActiveTab(tab);
    if (tab === 'saved' && savedPosts.length === 0) {
      fetchSavedPosts();
    } else if (tab === 'tagged' && taggedPosts.length === 0) {
      fetchTaggedPosts();
    }
  };

  useEffect(() => {
    const handler = () => fetchUserProfile(true);
    window.addEventListener('followCountsChanged', handler as any);
    return () => window.removeEventListener('followCountsChanged', handler as any);
  }, []);

  // Listen for new post creation
  useEffect(() => {
    const handlePostCreated = (event: CustomEvent) => {
      const newPost = event.detail;
      if (newPost) {
        console.log('New post created, adding to profile:', newPost);
        // Add new post to the beginning of the posts array
        setPosts(prev => [newPost, ...prev]);
        
        // Update user profile post count
        if (userProfile) {
          const updatedProfile = {
            ...userProfile,
            posts: [newPost, ...(userProfile.posts || [])],
            _count: {
              posts: (userProfile._count?.posts || 0) + 1,
              followers: userProfile._count?.followers || 0,
              following: userProfile._count?.following || 0
            }
          };
          setUserProfile(updatedProfile);
          saveProfileToCache(updatedProfile);
        }
      }
    };

    window.addEventListener('postCreated', handlePostCreated as EventListener);
    return () => window.removeEventListener('postCreated', handlePostCreated as EventListener);
  }, [userProfile]);

  if (!user || (loading && !userProfile)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#02fa97] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSavingProfile(true);
    try {
      const payload: any = { ...editForm, bio: editBio, username: editUsername, profile_image: editPfp };
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setUserProfile(data.user);
        setIsEditing(false);
        setHasUnsavedChanges(false);
        saveProfileToCache(data.user);
      } else {
        const err = await response.json().catch(() => ({} as any));
        alert(err.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Update failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Discard them?')) {
        resetEditForm();
        setIsEditing(false);
        setHasUnsavedChanges(false);
      }
    } else {
      resetEditForm();
      setIsEditing(false);
    }
  };

  const resetEditForm = () => {
    setEditForm({
      name: userProfile?.name || user?.name || '',
      department: userProfile?.department || user?.department || '',
      year: userProfile?.year || user?.year || 1
    });
    setEditUsername(userProfile?.username || '');
    setEditBio(userProfile?.bio || '');
    setEditPfp(userProfile?.profile_image || null);
  };

  const handleFormChange = () => {
    setHasUnsavedChanges(true);
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB to match server config)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size should be less than 10MB');
      return;
    }

    setUploadingPfp(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Upload to our API endpoint
      const response = await fetch('/api/users/upload-profile-pic', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setEditPfp(data.url);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        const errorMsg = errorData.details || errorData.error || 'Upload failed';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Profile picture upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setUploadingPfp(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePostClick = (postCardData: {
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
    userLiked?: boolean;
  }) => {
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
      location: undefined
    };
    setSelectedPost(modalPost);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPost(null);
  };

  // Open mobile fullscreen list
  const openFullscreenFromGrid = (postId: number) => {
    if (isMobile) {
      setFullscreenStartPostId(postId);
      setIsFullscreenListOpen(true);
    } else {
      const p = posts.find((pp) => pp.id === postId);
      if (!p) return;
      const modalPost: PostModalData = {
        id: p.id,
        authorName: userProfile?.name || user.name,
        authorDept: userProfile?.department || user.department,
        authorYear: userProfile?.year || user.year,
        content: p.content,
        category: p.category,
        auraCount: p.aura_count || 0,
        commentCount: 0,
        timestamp: new Date(p.created_at).toLocaleDateString(),
        profilePic: userProfile?.profile_image || undefined,
        mediaUrl: p.media_url,
        mediaType: (p.media_type as 'image' | 'video') || undefined,
        userLiked: p.user_liked,
      } as any;
      setSelectedPost(modalPost);
      setIsModalOpen(true);
    }
  };

  const handleDeletePostMobile = async (postId: number) => {
    if (!token) return;
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setIsDeletingId(postId);
    try {
      const resp = await fetch(`/api/posts/${postId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.status === 204) {
        // Update state
        setPosts(prev => {
          const updated = prev.filter(p => p.id !== postId);
          
          // Update cache with new posts array
          if (userProfile) {
            const updatedProfile = {
              ...userProfile,
              posts: updated,
              _count: {
                posts: (userProfile._count?.posts || 0) - 1,
                followers: userProfile._count?.followers || 0,
                following: userProfile._count?.following || 0
              }
            };
            saveProfileToCache(updatedProfile);
            setUserProfile(updatedProfile);
          }
          
          return updated;
        });
        
        window.dispatchEvent(new CustomEvent('postDeleted', { detail: { id: postId } }));
      } else {
        const err = await resp.json().catch(() => ({} as any));
        alert(err.error || 'Failed to delete post');
      }
    } catch (e) {
      alert('Failed to delete post');
    } finally {
      setIsDeletingId(null);
      setOptionsPostId(null);
    }
  };

  const handleEditCaptionMobile = async (postId: number, current: string) => {
    if (!token) return;
    const next = window.prompt('Edit caption', current || '');
    if (next === null) return; // cancelled
    const trimmed = next.trim();
    if (!trimmed) {
      alert('Caption cannot be empty');
      return;
    }
    setIsSavingId(postId);
    try {
      const resp = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ caption: trimmed })
      });
      if (resp.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, content: trimmed } : p));
        window.dispatchEvent(new CustomEvent('postUpdated', { detail: { id: postId, content: trimmed } }));
      } else {
        const err = await resp.json().catch(() => ({} as any));
        alert(err.error || 'Failed to update caption');
      }
    } catch (e) {
      alert('Failed to update caption');
    } finally {
      setIsSavingId(null);
      setOptionsPostId(null);
    }
  };

  const followerCount = userProfile?.follower_count ?? userProfile?._count?.followers ?? 0;
  const followingCount = userProfile?.following_count ?? userProfile?._count?.following ?? 0;

  const currentPosts = activeTab === 'posts' ? posts : activeTab === 'saved' ? savedPosts : taggedPosts;
  const displayPosts = (() => {
    if (activeTab !== 'posts') return currentPosts;
    if (postMediaFilter === 'images') return currentPosts.filter(p => inferPostType(p) === 'image');
    if (postMediaFilter === 'reels') return currentPosts.filter(p => inferPostType(p) === 'video');
    return currentPosts;
  })();

  return (
    <div className="min-h-screen bg-white">
      {profileError && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
            {profileError}
          </div>
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header - compact like Instagram */}
        <div className="bg-white p-4 md:p-6 mb-4">
              <div className="flex items-start gap-8">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300">
              <img 
                src={(userProfile?.profile_image || '/uploads/DefaultProfile.jpg') as string} 
                alt={userProfile?.name || user.name} 
                className="w-full h-full object-cover" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <h2 className="text-xl md:text-2xl text-gray-800 font-bold">{ userProfile?.username || user.username}</h2>
                <button onClick={() => { setIsEditing(true); resetEditForm(); }} className="px-4 py-1.5 text-sm text-lime-300/70 font-semibold rounded-md border border-lime-300/70 hover:bg-gray-50">Edit Profile</button>
              </div>              <div className="flex items-center gap-8 mb-3 text-sm text-gray-800">
                <div><span className="font-semibold mr-1">{userProfile?.post_count ?? userProfile?._count?.posts ?? posts.length}</span>posts</div>
                <button onClick={() => setShowFollowModal({ open: true, type: 'followers' })} className="hover:underline"><span className="font-semibold mr-1">{followerCount}</span>followers</button>
                <button onClick={() => setShowFollowModal({ open: true, type: 'following' })} className="hover:underline"><span className="font-semibold mr-1">{followingCount}</span>following</button>
              </div>

              <div className="text-sm">
                <div className="font-semibold text-gray-600">{userProfile?.name || user.name}</div>
                {userProfile?.bio && <div className="text-gray-700 whitespace-pre-line">{userProfile.bio}</div>}
              </div>
            </div>
          </div>

          {isEditing && (
            <div className={`fixed inset-0 z-50 ${isMobile ? '' : 'bg-black/50 flex items-center justify-center p-4'}`}>
              <div className={`${isMobile ? 'w-full h-full bg-white' : 'bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden'}`}>
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={handleCancelEdit}
                    className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                  >
                    {hasUnsavedChanges ? 'Discard' : 'Cancel'}
                  </button>
                  <h3 className="text-lg font-semibold text-gray-900">Edit Profile</h3>
                  <button
                    onClick={handleSave}
                    disabled={savingProfile}
                    className="text-[#02fa97] hover:text-[#02fa97]/80 font-semibold text-sm disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save'}
                  </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto" style={{ maxHeight: isMobile ? 'calc(100vh - 57px)' : 'calc(90vh - 57px)' }}>
                  <div className="p-6 space-y-6">
                    {/* Profile Picture */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                        <img 
                          src={editPfp || '/uploads/DefaultProfile.jpg'} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                        />
                      </div>
                      <div className="text-center">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => { handleProfilePicUpload(e); handleFormChange(); }}
                          className="hidden"
                          id="profile-pic-upload"
                        />
                        <label
                          htmlFor="profile-pic-upload"
                          className={`inline-block px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                            uploadingPfp 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {uploadingPfp ? (
                            <span className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              Uploading...
                            </span>
                          ) : (
                            'Change Photo'
                          )}
                        </label>
                        <div className="text-xs text-gray-500 mt-2">
                          Max 10MB • JPG, PNG, GIF
                        </div>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input 
                          value={editForm.name} 
                          onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); handleFormChange(); }} 
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent" 
                          placeholder="Enter your name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input 
                          value={editUsername} 
                          onChange={(e) => { setEditUsername(e.target.value); handleFormChange(); }} 
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent" 
                          placeholder="Enter your username"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                        <textarea 
                          value={editBio} 
                          onChange={(e) => { setEditBio(e.target.value); handleFormChange(); }} 
                          rows={4} 
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent resize-none" 
                          placeholder="Tell us about yourself"
                        />
                        <div className="text-xs text-gray-500 mt-1 text-right">
                          {editBio.length} / 150
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                          <input 
                            value={editForm.department} 
                            onChange={(e) => { setEditForm({ ...editForm, department: e.target.value }); handleFormChange(); }} 
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent" 
                            placeholder="Your department"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                          <select 
                            value={editForm.year} 
                            onChange={(e) => { setEditForm({ ...editForm, year: parseInt(e.target.value) }); handleFormChange(); }} 
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#02fa97] focus:border-transparent bg-white"
                          >
                            <option value={1}>1st Year</option>
                            <option value={2}>2nd Year</option>
                            <option value={3}>3rd Year</option>
                            <option value={4}>4th Year</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Grid posts like Instagram */}
        <div className="bg-white rounded-lg">
          <div className="flex items-center justify-center gap-8 px-8 pt-3 border border-gray-200 rounded-2xl text-xs font-semibold tracking-wider text-gray-500">
            <button 
              onClick={() => setActiveTab('posts')}
              className={`py-3 border-t-2 ${activeTab === 'posts' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'} transition-colors`}
            >
              POSTS
            </button>
            <button 
              onClick={() => setActiveTab('saved')}
              className={`py-3 border-t-2 ${activeTab === 'saved' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'} transition-colors`}
            >
              SAVED
            </button>
            <button 
              onClick={() => setActiveTab('tagged')}
              className={`py-3 border-t-2 ${activeTab === 'tagged' ? 'border-gray-900 text-gray-900' : 'border-transparent hover:text-gray-700'} transition-colors`}
            >
              TAGGED
            </button>
          </div>

          <div className="p-4 md:p-6">
            {activeTab === 'posts' && (
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setPostMediaFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs border ${postMediaFilter==='all' ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-600'} transition-colors`}
                >
                  All
                </button>
                <button
                  onClick={() => setPostMediaFilter('images')}
                  className={`px-3 py-1.5 rounded-full text-xs border ${postMediaFilter==='images' ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-600'} transition-colors`}
                >
                  Images
                </button>
                <button
                  onClick={() => setPostMediaFilter('reels')}
                  className={`px-3 py-1.5 rounded-full text-xs border ${postMediaFilter==='reels' ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-600'} transition-colors`}
                >
                  Reels
                </button>
              </div>
            )}

            {tabLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-gray-200 border-t-[#02fa97] rounded-full animate-spin"></div>
              </div>
            ) : (() => {
              if (displayPosts && displayPosts.length > 0) {
                return (
                  <div className="grid grid-cols-3 gap-1 md:gap-4">
                    {displayPosts.map((p) => (
                      <VideoGridTile
                        key={p.id}
                        post={p}
                        onClick={() => openFullscreenFromGrid(p.id)}
                      />
                    ))}
                  </div>
                );
              } else {
                const emptyMessage = 
                  activeTab === 'posts' ? 'No posts yet' :
                  activeTab === 'saved' ? 'No saved posts yet' :
                  'No tagged posts yet';
                
                const emptyDescription =
                  activeTab === 'posts' ? 'Share photos and videos to see them on your profile.' :
                  activeTab === 'saved' ? 'Save posts you want to see again. Only you can see what you\'ve saved.' :
                  'When people tag you in photos, they\'ll appear here.';
                
                return (
                  <div className="text-center py-16">
                    <div className="text-gray-600 text-lg font-light mb-2">{emptyMessage}</div>
                    <div className="text-gray-500 text-sm">{emptyDescription}</div>
                  </div>
                );
              }
            })()}
          </div>
        </div>


        {/* Post Modal */}
        {selectedPost && (
          <PostModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            post={selectedPost}
            canManage={true}
          />
        )}

        {showFollowModal?.open && (
          <FollowersListModal
            isOpen={showFollowModal.open}
            onClose={() => setShowFollowModal(null)}
            userId={'me'}
            type={showFollowModal.type}
          />
        )}
      </div>

      {/* Mobile Fullscreen Vertical List Overlay */}
      {isFullscreenListOpen && isMobile && (
        <div className="fixed inset-0 z-[60] bg-white/95 text-white">
          {/* Header */}
          <div className="sticky top-0 z-[61] bg-white/90 text-black backdrop-blur px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setIsFullscreenListOpen(false)}
              className="text-black text-sm"
            >
              Close
            </button>
            <div className="text-sm opacity-75">{currentPosts?.length || 0} posts</div>
            <div className="w-10" />
          </div>

          {/* Scrollable feed */}
          <div ref={scrollRef} className="h-[calc(100%-48px)] overflow-y-auto snap-y snap-mandatory">
            {currentPosts?.map((p) => (
              <div key={p.id} data-post-id={p.id} className="snap-start">
                <div className="relative">
                  <PostCard
                    id={p.id}
                    authorId={userProfile?.id}
                    authorName={userProfile?.name || user.name}
                    authorDept={userProfile?.department || user.department}
                    authorYear={userProfile?.year || user.year}
                    content={p.content}
                    category={p.category}
                    auraCount={p.aura_count || 0}
                    commentCount={0}
                    timestamp={new Date(p.created_at).toLocaleDateString()}
                    profilePic={userProfile?.profile_image || undefined}
                    mediaUrl={p.media_url}
                    mediaType={(p.media_type as 'image' | 'video') || undefined}
                    userLiked={p.user_liked}
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

                  {/* Mobile options menu (three dots) */}
                  <div className="absolute top-2 right-2 z-[62] md:hidden">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOptionsPostId(optionsPostId === p.id ? null : p.id); }}
                      className="w-8 h-8 rounded-full bg-white/80 text-gray-700 hover:bg-white shadow flex items-center justify-center"
                      title="Options"
                    >
                      <span className="text-xl leading-none">⋮</span>
                    </button>
                    {optionsPostId === p.id && (
                      <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-[63]">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditCaptionMobile(p.id, p.content); }}
                          disabled={isSavingId === p.id}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          {isSavingId === p.id ? 'Saving...' : 'Edit caption'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePostMobile(p.id); }}
                          disabled={isDeletingId === p.id}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {isDeletingId === p.id ? 'Deleting…' : 'Delete post'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="h-10" />
          </div>
        </div>
      )}
    </div>
  );
}
