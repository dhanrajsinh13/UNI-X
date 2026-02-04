'use client';

import Image from 'next/image'
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '../../hooks/useIsMobile';
import { fetchAPI, dataFetcher } from '../../lib/dataFetcher';

type SettingsSection = 'account-privacy' | 'edit-profile' | 'notifications' | 'password';

interface BlockedUser {
  id: number;
  blocked_user_id: number;
  blocked_user: {
    id: number;
    name: string;
    username?: string;
    profile_image?: string;
  };
  created_at: string;
}

export default function SettingsPage() {
  const { token, user, logout } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>('account-privacy');

  // Additional privacy settings
  const [showOnlineStatus, setShowOnlineStatus] = useState<boolean>(true);
  const [showReadReceipts, setShowReadReceipts] = useState<boolean>(true);
  const [whoCanMessage, setWhoCanMessage] = useState<'everyone' | 'followers'>('everyone');
  const [whoCanComment, setWhoCanComment] = useState<'everyone' | 'followers'>('everyone');

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Edit Profile Modal States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    department: user?.department || '',
    year: user?.year || 1
  });
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPfp, setEditPfp] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPfp, setUploadingPfp] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAPI<{ user: any }>(
          '/api/users/me',
          { token, cacheTTL: 30000 }
        );

        setIsPrivate(!!data.user?.is_private);

        // Load additional privacy settings from localStorage (since they're not in DB yet)
        const savedSettings = localStorage.getItem('privacySettings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setShowOnlineStatus(parsed.showOnlineStatus ?? true);
          setShowReadReceipts(parsed.showReadReceipts ?? true);
          setWhoCanMessage(parsed.whoCanMessage ?? 'everyone');
          setWhoCanComment(parsed.whoCanComment ?? 'everyone');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  useEffect(() => {
    // Load blocked users
    const loadBlockedUsers = async () => {
      if (!token) return;
      setLoadingBlocked(true);
      try {
        const data = await fetchAPI<{ blockedUsers: BlockedUser[] }>(
          '/api/users/blocked',
          { token, cacheTTL: 10000 } // Cache for 10 seconds
        );
        setBlockedUsers(data.blockedUsers || []);
      } catch (err: any) {
        console.error('Failed to load blocked users:', err);
      } finally {
        setLoadingBlocked(false);
      }
    };
    loadBlockedUsers();
  }, [token]);

  const handleUnblockUser = async (blockedUserId: number) => {
    if (!token) return;
    try {
      await fetchAPI(`/api/users/block/${blockedUserId}`, {
        method: 'DELETE',
        token,
        skipCache: true
      });

      setBlockedUsers(prev => prev.filter(blocked => blocked.blocked_user_id !== blockedUserId));
      setMessage('User unblocked successfully');
      setTimeout(() => setMessage(null), 3000);

      // Clear cache
      dataFetcher.clearCache('/api/users/blocked');
    } catch (err: any) {
      console.error('Error unblocking user:', err);
      setError(err.message || 'Failed to unblock user');
      setTimeout(() => setError(null), 3000);
    }
  };

  const savePrivacySettings = () => {
    // Save to localStorage (in production, you'd save to backend)
    // TODO: Migrate to backend API when privacy settings schema is added to User model
    // Recommended fields to add to User schema:
    // - show_online_status: boolean
    // - show_read_receipts: boolean  
    // - who_can_message: 'everyone' | 'followers'
    // - who_can_comment: 'everyone' | 'followers'
    const settings = {
      showOnlineStatus,
      showReadReceipts,
      whoCanMessage,
      whoCanComment
    };
    localStorage.setItem('privacySettings', JSON.stringify(settings));
  };

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await fetchAPI('/api/users/me', {
        method: 'PUT',
        token,
        body: JSON.stringify({ is_private: isPrivate }),
        skipCache: true
      });

      savePrivacySettings(); // Save other privacy settings
      dataFetcher.clearCache('/api/users/me'); // Clear user cache
      setMessage('Settings saved');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Edit Profile Functions
  const resetEditForm = async () => {
    if (!token) return;

    try {
      // Fetch latest user data
      const data = await fetchAPI<{ user: any }>(
        '/api/users/me',
        { token, skipCache: true } // Skip cache to get fresh data
      );

      const latestUser = data.user;

      setEditForm({
        name: latestUser.name || '',
        department: latestUser.department || '',
        year: latestUser.year || 1
      });
      setEditUsername(latestUser.username || '');
      setEditBio(latestUser.bio || '');
      setEditPfp(latestUser.profile_image || null);
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fallback to cached user data
      if (user) {
        setEditForm({ name: user.name || '', department: user.department || '', year: user.year || 1 });
        setEditUsername(user.username || '');
        setEditBio((user as any).bio || '');
        setEditPfp((user as any).profile_image || null);
      }
    }

    setHasUnsavedChanges(false);
  };

  const handleFormChange = () => {
    setHasUnsavedChanges(true);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        setIsEditing(false);
        setHasUnsavedChanges(false);
        resetEditForm();
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const payload: any = { ...editForm, bio: editBio, username: editUsername, profile_image: editPfp };
      await fetchAPI('/api/users/me', {
        method: 'PUT',
        token: token || '',
        body: JSON.stringify(payload),
        skipCache: true
      });

      setIsEditing(false);
      setHasUnsavedChanges(false);
      dataFetcher.clearCache('/api/users/me'); // Clear user cache
      setMessage('Profile updated successfully');
      setTimeout(() => setMessage(null), 3000);
      // Reload user data
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploadingPfp(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await fetchAPI('/api/users/upload-profile-pic', {
        method: 'POST',
        token: token || '',
        body: formData,
        skipCache: true
      }) as { url: string };

      setEditPfp(data.url);
      setHasUnsavedChanges(true);
      dataFetcher.clearCache('/api/users/me'); // Clear user cache
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      alert(error.message || 'Failed to upload profile picture');
    } finally {
      setUploadingPfp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {/* Modern Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your account preferences</p>
          </div>

          {/* Settings Sections */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="px-4 space-y-2">
              {/* Account Section */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Account</p>

                <button
                  onClick={async () => {
                    setIsEditing(true);
                    await resetEditForm();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 group"
                >
                  <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-green-100 transition-colors">
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Edit Profile</span>
                    <p className="text-xs text-gray-500">Update your information</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => setActiveSection('notifications')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeSection === 'notifications'
                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 shadow-sm'
                    : 'hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50'
                    } group`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${activeSection === 'notifications' ? 'bg-green-200' : 'bg-gray-100 group-hover:bg-green-100'
                    }`}>
                    <svg className={`w-5 h-5 ${activeSection === 'notifications' ? 'text-green-700' : 'text-gray-600 group-hover:text-green-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className={`font-medium ${activeSection === 'notifications' ? 'text-green-700' : 'text-gray-900'}`}>
                      Notifications
                    </span>
                    <p className="text-xs text-gray-500">Manage alerts</p>
                  </div>
                  <svg className={`w-5 h-5 ${activeSection === 'notifications' ? 'text-green-600' : 'text-gray-400 group-hover:text-green-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Privacy Section */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Privacy & Security</p>

                <button
                  onClick={() => setActiveSection('account-privacy')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeSection === 'account-privacy'
                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 shadow-sm'
                    : 'hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50'
                    } group`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${activeSection === 'account-privacy' ? 'bg-green-200' : 'bg-gray-100 group-hover:bg-green-100'
                    }`}>
                    <svg className={`w-5 h-5 ${activeSection === 'account-privacy' ? 'text-green-700' : 'text-gray-600 group-hover:text-green-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className={`font-medium ${activeSection === 'account-privacy' ? 'text-green-700' : 'text-gray-900'}`}>
                      Account Privacy
                    </span>
                    <p className="text-xs text-gray-500">Control visibility</p>
                  </div>
                  {isPrivate && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                      Private
                    </span>
                  )}
                  <svg className={`w-5 h-5 ${activeSection === 'account-privacy' ? 'text-green-600' : 'text-gray-400 group-hover:text-green-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => setActiveSection('password')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeSection === 'password'
                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 shadow-sm'
                    : 'hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50'
                    } group`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${activeSection === 'password' ? 'bg-green-200' : 'bg-gray-100 group-hover:bg-green-100'
                    }`}>
                    <svg className={`w-5 h-5 ${activeSection === 'password' ? 'text-green-700' : 'text-gray-600 group-hover:text-green-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <span className={`font-medium ${activeSection === 'password' ? 'text-green-700' : 'text-gray-900'}`}>
                      Close Friends
                    </span>
                    <p className="text-xs text-gray-500">Manage lists</p>
                  </div>
                  <svg className={`w-5 h-5 ${activeSection === 'password' ? 'text-green-600' : 'text-gray-400 group-hover:text-green-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Logout Button */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left hover:bg-red-50 group"
                >
                  <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-red-100 transition-colors">
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-900 group-hover:text-red-600">Log out</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-8 py-10">
              {/* Account Privacy Section */}
              {activeSection === 'account-privacy' && (
                <div>
                  {/* Header */}
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Account Privacy</h2>
                    <p className="text-gray-600">Control who can see your content and interact with you</p>
                  </div>

                  {/* Alerts */}
                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-900">Error</p>
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  )}
                  {message && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-900">Success</p>
                        <p className="text-sm text-green-700">{message}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Account Visibility Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Account Visibility
                        </h3>
                      </div>

                      {/* Private Account Toggle */}
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-6">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              Private account
                              {isPrivate && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 leading-relaxed">
                              When your account is public, your profile and posts can be seen by anyone.
                              When private, only approved followers can see what you share.
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isPrivate}
                                onChange={(e) => {
                                  setIsPrivate(e.target.checked);
                                  setTimeout(() => onSave(), 100);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Interactions Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Interactions
                        </h3>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Who Can Comment */}
                        <div className="flex items-start justify-between gap-6">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-2">Who can comment on your posts</div>
                            <div className="text-sm text-gray-600">
                              Control who can comment on your posts
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <select
                              value={whoCanComment}
                              onChange={(e) => {
                                setWhoCanComment(e.target.value as 'everyone' | 'followers');
                                savePrivacySettings();
                              }}
                              className="bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:border-gray-400 transition-colors"
                            >
                              <option value="everyone">Everyone</option>
                              <option value="followers">Followers only</option>
                            </select>
                          </div>
                        </div>

                        <div className="border-t border-gray-100"></div>

                        {/* Who Can Message */}
                        <div className="flex items-start justify-between gap-6">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-2">Who can message you</div>
                            <div className="text-sm text-gray-600">
                              Control who can send you direct messages
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <select
                              value={whoCanMessage}
                              onChange={(e) => {
                                setWhoCanMessage(e.target.value as 'everyone' | 'followers');
                                savePrivacySettings();
                              }}
                              className="bg-white text-gray-900 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 hover:border-gray-400 transition-colors"
                            >
                              <option value="everyone">Everyone</option>
                              <option value="followers">Followers only</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Activity Status Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Activity Status
                        </h3>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Show Online Status */}
                        <div className="flex items-start justify-between gap-6">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-2">Show online status</div>
                            <div className="text-sm text-gray-600">
                              Let others see when you're active on UNI-X
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showOnlineStatus}
                                onChange={(e) => {
                                  setShowOnlineStatus(e.target.checked);
                                  savePrivacySettings();
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                          </div>
                        </div>

                        <div className="border-t border-gray-100"></div>

                        {/* Show Read Receipts */}
                        <div className="flex items-start justify-between gap-6">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-2">Show read receipts</div>
                            <div className="text-sm text-gray-600">
                              Let others see when you've read their messages
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showReadReceipts}
                                onChange={(e) => {
                                  setShowReadReceipts(e.target.checked);
                                  savePrivacySettings();
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Blocked Users Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                            <path d="M4.93 4.93L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          Blocked Users
                          {blockedUsers.length > 0 && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                              {blockedUsers.length}
                            </span>
                          )}
                        </h3>
                      </div>

                      <div className="p-6">
                        {loadingBlocked ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
                          </div>
                        ) : blockedUsers.length === 0 ? (
                          <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                              <path d="M4.93 4.93L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <p className="text-gray-500 font-medium">No blocked users</p>
                            <p className="text-sm text-gray-400 mt-1">Users you block will appear here</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {blockedUsers.map((blocked) => (
                              <div key={blocked.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <Image
                                    src={blocked.blocked_user?.profile_image || '/uploads/DefaultProfile.jpg'}
                                    alt={blocked.blocked_user?.name}
                                    className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm grayscale"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-gray-900 truncate">{blocked.blocked_user?.name}</div>
                                    {blocked.blocked_user?.username && (
                                      <div className="text-sm text-gray-500 truncate">@{blocked.blocked_user.username}</div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      Blocked {new Date(blocked.created_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleUnblockUser(blocked.blocked_user_id)}
                                  className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors border border-gray-300 shadow-sm ml-4"
                                >
                                  Unblock
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Data & History Section */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Data & History
                        </h3>
                      </div>

                      <div className="p-6 space-y-3">
                        <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left border border-gray-200">
                          <div>
                            <div className="font-semibold text-gray-900 mb-1">Download your data</div>
                            <div className="text-sm text-gray-600">
                              Get a copy of your UNI-X data
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left border border-gray-200">
                          <div>
                            <div className="font-semibold text-gray-900 mb-1">Clear search history</div>
                            <div className="text-sm text-gray-600">
                              Remove your recent searches
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
                      <div className="p-6 border-b border-red-100 bg-red-50">
                        <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Danger Zone
                        </h3>
                      </div>

                      <div className="p-6 space-y-3">
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to deactivate your account? You can reactivate it anytime by logging in.')) {
                              // Implement deactivation logic
                              alert('Account deactivation feature coming soon');
                            }
                          }}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left border border-gray-300"
                        >
                          <div>
                            <div className="font-semibold text-gray-900 mb-1">Deactivate account</div>
                            <div className="text-sm text-gray-600">
                              Temporarily disable your account
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm('⚠️ WARNING: This will permanently delete your account and all your data. This action cannot be undone. Are you absolutely sure?')) {
                              // Implement deletion logic
                              alert('Account deletion feature coming soon');
                            }
                          }}
                          className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-left border border-red-300"
                        >
                          <div>
                            <div className="font-semibold text-red-700 mb-1">Delete account</div>
                            <div className="text-sm text-red-600">
                              Permanently delete your account and data
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
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
                onClick={handleSaveProfile}
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
                    <Image
                      src={editPfp || '/uploads/DefaultProfile.jpg'}
                      alt="Preview"
                      width={96}
                      height={96}
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
                      className={`inline-block px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${uploadingPfp
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
                      maxLength={150}
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
  );
}
