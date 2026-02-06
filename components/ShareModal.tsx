'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchAPI } from '../lib/dataFetcher';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number;
  postContent?: string;
  postMediaUrl?: string;
  postMediaType?: 'image' | 'video';
  authorName: string;
}

interface Friend {
  id: number;
  name: string;
  username?: string;
  profile_image?: string;
  department: string;
  year: number;
}

export default function ShareModal({
  isOpen,
  onClose,
  postId,
  postContent,
  postMediaUrl,
  postMediaType,
  authorName,
}: ShareModalProps) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      fetchFriends();
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
      setSelectedFriends(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const fetchFriends = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchAPI('/api/users/me/following', {
        token,
        cacheTTL: 30000,
      }) as { users: Friend[] };
      setFriends(data.users || []);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFriendSelection = (friendId: number) => {
    const newSelected = new Set(selectedFriends);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelectedFriends(newSelected);
  };

  const handleSend = async () => {
    if (selectedFriends.size === 0) {
      showToast('Please select at least one friend', 'error');
      return;
    }

    setSending(true);
    try {
      // Send to each selected friend
      for (const friendId of Array.from(selectedFriends)) {
        try {
          const messagePayload: any = {
            receiverId: friendId,
            postId: postId,
          };

          // Send the actual media content if available
          if (postMediaUrl) {
            messagePayload.mediaUrl = postMediaUrl;
          }

          // Add caption/text with author info
          if (postContent) {
            messagePayload.messageText = `${authorName}: ${postContent.slice(0, 100)}${postContent.length > 100 ? '...' : ''}`;
          } else {
            messagePayload.messageText = `${authorName} shared a post`;
          }

          console.log('📤 Sending shared post:', messagePayload);

          await fetchAPI('/api/messages/send', {
            method: 'POST',
            token: token || '',
            body: JSON.stringify(messagePayload),
            skipCache: true,
          });
        } catch (error) {
          console.error(`Failed to send to friend ${friendId}:`, error);
        }
      }

      showToast(
        selectedFriends.size === 1
          ? 'Post shared successfully!'
          : `Post shared to ${selectedFriends.size} friends!`,
        'success'
      );
      onClose();
    } catch (error: any) {
      console.error('Error sharing post:', error);
      showToast(error.message || 'Failed to share post', 'error');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!', 'success');
    });
  };

  const shareViaWebShare = async () => {
    const shareUrl = `${window.location.origin}/post/${postId}`;
    const shareData: ShareData = {
      title: `Post by ${authorName} on UNIX`,
      text: postContent?.slice(0, 120) || 'Check out this post',
      url: shareUrl,
    };

    try {
      if (navigator.share && typeof navigator.share === 'function') {
        await navigator.share(shareData);
      }
    } catch (err) {
      console.log('Share cancelled or failed:', err);
    }
  };

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Share</h2>
          <button
            onClick={handleSend}
            disabled={selectedFriends.size === 0 || sending}
            className={`text-sm font-semibold px-3 py-1 rounded-lg transition-colors ${
              selectedFriends.size === 0 || sending
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-[#FFAF50] hover:text-orange-600'
            }`}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFAF50]"
            />
          </div>
        </div>

        {/* Post Preview */}
        {postMediaUrl && (
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                {postMediaType === 'video' ? (
                  <video
                    src={postMediaUrl}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <Image
                    src={postMediaUrl}
                    alt="Post preview"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{authorName}</p>
                {postContent && (
                  <p className="text-xs text-gray-600 truncate">{postContent}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Friends Count */}
        {selectedFriends.size > 0 && (
          <div className="px-4 py-2 bg-blue-50 text-blue-700 text-sm">
            {selectedFriends.size} friend{selectedFriends.size > 1 ? 's' : ''} selected
          </div>
        )}

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#FFAF50] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'No friends found' : 'You are not following anyone yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredFriends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => toggleFriendSelection(friend.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                      <Image
                        src={friend.profile_image || '/uploads/DefaultProfile.jpg'}
                        alt={friend.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg';
                        }}
                      />
                    </div>
                    {selectedFriends.has(friend.id) && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#FFAF50] rounded-full flex items-center justify-center border-2 border-white">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900 text-sm">{friend.name}</div>
                    <div className="text-xs text-gray-500">
                      {friend.username || `${friend.department} • Year ${friend.year}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Share Options Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={copyLink}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <span className="text-xs text-gray-700">Copy Link</span>
            </button>

            {navigator.share && (
              <button
                onClick={shareViaWebShare}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
                <span className="text-xs text-gray-700">Share</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
