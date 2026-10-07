import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, BookOpen, Sparkles } from 'lucide-react';
import { useSkills, SyllabusTopic } from '@/hooks/useSkills';
import { useToast } from '@/hooks/use-toast';

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
  
  // Generic Intelligent Fallback
  return [
    `Foundations of ${skillName}`,
    `Core concepts and terms in ${skillName}`,
    `Setting up the dev environment`,
    `Basic syntax and fundamentals`,
    `Common patterns and practices`,
    `Handling errors and debugging`,
    `Intermediate techniques`,
    `Optimizing performance`,
    `Advanced tools and packages`,
    `Best practices & security`,
    `Architecting a project`,
    `Real-world implementation`
  ];
};

/**
 * Fast direct AI syllabus generator using Gemini with zero thinking latency
 * and a strict 4.5s timeout.
 */
const generateSyllabusWithAI = async (skillName: string): Promise<string[]> => {
  const rawKey = import.meta.env.VITE_GEMINI_API_KEY || (import.meta.env as any).GEMINI_API_KEY;
  const apiKey = rawKey?.trim().replace(/^["']|["']$/g, '');

  if (!apiKey) {
    return getFallbackSyllabus(skillName);
  }

  const prompt = `Generate a structured syllabus of exactly 12 learning topics for the skill '${skillName}', ordered logically from beginner to advanced. Return ONLY a JSON array of 12 strings, e.g. ["Topic 1", "Topic 2", ...]. Do not include markdown codeblocks, numbers, or any additional text.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini status ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => String(item).trim()).filter(Boolean);
      }
    }
  } catch (err) {
    console.warn('Fast Gemini syllabus generation fallback used:', err);
  } finally {
    clearTimeout(timeoutId);
  }

  return getFallbackSyllabus(skillName);
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

  const { createSkillAsync, isCreating } = useSkills();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skill.trim()) return;

    setIsGenerating(true);

    try {
      let generatedTopics: string[] = [];

      if (syllabusType === 'ai') {
        generatedTopics = await generateSyllabusWithAI(skill.trim());
      } else {
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

      await createSkillAsync({
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
    } catch (err: any) {
      console.error('Failed to create skill pathway:', err);
      toast({
        title: "Creation Error",
        description: err.message || "Failed to create skill pathway. Please try again.",
        variant: "destructive"
      });
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
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Add Skill Pathway</span>
          </DialogTitle>
        </DialogHeader>

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
              <SelectTrigger id="category">
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
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="syllabusType"
                  checked={syllabusType === 'ai'}
                  onChange={() => setSyllabusType('ai')}
                  className="accent-primary"
                />
                AI generated roadmap (Recommended)
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="radio"
                  name="syllabusType"
                  checked={syllabusType === 'manual'}
                  onChange={() => setSyllabusType('manual')}
                  className="accent-primary"
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
            <Button 
              type="submit" 
              disabled={isCreating || isGenerating || !skill.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium"
            >
              {(isCreating || isGenerating) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Pathway...
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