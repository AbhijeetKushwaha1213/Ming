import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, Sparkles, GitFork, BookOpen } from 'lucide-react';
import { useSkills, SyllabusTopic } from '@/hooks/useSkills';
import { supabase } from '@/integrations/supabase/client';
import { geminiClient } from '@/utils/geminiClient';
import { useSavedDAGs } from '@/hooks/useSavedDAGs';
import { generateDAG } from '@/api/dagAPI';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface AddSkillDialogProps {
  trigger?: React.ReactNode;
}

const getFallbackSyllabus = (skillName: string): string[] => {
  const normalized = skillName.toLowerCase();
  if (normalized.includes('react')) {
    return [
      'Introduction to JSX and Components',
      'Props and Component Customization',
      'State Management with useState',
      'Component Lifecycle & useEffect',
      'Event Handling & Form Inputs',
      'Conditional Rendering & Lists',
      'Lifting State & Context API',
      'Custom React Hooks',
      'Routing with React Router',
      'Performance Optimization',
      'Testing React Components',
      'Building a Complete Project'
    ];
  } else if (normalized.includes('python')) {
    return [
      'Variables & Core Data Types',
      'Control Flow & Loops',
      'Functions & Scope',
      'Lists, Tuples, and Dictionaries',
      'File Input and Output Operations',
      'Error Handling & Exceptions',
      'Object-Oriented Programming (OOP)',
      'Working with Modules & Packages',
      'Introduction to Regular Expressions',
      'Data Analysis Basics (Pandas)',
      'Web Scraping Basics',
      'Building a Command-Line App'
    ];
  } else if (normalized.includes('javascript') || normalized.includes('js')) {
    return [
      'JS Syntax and Variables',
      'Functions & Arrow Syntax',
      'Arrays & Array Methods',
      'Objects & Destructuring',
      'DOM Manipulation & Events',
      'Asynchronous JS & Promises',
      'Fetch API & Network Requests',
      'ES6+ Modern Features',
      'Error Handling & Debugging',
      'Local Storage & Web APIs',
      'OOP & Prototype Chain',
      'Modular JavaScript'
    ];
  }
  
  // Generic Fallback
  return [
    `Foundations of ${skillName}`,
    `Core concepts and terms in ${skillName}`,
    `Setting up the dev environment`,
    `Basic syntax and rules`,
    `Common patterns and practices`,
    `Handling errors and debugging`,
    `Intermediate techniques`,
    `Optimizing performance`,
    `Advanced tools and packages`,
    `Best practices & security`,
    `Architecting an application`,
    `Final project implementation`
  ];
};

export const AddSkillDialog = ({ trigger }: AddSkillDialogProps) => {
  const [open, setOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'pathway' | 'dag'>('pathway');

  // Pathway Mode States
  const [skill, setSkill] = useState('');
  const [category, setCategory] = useState('General');
  const [pace, setPace] = useState<'slow' | 'medium' | 'fast'>('medium');
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [syllabusType, setSyllabusType] = useState<'ai' | 'manual'>('ai');
  const [manualTopics, setManualTopics] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // DAG Mode States
  const [dagTopic, setDagTopic] = useState('');
  const [dagCourse, setDagCourse] = useState('');
  const [dagSubtopic, setDagSubtopic] = useState('');
  const [dagGoal, setDagGoal] = useState('');
  const [dagDifficulty, setDagDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [dagDepth, setDagDepth] = useState<'Basic' | 'Standard' | 'Detailed'>('Standard');
  const [dagSource, setDagSource] = useState('');
  const [isGeneratingDAG, setIsGeneratingDAG] = useState(false);

  const { createSkill, isCreating } = useSkills();
  const { saveDAG, openDAG } = useSavedDAGs();
  const { toast } = useToast();

  const handleCreateDAG = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dagTopic.trim()) return;

    setIsGeneratingDAG(true);
    try {
      const generated = await generateDAG({
        topic: dagTopic.trim(),
        subtopic: dagSubtopic.trim() || undefined,
        learningGoal: (dagGoal.trim() as any) || 'Concept Mastery',
        depth: dagDepth,
        sourceTitle: dagSource.trim() || undefined,
      });

      const record = await saveDAG({
        title: `${dagTopic.trim()} Concept Map`,
        course: dagCourse.trim() || dagTopic.trim(),
        topic: generated.topic,
        subtopic: generated.subtopic,
        goal: generated.learningGoal,
        difficulty: dagDifficulty,
        depth: generated.depth,
        sourceMaterial: dagSource.trim() ? {
          title: dagSource.trim(),
          type: 'pdf',
          fileName: dagSource.trim()
        } : undefined,
        nodes: generated.nodes,
        edges: generated.edges,
        metadata: generated.metadata
      });

      openDAG(record.id);

      toast({
        title: 'Learning DAG Created & Saved',
        description: `"${record.title}" with ${record.nodes.length} concepts is now saved to your learning path.`,
      });

      // Reset DAG form
      setDagTopic('');
      setDagCourse('');
      setDagSubtopic('');
      setDagGoal('');
      setDagSource('');
      setOpen(false);
    } catch (error: any) {
      console.error('Failed to create learning DAG:', error);
      toast({
        title: 'Failed to Generate DAG',
        description: error.message || 'An error occurred while generating the concept graph.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingDAG(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skill.trim()) return;

    let generatedTopics: string[] = [];
    setIsGenerating(true);

    try {
      if (syllabusType === 'ai') {
        try {
          let rawText = '';
          const syllabusPrompt = `I want to learn the skill '${skill.trim()}'. Please generate a structured syllabus of exactly 12 topics, ordered logically from beginner to advanced. Return ONLY a valid raw JSON array of strings containing the topics (e.g. ["Topic 1", "Topic 2", ...]). Do not write any other text, markdown formatting (no backticks), or explanations. Just return the JSON array.`;

          try {
            const { data: response, error: callError } = await supabase.functions.invoke('ai-assistant', {
              body: { 
                message: syllabusPrompt,
                history: []
              }
            });
            if (callError) throw callError;
            rawText = response?.text || response?.response || '';
          } catch (edgeErr) {
            console.warn('Edge function invoke failed, using direct Gemini client:', edgeErr);
            const direct = await geminiClient.generateContent({
              message: syllabusPrompt
            });
            if (direct.error) throw new Error(direct.error);
            rawText = direct.response;
          }
          
          // Try to clean markdown formatting if AI returns it
          const cleanText = rawText.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(cleanText);
          if (Array.isArray(parsed)) {
            generatedTopics = parsed.map(item => String(item));
          } else {
            throw new Error('AI response was not a JSON array');
          }
        } catch (error) {
          console.warn('AI Syllabus generation failed, using fallback:', error);
          generatedTopics = getFallbackSyllabus(skill.trim());
        }
      } else {
        // Parse manual topics
        generatedTopics = manualTopics
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        if (generatedTopics.length === 0) {
          generatedTopics = getFallbackSyllabus(skill.trim());
        }
      }

      // Map topics to days based on pace
      // Slow: 1 topic/day, Medium: 2 topics/day, Fast: 3 topics/day
      const syllabusTopics: SyllabusTopic[] = generatedTopics.map((topic, index) => {
        let dayNumber = 1;
        if (pace === 'slow') {
          dayNumber = index + 1;
        } else if (pace === 'medium') {
          dayNumber = Math.floor(index / 2) + 1;
        } else {
          dayNumber = Math.floor(index / 3) + 1;
        }
        
        return {
          id: `topic-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5)}`,
          topic,
          completed: false,
          dayNumber
        };
      });

      const categoryData = {
        categoryName: category,
        preference: {
          pace,
          hoursPerDay
        },
        syllabus: syllabusTopics,
        unlockedDays: 0
      };

      createSkill({
        skill: skill.trim(),
        category: JSON.stringify(categoryData),
        progress: 0,
      });

      // Reset form
      setSkill('');
      setCategory('General');
      setPace('medium');
      setHoursPerDay(2);
      setSyllabusType('ai');
      setManualTopics('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to submit new skill:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Skill
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialogMode === 'pathway' ? (
              <>
                <BookOpen className="w-5 h-5 text-primary" />
                <span>Add Skill Pathway</span>
              </>
            ) : (
              <>
                <GitFork className="w-5 h-5 text-indigo-500" />
                <span>Create Learning DAG</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Mode Switcher */}
        <div className="flex p-1 bg-muted rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setDialogMode('pathway')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              dialogMode === 'pathway' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Skill Pathway</span>
          </button>
          <button
            type="button"
            onClick={() => setDialogMode('dag')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              dialogMode === 'dag' ? 'bg-background shadow-xs text-foreground text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GitFork className="w-3.5 h-3.5 text-indigo-500" />
            <span>Create Learning DAG</span>
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-indigo-400 text-indigo-600 bg-indigo-500/10 font-bold">AI</Badge>
          </button>
        </div>

        {dialogMode === 'pathway' ? (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="skill">Skill Name</Label>
              <Input
                id="skill"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="e.g., React.js, Python, UI/UX Design"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Frontend">Frontend</SelectItem>
                  <SelectItem value="Backend">Backend</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="Mobile">Mobile</SelectItem>
                  <SelectItem value="Data Science">Data Science</SelectItem>
                  <SelectItem value="DevOps">DevOps</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pace">Learning Pace</Label>
                <Select value={pace} onValueChange={(val: any) => setPace(val)}>
                  <SelectTrigger id="pace">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Slow (1 topic/day)</SelectItem>
                    <SelectItem value="medium">Medium (2 topics/day)</SelectItem>
                    <SelectItem value="fast">Fast (3 topics/day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hours">Study Time (Hours/Day)</Label>
                <Input
                  id="hours"
                  type="number"
                  min={1}
                  max={24}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseInt(e.target.value) || 2)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t border-border">
              <Label>Syllabus Roadmap Source</Label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="syllabusType"
                    checked={syllabusType === 'ai'}
                    onChange={() => setSyllabusType('ai')}
                    className="accent-indigo-600"
                  />
                  AI generated roadmap (Recommended)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="syllabusType"
                    checked={syllabusType === 'manual'}
                    onChange={() => setSyllabusType('manual')}
                    className="accent-indigo-600"
                  />
                  Custom syllabus
                </label>
              </div>
            </div>

            {syllabusType === 'manual' && (
              <div className="space-y-2">
                <Label htmlFor="manualTopics">Topics (One per line)</Label>
                <Textarea
                  id="manualTopics"
                  value={manualTopics}
                  onChange={(e) => setManualTopics(e.target.value)}
                  placeholder="e.g.&#10;Introduction to HTML&#10;CSS Selectors&#10;Box Model"
                  rows={4}
                  required
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isGenerating || !skill.trim()}>
                {(isCreating || isGenerating) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Roadmap...
                  </>
                ) : (
                  'Create Pathway'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateDAG} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="dagTopic">Skill / Subject Topic <span className="text-destructive">*</span></Label>
              <Input
                id="dagTopic"
                value={dagTopic}
                onChange={(e) => setDagTopic(e.target.value)}
                placeholder="e.g., Distributed Systems, Machine Learning, Graph Theory"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dagCourse">Course / Field</Label>
                <Input
                  id="dagCourse"
                  value={dagCourse}
                  onChange={(e) => setDagCourse(e.target.value)}
                  placeholder="e.g., Computer Science"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dagSubtopic">Subtopic / Focus</Label>
                <Input
                  id="dagSubtopic"
                  value={dagSubtopic}
                  onChange={(e) => setDagSubtopic(e.target.value)}
                  placeholder="e.g., Consensus Protocols"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dagDifficulty">Target Difficulty</Label>
                <Select value={dagDifficulty} onValueChange={(val: any) => setDagDifficulty(val)}>
                  <SelectTrigger id="dagDifficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dagDepth">Graph Depth</Label>
                <Select value={dagDepth} onValueChange={(val: any) => setDagDepth(val)}>
                  <SelectTrigger id="dagDepth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic (4-6 nodes)</SelectItem>
                    <SelectItem value="Standard">Standard (7-10 nodes)</SelectItem>
                    <SelectItem value="Detailed">Detailed (11-16 nodes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dagGoal">Learning Goal</Label>
              <Input
                id="dagGoal"
                value={dagGoal}
                onChange={(e) => setDagGoal(e.target.value)}
                placeholder="e.g., Master prerequisite foundations and exam-critical concepts"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dagSource">Source Material / Document Note (Optional)</Label>
              <Input
                id="dagSource"
                value={dagSource}
                onChange={(e) => setDagSource(e.target.value)}
                placeholder="e.g., Chapter 5 Concurrency or Lecture Slides 1-4"
              />
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-muted-foreground flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Generates an interactive prerequisite-aware Directed Acyclic Graph (DAG) with BKT mastery tracking, source coordinates, and AI Tutor integration.
              </span>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isGeneratingDAG || !dagTopic.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xs font-medium"
              >
                {isGeneratingDAG ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating DAG...
                  </>
                ) : (
                  <>
                    <GitFork className="w-4 h-4 mr-2" />
                    Generate & Save DAG
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};