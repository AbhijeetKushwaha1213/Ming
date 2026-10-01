
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  Video, 
  ExternalLink, 
  FileText, 
  Target,
  Clock,
  CheckCircle,
  Play
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TopicDetailPageProps {
  subject: string;
  topic: string;
  onBack: () => void;
  onStartSession?: () => void;
}

export const TopicDetailPage = ({ 
  subject, 
  topic, 
  onBack, 
  onStartSession 
}: TopicDetailPageProps) => {
  const { toast } = useToast();

  // Mock data - in real app, this would come from your database
  const topicData = {
    progress: 65,
    timeEstimate: "2 hours",
    difficulty: "Medium",
    status: "In Progress",
    objectives: [
      "Understand electromagnetic induction principles",
      "Learn Faraday's laws",
      "Solve numerical problems on induced EMF",
      "Apply Lenz's law in various scenarios"
    ],
    resources: [
      { type: 'pdf', name: 'Electromagnetic Induction Notes.pdf', icon: FileText },
      { type: 'video', name: 'Faraday Laws Explained', icon: Video },
      { type: 'link', name: 'Khan Academy - Electromagnetic Induction', icon: ExternalLink },
      { type: 'pdf', name: 'Practice Problems Set.pdf', icon: FileText },
    ],
    practiceQuestions: [
      "A coil of 100 turns has an area of 0.1 m². Calculate the induced EMF when magnetic field changes from 0.2 T to 0.8 T in 2 seconds.",
      "Explain why the induced current flows in such a direction as to oppose the change causing it.",
      "A conducting rod moves in a magnetic field. Derive the expression for motional EMF."
    ],
    readingMaterial: [
      "Chapter 12: Electromagnetic Induction - NCERT Physics Class XII",
      "Griffiths Introduction to Electrodynamics - Chapter 7",
      "HC Verma Concepts of Physics - Chapter 38"
    ]
  };

  const handleResourceClick = (resource: any) => {
    toast({
      title: "Opening Resource",
      description: `Opening ${resource.name}`,
    });
  };

  const handleStartStudySession = () => {
    if (onStartSession) {
      onStartSession();
    } else {
      toast({
        title: "Study Session Started! 🚀",
        description: `Starting focused session on ${subject} - ${topic}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button variant="ghost" onClick={onBack} className="mb-2">
              ← Back to Study Plan
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">{subject}</h1>
            <h2 className="text-xl text-gray-600">{topic}</h2>
          </div>
          <div className="flex space-x-2">
            <Badge variant={topicData.status === 'Completed' ? 'default' : 'secondary'}>
              {topicData.status}
            </Badge>
            <Badge variant="outline">{topicData.difficulty}</Badge>
          </div>
        </div>

        {/* Progress Overview */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Progress</h3>
              <Progress value={topicData.progress} className="h-3 mb-2" />
              <p className="text-sm text-gray-600">{topicData.progress}% Complete</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Time Required</h3>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-600" />
                <span>{topicData.timeEstimate}</span>
              </div>
            </div>
            <div>
              <Button onClick={handleStartStudySession} className="w-full">
                <Play className="w-4 h-4 mr-2" />
                Start Study Session
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Learning Objectives */}
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Learning Objectives
            </h3>
            <div className="space-y-3">
              {topicData.objectives.map((objective, index) => (
                <div key={index} className="flex items-start">
                  <CheckCircle className="w-5 h-5 mr-3 mt-0.5 text-green-600" />
                  <span className="text-sm">{objective}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Study Resources */}
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              Study Resources
            </h3>
            <div className="space-y-3">
              {topicData.resources.map((resource, index) => (
                <div 
                  key={index}
                  className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleResourceClick(resource)}
                >
                  <resource.icon className="w-5 h-5 mr-3 text-gray-600" />
                  <span className="flex-1 text-sm font-medium">{resource.name}</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </Card>

          {/* Reading Material */}
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">📖 What to Read</h3>
            <div className="space-y-3">
              {topicData.readingMaterial.map((material, index) => (
                <div key={index} className="flex items-start">
                  <BookOpen className="w-4 h-4 mr-3 mt-1 text-blue-600" />
                  <span className="text-sm">{material}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Practice Questions */}
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">❓ Practice Questions</h3>
            <div className="space-y-4">
              {topicData.practiceQuestions.map((question, index) => (
                <div key={index} className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">Q{index + 1}.</p>
                  <p className="text-sm text-blue-800 mt-1">{question}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
