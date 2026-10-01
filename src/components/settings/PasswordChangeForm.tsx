import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateFileUpload, passwordSchema } from '@/lib/security';
import { z } from 'zod';

export const PasswordChangeForm = () => {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = async () => {
    setIsSubmitting(true);
    
    try {
      // Validate passwords
      passwordSchema.parse(newPassword);
      
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (!currentPassword) {
        throw new Error('Current password is required');
      }

      // Verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email || '',
        password: currentPassword
      });

      if (verifyError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed.",
      });

    } catch (error) {
      let errorMessage = "Failed to change password. Please try again.";
      
      if (error instanceof z.ZodError) {
        errorMessage = error.errors[0].message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Password Change Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="currentPassword">Current Password</Label>
        <Input
          type="password"
          id="currentPassword"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
        />
      </div>
      <div>
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          type="password"
          id="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password (min 8 characters)"
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
        />
      </div>
      <Button 
        onClick={handlePasswordChange} 
        disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
      >
        {isSubmitting ? "Changing Password..." : "Change Password"}
      </Button>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <p>Password requirements:</p>
        <ul className="list-disc list-inside ml-2">
          <li>At least 8 characters long</li>
          <li>Include a mix of letters, numbers, and symbols for better security</li>
        </ul>
      </div>
    </div>
  );
};