'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { dataFetcher } from '../../lib/dataFetcher';

export default function CreatePostPage() {
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('academic');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [captionTouched, setCaptionTouched] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const router = useRouter();
  const { user, token } = useAuth();

  const categories = [
    { id: 'academic', name: 'Academic', emoji: '📚', color: 'from-blue-500 to-blue-600' },
    { id: 'events', name: 'Events', emoji: '🎉', color: 'from-purple-500 to-purple-600' },
    { id: 'clubs', name: 'Clubs', emoji: '👥', color: 'from-green-500 to-green-600' },
    { id: 'sports', name: 'Sports', emoji: '⚽', color: 'from-orange-500 to-orange-600' },
    { id: 'social', name: 'Social', emoji: '💬', color: 'from-pink-500 to-pink-600' },
    { id: 'general', name: 'General', emoji: '💭', color: 'from-gray-500 to-gray-600' },
  ];

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }

      setMediaFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!caption.trim()) {
      setCaptionTouched(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('caption', caption);
      formData.append('category', category);
      
      if (mediaFile) {
        formData.append('media', mediaFile);
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Clear posts cache after creating a new post
        dataFetcher.clearCache('/api/posts');
        
        // Dispatch custom event to update posts in other components
        window.dispatchEvent(new CustomEvent('postCreated', { detail: result.post }));
        
        // Show success message
        setShowSuccess(true);
        
        // Reset form
        setCaption('');
        setCategory('academic');
        setMediaFile(null);
        setMediaPreview(null);
        setCaptionTouched(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Redirect to home after a short delay
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-sm max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Login Required</h2>
            <p className="text-gray-600 mb-6">You need to be logged in to create a post.</p>
            <button 
              onClick={() => router.push('/')}
              className="bg-[#02fa97] text-black px-6 py-3 rounded-full font-semibold hover:bg-teal-500 transition-colors"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20 md:pb-8">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
          <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-medium">Post created successfully!</span>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.back()}
                className="p-2 hover:bg-white/80 rounded-full transition-all active:scale-95"
                disabled={isSubmitting}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">Create Post</h1>
            </div>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!caption.trim() || isSubmitting}
              className="md:hidden px-4 py-2 bg-[#02fa97] text-black font-semibold rounded-full hover:bg-teal-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Post Form */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <form onSubmit={handleSubmit}>
            {/* User Info */}
            <div className="p-4 md:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">{user.department} • {user.year}rd Year</p>
                </div>
              </div>
            </div>

            {/* Content Input */}
            <div className="p-4 md:p-6">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onBlur={() => setCaptionTouched(true)}
                placeholder="What's on your mind? Share something amazing..."
                className="w-full min-h-[120px] md:min-h-[150px] text-gray-900 placeholder-gray-400 border-0 focus:outline-none resize-none text-base md:text-lg leading-relaxed"
                maxLength={500}
                disabled={isSubmitting}
              />
              
              <div className="flex items-center justify-between mb-4">
                <div className={`text-sm font-medium ${caption.length > 450 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {caption.length}/500
                </div>
                {caption.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCaption('')}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              {captionTouched && !caption.trim() && (
                <div className="flex items-center gap-2 text-sm text-red-600 mb-4 bg-red-50 p-3 rounded-lg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Caption is required</span>
                </div>
              )}

              {/* Media Preview */}
              {mediaPreview && (
                <div className="relative mb-6 animate-fade-in-up">
                  <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-50">
                    {mediaFile?.type.startsWith('image/') ? (
                      <img 
                        src={mediaPreview} 
                        alt="Preview" 
                        className="w-full max-h-[400px] md:max-h-[500px] object-contain bg-gray-900"
                      />
                    ) : (
                      <video 
                        src={mediaPreview} 
                        controls 
                        className="w-full max-h-[400px] md:max-h-[500px]"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removeMedia}
                    className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg active:scale-95"
                    disabled={isSubmitting}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <div className="absolute bottom-3 left-3 bg-black bg-opacity-60 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
                    {mediaFile?.type.startsWith('image/') ? '📷 Image' : '🎥 Video'}
                  </div>
                </div>
              )}

              {/* Category Selection */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 7H17M7 12H17M7 17H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Choose a Category
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      disabled={isSubmitting}
                      className={`p-3 md:p-4 rounded-xl border-2 transition-all text-sm font-medium relative overflow-hidden group ${
                        category === cat.id
                          ? 'border-[#02fa97] bg-gradient-to-br from-[#02fa97]/20 to-teal-100 shadow-md scale-105'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
                      }`}
                    >
                      <span className="text-2xl md:text-3xl mb-1 block">{cat.emoji}</span>
                      <span className={category === cat.id ? 'text-gray-900 font-semibold' : 'text-gray-700'}>
                        {cat.name}
                      </span>
                      {category === cat.id && (
                        <div className="absolute top-2 right-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 6L9 17L4 12" stroke="#02fa97" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media Upload */}
              <div className="mb-6">
                <label className={`flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${
                  mediaPreview 
                    ? 'border-[#02fa97] bg-[#02fa97]/5' 
                    : 'border-gray-300 hover:border-[#02fa97] hover:bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${
                      mediaPreview 
                        ? 'bg-[#02fa97] text-white' 
                        : 'bg-gray-100 text-gray-600 group-hover:bg-[#02fa97] group-hover:text-white'
                    }`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-semibold text-gray-900">
                        {mediaPreview ? 'Change Media' : 'Add Photo or Video'}
                      </span>
                      <span className="block text-xs text-gray-500">Max size: 10MB</span>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </label>
              </div>

              {/* Submit Buttons - Desktop Only */}
              <div className="hidden md:flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-all active:scale-95"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!caption.trim() || isSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-[#02fa97] to-teal-400 text-black font-semibold rounded-full hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Publish Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Tips Section */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl p-4 border border-blue-100">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Quick Tips
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Be respectful and follow community guidelines</li>
            <li>• Add relevant categories to help others find your post</li>
            <li>• Images and videos make posts more engaging</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
