'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Comment {
  id: number;
  text: string;
  timestamp: string;
  likes: number;
  userLiked: boolean;
  user: {
    id: number;
    name: string;
    profile_image?: string;
  };
}

interface MobileCommentsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number;
  authorName: string;
  authorProfilePic?: string;
  content: string;
  timestamp: string;
  auraCount: number;
  hasAura: boolean;
  onAuraClick: () => void;
}

const COMMENTS_PAGE_SIZE = 20;

const MobileCommentsSheet: React.FC<MobileCommentsSheetProps> = ({
  isOpen,
  onClose,
  postId,
  authorName,
  authorProfilePic,
  content,
  timestamp,
  auraCount,
  hasAura,
  onAuraClick,
}) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const commonEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯',
    '💫', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '👏', '🙌', '👍',
  ];

  const parseCaption = (text: string) => {
    return text
      .replace(/#(\w+)/g, '<span class="text-info font-semibold">#$1</span>')
      .replace(/@(\w+)/g, '<span class="text-info font-semibold">@$1</span>');
  };

  const loadComments = useCallback(async (offset = 0, append = false) => {
    if (!token) return;
    setIsLoadingComments(true);
    try {
      const response = await fetch(
        `/api/comments?postId=${postId}&limit=${COMMENTS_PAGE_SIZE}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        const fetchedComments = data.comments || [];
        setComments(prev => append ? [...prev, ...fetchedComments] : fetchedComments);
        setCommentsOffset(offset);
        setHasMoreComments(fetchedComments.length === COMMENTS_PAGE_SIZE);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [token, postId]);

  useEffect(() => {
    if (isOpen) {
      loadComments(0, false);
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
  }, [isOpen, loadComments]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newComment.trim() || isPosting) return;

    setIsPosting(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postId, text: newComment.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        setShowEmojiPicker(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Comment post failed:', response.status, errorData);
        showToast(errorData.error || 'Failed to post comment', 'error');
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      showToast('Network error', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setStartY(touch.clientY);
    setCurrentY(touch.clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const diff = touch.clientY - startY;
    if (diff > 0) {
      setCurrentY(touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    const diff = currentY - startY;
    if (diff > 100) {
      onClose();
    }
    setIsDragging(false);
    setCurrentY(0);
    setStartY(0);
  };

  const translateY = isDragging && currentY > startY ? currentY - startY : 0;

  if (!isOpen) return null;

  const sheetContent = (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/65 z-[9998] animate-fade-in"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-0 top-auto bg-white rounded-t-3xl z-[9999] h-[95vh] flex flex-col animate-slide-up"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {/* Drag Handle */}
        <div 
          className="py-3 flex justify-center cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-center">Comments</h2>
        </div>

        {/* Caption */}
        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex gap-3">
            <Image
              src={authorProfilePic || '/uploads/DefaultProfile.jpg'}
              alt={authorName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold mr-1.5">{authorName}</span>
                <span
                  className="text-gray-900"
                  dangerouslySetInnerHTML={{ __html: parseCaption(content) }}
                />
              </p>
              <p className="text-xs text-text-tertiary mt-1">{timestamp}</p>
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoadingComments && comments.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">Loading comments...</div>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0 overflow-hidden bg-gray-100">
                {comment.user.profile_image ? (
                  <Image src={comment.user.profile_image} alt={comment.user.name} width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  comment.user.name.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold mr-1.5">{comment.user.name}</span>
                  <span
                    className="text-gray-900"
                    dangerouslySetInnerHTML={{ __html: parseCaption(comment.text) }}
                  />
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                  <span>{comment.timestamp}</span>
                  <button className="font-medium hover:text-gray-600">Reply</button>
                  {user && comment.user.id === user.id && (
                    <button
                      onClick={async () => {
                        if (!token) return;
                        setComments(prev => prev.filter(c => c.id !== comment.id));
                        try {
                          await fetch(`/api/comments?id=${comment.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                        } catch (e) {
                          console.error('Delete failed', e);
                          loadComments(0, false);
                        }
                      }}
                      className="text-red-500 hover:text-red-600 font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!isLoadingComments && comments.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">No comments yet. Be the first to comment!</div>
          )}
          {hasMoreComments && (
            <button
              onClick={() => loadComments(commentsOffset + COMMENTS_PAGE_SIZE, true)}
              disabled={isLoadingComments}
              className="w-full text-sm text-info font-semibold py-2 disabled:opacity-50"
            >
              {isLoadingComments ? 'Loading...' : 'Load more comments'}
            </button>
          )}
        </div>

        {/* Actions Bar */}
        <div className="border-t border-gray-100 px-4 py-2 bg-white">
          {/* Comment Input */}
          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-xl hover:opacity-70 transition-opacity"
            >
              😊
            </button>
            <input
              ref={commentInputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              maxLength={2200}
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
              disabled={isPosting}
            />
            {newComment.trim() && (
              <button
                type="submit"
                disabled={isPosting}
                className="text-info font-semibold text-sm hover:text-info/80 disabled:opacity-50"
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            )}
          </form>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="mb-2 bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="grid grid-cols-8 gap-2">
                {commonEmojis.map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setNewComment(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded text-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Safe area for iPhone notch */}
        <div className="h-safe-bottom bg-white" />
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );

  // Render in portal at document body level
  return typeof document !== 'undefined' 
    ? createPortal(sheetContent, document.body)
    : null;
};

export default MobileCommentsSheet;
