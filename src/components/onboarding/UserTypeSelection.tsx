
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Users, Target, Code, Trophy, Calendar, GraduationCap, FileText } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export const UserTypeSelection = () => {
  const { updateUserType } = useAuth();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<'exam' | 'college' | null>(null);
  const [examType, setExamType] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [examDate, setExamDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    if (!selectedType) {
      toast({
        title: "Please select a path",
        description: "Choose between College Student or Exam Prep Candidate.",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === 'exam' && !examType) {
      toast({
        title: "Please specify exam type",
        description: "Enter the exam you're preparing for (e.g., JEE, NEET, UPSC).",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === 'college' && !college) {
      toast({
        title: "Please enter your college",
        description: "Enter your college or university name.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const details: any = {};
      
      if (selectedType === 'exam') {
        details.examType = examType;
        if (examDate) details.examDate = examDate;
      } else {
        details.college = college;
        if (branch) details.branch = branch;
        if (semester) details.semester = parseInt(semester);
      }

      await updateUserType(selectedType, details);
      
      toast({
        title: "Profile Setup Complete! 🚀",
        description: "Your personalized dashboard is being built...",
      });
      
    } catch (error) {
      console.error('Error updating user type:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const examOptions = [
    'NEET (Medical Entrance)',
    'JEE (Joint Entrance Examination)', 
    'UPSC (Civil Services)',
    'GATE (Graduate Aptitude Test)',
    'CUET (Common University Entrance)',
    'Bank/SSC (Banking & Government)',
    'CAT (MBA Entrance)',
    'CLAT (Law Entrance)',
    'Other'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            What best describes your 
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> current goal?</span>
          </h2>
          <p className="text-xl text-gray-600">Choose your path to get a personalized learning experience</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* College Student Card */}
          <Card 
            className={`p-8 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 ${
              selectedType === 'college' ? 'border-purple-500 bg-purple-50 shadow-xl' : 'hover:border-purple-300 bg-white/80 backdrop-blur-sm'
            }`}
            onClick={() => setSelectedType('college')}
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <GraduationCap className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">College Student</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Building skills, managing coursework, working on projects, and preparing for your career journey.
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Skill Building</Badge>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Project Tracker</Badge>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">GitHub Integration</Badge>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">Career Planning</Badge>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex items-center text-sm text-gray-600">
                  <Code className="w-4 h-4 mr-3 text-purple-600" />
                  <span>Coding practice & skill development</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <FileText className="w-4 h-4 mr-3 text-purple-600" />
                  <span>Assignment & project management</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Trophy className="w-4 h-4 mr-3 text-purple-600" />
                  <span>Portfolio & resume building</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Exam Preparation Card */}
          <Card 
            className={`p-8 cursor-pointer hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 ${
              selectedType === 'exam' ? 'border-indigo-500 bg-indigo-50 shadow-xl' : 'hover:border-indigo-300 bg-white/80 backdrop-blur-sm'
            }`}
            onClick={() => setSelectedType('exam')}
          >
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Target className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Exam Preparation</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Focused preparation for competitive exams like JEE, NEET, UPSC, GATE, and other entrance tests.
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700">Study Plans</Badge>
                <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700">Mock Tests</Badge>
                <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700">Progress Analytics</Badge>
                <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700">Revision Tracker</Badge>
              </div>

              <div className="space-y-3 text-left">
                <div className="flex items-center text-sm text-gray-600">
                  <BookOpen className="w-4 h-4 mr-3 text-indigo-600" />
                  <span>Structured study roadmaps</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-3 text-indigo-600" />
                  <span>Time-bound preparation schedules</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Target className="w-4 h-4 mr-3 text-indigo-600" />
                  <span>Goal-oriented learning paths</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Details Form */}
        {selectedType && (
          <Card className="p-8 bg-white/90 backdrop-blur-sm shadow-xl border-0">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Tell us more about yourself
            </h3>
            
            {selectedType === 'exam' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="examType" className="text-base font-medium">Which exam are you preparing for? *</Label>
                    <Select value={examType} onValueChange={setExamType}>
                      <SelectTrigger className="mt-2 h-12">
                        <SelectValue placeholder="Select your exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {examOptions.map((exam) => (
                          <SelectItem key={exam} value={exam}>
                            {exam}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="examDate" className="text-base font-medium">Target Exam Date (Optional)</Label>
                    <Input
                      id="examDate"
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="mt-2 h-12"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedType === 'college' && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="college" className="text-base font-medium">College/University Name *</Label>
                    <Input
                      id="college"
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g., MIT, Stanford University"
                      className="mt-2 h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="branch" className="text-base font-medium">Branch/Major (Optional)</Label>
                    <Input
                      id="branch"
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g., Computer Science, Mechanical"
                      className="mt-2 h-12"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="semester" className="text-base font-medium">Current Year/Semester (Optional)</Label>
                    <Select value={semester} onValueChange={setSemester}>
                      <SelectTrigger className="mt-2 h-12">
                        <SelectValue placeholder="Select year/semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                          <SelectItem key={sem} value={sem.toString()}>
                            {sem <= 4 ? `Year ${Math.ceil(sem/2)}` : `Semester ${sem}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleNext}
              disabled={isLoading}
              className="w-full mt-8 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              {isLoading ? 'Setting up your dashboard...' : 'Complete Setup'}
              <Target className="w-5 h-5 ml-2" />
            </Button>
          </Card>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Don't worry! You can change your preferences later in settings
          </p>
        </div>
      </div>
    </div>
  );
};
