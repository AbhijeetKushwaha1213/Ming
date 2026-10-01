import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase, isLocalMode } from '@/integrations/supabase/client';
import { localStore } from '@/utils/localStore';
import { 
  Search, 
  Plus, 
  Code, 
  BookOpen, 
  Target, 
  ExternalLink,
  Github,
  Youtube,
  Twitter,
  Lightbulb,
  Loader2,
  Trash2
} from 'lucide-react';

interface DiscoverResourcesProps {
  onNavigate?: (tab: string) => void;
}

interface Skill {
  id: string;
  skill: string;
  progress: number;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
  technologies?: string[];
  github_url?: string;
  demo_url?: string;
}

export const DiscoverResources = ({ onNavigate }: DiscoverResourcesProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [skillInput, setSkillInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [resources, setResources] = useState<any[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (user?.user_id) {
      fetchSkills();
      fetchProjects();
    }
  }, [user?.user_id]);

  const fetchSkills = async () => {
    if (!user?.user_id) return;
    
    try {
      if (isLocalMode()) {
        setSkills(localStore.getSkills());
        return;
      }

      const { data, error } = await supabase
        .from('user_skills')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSkills(data || []);
    } catch (error) {
      console.error('Error fetching skills:', error);
    }
  };

  const fetchProjects = async () => {
    if (!user?.user_id) return;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleAddSkill = async () => {
    if (!skillInput.trim() || !user?.user_id) return;

    setIsLoadingSkills(true);
    try {
      if (isLocalMode()) {
        localStore.saveSkill({
          skill: skillInput.trim(),
          category: 'General',
          progress: 10
        });
        toast({
          title: "Skill Added",
          description: `Added "${skillInput}" to your skills.`,
        });
        setSkillInput('');
        fetchSkills();
        return;
      }

      const { error } = await supabase
        .from('user_skills')
        .insert({
          user_id: user.user_id,
          skill: skillInput.trim(),
          progress: 10
        });

      if (error) throw error;

      toast({
        title: "Skill Added",
        description: `Added "${skillInput}" to your skills.`,
      });
      setSkillInput('');
      fetchSkills();
    } catch (error: any) {
      console.error('Error adding skill:', error);
      toast({
        title: "Error",
        description: error.message?.includes('duplicate') ? "This skill already exists in your list." : "Failed to add skill. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    try {
      if (isLocalMode()) {
        localStore.deleteSkill(skillId);
        toast({
          title: "Skill Removed",
          description: "Skill has been removed from your list.",
        });
        fetchSkills();
        return;
      }

      const { error } = await supabase
        .from('user_skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;

      toast({
        title: "Skill Removed",
        description: "Skill has been removed from your list.",
      });
      fetchSkills();
    } catch (error) {
      console.error('Error removing skill:', error);
      toast({
        title: "Error",
        description: "Failed to remove skill. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAddProject = async () => {
    if (!projectInput.trim() || !user?.user_id) return;

    setIsLoadingProjects(true);
    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          user_id: user.user_id,
          title: projectInput.trim(),
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: "Project Added",
        description: `Added "${projectInput}" to your active projects.`,
      });
      setProjectInput('');
      fetchProjects();
    } catch (error) {
      console.error('Error adding project:', error);
      toast({
        title: "Error",
        description: "Failed to add project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Project Removed",
        description: "Project has been removed from your list.",
      });
      fetchProjects();
    } catch (error) {
      console.error('Error removing project:', error);
      toast({
        title: "Error",
        description: "Failed to remove project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExploreIdeas = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: `Generate 5 project ideas for a ${user?.userType} student interested in programming and ${user?.examType || 'general studies'}. Include difficulty level and key technologies.`,
          context: [],
          userType: user?.userType || 'exam',
          subject: 'Project Ideas'
        }
      });

      if (error) throw error;

      const ideas = [
        {
          title: "Portfolio Website",
          description: "Build a personal portfolio using React and Tailwind CSS",
          difficulty: "Beginner",
          technologies: ["React", "Tailwind CSS"],
          type: "Web Development"
        },
        {
          title: "Study Tracker App",
          description: "Create a mobile-responsive study tracking application",
          difficulty: "Intermediate",
          technologies: ["React", "Supabase"],
          type: "Full Stack"
        },
        {
          title: "Algorithm Visualizer",
          description: "Interactive tool to visualize sorting and searching algorithms",
          difficulty: "Advanced",
          technologies: ["JavaScript", "Canvas API"],
          type: "Educational"
        },
        {
          title: "Flashcard Learning System",
          description: "Spaced repetition system for efficient learning",
          difficulty: "Intermediate",
          technologies: ["React", "TypeScript", "PostgreSQL"],
          type: "Educational"
        },
        {
          title: "Task Management Dashboard",
          description: "Collaborative project management tool with real-time updates",
          difficulty: "Advanced",
          technologies: ["React", "Node.js", "WebSocket"],
          type: "Productivity"
        }
      ];

      setResources(ideas);
      toast({
        title: "Ideas Generated",
        description: "Found some great project ideas for you!",
      });
    } catch (error) {
      console.error('Error generating ideas:', error);
      toast({
        title: "Error",
        description: "Failed to generate ideas. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Discover Resources</h1>
        <p className="text-muted-foreground">Find projects, learn new skills, and explore ideas</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Target className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold">Manage Skills</h2>
        </div>
        <div className="flex space-x-2 mb-4">
          <Input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            placeholder="e.g., React, Python, Data Science..."
            onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
          />
          <Button onClick={handleAddSkill} disabled={!skillInput.trim() || isLoadingSkills}>
            {isLoadingSkills ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Skill
          </Button>
        </div>
        
        {skills.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Your Skills:</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center gap-1">
                  <Badge variant="secondary">
                    {skill.skill} ({skill.progress}%)
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Code className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold">Manage Active Projects</h2>
        </div>
        <div className="flex space-x-2 mb-4">
          <Input
            value={projectInput}
            onChange={(e) => setProjectInput(e.target.value)}
            placeholder="e.g., Personal Website, Mobile App..."
            onKeyPress={(e) => e.key === 'Enter' && handleAddProject()}
          />
          <Button onClick={handleAddProject} disabled={!projectInput.trim() || isLoadingProjects}>
            {isLoadingProjects ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Add Project
          </Button>
        </div>

        {projects.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Your Projects:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((project) => (
                <Card key={project.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{project.title}</h4>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-1">{project.description}</p>
                      )}
                      <Badge variant="outline" className="mt-2 text-xs">
                        {project.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteProject(project.id)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Explore Project Ideas</h2>
          </div>
          <Button onClick={handleExploreIdeas} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Get Ideas
              </>
            )}
          </Button>
        </div>
        
        {resources.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {resources.map((resource, index) => (
              <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-foreground mb-2">{resource.title}</h3>
                <p className="text-muted-foreground text-sm mb-3">{resource.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline">{resource.difficulty}</Badge>
                  <Badge variant="secondary">{resource.type}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {resource.technologies.map((tech: string, techIndex: number) => (
                    <Badge key={techIndex} className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <Youtube className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <h3 className="font-semibold mb-1">YouTube Playlists</h3>
          <p className="text-sm text-muted-foreground">Curated learning content</p>
          <ExternalLink className="w-4 h-4 mt-2 mx-auto text-muted-foreground" />
        </Card>

        <Card className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <Github className="w-8 h-8 text-foreground mx-auto mb-2" />
          <h3 className="font-semibold mb-1">GitHub Repos</h3>
          <p className="text-sm text-muted-foreground">Trending projects</p>
          <ExternalLink className="w-4 h-4 mt-2 mx-auto text-muted-foreground" />
        </Card>

        <Card className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
          <Twitter className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <h3 className="font-semibold mb-1">Tech Twitter</h3>
          <p className="text-sm text-muted-foreground">Follow industry experts</p>
          <ExternalLink className="w-4 h-4 mt-2 mx-auto text-muted-foreground" />
        </Card>
      </div>
    </div>
  );
};
