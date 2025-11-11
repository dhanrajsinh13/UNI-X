'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose }) => {
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('general');
  const [captionTouched, setCaptionTouched] = useState(false);
  const [step, setStep] = useState<'upload' | 'edit' | 'share'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  
  // Edit state (images only)
  const [editTab, setEditTab] = useState<'filters' | 'adjust'>('filters');
  const [brightness, setBrightness] = useState<number>(1);
  const [contrast, setContrast] = useState<number>(1);
  const [saturation, setSaturation] = useState<number>(1);
  const [hue, setHue] = useState<number>(0);
  const [blur, setBlur] = useState<number>(0);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);

  const cssFilter = useMemo(() => {
    return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) hue-rotate(${hue}deg) blur(${blur}px)`;
  }, [brightness, contrast, saturation, hue, blur]);

  type FilterPreset = {
    name: string;
    values: { brightness: number; contrast: number; saturation: number; hue: number; blur: number };
    css: string;
  };

  const filterPresets: FilterPreset[] = [
    { name: 'Original', values: { brightness: 1, contrast: 1, saturation: 1, hue: 0, blur: 0 }, css: 'none' },
    { name: 'Aden', values: { brightness: 1.08, contrast: 0.9, saturation: 0.85, hue: -10, blur: 0 }, css: 'brightness(1.08) contrast(0.9) saturate(0.85) hue-rotate(-10deg)' },
    { name: 'Clarendon', values: { brightness: 1.05, contrast: 1.2, saturation: 1.1, hue: 0, blur: 0 }, css: 'brightness(1.05) contrast(1.2) saturate(1.1)' },
    { name: 'Crema', values: { brightness: 1.06, contrast: 0.95, saturation: 0.9, hue: 5, blur: 0 }, css: 'brightness(1.06) contrast(0.95) saturate(0.9) hue-rotate(5deg)' },
    { name: 'Gingham', values: { brightness: 1.05, contrast: 0.9, saturation: 0.8, hue: 0, blur: 0 }, css: 'brightness(1.05) contrast(0.9) saturate(0.8)' },
    { name: 'Juno', values: { brightness: 1.05, contrast: 1.1, saturation: 1.25, hue: 5, blur: 0 }, css: 'brightness(1.05) contrast(1.1) saturate(1.25) hue-rotate(5deg)' },
    { name: 'Lark', values: { brightness: 1.1, contrast: 0.95, saturation: 1.05, hue: 0, blur: 0 }, css: 'brightness(1.1) contrast(0.95) saturate(1.05)' },
    { name: 'Mono', values: { brightness: 1, contrast: 1.15, saturation: 0, hue: 0, blur: 0 }, css: 'contrast(1.15) saturate(0)' },
    { name: 'Vivid', values: { brightness: 1.05, contrast: 1.1, saturation: 1.35, hue: 0, blur: 0 }, css: 'brightness(1.05) contrast(1.1) saturate(1.35)' },
  ];

  const [activePreset, setActivePreset] = useState<string>('Original');

  const applyPreset = useCallback((preset: FilterPreset) => {
    setBrightness(preset.values.brightness);
    setContrast(preset.values.contrast);
    setSaturation(preset.values.saturation);
    setHue(preset.values.hue);
    setBlur(preset.values.blur);
    setActivePreset(preset.name);
  }, []);

  const applyEditsToImage = async (imageUrl: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;

        // Use original aspect ratio
        const canvasWidth = 1080;
        const canvasHeight = Math.round(canvasWidth * (naturalHeight / naturalWidth));

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }

        // Apply filter
        ctx.filter = cssFilter;

        // Scale to fit canvas
        const scale = canvasWidth / naturalWidth;
        const drawWidth = naturalWidth * scale;
        const drawHeight = naturalHeight * scale;
        const dx = 0;
        const dy = 0;

        ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.92);
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  };

  const resetEdits = useCallback(() => {
    setEditTab('filters');
    setBrightness(1);
    setContrast(1);
    setSaturation(1);
    setHue(0);
    setBlur(0);
    setOffsetX(0);
    setOffsetY(0);
    setActivePreset('Original');
  }, []);

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const point = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    dragStartRef.current = { x: point.clientX, y: point.clientY, ox: offsetX, oy: offsetY };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const point = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    const dx = point.clientX - dragStartRef.current.x;
    const dy = point.clientY - dragStartRef.current.y;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setOffsetX(dragStartRef.current!.ox + dx);
      setOffsetY(dragStartRef.current!.oy + dy);
    });
  };

  const onPointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };
  
  const { user, token } = useAuth();

  async function downscaleImageFile(file: File, maxDimension: number = 2048): Promise<File> {
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      const scale = Math.min(1, maxDimension / Math.max(width, height));
      if (scale >= 1) return file;
      const targetW = Math.round(width * scale);
      const targetH = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.imageSmoothingEnabled = true;
      try { (ctx as any).imageSmoothingQuality = 'high'; } catch {}
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.(\w+)$/i, '.jpg'), { type: 'image/jpeg' });
    } catch {
      return file;
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const processed = file.type.startsWith('image/') ? await downscaleImageFile(file, 2048) : file;
      setSelectedMedia(processed);
      const url = URL.createObjectURL(processed);
      setPreviewUrl(url);
      setStep('edit');
      resetEdits();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedMedia(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setStep('edit');
      resetEdits();
    }
  };

  const handleShare = async () => {
    if (!caption.trim()) { setCaptionTouched(true); return; }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      formData.append('category', category);
      
      if (selectedMedia) {
        if (selectedMedia.type.startsWith('image/')) {
          // Use the already edited image blob from editedPreviewUrl
          if (editedPreviewUrl) {
            const response = await fetch(editedPreviewUrl);
            const blob = await response.blob();
            const editedFile = new File([blob], `edited-${selectedMedia.name.replace(/\.(\w+)$/i, '.jpg')}`, { type: 'image/jpeg' });
            formData.append('media', editedFile);
          } else {
            // Fallback: apply edits if somehow editedPreviewUrl is not set
            const editedBlob = await applyEditsToImage(previewUrl);
            if (editedBlob) {
              const editedFile = new File([editedBlob], `edited-${selectedMedia.name.replace(/\.(\w+)$/i, '.jpg')}`, { type: 'image/jpeg' });
              formData.append('media', editedFile);
            } else {
              formData.append('media', selectedMedia);
            }
          }
        } else {
          formData.append('media', selectedMedia);
        }
      }

      // Get token from localStorage (you'll need to implement auth context)
      const authToken = token || localStorage.getItem('token');
      
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Post created successfully:', result);
        
        // Reset modal
        setSelectedMedia(null);
        setPreviewUrl('');
        setCaption('');
        setCategory('general');
        setStep('upload');
        onClose();
        
        // You could emit an event here to refresh the feed
        window.dispatchEvent(new CustomEvent('postCreated', { detail: result.post }));
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to create post');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    if (step === 'edit') {
      setStep('upload');
      setSelectedMedia(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (editedPreviewUrl) URL.revokeObjectURL(editedPreviewUrl);
      setPreviewUrl('');
      setEditedPreviewUrl('');
      resetEdits();
    } else if (step === 'share') {
      setStep('edit');
    }
  };

  const handleNext = async () => {
    // Apply edits to image and create edited preview for share step
    if (selectedMedia?.type.startsWith('image/')) {
      const editedBlob = await applyEditsToImage(previewUrl);
      if (editedBlob) {
        if (editedPreviewUrl) URL.revokeObjectURL(editedPreviewUrl);
        const editedUrl = URL.createObjectURL(editedBlob);
        setEditedPreviewUrl(editedUrl);
      }
    }
    setStep('share');
  };

  const reset = () => {
    setSelectedMedia(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (editedPreviewUrl) URL.revokeObjectURL(editedPreviewUrl);
    setPreviewUrl('');
    setEditedPreviewUrl('');
    setCaption('');
    setStep('upload');
    resetEdits();
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (step === 'upload') {
        reset();
        onClose();
      } else {
        setShowDiscardConfirm(true);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={handleOverlayClick}>
      <div className="bg-white rounded-2xl md:rounded-xl w-full max-w-lg md:max-w-2xl max-h-[90vh] overflow-auto shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          {step !== 'upload' && (
            <button
              onClick={handleBack}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          
          <h2 className="text-lg font-semibold text-gray-900 flex-1 text-center">
            {step === 'upload' && 'Create new post'}
            {step === 'edit' && 'Edit'}
            {step === 'share' && 'Share'}
          </h2>
          
          {step === 'edit' && (
            <button
              onClick={handleNext}
              className="text-[#02fa97] font-semibold hover:text-teal-600 transition-colors"
            >
              Next
            </button>
          )}
          
          {step === 'share' && (
            <button
              onClick={handleShare}
              disabled={isUploading || !caption.trim()}
              className="text-[#02fa97] font-semibold hover:text-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#02fa97] border-t-transparent rounded-full animate-spin"></div>
                  Sharing...
                </>
              ) : (
                'Share'
              )}
            </button>
          )}

          {step === 'upload' && (
            <button
              onClick={() => { reset(); onClose(); }}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors shadow-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {step === 'upload' && (
            <div className="p-8 md:p-16">
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 md:p-16 text-center hover:border-[#02fa97] transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 mb-4 text-gray-400">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                      <path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="currentColor"/>
                      <path d="M14 8.5C14 9.88071 12.8807 11 11.5 11C10.1193 11 9 9.88071 9 8.5C9 7.11929 10.1193 6 11.5 6C12.8807 6 14 7.11929 14 8.5Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <h3 className="text-xl md:text-2xl font-light text-gray-900 mb-2">
                    Drag photos and videos here
                  </h3>
                  <button className="bg-[#02fa97] text-black px-6 py-2 rounded-lg font-medium hover:bg-teal-500 transition-colors">
                    Select from computer
                  </button>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {step === 'edit' && previewUrl && (
            <div className="flex flex-col md:flex-row max-h-[70vh]">
              {/* Preview on the left */}
              <div className="flex-1 p-4">
                <div className="aspect-square bg-black flex items-center justify-center md:max-h-[60vh] relative overflow-hidden rounded-2xl shadow-lg">
                  {selectedMedia?.type.startsWith('image/') ? (
                    <img
                      ref={imageRef}
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                      style={{ filter: cssFilter }}
                    />
                  ) : (
                    <video
                      src={previewUrl}
                      controls
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                </div>
              </div>

              {/* Controls on the right */}
              <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-100 p-4 overflow-y-auto">
                {selectedMedia?.type.startsWith('image/') ? (
                  <>
                    {/* Tabs */}
                    <div className="flex items-center justify-center mb-4">
                      <div className="inline-flex rounded-full bg-gray-100 p-1">
                        <button onClick={() => setEditTab('filters')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${editTab === 'filters' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>Filters</button>
                        <button onClick={() => setEditTab('adjust')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${editTab === 'adjust' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>Adjust</button>
                      </div>
                    </div>

                    {/* Panels */}
                              onClick={() => setCropAspect('original')}
                              className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                                cropAspect === 'original'
                                  ? 'border-[#02fa97] bg-[#02fa97]/10 text-gray-900'
                                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
                              }`}
                            >
                              <div className="w-7 h-8 border-2 border-current rounded mx-auto mb-1"></div>
                              Original
                            </button>
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm text-gray-700 mb-2">
                            <span className="font-medium">Zoom</span>
                            <span className="text-gray-500">{zoom.toFixed(2)}×</span>
                          </div>
                          <input 
                            type="range" 
                            min={1} 
                            max={2.5} 
                            step={0.01} 
                            value={zoom} 
                            onChange={(e) => setZoom(parseFloat(e.target.value))} 
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#02fa97]" 
                          />
                        </div>

                        <div className="pt-2 pb-1 border-t border-gray-100">
                          <p className="text-xs text-gray-500 leading-relaxed">
                            💡 Drag the image to reposition it within the frame
                          </p>
                        </div>
                      </div>
                    )}

                    {editTab === 'filters' && (
                      <div className="grid grid-cols-3 gap-3">
                        {filterPresets.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => applyPreset(preset)}
                            className={`border rounded-lg p-2 text-xs text-gray-700 hover:bg-gray-50 ${activePreset === preset.name ? 'ring-2 ring-[#02fa97]' : ''}`}
                          >
                            <div className="h-20 w-full bg-gray-200 rounded mb-2 overflow-hidden flex items-center justify-center">
                              <img src={previewUrl} alt={preset.name} className="h-full w-full object-cover" style={{ filter: preset.css }} />
                            </div>
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {editTab === 'adjust' && (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm text-gray-700 mb-2">
                            <span className="font-medium">Brightness</span>
                            <span className="text-gray-500">{brightness.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range" 
                            min={0.5} 
                            max={1.5} 
                            step={0.01} 
                            value={brightness} 
                            onChange={(e) => setBrightness(parseFloat(e.target.value))} 
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#02fa97]" 
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm text-gray-700 mb-2">
                            <span className="font-medium">Contrast</span>
                            <span className="text-gray-500">{contrast.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range" 
                            min={0.5} 
                            max={1.5} 
                            step={0.01} 
                            value={contrast} 
                            onChange={(e) => setContrast(parseFloat(e.target.value))} 
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#02fa97]" 
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm text-gray-700 mb-2">
                            <span className="font-medium">Saturation</span>
                            <span className="text-gray-500">{saturation.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range" 
                            min={0} 
                            max={2} 
                            step={0.01} 
                            value={saturation} 
                            onChange={(e) => setSaturation(parseFloat(e.target.value))} 
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#02fa97]" 
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm text-gray-700 mb-2">
                            <span className="font-medium">Hue</span>
                            <span className="text-gray-500">{hue.toFixed(0)}°</span>
                          </div>
                          <input 
                            type="range" 
                            min={-180} 
                            max={180} 
                            step={1} 
                            value={hue} 
                            onChange={(e) => setHue(parseFloat(e.target.value))} 
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#02fa97]" 
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm text-gray-700 mb-2">
                            <span className="font-medium">Blur</span>
                            <span className="text-gray-500">{blur.toFixed(1)}px</span>
                          </div>
                          <input 
                            type="range" 
                            min={0} 
                            max={5} 
                            step={0.1} 
                            value={blur} 
                            onChange={(e) => setBlur(parseFloat(e.target.value))} 
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#02fa97]" 
                          />
                        </div>
                        <div className="pt-3 border-t border-gray-100">
                          <button 
                            onClick={resetEdits} 
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Reset All
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-500">Video editing is not supported yet. You can still share this video.</div>
                )}
              </div>
            </div>
          )}

          {step === 'share' && (
            <div className="flex flex-col md:flex-row">
              {/* Preview */}
              <div className="aspect-square md:w-1/2 bg-black flex items-center justify-center rounded-2xl shadow-lg overflow-hidden">
                {selectedMedia?.type.startsWith('image/') ? (
                  <img
                    src={editedPreviewUrl || previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <video
                    src={previewUrl}
                    controls
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
              
              {/* Caption */}
              <div className="flex-1 p-4 md:pl-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#02fa97] to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    U
                  </div>
                  <span className="font-semibold text-gray-900">{user?.name || 'Your Username'}</span>
                </div>
                
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onBlur={() => setCaptionTouched(true)}
                  placeholder="Write a caption..."
                  className="w-full h-32 md:h-40 resize-none border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#02fa97] text-sm text-gray-500 placeholder-gray-500"
                  maxLength={1000}
                />
                
                <div className="text-xs text-gray-400 text-right mb-4">
                  {caption.length}/2,200
                </div>
                {captionTouched && !caption.trim() && (
                  <div className="text-xs text-red-600 mb-3">Caption is required.</div>
                )}
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-900">Category</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#02fa97]"
                    >
                      <option value="general">General</option>
                      <option value="academic">Academic</option>
                      <option value="events">Events</option>
                      <option value="clubs">Clubs</option>
                      <option value="sports">Sports</option>
                      <option value="social">Social</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 opacity-50">
                    <span className="text-sm text-gray-900">Add location</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Coming soon</span>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                        <path d="M9 12L11 14L15 10M21 12C21 16.418 16.97 20 12 20C7.03 20 3 16.418 3 12C3 7.582 7.03 4 12 4C16.97 4 21 7.582 21 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-900">Tag people</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-400">
                      <path d="M9 12L11 14L15 10M21 12C21 16.418 16.97 20 12 20C7.03 20 3 16.418 3 12C3 7.582 7.03 4 12 4C16.97 4 21 7.582 21 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDiscardConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" onClick={(e) => { if (e.target === e.currentTarget) setShowDiscardConfirm(false); }}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="text-lg font-semibold mb-1">Discard post?</h3>
            <p className="text-sm text-gray-600 mb-4">If you leave, your edits won’t be saved.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => { reset(); setShowDiscardConfirm(false); onClose(); }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePostModal;
