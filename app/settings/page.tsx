'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '../../hooks/useIsMobile';

type SettingsSection = 'account-privacy' | 'edit-profile' | 'notifications' | 'password';

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
        const resp = await fetch('/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resp.ok) {
          const data = await resp.json();
          setIsPrivate(!!data.user?.is_private);
        } else {
          setError('Failed to load settings');
        }
      } catch {
        setError('Network error loading settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const resp = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ is_private: isPrivate })
      });
      if (resp.ok) {
        setMessage('Settings saved');
        setTimeout(() => setMessage(null), 3000);
      } else {
        const err = await resp.json().catch(() => ({} as any));
        setError(err.error || 'Failed to save settings');
      }
    } catch {
      setError('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  // Edit Profile Functions
  const resetEditForm = async () => {
    if (!token) return;
    
    try {
      // Fetch latest user data
      const resp = await fetch('/api/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) {
        const data = await resp.json();
        const latestUser = data.user;
        
        setEditForm({ 
          name: latestUser.name || '', 
          department: latestUser.department || '', 
          year: latestUser.year || 1 
        });
        setEditUsername(latestUser.username || '');
        setEditBio(latestUser.bio || '');
        setEditPfp(latestUser.profile_image || null);
      }
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
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setIsEditing(false);
        setHasUnsavedChanges(false);
        setMessage('Profile updated successfully');
        setTimeout(() => setMessage(null), 3000);
        // Reload user data
        window.location.reload();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Network error. Please try again.');
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
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setEditPfp(data.url);
      } else {
        alert('Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Network error while uploading');
    } finally {
      setUploadingPfp(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r flex flex-col">
          <div className="p-6">
            <h1 className="text-2xl font-semibold">Settings</h1>
          </div>

          {/* Settings Sections */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 space-y-1">
              <p className="text-xs text-gray-500 font-semibold px-3 py-2">How you use UNI-X</p>
              
              <button 
                onClick={async () => { 
                  setIsEditing(true); 
                  await resetEditForm(); 
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Edit Profile</span>
              </button>

              <button 
                onClick={() => setActiveSection('notifications')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeSection === 'notifications' ? 'bg-green-400' : 'hover:bg-lime-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>Notifications</span>
              </button>

              <p className="text-xs text-gray-500 font-semibold px-3 py-2 pt-4">Who can see your content</p>
              
              <button 
                onClick={() => setActiveSection('account-privacy')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeSection === 'account-privacy' ? 'bg-green-400' : 'hover:bg-lime-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Account privacy</span>
              </button>

              <button 
                onClick={() => setActiveSection('password')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                  activeSection === 'password' ? 'bg-green-400' : 'hover:bg-lime-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>Close Friends</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-8 py-10">
              {/* Account Privacy Section */}
              {activeSection === 'account-privacy' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">Account privacy</h2>
                  
                  {error && (
                    <div className="mb-4 p-3 text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg">
                      {error}
                    </div>
                  )}
                  {message && (
                    <div className="mb-4 p-3 text-sm text-green-400 bg-green-950 border border-green-800 rounded-lg">
                      {message}
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Private Account Toggle */}
                    <div className="flex items-start justify-between py-4">
                      <div className="flex-1">
                        <div className="font-medium text-white mb-1">Private account</div>
                        <div className="text-sm text-gray-400 max-w-lg">
                          When your account is public, your profile and posts can be seen by anyone, on or off UNI-X, even if they don't have a UNI-X account.
                        </div>
                        <div className="text-sm text-gray-400 max-w-lg mt-3">
                          When your account is private, only the followers that you approve can see what you share, including your photos or videos on hashtag and location pages, and your followers and following lists. Certain info on your profile, such as your profile picture and username, is visible to everyone on and off UNI-X.
                        </div>
                      </div>
                      <div className="ml-6">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={isPrivate} 
                            onChange={(e) => {
                              setIsPrivate(e.target.checked);
                              // Auto-save on toggle
                              setTimeout(() => onSave(), 100);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'notifications' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">Notifications</h2>
                  <div className="space-y-4">
                    <p className="text-gray-400">Notification settings will be available soon.</p>
                  </div>
                </div>
              )}

              {/* Password Section */}
              {activeSection === 'password' && (
                <div>
                  <h2 className="text-2xl font-semibold mb-6">Close Friends</h2>
                  <div className="space-y-4">
                    <p className="text-gray-400">Close friends feature coming soon.</p>
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
