
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Lightbulb, 
  Code, 
  Smartphone, 
  Globe, 
  Database,
  Palette,
  Zap,
  Star,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProjectIdeasExplorerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectIdeasExplorer = ({ open, onOpenChange }: ProjectIdeasExplorerProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const projectIdeas = [
    {
      id: 1,
      title: 'Personal Finance Tracker',
      description: 'Build a web app to track expenses, set budgets, and visualize spending patterns.',
      category: 'web',
      difficulty: 'Intermediate',
      duration: '2-3 weeks',
      technologies: ['React', 'Node.js', 'MongoDB', 'Chart.js'],
      trending: true
    },
    {
      id: 2,
      title: 'Study Buddy Mobile App',
      description: 'Create a mobile app for students to form study groups and share resources.',
      category: 'mobile',
      difficulty: 'Advanced',
      duration: '4-6 weeks',
      technologies: ['React Native', 'Firebase', 'Socket.io'],
      trending: false
    },
    {
      id: 3,
      title: 'Weather Dashboard',
      description: 'Design a responsive weather dashboard with forecasts and location-based alerts.',
      category: 'web',
      difficulty: 'Beginner',
      duration: '1-2 weeks',
      technologies: ['HTML', 'CSS', 'JavaScript', 'Weather API'],
      trending: true
    },
    {
      id: 4,
      title: 'AI Chatbot for Customer Service',
      description: 'Develop an intelligent chatbot that can handle customer queries and complaints.',
      category: 'ai',
      difficulty: 'Advanced',
      duration: '3-4 weeks',
      technologies: ['Python', 'TensorFlow', 'Natural Language Processing'],
      trending: true
    },
    {
      id: 5,
      title: 'Recipe Sharing Platform',
      description: 'Build a social platform where users can share recipes, rate them, and save favorites.',
      category: 'web',
      difficulty: 'Intermediate',
      duration: '3-4 weeks',
      technologies: ['React', 'Express', 'PostgreSQL', 'Cloudinary'],
      trending: false
    },
    {
      id: 6,
      title: 'Task Management Chrome Extension',
      description: 'Create a browser extension for managing daily tasks and productivity tracking.',
      category: 'extension',
      difficulty: 'Intermediate',
      duration: '2-3 weeks',
      technologies: ['JavaScript', 'Chrome APIs', 'Local Storage'],
      trending: false
    }
  ];

  const categories = [
    { id: 'all', name: 'All Ideas', icon: Lightbulb },
    { id: 'web', name: 'Web Apps', icon: Globe },
    { id: 'mobile', name: 'Mobile Apps', icon: Smartphone },
    { id: 'ai', name: 'AI/ML', icon: Zap },
    { id: 'extension', name: 'Extensions', icon: Code },
  ];

  const filteredIdeas = projectIdeas.filter(idea => {
    const matchesSearch = idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         idea.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || idea.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddToMyProjects = (idea: any) => {
    toast({
      title: "Project Added! 🚀",
      description: `"${idea.title}" has been added to your project list.`,
    });
  };

  const handleGetStarted = (idea: any) => {
    toast({
      title: "Getting Started Guide 📚",
      description: `Opening detailed guide for "${idea.title}"`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Lightbulb className="w-6 h-6 mr-2 text-yellow-500" />
            Project Ideas Explorer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search project ideas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-5">
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="flex items-center">
                  <category.icon className="w-4 h-4 mr-1" />
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredIdeas.map((idea) => (
                  <Card key={idea.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold">{idea.title}</h3>
                      {idea.trending && (
                        <Badge className="bg-orange-100 text-orange-800">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Trending
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-4 text-sm">{idea.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {idea.technologies.map((tech) => (
                        <Badge key={tech} variant="secondary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 mr-1" />
                          <Badge className={getDifficultyColor(idea.difficulty)}>
                            {idea.difficulty}
                          </Badge>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {idea.duration}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        onClick={() => handleAddToMyProjects(idea)}
                        className="flex-1"
                        size="sm"
                      >
                        Add to My Projects
                      </Button>
                      <Button 
                        onClick={() => handleGetStarted(idea)}
                        variant="outline"
                        size="sm"
                      >
                        Get Started
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              
              {filteredIdeas.length === 0 && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No ideas found</h3>
                  <p className="text-gray-500">Try adjusting your search or category filter.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
