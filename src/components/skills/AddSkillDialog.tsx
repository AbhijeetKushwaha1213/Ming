import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { useSkills, SyllabusTopic } from '@/hooks/useSkills';
import { supabase } from '@/integrations/supabase/client';

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
  const [skill, setSkill] = useState('');
  const [category, setCategory] = useState('General');
  const [pace, setPace] = useState<'slow' | 'medium' | 'fast'>('medium');
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [syllabusType, setSyllabusType] = useState<'ai' | 'manual'>('ai');
  const [manualTopics, setManualTopics] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { createSkill, isCreating } = useSkills();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skill.trim()) return;

    let generatedTopics: string[] = [];
    setIsGenerating(true);

    try {
      if (syllabusType === 'ai') {
        try {
          const { data: response, error: callError } = await supabase.functions.invoke('ai-assistant', {
            body: { 
              message: `I want to learn the skill '${skill.trim()}'. Please generate a structured syllabus of exactly 12 topics, ordered logically from beginner to advanced. Return ONLY a valid raw JSON array of strings containing the topics (e.g. ["Topic 1", "Topic 2", ...]). Do not write any other text, markdown formatting (no backticks), or explanations. Just return the JSON array.`,
              history: []
            }
          });
          
          if (callError) throw callError;
          
          const rawText = response?.text || '';
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
      <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add New Skill Pathway</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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
      </DialogContent>
    </Dialog>
  );
};