import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Mail,
  Camera,
  Flame,
  Clock,
  Trophy,
  Star,
  BarChart2,
  Settings,
  Edit3,
  GraduationCap,
  Landmark,
  FileText,
  BookOpen,
  Target,
  TrendingUp,
  Calendar,
  ChevronDown,
  Upload,
  Check,
  RotateCcw
} from 'lucide-react';

interface ExtendedPreferences {
  preferredSubjects?: string;
  studyGoal?: string;
  dailyTarget?: string;
  quote?: string;
  college?: string;
  examType?: string;
}

const DEFAULT_PREFERENCES: ExtendedPreferences = {
  preferredSubjects: 'CS, DSA, OS, CN',
  studyGoal: 'Get into top tech company',
  dailyTarget: '4 hours',
  quote: '“A little progress each day adds up to big results.”',
  college: 'IIT',
  examType: 'JEE',
};

export const ProfilePage = () => {
  const { user, refetch } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load custom preferences from localStorage or default
  const [preferences, setPreferences] = useState<ExtendedPreferences>(() => {
    const saved = localStorage.getItem('studymate_user_preferences');
    if (saved) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  });

  // Modal edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [name, setName] = useState(user?.name || 'abhi');
  const [userType, setUserType] = useState(user?.userType || 'college');
  const [college, setCollege] = useState(user?.college || preferences.college || 'IIT');
  const [examType, setExamType] = useState(user?.examType || preferences.examType || 'JEE');
  const [preferredSubjects, setPreferredSubjects] = useState(preferences.preferredSubjects || 'CS, DSA, OS, CN');
  const [studyGoal, setStudyGoal] = useState(preferences.studyGoal || 'Get into top tech company');
  const [dailyTarget, setDailyTarget] = useState(preferences.dailyTarget || '4 hours');
  const [quote, setQuote] = useState(preferences.quote || DEFAULT_PREFERENCES.quote);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');

  // Keep local state in sync when user data loads
  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.userType) setUserType(user.userType);
    if (user?.college) setCollege(user.college);
    if (user?.examType) setExamType(user.examType);
    if (user?.avatar) setAvatarUrl(user.avatar);
  }, [user]);

  const handleOpenEdit = () => {
    setName(user?.name || name);
    setCollege(user?.college || preferences.college || 'IIT');
    setExamType(user?.examType || preferences.examType || 'JEE');
    setPreferredSubjects(preferences.preferredSubjects || 'CS, DSA, OS, CN');
    setStudyGoal(preferences.studyGoal || 'Get into top tech company');
    setDailyTarget(preferences.dailyTarget || '4 hours');
    setQuote(preferences.quote || DEFAULT_PREFERENCES.quote);
    setAvatarUrl(user?.avatar || avatarUrl);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1. Save extended preferences to localStorage
      const newPrefs: ExtendedPreferences = {
        preferredSubjects,
        studyGoal,
        dailyTarget,
        quote,
        college,
        examType,
      };
      setPreferences(newPrefs);
      localStorage.setItem('studymate_user_preferences', JSON.stringify(newPrefs));

      // 2. Update Supabase user profile if authenticated
      if (user?.user_id) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            name,
            college,
            exam_type: examType,
            avatar: avatarUrl || user.avatar,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.user_id);

        if (error) {
          console.warn('Could not update Supabase user_profiles, saved locally:', error);
        }

        if (refetch) {
          await refetch();
        }
      }

      toast({
        title: "Profile Updated Successfully! ✅",
        description: "Your profile information and study preferences have been saved.",
      });
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      toast({
        title: "Update Error",
        description: "Failed to update profile. Changes saved locally.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setAvatarUrl(result);

      if (user?.user_id) {
        try {
          await supabase
            .from('user_profiles')
            .update({ avatar: result })
            .eq('user_id', user.user_id);
          if (refetch) await refetch();
        } catch (err) {
          console.warn('Could not sync avatar to database:', err);
        }
      }

      toast({
        title: "Avatar Updated! 📷",
        description: "Your new profile picture is set.",
      });
    };
    reader.readAsDataURL(file);
  };

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click();
  };

  const displayInitial = (name || user?.name || 'A')
    .trim()[0]
    ?.toUpperCase() || 'A';

  // Sample 7-day study activity hours
  const activityData = [
    { day: 'Mon', hours: 1.0, max: 8 },
    { day: 'Tue', hours: 5.0, max: 8 },
    { day: 'Wed', hours: 7.0, max: 8 },
    { day: 'Thu', hours: 1.0, max: 8 },
    { day: 'Fri', hours: 1.0, max: 8 },
    { day: 'Sat', hours: 0.5, max: 8 },
    { day: 'Sun', hours: 1.2, max: 8 },
  ];

  const totalWeeklyHours = activityData.reduce((acc, d) => acc + d.hours, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Hidden file input for avatar upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleAvatarFile}
        className="hidden"
      />

      {/* ============================================================== */}
      {/* 1. HERO LANDSCAPE BANNER */}
      {/* ============================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-sm min-h-[175px] sm:min-h-[195px] flex items-center p-6 bg-gradient-to-r from-[#e8f3ed] via-[#dceee4] to-[#cde5d8] dark:from-[#062314] dark:via-[#092e1b] dark:to-[#0c3520]">
        {/* Mountain Landscape Background Illustration (Exact Vector Match) */}
        <svg
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 1200 240"
        >
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8f3ed" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#dceee4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#cde5d8" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="mtnBack" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b4dac7" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#87c2a4" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="mtnMid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3d8f68" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#226746" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="mtnFront" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1b5a3c" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0d3b24" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Sky Layer */}
          <rect width="1200" height="240" fill="url(#skyGrad)" className="dark:opacity-20" />

          {/* Glowing Sun/Moon */}
          <circle
            cx="975"
            cy="70"
            r="26"
            fill="#ffffff"
            opacity="0.85"
            filter="drop-shadow(0 0 16px rgba(255,255,255,0.9))"
          />

          {/* Back Mountain Ridge */}
          <path
            d="M 680 240 L 880 90 L 980 160 L 1080 110 L 1220 240 Z"
            fill="url(#mtnBack)"
            opacity="0.7"
          />

          {/* Mid Mountain Ridge with snowy facets */}
          <path
            d="M 740 240 L 950 75 L 1020 135 L 1150 65 L 1230 240 Z"
            fill="url(#mtnMid)"
            opacity="0.8"
          />
          <polygon points="950,75 930,105 955,100 970,118 950,75" fill="#ffffff" opacity="0.6" />
          <polygon points="1150,65 1130,100 1160,95 1175,110 1150,65" fill="#ffffff" opacity="0.6" />

          {/* Foreground Mountain Ridges */}
          <path
            d="M 620 240 Q 770 195 910 215 T 1200 195 L 1200 240 Z"
            fill="url(#mtnFront)"
            opacity="0.5"
          />

          {/* Pine Trees Silhouettes on Lower Right */}
          <g fill="#0d3b24" opacity="0.85">
            <polygon points="850,240 855,210 860,240" />
            <polygon points="858,240 863,205 868,240" />
            <polygon points="865,240 870,215 875,240" />
            <polygon points="890,240 896,198 902,240" />
            <polygon points="899,240 905,190 911,240" />
            <polygon points="908,240 914,202 920,240" />
            <polygon points="950,240 956,185 962,240" />
            <polygon points="959,240 966,175 973,240" />
            <polygon points="970,240 977,180 984,240" />
            <polygon points="1010,240 1017,170 1024,240" />
            <polygon points="1021,240 1028,160 1035,240" />
            <polygon points="1032,240 1039,165 1046,240" />
            <polygon points="1080,240 1088,155 1096,240" />
            <polygon points="1093,240 1101,148 1109,240" />
            <polygon points="1106,240 1114,158 1122,240" />
            <polygon points="1140,240 1148,150 1156,240" />
            <polygon points="1153,240 1162,140 1171,240" />
            <polygon points="1168,240 1177,152 1186,240" />
            <polygon points="1185,240 1193,145 1201,240" />
          </g>
        </svg>

        {/* Ambient Dark Overlay in dark mode */}
        <div className="absolute inset-0 bg-black/10 dark:bg-black/40 pointer-events-none" />

        {/* Banner Content Layout */}
        <div className="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Avatar + Details */}
          <div className="flex items-center space-x-5">
            {/* Avatar Circle */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[#002313] via-[#165034] to-[#1b6b44] text-white flex items-center justify-center font-bold text-3xl sm:text-4xl shadow-xl border-4 border-white dark:border-background overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span>{displayInitial}</span>
                )}
              </div>

              {/* Camera Upload Badge */}
              <button
                type="button"
                onClick={triggerAvatarUpload}
                title="Change Profile Photo"
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-card border-2 border-border shadow-md flex items-center justify-center text-foreground hover:bg-muted hover:scale-105 transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* User Info & Badges */}
            <div className="space-y-1.5 min-w-0">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
                {name || user?.name || 'abhi'}
              </h2>

              <div className="flex items-center text-xs sm:text-sm text-muted-foreground font-medium truncate">
                <Mail className="w-3.5 h-3.5 mr-1.5 opacity-70 shrink-0" />
                <span className="truncate">{user?.email || 'abhitest1290@gmail.com'}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {/* Primary Filled Study Mode Badge */}
                <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 text-xs px-2.5 py-0.5 rounded-lg font-semibold shadow-xs">
                  {userType === 'college' ? 'College Student' : 'Exam Preparation'}
                </Badge>

                {/* Grey / Outline College Badge */}
                <Badge
                  variant="secondary"
                  className="bg-white/80 dark:bg-card/80 text-foreground border border-border/60 text-xs px-2.5 py-0.5 rounded-lg shadow-xs"
                >
                  {college || 'IIT'}
                </Badge>

                {/* Grey / Outline Exam Type Badge */}
                <Badge
                  variant="secondary"
                  className="bg-white/80 dark:bg-card/80 text-foreground border border-border/60 text-xs px-2.5 py-0.5 rounded-lg shadow-xs"
                >
                  {examType || 'JEE'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Center: Italic Motivational Quote (matching screenshot) */}
          <div className="hidden lg:flex flex-1 justify-center px-4">
            <blockquote className="font-serif italic text-slate-700 dark:text-slate-200 text-sm max-w-xs text-center drop-shadow-xs">
              {preferences.quote || DEFAULT_PREFERENCES.quote}
            </blockquote>
          </div>

          {/* Right: Edit Profile Button */}
          <div className="shrink-0 self-end md:self-start">
            <Button
              variant="outline"
              onClick={handleOpenEdit}
              className="bg-white/90 dark:bg-card/90 backdrop-blur-md border-border/80 shadow-xs text-xs font-semibold hover:bg-white dark:hover:bg-card text-foreground gap-1.5 h-9 px-4 rounded-xl hover:scale-105 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. STATS CARDS ROW (4 CARDS) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Day Streak */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 fill-rose-500 text-rose-500" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {user?.study_streak || 0}
            </div>
            <div className="text-xs font-bold text-foreground">Day Streak</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Keep going! Start your journey today.</div>
          </div>
        </Card>

        {/* Card 2: Total Study Hours */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {Math.round(user?.total_study_hours || 0)}h
            </div>
            <div className="text-xs font-bold text-foreground">Total Study Hours</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Track your learning progress.</div>
          </div>
        </Card>

        {/* Card 3: Current Level */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-secondary text-primary flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {user?.current_level || 1}
            </div>
            <div className="text-xs font-bold text-foreground">Current Level</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Keep learning to level up!</div>
          </div>
        </Card>

        {/* Card 4: XP Points */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center space-x-3.5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shrink-0">
            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {user?.experience_points || 0}
            </div>
            <div className="text-xs font-bold text-foreground">XP Points</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Earn XP by completing tasks.</div>
          </div>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* 3. LOWER TWO COLUMNS: STUDY ACTIVITY & STUDY PREFERENCES */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: Study Activity Card */}
        <Card className="p-6 rounded-2xl border border-border/80 bg-card shadow-xs space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Study Activity</h3>
                <p className="text-xs text-muted-foreground">Your study hours over the last 7 days</p>
              </div>
            </div>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-border/80 font-medium">
              <span>Last 7 days</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
          </div>

          {/* Bar Chart Visualization */}
          <div className="space-y-2 pt-2">
            <div className="relative h-44 flex items-end justify-between pl-8 pr-2">
              {/* Horizontal Grid lines and Y-axis labels */}
              {[8, 6, 4, 2, 0].map((val) => (
                <div
                  key={val}
                  className="absolute left-0 right-0 flex items-center pointer-events-none"
                  style={{ bottom: `${(val / 8) * 100}%` }}
                >
                  <span className="text-[11px] text-muted-foreground w-6 text-right pr-2">
                    {val}h
                  </span>
                  <div className="w-full border-b border-border/40" />
                </div>
              ))}

              {/* 7 Daily Bars */}
              {activityData.map((item) => {
                const heightPct = Math.min(100, Math.max(6, (item.hours / item.max) * 100));
                return (
                  <div key={item.day} className="flex-1 flex flex-col items-center justify-end h-full z-10 px-1.5 sm:px-2">
                    <div
                      className="w-full max-w-[34px] rounded-t-md bg-[#c7d2fe] hover:bg-[#818cf8] dark:bg-indigo-500/40 dark:hover:bg-indigo-500 transition-all cursor-pointer group relative"
                      style={{ height: `${heightPct}%` }}
                    >
                      {/* Tooltip on Hover */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] py-0.5 px-1.5 rounded shadow-md border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {item.hours}h
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis Day Labels */}
            <div className="flex justify-between pl-8 pr-2 text-xs text-muted-foreground font-medium pt-1">
              {activityData.map((item) => (
                <div key={item.day} className="flex-1 text-center">
                  {item.day}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Summary Strip (matching screenshot) */}
          <div className="grid grid-cols-3 p-3 bg-muted/40 dark:bg-muted/20 border border-border/50 rounded-xl text-center divide-x divide-border/60">
            <div className="space-y-0.5 px-2">
              <div className="text-sm font-bold text-foreground flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{Math.round(user?.total_study_hours || 0)}h</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Total This Week</div>
            </div>

            <div className="space-y-0.5 px-2">
              <div className="text-sm font-bold text-foreground flex items-center justify-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>{user?.study_streak || 0} days</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Active Days</div>
            </div>

            <div className="space-y-0.5 px-2">
              <div className="text-sm font-bold text-foreground flex items-center justify-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span>0h</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Daily Average</div>
            </div>
          </div>
        </Card>

        {/* RIGHT COLUMN: Study Preferences Card */}
        <Card className="p-6 rounded-2xl border border-border/80 bg-card shadow-xs space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-secondary text-primary flex items-center justify-center shrink-0 mt-0.5">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Study Preferences</h3>
                <p className="text-xs text-muted-foreground">Your learning preferences and academic information</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEdit}
              className="h-8 text-xs gap-1 border-border/80 font-medium"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>
          </div>

          {/* Preferences Key-Value Rows (Exact match with screenshot) */}
          <div className="space-y-3.5 pt-1">
            {/* 1. Study Mode */}
            <div className="flex items-center justify-between py-2 border-b border-border/40">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-secondary text-primary flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground">Study Mode</span>
              </div>
              <span className="text-xs font-semibold text-foreground px-3 py-1 bg-muted/60 dark:bg-muted/40 rounded-lg">
                {userType === 'college' ? 'College Student' : 'Exam Preparation'}
              </span>
            </div>

            {/* 2. College */}
            <div className="flex items-center justify-between py-2 border-b border-border/40">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground">College</span>
              </div>
              <span className="text-xs font-semibold text-foreground px-3 py-1 bg-muted/60 dark:bg-muted/40 rounded-lg">
                {college || 'IIT'}
              </span>
            </div>

            {/* 3. Exam Type */}
            <div className="flex items-center justify-between py-2 border-b border-border/40">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground">Exam Type</span>
              </div>
              <span className="text-xs font-semibold text-foreground px-3 py-1 bg-muted/60 dark:bg-muted/40 rounded-lg">
                {examType || 'JEE'}
              </span>
            </div>

            {/* 4. Preferred Subjects */}
            <div className="flex items-center justify-between py-2 border-b border-border/40">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground">Preferred Subjects</span>
              </div>
              <span className="text-xs font-semibold text-foreground px-3 py-1 bg-muted/60 dark:bg-muted/40 rounded-lg max-w-[200px] truncate text-right">
                {preferences.preferredSubjects || 'CS, DSA, OS, CN'}
              </span>
            </div>

            {/* 5. Study Goal */}
            <div className="flex items-center justify-between py-2 border-b border-border/40">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground">Study Goal</span>
              </div>
              <span className="text-xs font-semibold text-foreground px-3 py-1 bg-muted/60 dark:bg-muted/40 rounded-lg max-w-[220px] truncate text-right">
                {preferences.studyGoal || 'Get into top tech company'}
              </span>
            </div>

            {/* 6. Daily Study Target */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground">Daily Study Target</span>
              </div>
              <span className="text-xs font-semibold text-foreground px-3 py-1 bg-muted/60 dark:bg-muted/40 rounded-lg">
                {preferences.dailyTarget || '4 hours'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ============================================================== */}
      {/* 4. EDIT PROFILE & PREFERENCES MODAL */}
      {/* ============================================================== */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Edit3 className="w-5 h-5 text-primary" />
              Edit Profile & Study Preferences
            </DialogTitle>
            <DialogDescription>
              Update your account information, academic affiliations, and personal study goals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="prof-name" className="text-xs font-semibold">Full Name</Label>
              <Input
                id="prof-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            {/* Study Mode */}
            <div className="space-y-1.5">
              <Label htmlFor="prof-mode" className="text-xs font-semibold">Study Mode</Label>
              <select
                id="prof-mode"
                value={userType}
                onChange={(e) => setUserType(e.target.value as 'college' | 'exam')}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="college">College Student</option>
                <option value="exam">Exam Preparation</option>
              </select>
            </div>

            {/* College & Exam Type Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prof-college" className="text-xs font-semibold">College / University</Label>
                <Input
                  id="prof-college"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g. IIT, BBA, B.Tech"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prof-exam" className="text-xs font-semibold">Exam Type</Label>
                <Input
                  id="prof-exam"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  placeholder="e.g. JEE, GATE, Semester"
                />
              </div>
            </div>

            {/* Preferred Subjects */}
            <div className="space-y-1.5">
              <Label htmlFor="prof-sub" className="text-xs font-semibold">Preferred Subjects</Label>
              <Input
                id="prof-sub"
                value={preferredSubjects}
                onChange={(e) => setPreferredSubjects(e.target.value)}
                placeholder="e.g. CS, DSA, OS, CN"
              />
            </div>

            {/* Study Goal */}
            <div className="space-y-1.5">
              <Label htmlFor="prof-goal" className="text-xs font-semibold">Study Goal</Label>
              <Input
                id="prof-goal"
                value={studyGoal}
                onChange={(e) => setStudyGoal(e.target.value)}
                placeholder="e.g. Get into top tech company"
              />
            </div>

            {/* Daily Target */}
            <div className="space-y-1.5">
              <Label htmlFor="prof-target" className="text-xs font-semibold">Daily Study Target</Label>
              <Input
                id="prof-target"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(e.target.value)}
                placeholder="e.g. 4 hours"
              />
            </div>

            {/* Motivational Quote */}
            <div className="space-y-1.5">
              <Label htmlFor="prof-quote" className="text-xs font-semibold">Motivational Quote</Label>
              <Input
                id="prof-quote"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="“A little progress each day adds up to big results.”"
              />
            </div>

            {/* Avatar URL / Upload */}
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <Label className="text-xs font-semibold">Profile Photo</Label>
              <div className="flex gap-2">
                <Input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Paste image URL or click Upload"
                  className="text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={triggerAvatarUpload}
                  className="text-xs gap-1 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="premium" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
