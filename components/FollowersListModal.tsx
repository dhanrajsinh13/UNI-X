"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface FollowersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | 'me';
  type: 'followers' | 'following';
}

interface LiteUser {
  id: number;
  name: string;
  username?: string;
  department?: string;
  year?: number;
  profile_image?: string | null;
  is_following: boolean;
}

const PAGE_SIZE = 20;

const FollowersListModal: React.FC<FollowersListModalProps> = ({ isOpen, onClose, userId, type }) => {
  const { token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<LiteUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isActing, setIsActing] = useState<number | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  
  // Use refs to avoid dependency issues
  const loadingRef = React.useRef(loading);
  const hasMoreRef = React.useRef(hasMore);
  const offsetRef = React.useRef(offset);
  
  // Keep refs in sync with state
  React.useEffect(() => {
    loadingRef.current = loading;
    hasMoreRef.current = hasMore;
    offsetRef.current = offset;
  }, [loading, hasMore, offset]);

  const resetState = useCallback(() => {
    setUsers([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
    setInitialLoading(true);
  }, []);

  const fetchPage = useCallback(async (append: boolean) => {
    if (!token) return;
    if (loading) return;
    if (!hasMore && append) return;
    
    setLoading(true);
    setError(null);
    
    const currentOffset = append ? offset : 0;
    console.log(`[FollowersListModal] Fetching ${type} for userId ${userId}, append=${append}, offset=${currentOffset}`);
    
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) });
      const endpoint = type === 'followers' ? 'followers' : 'following';
      const url = `/api/users/${userId}/${endpoint}?${params.toString()}`;
      
      console.log(`[FollowersListModal] Fetching: ${url}`);
      
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log(`[FollowersListModal] Response status: ${resp.status}`);
      
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        console.error(`[FollowersListModal] Error response:`, data);
        throw new Error(data.error || 'Failed to load users');
      }
      const data = await resp.json();
      const newUsers: LiteUser[] = data.users || [];
      
      console.log(`[FollowersListModal] Received ${newUsers.length} users`);
      
      setUsers(prev => {
        if (append) {
          // When appending, filter out any duplicates to prevent duplicate keys
          const existingIds = new Set(prev.map(u => u.id));
          const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.id));
          return [...prev, ...uniqueNewUsers];
        } else {
          // When not appending (fresh load), remove any potential duplicates
          const uniqueUsers = newUsers.filter((user, index, arr) => 
            arr.findIndex(u => u.id === user.id) === index
          );
          return uniqueUsers;
        }
      });
      
      setHasMore(newUsers.length === PAGE_SIZE);
      setOffset(prev => append ? prev + newUsers.length : newUsers.length);
    } catch (e: any) {
      console.error(`[FollowersListModal] Fetch error:`, e);
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setInitialLoading(false);
      console.log(`[FollowersListModal] Fetch complete, loading set to false`);
    }
  }, [token, type, userId]);

  const toggleFollow = useCallback(async (targetId: number) => {
    if (!token || isActing === targetId) return;
    setIsActing(targetId);
    try {
      const resp = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: targetId })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update follow');
      }
      const data = await resp.json();
      const action = data.action as 'followed' | 'unfollowed';
      setUsers(prev => prev.map(u => (u.id === targetId ? { ...u, is_following: action === 'followed' } : u)));
      // Let profile header update counts if listening
      window.dispatchEvent(new CustomEvent('followCountsChanged', { detail: { targetId, action } }));
    } catch (e: any) {
      alert(e.message || 'Failed to update follow');
    } finally {
      setIsActing(null);
    }
  }, [token, isActing]);

  const handleUserClick = useCallback((targetUserId: number) => {
    onClose(); // Close the modal first
    router.push(`/profile/${targetUserId}`);
  }, [onClose, router]);

  useEffect(() => {
    if (isOpen) {
      console.log(`[FollowersListModal] Modal opened for ${type}, userId: ${userId}`);
      resetState();
      // Use a small delay to prevent flickering
      const timer = setTimeout(() => {
        fetchPage(false);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      console.log(`[FollowersListModal] Modal closed`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, type]);

  // Infinite scroll
  useEffect(() => {
    if (!isOpen) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasMoreRef.current && !loadingRef.current) {
        fetchPage(true);
      }
    }, { root: null, rootMargin: '300px', threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, fetchPage]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-base">{type === 'followers' ? 'Followers' : 'Following'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">×</button>
        </div>

        {error && (
          <div className="px-4 py-3 text-sm text-red-600 border-b border-gray-100">{error}</div>
        )}

        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {initialLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-[#02fa97] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {users.map((u, index) => (
                <div key={`user-${u.id}-${index}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => handleUserClick(u.id)}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300">
                      <img 
                        src={u.profile_image || '/uploads/DefaultProfile.jpg'} 
                        alt={u.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/uploads/DefaultProfile.jpg'; }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 hover:underline">{u.username || u.name}</div>
                      <div className="text-xs text-gray-500">{u.name}</div>
                      {(u.department || u.year) && (
                        <div className="text-xs text-gray-400">{u.department}{u.year ? ` • ${u.year}rd Year` : ''}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollow(u.id);
                    }}
                    disabled={isActing === u.id}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      u.is_following ? 'border-gray-300 text-gray-700 hover:bg-gray-50' : 'border-[#02fa97] text-black bg-[#02fa97] hover:bg-teal-500'
                    } disabled:opacity-50`}
                  >
                    {u.is_following ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}

              {loading && !initialLoading && (
                <div className="px-4 py-3 text-sm text-gray-500">Loading…</div>
              )}

              {!loading && !initialLoading && users.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-500">No users to show</div>
              )}

              {/* Sentinel for infinite scroll */}
              <div ref={sentinelRef} />
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500">{users.length} loaded</div>
          <button
            onClick={() => fetchPage(true)}
            disabled={loading || !hasMore}
            className="text-sm font-medium text-[#02fa97] disabled:opacity-50"
          >
            {hasMore ? (loading ? 'Loading…' : 'Load more') : 'No more'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FollowersListModal;


