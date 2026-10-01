
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  GraduationCap, 
  Target, 
  BookOpen, 
  Clock, 
  Star,
  Calendar,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Camera,
  Upload
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface OnboardingData {
  name: string;
  age: string;
  avatarUrl?: string;
  learningMode: 'college' | 'exam' | '';
  subjects: string[];
  examType?: string;
  targetYear?: string;
  semester?: string;
  course?: string;
  college?: string;
  studyPreference: string[];
  motivation: string[];
  dailyHours: string;
  reviewModes: string[];
  email: string;
  studyReminder?: string;
}

const STEPS = [
  'Welcome & Identity',
  'Profile Photo',
  'Learning Mode & Context',
  'Academic Details',
  'Study Preferences',
  'Review & Schedule',
  'Complete Profile'
];

export const OnboardingFlow = () => {
  const { updateUserType, user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: '',
    age: '',
    learningMode: '',
    subjects: [],
    studyPreference: [],
    motivation: [],
    dailyHours: '',
    reviewModes: [],
    email: user?.email || ''
  });

  const subjects = [
    'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science', 
    'English', 'Current Affairs', 'History', 'Geography', 'Economics',
    'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering'
  ];

  const examTypes = [
    'NEET (Medical)', 'JEE (Engineering)', 'UPSC (Civil Services)', 
    'GATE (Graduate Aptitude)', 'CUET (Common University)', 'Bank/SSC', 
    'CAT (MBA)', 'CLAT (Law)', 'Other'
  ];

  const courses = [
    'BTech (Computer Science)', 'BTech (Mechanical)', 'BTech (Electrical)', 
    'BTech (Civil)', 'BSc (Biology)', 'BSc (Physics)', 'BSc (Chemistry)',
    'BA (Economics)', 'BA (English)', 'BBA', 'BCom', 'Other'
  ];

  const studyPreferences = [
    'Solo Study Sessions', 'Group Learning', 'Guided/Structured Plans', 
    'Revision-Heavy Approach', 'Practice-Based Learning', 'Visual Learning'
  ];

  const motivations = [
    'Achievements & Gamification', 'Progress Tracking', 'AI Assistant Support', 
    'Smart Planning Tools', 'Peer Competition', 'Regular Reminders'
  ];

  const reviewModes = [
    'Flashcards', 'Mind Maps', 'Practice Quizzes', 'Summary Notes', 
    'Mock Tests', 'Video Tutorials'
  ];

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubjectToggle = (subject: string) => {
    setData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  const handleArrayToggle = (field: keyof OnboardingData, value: string) => {
    setData(prev => ({
      ...prev,
      [field]: Array.isArray(prev[field])
        ? (prev[field] as string[]).includes(value)
          ? (prev[field] as string[]).filter(item => item !== value)
          : [...(prev[field] as string[]), value]
        : [value]
    }));
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setData(prev => ({ ...prev, avatarUrl: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const userType = data.learningMode;
      
      // Validate required fields
      if (!userType || !data.name) {
        throw new Error('Missing required information');
      }

      const details: any = {
        name: data.name.trim(),
        age: data.age,
        avatarUrl: data.avatarUrl,
        subjects: data.subjects,
        studyPreference: data.studyPreference,
        motivation: data.motivation,
        dailyHours: data.dailyHours,
        reviewModes: data.reviewModes,
        email: data.email,
        studyReminder: data.studyReminder
      };

      if (userType === 'exam') {
        details.examType = data.examType;
        details.targetYear = data.targetYear;
      } else {
        details.college = data.college;
        details.course = data.course;
        details.semester = parseInt(data.semester || '1');
      }

      console.log('OnboardingFlow: Completing onboarding with details:', details);
      
      await updateUserType(userType as 'exam' | 'college', details);
      
      toast({
        title: "Welcome to StudyMate AI! 🎉",
        description: "Your personalized learning journey begins now!",
      });
    } catch (error) {
      console.error('Onboarding completion error:', error);
      toast({
        title: "Setup Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return data.name && data.age;
      case 1: return true; // Avatar is optional
      case 2: return data.learningMode && data.subjects.length > 0;
      case 3: 
        if (data.learningMode === 'exam') {
          return data.examType && data.targetYear;
        } else {
          return data.semester && data.course;
        }
      case 4: return data.studyPreference.length > 0 && data.motivation.length > 0;
      case 5: return data.dailyHours && data.reviewModes.length > 0;
      case 6: return data.email;
      default: return true;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <User className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">Welcome to StudyMate AI!</h2>
              <p className="text-lg text-muted-foreground">Let's get to know you better to personalize your experience</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-base font-medium">What's your full name? *</Label>
                <Input
                  id="name"
                  value={data.name}
                  onChange={(e) => setData({...data, name: e.target.value})}
                  placeholder="Enter your full name"
                  className="mt-2 h-12 text-base"
                />
              </div>
              <div>
                <Label className="text-base font-medium">How old are you? *</Label>
                <Select value={data.age} onValueChange={(value) => setData({...data, age: value})}>
                  <SelectTrigger className="mt-2 h-12">
                    <SelectValue placeholder="Select your age range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="13-16">13-16 years</SelectItem>
                    <SelectItem value="17-20">17-20 years</SelectItem>
                    <SelectItem value="21-25">21-25 years</SelectItem>
                    <SelectItem value="26-30">26-30 years</SelectItem>
                    <SelectItem value="30+">30+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">Add Your Profile Photo</h2>
              <p className="text-lg text-muted-foreground">Make your profile more personal (optional)</p>
            </div>

            <div className="flex flex-col items-center space-y-6">
              <Avatar className="w-32 h-32 border-4 border-gray-200 shadow-lg">
                {data.avatarUrl ? (
                  <AvatarImage src={data.avatarUrl} alt="Profile" />
                ) : (
                  <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {data.name ? getInitials(data.name) : 'U'}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="text-center">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Photo
                </label>
                <p className="text-sm text-muted-foreground mt-2">JPG, PNG or GIF (max 5MB)</p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-3">What describes your learning journey?</h2>
              <p className="text-lg text-muted-foreground">This helps us customize your dashboard and features</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card 
                className={`p-8 cursor-pointer transition-all duration-300 hover:shadow-xl ${
                  data.learningMode === 'college' 
                    ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200' 
                    : 'hover:border-blue-300 bg-white hover:shadow-lg'
                }`}
                onClick={() => setData({...data, learningMode: 'college'})}
              >
                <div className="text-center">
                  <GraduationCap className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-3">College Student</h3>
                  <p className="text-muted-foreground leading-relaxed">Building skills, managing coursework, working on projects, and preparing for your career</p>
                </div>
              </Card>

              <Card 
                className={`p-8 cursor-pointer transition-all duration-300 hover:shadow-xl ${
                  data.learningMode === 'exam' 
                    ? 'border-green-500 bg-green-50 shadow-lg ring-2 ring-green-200' 
                    : 'hover:border-green-300 bg-white hover:shadow-lg'
                }`}
                onClick={() => setData({...data, learningMode: 'exam'})}
              >
                <div className="text-center">
                  <Target className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-3">Exam Preparation</h3>
                  <p className="text-muted-foreground leading-relaxed">Focused preparation for competitive exams like JEE, NEET, UPSC, GATE, and more</p>
                </div>
              </Card>
            </div>

            <div>
              <Label className="text-lg font-medium mb-4 block">Which subjects are you most focused on? *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {subjects.map((subject) => (
                  <Badge
                    key={subject}
                    variant={data.subjects.includes(subject) ? "default" : "outline"}
                    className={`cursor-pointer p-3 text-center justify-center transition-all duration-200 hover:scale-105 ${
                      data.subjects.includes(subject) 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                        : 'hover:bg-blue-50 hover:border-blue-300'
                    }`}
                    onClick={() => handleSubjectToggle(subject)}
                  >
                    {subject}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Select at least one subject</p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-3">Tell us about your academic details</h2>
              <p className="text-lg text-muted-foreground">This helps us create the perfect study plan for you</p>
            </div>

            {data.learningMode === 'exam' ? (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Which exam are you preparing for? *</Label>
                  <Select value={data.examType} onValueChange={(value) => setData({...data, examType: value})}>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue placeholder="Select your target exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {examTypes.map((exam) => (
                        <SelectItem key={exam} value={exam}>{exam}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base font-medium">What is your target year? *</Label>
                  <Select value={data.targetYear} onValueChange={(value) => setData({...data, targetYear: value})}>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue placeholder="Select target year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                      <SelectItem value="2028">2028</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Which semester are you currently in? *</Label>
                  <Select value={data.semester} onValueChange={(value) => setData({...data, semester: value})}>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6,7,8].map((sem) => (
                        <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base font-medium">What is your course/branch? *</Label>
                  <Select value={data.course} onValueChange={(value) => setData({...data, course: value})}>
                    <SelectTrigger className="mt-2 h-12">
                      <SelectValue placeholder="Select your course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course} value={course}>{course}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-base font-medium">Which college are you from? (Optional)</Label>
                  <Input
                    value={data.college || ''}
                    onChange={(e) => setData({...data, college: e.target.value})}
                    placeholder="e.g., IIT Delhi, MIT, Stanford University"
                    className="mt-2 h-12"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-3">How do you prefer to study?</h2>
              <p className="text-lg text-muted-foreground">Let's customize your learning experience</p>
            </div>

            <div className="space-y-8">
              <div>
                <Label className="text-lg font-medium mb-4 block">Study Preferences (select all that apply) *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {studyPreferences.map((pref) => (
                    <Badge
                      key={pref}
                      variant={data.studyPreference.includes(pref) ? "default" : "outline"}
                      className={`cursor-pointer p-4 text-center justify-center transition-all duration-200 hover:scale-105 ${
                        data.studyPreference.includes(pref) 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md' 
                          : 'hover:bg-purple-50 hover:border-purple-300'
                      }`}
                      onClick={() => handleArrayToggle('studyPreference', pref)}
                    >
                      {pref}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-lg font-medium mb-4 block">What motivates you to study? *</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {motivations.map((motivation) => (
                    <Badge
                      key={motivation}
                      variant={data.motivation.includes(motivation) ? "default" : "outline"}
                      className={`cursor-pointer p-4 text-center justify-center transition-all duration-200 hover:scale-105 ${
                        data.motivation.includes(motivation) 
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' 
                          : 'hover:bg-green-50 hover:border-green-300'
                      }`}
                      onClick={() => handleArrayToggle('motivation', motivation)}
                    >
                      {motivation}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-3">Plan your study schedule</h2>
              <p className="text-lg text-muted-foreground">Help us create the perfect study routine for you</p>
            </div>

            <div className="space-y-8">
              <div>
                <Label className="text-base font-medium">How many hours do you plan to study daily? *</Label>
                <Select value={data.dailyHours} onValueChange={(value) => setData({...data, dailyHours: value})}>
                  <SelectTrigger className="mt-2 h-12">
                    <SelectValue placeholder="Select daily study hours" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="<1">Less than 1 hour</SelectItem>
                    <SelectItem value="1-2">1-2 hours</SelectItem>
                    <SelectItem value="3-4">3-4 hours</SelectItem>
                    <SelectItem value="5-6">5-6 hours</SelectItem>
                    <SelectItem value="7+">7+ hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-lg font-medium mb-4 block">Preferred review methods (select all that apply) *</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {reviewModes.map((mode) => (
                    <Badge
                      key={mode}
                      variant={data.reviewModes.includes(mode) ? "default" : "outline"}
                      className={`cursor-pointer p-4 text-center justify-center transition-all duration-200 hover:scale-105 ${
                        data.reviewModes.includes(mode) 
                          ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md' 
                          : 'hover:bg-orange-50 hover:border-orange-300'
                      }`}
                      onClick={() => handleArrayToggle('reviewModes', mode)}
                    >
                      {mode}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">Complete your profile</h2>
              <p className="text-lg text-muted-foreground">Just a few more details to get started</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label htmlFor="email" className="text-base font-medium">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={data.email}
                  onChange={(e) => setData({...data, email: e.target.value})}
                  placeholder="Enter your email address"
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label htmlFor="reminder" className="text-base font-medium">Daily Study Reminder (Optional)</Label>
                <Input
                  id="reminder"
                  type="time"
                  value={data.studyReminder || ''}
                  onChange={(e) => setData({...data, studyReminder: e.target.value})}
                  className="mt-2 h-12"
                />
                <p className="text-sm text-muted-foreground mt-2">We'll send you a gentle reminder to study</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-4 text-lg">Your Profile Summary:</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span><strong>Name:</strong> {data.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4" />
                  <span><strong>Mode:</strong> {data.learningMode === 'college' ? 'College Student' : 'Exam Preparation'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4" />
                  <span><strong>Subjects:</strong> {data.subjects.slice(0, 3).join(', ')}{data.subjects.length > 3 ? '...' : ''}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span><strong>Daily Study:</strong> {data.dailyHours} hours</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/30 via-background to-accent/20 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl animate-fade-in-up">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-sm text-muted-foreground font-medium">{STEPS[currentStep]}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 shadow-inner">
            <div 
              className="bg-brand-gradient h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Card */}
        <Card className="p-8 lg:p-12 glass-strong shadow-premium-lg rounded-2xl">
          {renderStep()}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-10">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center px-6 h-12 border-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {currentStep === STEPS.length - 1 ? (
              <Button
                onClick={handleComplete}
                disabled={!canProceed() || isLoading}
                variant="success"
                size="lg"
                className="flex items-center"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating your profile...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <Star className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                variant="premium"
                size="lg"
                className="flex items-center"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't worry! You can always change these preferences later in your settings
          </p>
        </div>
      </div>
    </div>
  );
};
