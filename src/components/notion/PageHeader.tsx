import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Smile, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  pageId?: string;
  title: string;
  icon: string | null;
  coverImage: string | null;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string | null) => void;
  onCoverImageChange: (coverImage: string | null) => void;
  onShareClick?: () => void;
  editable?: boolean;
}

// Common emoji icons for pages
const EMOJI_OPTIONS = [
  '📝', '📚', '📖', '📄', '📋', '📌', '📍', '🎯', '🎓', '🎨',
  '💡', '💻', '🔬', '🔭', '🗂️', '📁', '📂', '🗃️', '📊', '📈',
  '🏆', '⭐', '✨', '🔥', '💪', '🚀', '🎉', '🎊', '🌟', '⚡',
];

export function PageHeader({
  pageId,
  title,
  icon,
  coverImage,
  onTitleChange,
  onIconChange,
  onCoverImageChange,
  onShareClick,
  editable = true,
}: PageHeaderProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local title with prop when it changes externally
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Auto-save title after user stops typing (debounced)
  useEffect(() => {
    if (localTitle === title) return;

    const timeoutId = setTimeout(() => {
      if (localTitle.trim()) {
        onTitleChange(localTitle);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localTitle, title, onTitleChange]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleCoverImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB for cover images)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Create a local URL for preview (in production, this would upload to storage)
    const imageUrl = URL.createObjectURL(file);
    onCoverImageChange(imageUrl);
  };

  const handleRemoveCoverImage = () => {
    onCoverImageChange(null);
  };

  const handleIconSelect = (emoji: string) => {
    onIconChange(emoji);
  };

  const handleRemoveIcon = () => {
    onIconChange(null);
  };

  return (
    <div className="page-header">
      {/* Cover Image */}
      {coverImage && (
        <div className="relative w-full h-60 group">
          <img
            src={coverImage}
            alt="Page cover"
            className="w-full h-full object-cover"
            role="img"
          />
          {editable && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRemoveCoverImage}
                className="bg-white/90 hover:bg-white"
                aria-label="Remove cover image"
              >
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                Remove
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Cover Image Button and Share Button */}
      {!coverImage && editable && (
        <div className="relative w-full h-12 group">
          <div className="absolute top-2 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onShareClick && pageId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onShareClick}
                aria-label="Share page"
              >
                <Share2 className="h-4 w-4 mr-1" aria-hidden="true" />
                Share
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add cover image"
            >
              <Upload className="h-4 w-4 mr-1" aria-hidden="true" />
              Add cover
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverImageUpload}
            className="hidden"
            aria-label="Upload cover image"
          />
        </div>
      )}

      {/* Share Button for pages with cover image */}
      {coverImage && editable && onShareClick && pageId && (
        <div className="absolute top-4 right-20">
          <Button
            variant="secondary"
            size="sm"
            onClick={onShareClick}
            className="bg-white/90 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Share page"
          >
            <Share2 className="h-4 w-4 mr-1" aria-hidden="true" />
            Share
          </Button>
        </div>
      )}

      {/* Icon and Title */}
      <div className={cn(
        "px-16 py-8",
        coverImage ? "pt-12" : "pt-8"
      )}>
        {/* Icon */}
        <div className="flex items-center gap-2 mb-2">
          {icon ? (
            <div className="flex items-center gap-2">
              <span className="text-6xl cursor-pointer hover:opacity-80 transition-opacity" role="img" aria-label={`Page icon: ${icon}`}>
                {icon}
              </span>
              {editable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveIcon}
                  className="opacity-0 hover:opacity-100 transition-opacity"
                  aria-label="Remove page icon"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          ) : (
            editable && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label="Add page icon">
                    <Smile className="h-4 w-4 mr-1" aria-hidden="true" />
                    Add icon
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" role="dialog" aria-label="Select page icon">
                  <div className="grid grid-cols-8 gap-2" role="grid" aria-label="Icon options">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleIconSelect(emoji)}
                        className="text-2xl hover:bg-accent rounded p-1 transition-colors"
                        role="gridcell"
                        aria-label={`Select ${emoji} icon`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )
          )}
        </div>

        {/* Title */}
        {editable ? (
          isEditingTitle ? (
            <Input
              ref={titleInputRef}
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                }
              }}
              className="text-4xl font-bold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
              placeholder="Untitled"
              aria-label="Page title"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="text-4xl font-bold cursor-text hover:bg-accent/50 rounded px-2 -mx-2 transition-colors"
              role="button"
              tabIndex={0}
              aria-label="Page title. Click to edit"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsEditingTitle(true);
                }
              }}
            >
              {localTitle || 'Untitled'}
            </h1>
          )
        ) : (
          <h1 className="text-4xl font-bold" aria-label="Page title">
            {title || 'Untitled'}
          </h1>
        )}
      </div>
    </div>
  );
}
