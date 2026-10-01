
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { IntegrationsSettings } from './IntegrationsSettings';
import { PasswordChangeForm } from './PasswordChangeForm';
import { supabase } from '@/integrations/supabase/client';

export const SettingsPage = () => {
  const { user, updateUserType, updateUser } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState(user?.userType || 'exam');
  const [examType, setExamType] = useState(user?.examType || '');
  const [college, setCollege] = useState(user?.college || '');
  const [semester, setSemester] = useState<number | undefined>(user?.semester);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [isDarkModeEnabled, setIsDarkModeEnabled] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkModeEnabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkModeEnabled.toString());
  }, [isDarkModeEnabled]);

  const handleProfileUpdate = async () => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          name: name,
          email: email
        })
        .eq('user_id', user.user_id);

      if (error) {
        throw error;
      }

      // Update local state
      updateUser({ ...user, name, email });

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      console.error("Profile update failed:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudyPreferenceUpdate = async () => {
    setIsSubmitting(true);
    try {
      await updateUserType(selectedType, { examType, college, semester });
      toast({
        title: "Study Preferences Updated",
        description: "Your study preferences have been saved.",
      });
    } catch (error) {
      console.error("Study preferences update failed:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update study preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserTypeChange = (value: string) => {
    if (value === 'exam' || value === 'college') {
      setSelectedType(value);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gradient">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="study">Study Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy & Security</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your Email"
                  disabled
                />
              </div>
              <Button onClick={handleProfileUpdate} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Profile"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="study">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Study Preferences</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="userType">I am a...</Label>
                <Select value={selectedType} onValueChange={handleUserTypeChange}>
                  <SelectTrigger id="userType">
                    <SelectValue placeholder="Select your type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">Exam Aspirant</SelectItem>
                    <SelectItem value="college">College Student</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedType === 'exam' && (
                <div>
                  <Label htmlFor="examType">Preparing for...</Label>
                  <Input
                    type="text"
                    id="examType"
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    placeholder="e.g., JEE, NEET, UPSC"
                  />
                </div>
              )}

              {selectedType === 'college' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="collegeName">College Name</Label>
                    <Input
                      type="text"
                      id="collegeName"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g., IIT Bombay"
                    />
                  </div>
                  <div>
                    <Label htmlFor="semester">Semester</Label>
                    <Select value={semester?.toString()} onValueChange={(value) => setSemester(parseInt(value))}>
                      <SelectTrigger id="semester">
                        <SelectValue placeholder="Select semester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Semester 1</SelectItem>
                        <SelectItem value="2">Semester 2</SelectItem>
                        <SelectItem value="3">Semester 3</SelectItem>
                        <SelectItem value="4">Semester 4</SelectItem>
                        <SelectItem value="5">Semester 5</SelectItem>
                        <SelectItem value="6">Semester 6</SelectItem>
                        <SelectItem value="7">Semester 7</SelectItem>
                        <SelectItem value="8">Semester 8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <Button onClick={handleStudyPreferenceUpdate} disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Preferences"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications">Enable Notifications</Label>
                <Switch
                  id="notifications"
                  checked={isNotificationsEnabled}
                  onCheckedChange={setIsNotificationsEnabled}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Stay updated with study reminders, achievements, and important announcements.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Privacy & Security</h2>
            <PasswordChangeForm />
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsSettings />
        </TabsContent>

        <TabsContent value="appearance">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="darkMode">Dark Mode</Label>
                <Switch
                  id="darkMode"
                  checked={isDarkModeEnabled}
                  onCheckedChange={setIsDarkModeEnabled}
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toggle between light and dark mode for a comfortable viewing experience.
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
