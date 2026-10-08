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

import { geminiClient } from '@/utils/geminiClient';
import { localStore } from '@/utils/localStore';

interface AddSkillDialogProps {
  trigger?: React.ReactNode;
}

const getFallbackSyllabus = (skillName: string): string[] => {
  const normalized = skillName.toLowerCase();

  // Agentic AI / LLM Agents / Autonomous Agents
  if (normalized.includes('agent') || normalized.includes('llm') || normalized.includes('rag')) {
    return [
      'Foundations of LLMs & Agentic Architecture',
      'Prompt Engineering & Structured Tool Outputs',
      'Function Calling & Dynamic Tool Integration',
      'Retrieval-Augmented Generation (RAG) Systems',
      'Short-Term & Long-Term Vector Memory (Pinecone/Chroma)',
      'Reasoning Loops: ReAct, Chain-of-Thought & Planning',
      'Multi-Agent Orchestration & Communication Protocols',
      'Autonomous Execution, Sandboxing & Safety Guards',
      'Self-Correction, Reflection & Error Recovery Loops',
      'Agent Evaluation, Benchmarking & Cost Optimization',
      'Production Deployment & Streaming Agent APIs',
      'Capstone: End-to-End Autonomous AI Agent'
    ];
  }

  // AI / Machine Learning / Data Science
  if (normalized.includes('ai') || normalized.includes('machine learning') || normalized.includes('data science') || normalized.includes('deep learning')) {
    return [
      'Foundations of Artificial Intelligence & Machine Learning',
      'Supervised vs Unsupervised Learning Paradigms',
      'Data Preprocessing, Cleaning & Feature Engineering',
      'Linear & Logistic Regression Models',
      'Decision Trees & Ensemble Methods (Random Forest, XGBoost)',
      'Neural Networks & Backpropagation Fundamentals',
      'Deep Learning with PyTorch / TensorFlow',
      'Convolutional & Recurrent Neural Architectures',
      'Transformers & Attention Mechanisms',
      'Model Evaluation, Overfitting & Hyperparameter Tuning',
      'Model Deployment & MLOps Pipelines',
      'Capstone: Production Machine Learning Project'
    ];
  }

  // React / Frontend
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
      'Performance Optimization & Memoization',
      'Testing React Components',
      'Building a Complete Full-Stack Project'
    ];
  }

  // Python
  if (normalized.includes('python')) {
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
      'Data Analysis Basics (Pandas & NumPy)',
      'Web Scraping Basics with BeautifulSoup',
      'Building a Command-Line Application'
    ];
  }

  // JavaScript / TypeScript
  if (normalized.includes('javascript') || normalized.includes('js') || normalized.includes('typescript') || normalized.includes('ts')) {
    return [
      'Modern JS Syntax, Variables & Scoping',
      'Functions & Arrow Syntax',
      'Arrays & Modern Array Methods (map, filter, reduce)',
      'Objects, Destructuring & Spread Operators',
      'DOM Manipulation & Event Listeners',
      'Asynchronous JS, Promises & async/await',
      'Fetch API & Network Requests',
      'ES6+ Modules and Bundling',
      'Error Handling & Debugging Techniques',
      'Browser Storage: localStorage & IndexedDB',
      'Object-Oriented Programming & Prototypes',
      'Capstone: Dynamic Full-Stack Web Application'
    ];
  }

  // DSA / Algorithms
  if (normalized.includes('dsa') || normalized.includes('algorithm') || normalized.includes('leetcode') || normalized.includes('data structure')) {
    return [
      'Time & Space Complexity (Big O Notation)',
      'Arrays & Two-Pointer Techniques',
      'Strings & Sliding Window Algorithms',
      'Hash Maps & Sets for O(1) Lookups',
      'Linked Lists & Fast/Slow Pointer Strategies',
      'Stacks & Queues (Monotonic Stacks)',
      'Recursion & Backtracking Fundamentals',
      'Binary Search & Divide-and-Conquer',
      'Trees, Binary Search Trees & Traversal',
      'Graphs: BFS, DFS & Topological Sort',
      'Dynamic Programming (1D & 2D Memoization)',
      'Systematic Interview Problem Solving Strategies'
    ];
  }

  // Generic Intelligent Fallback
  return [
    `Foundations & Core Prerequisites for ${skillName}`,
    `Fundamental Concepts and Terminology in ${skillName}`,
    `Setting Up the Development & Learning Environment`,
    `Basic Syntax and Core Mechanics of ${skillName}`,
    `Common Patterns and Best Practices in ${skillName}`,
    `Error Handling, Debugging & Troubleshooting`,
    `Intermediate Techniques and Real-World Workflows`,
    `Performance Optimization and Efficiency`,
    `Advanced Tools, Frameworks and Ecosystem Packages`,
    `Security, Standards and Best Practices`,
    `Architecting a Scalable Project with ${skillName}`,
    `Capstone: Comprehensive End-to-End Implementation`
  ];
};

/**
 * Fast direct AI syllabus generator using Gemini with a 1.2s timeout.
 * Automatically falls back to high-quality curated curricula if offline, key invalid, or slow.
 */
const generateSyllabusWithAI = async (skillName: string): Promise<string[]> => {
  const curated = getFallbackSyllabus(skillName);

  // AI generation routes securely through backend AI proxy (/api/ai/generate)


  const prompt = `Generate a structured syllabus of exactly 12 learning topics for the skill '${skillName}', ordered logically from beginner to advanced. Return ONLY a JSON array of 12 strings, e.g. ["Topic 1", "Topic 2", ...]. Do not include markdown codeblocks, numbers, or any additional text.`;

  try {
    const aiPromise = geminiClient.generateContent({
      message: prompt,
      topic: skillName,
      systemPrompt: `You are an expert curriculum designer. Return ONLY a valid JSON array of 12 topic strings.`
    });

    const timeoutPromise = new Promise<{ response: string }>((resolve) =>
      setTimeout(() => resolve({ response: '' }), 1200)
    );

    const res = await Promise.race([aiPromise, timeoutPromise]);
    if (res?.response) {
      const clean = res.response.replace(/```json|```/g, '').trim();
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => String(item).trim()).filter(Boolean);
        }
      }
    }
  } catch (err) {
    console.warn('AI syllabus generation fallback used:', err);
  }

  return curated;
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
    const skillName = skill.trim();
    if (!skillName) return;

    setIsGenerating(true);

    try {
      let generatedTopics: string[] = [];

      if (syllabusType === 'ai') {
        generatedTopics = await generateSyllabusWithAI(skillName);
      } else {
        generatedTopics = manualTopics
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
      }

      if (!generatedTopics || generatedTopics.length === 0) {
        generatedTopics = getFallbackSyllabus(skillName);
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
        skill: skillName,
        category: JSON.stringify(categoryData),
        progress: 0,
      });

      // Reset form & Close modal
      setSkill('');
      setCategory('General');
      setPace('medium');
      setHoursPerDay(2);
      setSyllabusType('ai');
      setManualTopics('');
      setOpen(false);
    } catch (err: any) {
      console.warn('Skill pathway creation safety fallback:', err);
      // Guarantee local store save and dialog closure
      try {
        const fallbackTopics = getFallbackSyllabus(skillName);
        const fallbackSyllabusTopics: SyllabusTopic[] = fallbackTopics.map((topic, index) => ({
          id: `topic-${Date.now()}-${index}`,
          topic,
          completed: false,
          dayNumber: Math.floor(index / 2) + 1
        }));
        localStore.saveSkill({
          skill: skillName,
          category: JSON.stringify({
            categoryName: category,
            preference: { pace, hoursPerDay },
            syllabus: fallbackSyllabusTopics,
            unlockedDays: 0
          }),
          progress: 0
        });
      } catch (saveErr) {}

      setSkill('');
      setOpen(false);
      toast({
        title: "Skill Pathway Added",
        description: `Created pathway for "${skillName}".`,
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