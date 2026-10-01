
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

interface AvatarUploadProps {
  currentAvatar?: string;
  userName?: string;
  onAvatarUpdate?: (url: string) => void;
}

export const AvatarUpload = ({ currentAvatar, userName, onAvatarUpdate }: AvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.user_id) {
      if (!user?.user_id) {
        toast({
          title: "Authentication Required",
          description: "Please log in to upload an avatar.",
          variant: "destructive",
        });
      }
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast({
        title: "Invalid File Type",
        description: "Please select a JPG, PNG, GIF, or WebP image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    setUploading(true);

    try {
      console.log('AvatarUpload: Starting upload for user:', user.user_id);
      
      // Create unique filename with folder structure
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.user_id}/avatar-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('AvatarUpload: Storage upload error:', error);
        throw error;
      }

      console.log('AvatarUpload: Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('AvatarUpload: Generated public URL:', publicUrl);

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          avatar: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (updateError) {
        console.error('AvatarUpload: Profile update error:', updateError);
        throw updateError;
      }

      console.log('AvatarUpload: Profile updated successfully');

      toast({
        title: "Avatar Updated! 🎉",
        description: "Your profile picture has been updated successfully.",
      });

      onAvatarUpdate?.(publicUrl);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('AvatarUpload: Error uploading avatar:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to update your avatar. Please try again.",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.user_id) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ avatar: null })
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast({
        title: "Avatar Removed",
        description: "Your profile picture has been removed.",
      });

      setPreviewUrl(null);
      onAvatarUpdate?.('');
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: "Remove Failed",
        description: "Failed to remove your avatar. Please try again.",
        variant: "destructive",
      });
    }
  };

  const displayAvatar = previewUrl || currentAvatar;
  const initials = userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Avatar className="w-24 h-24">
            <AvatarImage src={displayAvatar} alt="Profile picture" />
            <AvatarFallback className="text-xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md">
            <Camera className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Profile Picture</h3>
          <p className="text-sm text-muted-foreground">
            Upload a photo to personalize your profile
          </p>
        </div>

        <div className="flex space-x-3">
          <label htmlFor="avatar-upload" className="cursor-pointer">
            <Button 
              variant="outline" 
              size="sm"
              disabled={uploading}
              className="cursor-pointer"
              type="button"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Photo'}
            </Button>
          </label>
          
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {displayAvatar && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRemoveAvatar}
              className="text-red-600 hover:text-red-700"
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Supported formats: JPG, PNG, GIF (max 5MB)
        </div>
      </div>
    </Card>
  );
};
