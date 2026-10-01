import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, BookOpen, Brain, FileQuestion, GitBranch, FileText, 
  Upload, X, Eye, Check, Download, Share2, Edit, RotateCcw,
  Target, Clock, TrendingUp, Zap, ChevronRight, Settings2,
  FileUp, Type, MessageSquare, Lightbulb, Star, CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type MaterialType = 'flashcards' | 'mindmaps' | 'quizzes' | 'diagrams' | 'notes' | 'summary' | 'revision';
type InputMode = 'upload' | 'paste' | 'topic';
type Step = 'choose' | 'input' | 'settings' | 'preview' | 'generating' | 'result';

interface GenerationConfig {
  includeExamples: boolean;
  includeMnemonics: boolean;
  includeDiagrams: boolean;
  includeExamTips: boolean;
  includePreviousYear: boolean;
  personalized: boolean;
}

interface MaterialCard {
  type: MaterialType;
  icon: any;
  title: string;
  description: string;
  gradient: string;
  examples: string[];
}

const materialCards: MaterialCard[] = [
  {
    type: 'flashcards',
    icon: BookOpen,
    title: 'Flashcards',
    description: 'Interactive question-answer cards for quick revision',
    gradient: 'from-purple-500 to-pink-500',
    examples: ['Q: What is photosynthesis?', 'A: Process of converting light...']
  },
  {
    type: 'mindmaps',
    icon: Brain,
    title: 'Mind Maps',
    description: 'Visual connections between concepts and ideas',
    gradient: 'from-blue-500 to-cyan-500',
    examples: ['Central: Topic', 'Branches: Subtopics']
  },
  {
    type: 'quizzes',
    icon: FileQuestion,
    title: 'Quiz',
    description: 'Multiple choice questions with explanations',
    gradient: 'from-green-500 to-emerald-500',
    examples: ['MCQs', 'Instant feedback']
  },
  {
    type: 'notes',
    icon: FileText,
    title: 'Smart Notes',
    description: 'Structured, well-organized study notes',
    gradient: 'from-orange-500 to-amber-500',
    examples: ['Key points', 'Summaries']
  },
  {
    type: 'diagrams',
    icon: GitBranch,
    title: 'Flowchart',
    description: 'Step-by-step visual process diagrams',
    gradient: 'from-indigo-500 to-purple-500',
    examples: ['Process flow', 'Connections']
  },
  {
    type: 'summary',
    icon: Target,
    title: 'Summary',
    description: 'Concise overview of key concepts',
    gradient: 'from-rose-500 to-pink-500',
    examples: ['Main ideas', 'Quick read']
  },
  {
    type: 'revision',
    icon: Star,
    title: 'Revision Sheet',
    description: 'Complete revision guide with key formulas and concepts',
    gradient: 'from-violet-500 to-purple-500',
    examples: ['Formulas', 'Quick facts']
  }
];

export const PremiumAIGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { generateContent, isLoading } = useAIAssistant();
  
  // State management
  const [step, setStep] = useState<Step>('choose');
  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'adaptive'>('medium');
  const [outputSize, setOutputSize] = useState(5);
  const [customSize, setCustomSize] = useState(10);
  const [config, setConfig] = useState<GenerationConfig>({
    includeExamples: true,
    includeMnemonics: false,
    includeDiagrams: true,
    includeExamTips: true,
    includePreviousYear: false,
    personalized: true
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generatedResult, setGeneratedResult] = useState<any>(null);
  const [generationStage, setGenerationStage] = useState(0);

  const stats = {
    generated: 120,
    sessions: 35,
    efficiency: 92,
    model: 'Gemini AI'
  };

  const generationStages = [
    { icon: BookOpen, text: 'Reading Notes...' },
    { icon: Brain, text: 'Understanding Concepts...' },
    { icon: Sparkles, text: `Creating ${selectedType}...` },
    { icon: CheckCircle2, text: 'Optimizing Output...' }
  ];

  const handleTypeSelect = (type: MaterialType) => {
    setSelectedType(type);
    setStep('input');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.size > 50 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload files smaller than 50KB.",
        variant: "destructive",
      });
      return;
    }
    
    setUploadedFile(file);
    toast({
      title: "File uploaded",
      description: `${file.name} is ready for processing.`,
    });
  };

  const handleGenerate = async () => {
    if (!selectedType) return;
    
    setStep('generating');
    setGenerationStage(0);
    
    // Animate through stages
    const stageInterval = setInterval(() => {
      setGenerationStage(prev => {
        if (prev >= generationStages.length - 1) {
          clearInterval(stageInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    
    try {
      const inputContent = content || topic;
      const subject = user?.userType === 'college' ? user?.branch : user?.examType;
      
      const result = await generateContent(
        selectedType,
        inputContent,
        difficulty === 'adaptive' ? 'medium' : difficulty,
        outputSize === 0 ? customSize : outputSize,
        subject
      );
      
      clearInterval(stageInterval);
      setGeneratedResult(result);
      setStep('result');
      
      toast({
        title: "Generation Complete! ✨",
        description: `Your ${selectedType} are ready to view.`,
      });
    } catch (error) {
      clearInterval(stageInterval);
      toast({
        title: "Generation Failed",
        description: "Please try again with different input.",
        variant: "destructive",
      });
      setStep('settings');
    }
  };

  // RENDER METHODS
  const renderHeroSection = () => (
    <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 rounded-3xl p-8 mb-8">
      <div className="absolute inset-0 bg-grid-white/10"></div>
      <div className="relative">
        <div className="flex items-center justify-center mb-4">
          <Sparkles className="w-12 h-12 text-white animate-pulse" />
        </div>
        <h1 className="text-4xl font-bold text-white text-center mb-3">
          AI Study Material Generator
        </h1>
        <p className="text-xl text-white/90 text-center mb-6">
          Transform your notes into interactive learning resources in seconds
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.generated}</div>
            <div className="text-sm text-white/80">Generated</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.sessions}</div>
            <div className="text-sm text-white/80">Sessions</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.efficiency}%</div>
            <div className="text-sm text-white/80">Efficiency</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <div className="text-sm font-bold text-white">{stats.model}</div>
            <div className="text-sm text-white/80">AI Model</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderChooseStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Choose What to Generate</h2>
        <p className="text-muted-foreground">Select the type of study material you need</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {materialCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.type}
              className={`p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl group ${
                selectedType === card.type ? 'ring-4 ring-purple-500 shadow-lg' : ''
              }`}
              onClick={() => handleTypeSelect(card.type)}
            >
              <div className={`w-16 h-16 bg-gradient-to-r ${card.gradient} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{card.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{card.description}</p>
              <div className="space-y-1">
                {card.examples.map((example, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-center">
                    <ChevronRight className="w-3 h-3 mr-1" />
                    {example}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderInputStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Provide Study Material</h2>
          <p className="text-muted-foreground">Upload files, paste notes, or enter a topic</p>
        </div>
        <Button variant="ghost" onClick={() => setStep('choose')}>
          Change Type
        </Button>
      </div>

      <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <FileUp className="w-4 h-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex items-center gap-2">
            <Type className="w-4 h-4" />
            Paste Notes
          </TabsTrigger>
          <TabsTrigger value="topic" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Enter Topic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card className="p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors">
            {!uploadedFile ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-10 h-10 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Drop your files here, or browse
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Supports PDF, TXT files up to 50KB
                </p>
                <Input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.txt"
                  onChange={handleFileUpload}
                />
                <Button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="paste" className="space-y-4">
          <Card className="p-6">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your study notes, lecture content, or textbook excerpts here..."
              className="min-h-[300px] text-base font-mono border-0 focus-visible:ring-0 resize-none"
            />
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{content.length} characters</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setContent('')}
                disabled={!content}
              >
                Clear
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="topic" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">What would you like to learn?</h3>
                <p className="text-sm text-muted-foreground">Enter any topic and AI will generate content</p>
              </div>
            </div>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Photosynthesis, Machine Learning, World War II..."
              className="text-lg py-6"
            />
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep('choose')}>
          Back
        </Button>
        <Button
          onClick={() => setStep('settings')}
          disabled={!uploadedFile && !content && !topic}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Generation Settings</h2>
        <p className="text-muted-foreground">Customize your AI-generated content</p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Difficulty */}
        <div>
          <Label className="text-base font-semibold mb-3 block">Difficulty Level</Label>
          <div className="grid grid-cols-4 gap-3">
            {['easy', 'medium', 'hard', 'adaptive'].map((level) => (
              <Button
                key={level}
                variant={difficulty === level ? "default" : "outline"}
                onClick={() => setDifficulty(level as any)}
                className={difficulty === level ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                {level === 'adaptive' && <Zap className="w-4 h-4 mr-1" />}
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Button>
            ))}
          </div>
          {difficulty === 'adaptive' && (
            <p className="text-sm text-purple-600 mt-2">AI will adjust difficulty based on your profile</p>
          )}
        </div>

        {/* Output Size */}
        <div>
          <Label className="text-base font-semibold mb-3 block">Output Size</Label>
          <div className="grid grid-cols-4 gap-3">
            {[5, 10, 20, 0].map((size) => (
              <Button
                key={size}
                variant={outputSize === size ? "default" : "outline"}
                onClick={() => setOutputSize(size)}
                className={outputSize === size ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                {size === 0 ? 'Custom' : size}
              </Button>
            ))}
          </div>
          {outputSize === 0 && (
            <div className="mt-4">
              <Label className="text-sm text-muted-foreground mb-2 block">
                Custom Size: {customSize}
              </Label>
              <Slider
                value={[customSize]}
                onValueChange={(v) => setCustomSize(v[0])}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Additional Options */}
        <div>
          <Label className="text-base font-semibold mb-3 block">Additional Options</Label>
          <div className="space-y-3">
            {[
              { key: 'includeExamples', label: 'Include examples', icon: Target },
              { key: 'includeMnemonics', label: 'Include mnemonics', icon: Brain },
              { key: 'includeDiagrams', label: 'Include diagrams', icon: GitBranch },
              { key: 'includeExamTips', label: 'Include exam tips', icon: Star },
              { key: 'includePreviousYear', label: 'Include previous year concepts', icon: Clock },
              { key: 'personalized', label: 'Personalized based on progress', icon: TrendingUp }
            ].map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                    {label}
                  </Label>
                </div>
                <Switch
                  id={key}
                  checked={config[key as keyof GenerationConfig]}
                  onCheckedChange={(checked) => 
                    setConfig(prev => ({ ...prev, [key]: checked }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* Estimated Time */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">Estimated Completion Time</p>
            <p className="text-sm text-blue-700">~30-45 seconds</p>
          </div>
        </div>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep('input')}>
          Back
        </Button>
        <Button
          onClick={() => setStep('preview')}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          Preview
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    const selectedCard = materialCards.find(c => c.type === selectedType);
    if (!selectedCard) return null;

    return (
      <div className="space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">AI Preview</h2>
          <p className="text-muted-foreground">Here's what AI will generate for you</p>
        </div>

        <Card className={`p-6 bg-gradient-to-r ${selectedCard.gradient} text-white`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <selectedCard.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{selectedCard.title}</h3>
              <p className="text-white/90 text-sm">{outputSize === 0 ? customSize : outputSize} items</p>
            </div>
          </div>
        </Card>

        {/* Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedType === 'flashcards' && (
            <>
              <Card className="p-4 animate-fade-in">
                <Badge className="mb-2">Question</Badge>
                <p className="text-sm text-foreground">What is {topic || 'the main concept'}?</p>
              </Card>
              <Card className="p-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <Badge className="mb-2">Answer</Badge>
                <p className="text-sm text-foreground">Detailed explanation with examples...</p>
              </Card>
            </>
          )}

          {selectedType === 'quizzes' && (
            <Card className="p-4 col-span-full animate-fade-in">
              <Badge className="mb-2">MCQ Example</Badge>
              <p className="font-medium text-foreground mb-2">Which of the following is correct?</p>
              <div className="space-y-1">
                {['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'].map((opt, i) => (
                  <div key={i} className="text-sm text-muted-foreground">{opt}</div>
                ))}
              </div>
            </Card>
          )}

          {selectedType === 'mindmaps' && (
            <Card className="p-4 col-span-full animate-fade-in">
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <span className="text-white font-bold">Central Topic</span>
                  </div>
                  <div className="flex gap-4 justify-center">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center">
                        <span className="text-xs text-blue-800">Branch {i}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setStep('settings')}>
            Back
          </Button>
          <Button
            onClick={handleGenerate}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            size="lg"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Generate with AI
          </Button>
        </div>
      </div>
    );
  };

  const renderGeneratingStep = () => {
    const currentStage = generationStages[generationStage];
    const StageIcon = currentStage.icon;

    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative w-32 h-32 mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full animate-pulse"></div>
          <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
            <StageIcon className="w-12 h-12 text-purple-600 animate-bounce" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-foreground mb-2">{currentStage.text}</h3>
        <p className="text-muted-foreground mb-8">Please wait while AI processes your content</p>

        <div className="flex gap-2">
          {generationStages.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i <= generationStage ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderResultStep = () => (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Generation Complete!</h2>
        <p className="text-muted-foreground">Your {selectedType} are ready to review</p>
      </div>

      {/* Result Cards with animation */}
      <div className="grid grid-cols-1 gap-4 max-w-4xl mx-auto">
        {Array.from({ length: Math.min(3, outputSize === 0 ? customSize : outputSize) }).map((_, i) => (
          <Card 
            key={i} 
            className="p-6 transform transition-all hover:scale-102 hover:shadow-xl animate-slide-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-2">
                  {selectedType?.charAt(0).toUpperCase()}{selectedType?.slice(1)} {i + 1}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Generated content preview...
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center pt-6">
        <Button variant="outline" size="lg">
          <Eye className="w-4 h-4 mr-2" />
          Preview All
        </Button>
        <Button variant="outline" size="lg">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button className="bg-green-600 hover:bg-green-700" size="lg">
          <Check className="w-4 h-4 mr-2" />
          Save to Vault
        </Button>
        <Button variant="outline" size="lg">
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
        <Button variant="outline" size="lg">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          onClick={() => {
            setStep('choose');
            setSelectedType(null);
            setContent('');
            setTopic('');
            setUploadedFile(null);
            setGeneratedResult(null);
          }}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Generate Again
        </Button>
      </div>
    </div>
  );

  const renderRightSidebar = () => (
    <Card className="p-6 sticky top-6 space-y-6">
      <div>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Generations
        </h3>
        <div className="space-y-2 text-sm">
          {['Flashcards - Biology', 'Quiz - Physics', 'Mind Map - History'].map((item, i) => (
            <div key={i} className="p-2 bg-muted rounded-lg hover:bg-muted/70 cursor-pointer transition-colors">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          Suggested Prompts
        </h3>
        <div className="space-y-2 text-sm">
          {[
            'Generate flashcards for exam prep',
            'Create a mind map of key concepts',
            'Quiz me on this topic'
          ].map((prompt, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="w-full text-left justify-start h-auto py-2 px-3"
              onClick={() => setTopic(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Learning Tips
        </h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>✨ Use adaptive difficulty for personalized learning</p>
          <p>📚 Include examples for better understanding</p>
          <p>🎯 Enable exam tips for test preparation</p>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20 p-6">
      <div className="max-w-7xl mx-auto">
        {renderHeroSection()}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {step === 'choose' && renderChooseStep()}
            {step === 'input' && renderInputStep()}
            {step === 'settings' && renderSettingsStep()}
            {step === 'preview' && renderPreviewStep()}
            {step === 'generating' && renderGeneratingStep()}
            {step === 'result' && renderResultStep()}
          </div>
          
          {step !== 'generating' && (
            <div className="hidden lg:block">
              {renderRightSidebar()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
