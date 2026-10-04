import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  Activity,
  Quote,
  Upload,
  RefreshCw,
  Sliders,
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  Eye,
  Settings2,
  Play
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export type CoverType = 'default' | 'image' | 'video' | 'simulation' | 'quote';
export type SimulationType = 'constellation' | 'starfield' | 'waves';

export interface BannerConfig {
  type: CoverType;
  // Image
  imageUrl?: string;
  // Video
  videoUrl?: string;
  videoMuted?: boolean;
  // Simulation
  simulationType?: SimulationType;
  simulationColor?: string;
  // Quote
  quoteText?: string;
  quoteAuthor?: string;
  quoteTheme?: 'indigo' | 'sunset' | 'emerald' | 'slate' | 'cyber';
  // Overlay
  showGreeting?: boolean;
  customGreeting?: string;
  customSubtitle?: string;
}

const DEFAULT_CONFIG: BannerConfig = {
  type: 'default',
  showGreeting: true,
  customGreeting: '',
  customSubtitle: '',
  simulationType: 'constellation',
  simulationColor: '#6366f1',
  quoteText: "The beautiful thing about learning is that no one can take it away from you.",
  quoteAuthor: "B.B. King",
  quoteTheme: 'indigo',
};

const PRESET_IMAGES = [
  {
    name: 'Cosmic Nebula',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1600&q=80',
    tag: 'Galaxy'
  },
  {
    name: 'Study Library',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1600&q=80',
    tag: 'Aesthetic'
  },
  {
    name: 'Minimal Mountain',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
    tag: 'Nature'
  },
  {
    name: 'Cyberpunk Neon',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
    tag: 'Tech'
  },
  {
    name: 'Lo-Fi Sunset',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80',
    tag: 'Calm'
  }
];

const PRESET_VIDEOS = [
  {
    name: 'Aesthetic Rain on Glass',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-rain-falling-on-the-water-of-a-lake-1981-large.mp4',
    tag: 'Rain'
  },
  {
    name: 'Calm Ocean Waves',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-set-of-plateaus-seen-from-the-sky-in-a-sunset-26070-large.mp4',
    tag: 'Sunset'
  },
  {
    name: 'Deep Space Starflow',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-flying-through-a-starfield-in-deep-space-41530-large.mp4',
    tag: 'Cosmic'
  },
  {
    name: 'Cozy Ambient Flow',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4',
    tag: 'Water'
  }
];

const PRESET_QUOTES = [
  {
    text: "The beautiful thing about learning is that no one can take it away from you.",
    author: "B.B. King"
  },
  {
    text: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi"
  },
  {
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius"
  },
  {
    text: "The mind is not a vessel to be filled, but a fire to be kindled.",
    author: "Plutarch"
  },
  {
    text: "First principle: you must not fool yourself — and you are the easiest person to fool.",
    author: "Richard Feynman"
  },
  {
    text: "Stay hungry, stay foolish.",
    author: "Steve Jobs"
  },
  {
    text: "We choose to go to the moon and do the other things, not because they are easy, but because they are hard.",
    author: "John F. Kennedy"
  }
];

interface DashboardCoverWidgetProps {
  userName?: string;
  userSemester?: string | number;
  userBranch?: string;
}

export const DashboardCoverWidget: React.FC<DashboardCoverWidgetProps> = ({
  userName = 'Student',
  userSemester,
  userBranch,
}) => {
  const { toast } = useToast();
  const [config, setConfig] = useState<BannerConfig>(() => {
    const saved = localStorage.getItem('studymate_dashboard_banner_config');
    if (saved) {
      try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<BannerConfig>(config);
  const [isVideoMuted, setIsVideoMuted] = useState(config.videoMuted ?? true);

  // Simulation Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const mousePos = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });

  // Save to localStorage
  const saveConfig = (newCfg: BannerConfig) => {
    setConfig(newCfg);
    localStorage.setItem('studymate_dashboard_banner_config', JSON.stringify(newCfg));
  };

  const handleOpenCustomize = () => {
    setTempConfig({ ...config });
    setIsCustomizeOpen(true);
  };

  const handleApplyChanges = () => {
    saveConfig(tempConfig);
    setIsCustomizeOpen(false);
    toast({
      title: "Banner Updated ✨",
      description: `Dashboard cover set to ${tempConfig.type} mode.`,
    });
  };

  const handleResetDefault = () => {
    saveConfig(DEFAULT_CONFIG);
    setTempConfig(DEFAULT_CONFIG);
    setIsCustomizeOpen(false);
    toast({
      title: "Reset to Default 🔄",
      description: "Default canvas placeholder restored.",
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (field === 'image') {
        setTempConfig(prev => ({ ...prev, type: 'image', imageUrl: result }));
      } else {
        setTempConfig(prev => ({ ...prev, type: 'video', videoUrl: result }));
      }
      toast({
        title: "File Loaded! 🚀",
        description: `Custom ${field} file loaded into preview.`,
      });
    };
    reader.readAsDataURL(file);
  };

  // --- Canvas Simulation Loop ---
  useEffect(() => {
    if (config.type !== 'simulation' && config.type !== 'default') {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 220);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const color = config.simulationColor || '#6366f1';
    const isStarfield = config.simulationType === 'starfield';
    const isWaves = config.simulationType === 'waves';

    // Particle nodes for Constellation / Default
    const particleCount = config.type === 'default' ? 35 : 55;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.9,
      vy: (Math.random() - 0.5) * 0.9,
      radius: Math.random() * 2 + 1.2,
    }));

    // Stars for starfield
    const starCount = 120;
    const stars = Array.from({ length: starCount }, () => ({
      x: (Math.random() - 0.5) * width * 2,
      y: (Math.random() - 0.5) * height * 2,
      z: Math.random() * width,
    }));

    let waveOffset = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (isStarfield && config.type === 'simulation') {
        // Starfield rendering
        const cx = width / 2;
        const cy = height / 2;
        ctx.fillStyle = '#ffffff';

        for (let i = 0; i < stars.length; i++) {
          const star = stars[i];
          star.z -= 2.5;
          if (star.z <= 0) {
            star.z = width;
            star.x = (Math.random() - 0.5) * width * 2;
            star.y = (Math.random() - 0.5) * height * 2;
          }

          const k = 128.0 / star.z;
          const px = star.x * k + cx;
          const py = star.y * k + cy;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const size = Math.max(0.5, (1 - star.z / width) * 2.5);
            const alpha = Math.min(1, (1 - star.z / width) * 1.5);
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } else if (isWaves && config.type === 'simulation') {
        // Generative Waveform
        waveOffset += 0.02;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;

        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.globalAlpha = 0.35 - j * 0.08;
          for (let x = 0; x < width; x += 6) {
            const y =
              height / 2 +
              Math.sin(x * 0.01 + waveOffset + j * 0.8) * (24 + j * 10) +
              Math.cos(x * 0.005 + waveOffset * 0.5) * 15;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        // Constellation / Default interactive nodes
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          // Mouse attraction/repulsion
          const dx = mousePos.current.x - p.x;
          const dy = mousePos.current.y - p.y;
          const distMouse = Math.sqrt(dx * dx + dy * dy);
          if (distMouse < 100) {
            p.x -= (dx / distMouse) * 1.2;
            p.y -= (dy / distMouse) * 1.2;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = config.type === 'default' ? 0.45 : 0.75;
          ctx.fill();

          // Connect nearby particles
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const d = Math.hypot(p.x - p2.x, p.y - p2.y);
            const maxDist = config.type === 'default' ? 85 : 110;
            if (d < maxDist) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = color;
              ctx.globalAlpha = (1 - d / maxDist) * (config.type === 'default' ? 0.25 : 0.45);
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [config.type, config.simulationType, config.simulationColor]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mousePos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseLeave = () => {
    mousePos.current = { x: -1000, y: -1000 };
  };

  const quoteThemes = {
    indigo: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-indigo-100 border-indigo-800/40',
    sunset: 'bg-gradient-to-br from-rose-950 via-amber-950 to-orange-950 text-amber-100 border-amber-800/40',
    emerald: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-emerald-100 border-emerald-800/40',
    slate: 'bg-gradient-to-br from-slate-900 via-zinc-900 to-black text-slate-100 border-slate-700/40',
    cyber: 'bg-gradient-to-br from-fuchsia-950 via-purple-950 to-cyan-950 text-cyan-100 border-cyan-800/40',
  };

  return (
    <div className="relative group">
      {/* ============================================================== */}
      {/* BANNER CONTAINER */}
      {/* ============================================================== */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`relative overflow-hidden rounded-2xl border transition-all duration-300 min-h-[170px] sm:min-h-[195px] flex flex-col justify-between p-6 shadow-sm hover:shadow-md ${
          config.type === 'quote'
            ? quoteThemes[config.quoteTheme || 'emerald']
            : config.type === 'default'
            ? 'bg-gradient-to-r from-primary/10 via-accent/30 to-secondary border-border text-foreground'
            : 'bg-card text-foreground border-border/60'
        }`}
      >
        {/* --- 1. IMAGE MODE --- */}
        {config.type === 'image' && config.imageUrl && (
          <>
            <img
              src={config.imageUrl}
              alt="Dashboard Cover"
              className="absolute inset-0 w-full h-full object-cover select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30 backdrop-blur-[0.5px]" />
          </>
        )}

        {/* --- 2. VIDEO MODE --- */}
        {config.type === 'video' && config.videoUrl && (
          <>
            <video
              src={config.videoUrl}
              autoPlay
              loop
              muted={isVideoMuted}
              playsInline
              className="absolute inset-0 w-full h-full object-cover select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
            
            {/* Audio Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVideoMuted(!isVideoMuted);
              }}
              className="absolute bottom-3 left-4 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white/90 backdrop-blur-md transition-all text-xs flex items-center gap-1.5 px-2.5"
            >
              {isVideoMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="text-[10px]">{isVideoMuted ? 'Muted' : 'Audio On'}</span>
            </button>
          </>
        )}

        {/* --- 3. SIMULATION OR DEFAULT INTERACTIVE CANVAS --- */}
        {(config.type === 'simulation' || config.type === 'default') && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}

        {/* ============================================================== */}
        {/* TOP BAR: BANNER BADGE & CUSTOMIZE BUTTON */}
        {/* ============================================================== */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {config.type === 'default' && (
              <Badge variant="secondary" className="text-[11px] bg-primary/10 text-primary border-primary/20 gap-1 px-2.5 py-0.5">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                Personal Canvas
              </Badge>
            )}
            {config.type === 'image' && (
              <Badge className="text-[10px] bg-black/50 backdrop-blur-md text-white border border-white/20 gap-1">
                <ImageIcon className="w-3 h-3 text-sky-400" />
                Wallpaper Cover
              </Badge>
            )}
            {config.type === 'video' && (
              <Badge className="text-[10px] bg-black/50 backdrop-blur-md text-white border border-white/20 gap-1">
                <Video className="w-3 h-3 text-rose-400" />
                Ambient Looping Video
              </Badge>
            )}
            {config.type === 'simulation' && (
              <Badge className="text-[10px] bg-black/50 backdrop-blur-md text-white border border-white/20 gap-1">
                <Activity className="w-3 h-3 text-indigo-400" />
                Interactive Simulation ({config.simulationType})
              </Badge>
            )}
            {config.type === 'quote' && (
              <Badge className="text-[10px] bg-white/10 backdrop-blur-md text-current border border-white/20 gap-1">
                <Quote className="w-3 h-3" />
                Daily Motivation
              </Badge>
            )}
          </div>

          {/* Customize Button (Always available, subtly accented on hover) */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenCustomize}
            className="h-8 px-3 text-xs gap-1.5 bg-background/80 hover:bg-background backdrop-blur-md border-border/80 shadow-xs transition-all hover:scale-105"
          >
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            <span>Customize Banner</span>
          </Button>
        </div>

        {/* ============================================================== */}
        {/* CENTER / BOTTOM CONTENT */}
        {/* ============================================================== */}
        <div className="relative z-10 my-auto py-2">
          {/* Default Placeholder Mode Content */}
          {config.type === 'default' && (
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Hey there, {userName}! 🚀</span>
                {userSemester && (
                  <span className="text-xs font-normal text-muted-foreground hidden sm:inline-block">
                    • Semester {userSemester} {userBranch ? `(${userBranch})` : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                This is your custom canvas. Click <strong className="text-foreground">"Customize Banner"</strong> above to personalize it with your favorite aesthetic wallpaper, calming looping video, interactive galaxy simulation, or inspiring daily quotes!
              </p>

              {/* Quick Jump Action Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setTempConfig(prev => ({ ...prev, type: 'image', imageUrl: PRESET_IMAGES[0].url }));
                    saveConfig({ ...config, type: 'image', imageUrl: PRESET_IMAGES[0].url });
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border/70 bg-card/60 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
                  <span>Set Wallpaper</span>
                </button>
                <button
                  onClick={() => {
                    setTempConfig(prev => ({ ...prev, type: 'video', videoUrl: PRESET_VIDEOS[0].url }));
                    saveConfig({ ...config, type: 'video', videoUrl: PRESET_VIDEOS[0].url });
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border/70 bg-card/60 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5 text-rose-500" />
                  <span>Looping Video</span>
                </button>
                <button
                  onClick={() => {
                    setTempConfig(prev => ({ ...prev, type: 'simulation', simulationType: 'starfield' }));
                    saveConfig({ ...config, type: 'simulation', simulationType: 'starfield' });
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border/70 bg-card/60 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Simulation</span>
                </button>
                <button
                  onClick={() => {
                    setTempConfig(prev => ({ ...prev, type: 'quote' }));
                    saveConfig({ ...config, type: 'quote' });
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-border/70 bg-card/60 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all flex items-center gap-1.5"
                >
                  <Quote className="w-3.5 h-3.5 text-amber-500" />
                  <span>Inspirational Quote</span>
                </button>
              </div>
            </div>
          )}

          {/* Image Mode Content Overlay */}
          {config.type === 'image' && (
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
                {config.customGreeting || `Hey there, ${userName}! 🚀`}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 drop-shadow-sm">
                {config.customSubtitle || `${userSemester ? `Semester ${userSemester}` : 'College'} • ${userBranch || 'Computer Science'}`}
              </p>
            </div>
          )}

          {/* Video Mode Content Overlay */}
          {config.type === 'video' && (
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
                {config.customGreeting || `Deep Focus Session • ${userName}`}
              </h2>
              <p className="text-xs sm:text-sm text-white/80 drop-shadow-sm">
                {config.customSubtitle || 'Calming ambient flow for high productivity'}
              </p>
            </div>
          )}

          {/* Simulation Mode Content */}
          {config.type === 'simulation' && (
            <div className="space-y-1 select-none">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md flex items-center gap-2">
                <span>Interactive {config.simulationType === 'starfield' ? 'Hyperspace' : config.simulationType === 'waves' ? 'Harmonic Flow' : 'Neural Constellation'}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h2>
              <p className="text-xs text-white/70">
                Move your cursor across the canvas to interact with dynamic physics
              </p>
            </div>
          )}

          {/* Quote Mode Content */}
          {config.type === 'quote' && (
            <div className="space-y-2 max-w-3xl">
              <div className="flex items-start gap-2">
                <Quote className="w-6 h-6 shrink-0 opacity-60 mt-0.5" />
                <blockquote className="text-base sm:text-lg font-medium italic tracking-wide leading-relaxed">
                  "{config.quoteText || DEFAULT_CONFIG.quoteText}"
                </blockquote>
              </div>
              <p className="text-xs sm:text-sm font-semibold opacity-80 pl-8">
                — {config.quoteAuthor || DEFAULT_CONFIG.quoteAuthor}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* CUSTOMIZE BANNER DIALOG MODAL */}
      {/* ============================================================== */}
      <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="w-5 h-5 text-primary" />
              Customize Dashboard Hero Banner
            </DialogTitle>
            <DialogDescription>
              Select whether you want an aesthetic wallpaper, ambient looping video, interactive simulation, or motivational quote.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={tempConfig.type}
            onValueChange={(val) => setTempConfig(prev => ({ ...prev, type: val as CoverType }))}
            className="w-full mt-2"
          >
            <TabsList className="grid grid-cols-5 w-full h-auto p-1 bg-muted/60">
              <TabsTrigger value="default" className="text-xs py-2 gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Default
              </TabsTrigger>
              <TabsTrigger value="image" className="text-xs py-2 gap-1">
                <ImageIcon className="w-3.5 h-3.5" />
                Image
              </TabsTrigger>
              <TabsTrigger value="video" className="text-xs py-2 gap-1">
                <Video className="w-3.5 h-3.5" />
                Video
              </TabsTrigger>
              <TabsTrigger value="simulation" className="text-xs py-2 gap-1">
                <Activity className="w-3.5 h-3.5" />
                Simulation
              </TabsTrigger>
              <TabsTrigger value="quote" className="text-xs py-2 gap-1">
                <Quote className="w-3.5 h-3.5" />
                Quote
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: DEFAULT PLACEHOLDER */}
            <TabsContent value="default" className="space-y-4 pt-4">
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Clean Canvas & Greeting
                </h4>
                <p className="text-xs text-muted-foreground">
                  The default view provides a clean, calming gradient canvas with dynamic particle motion and quick shortcuts. You can easily switch to images, videos, simulations, or quotes anytime!
                </p>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleResetDefault}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Restore Factory Default
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: IMAGE / WALLPAPER */}
            <TabsContent value="image" className="space-y-4 pt-4">
              {/* Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Choose from Curated Aesthetic Wallpapers</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PRESET_IMAGES.map((img) => (
                    <div
                      key={img.name}
                      onClick={() => setTempConfig(prev => ({ ...prev, imageUrl: img.url }))}
                      className={`group relative h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        tempConfig.imageUrl === img.url ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border'
                      }`}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-2 text-white">
                        <span className="text-[11px] font-bold truncate leading-tight">{img.name}</span>
                        <span className="text-[9px] text-white/70">{img.tag}</span>
                      </div>
                      {tempConfig.imageUrl === img.url && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Image URL or Upload */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label htmlFor="custom-image-url" className="text-xs font-semibold">Or Enter Custom Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-image-url"
                    placeholder="https://example.com/aesthetic-wallpaper.jpg"
                    value={tempConfig.imageUrl || ''}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, imageUrl: e.target.value }))}
                    className="text-xs flex-1"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'image')}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" size="sm" asChild className="h-9 gap-1 text-xs">
                      <span>
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </span>
                    </Button>
                  </label>
                </div>
              </div>

              {/* Text Overlays */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <Label htmlFor="img-greeting" className="text-xs">Greeting Title</Label>
                  <Input
                    id="img-greeting"
                    placeholder={`Hey there, ${userName}! 🚀`}
                    value={tempConfig.customGreeting || ''}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, customGreeting: e.target.value }))}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="img-sub" className="text-xs">Subtitle</Label>
                  <Input
                    id="img-sub"
                    placeholder="Semester 3 • Computer Science"
                    value={tempConfig.customSubtitle || ''}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, customSubtitle: e.target.value }))}
                    className="text-xs"
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: LOOPING VIDEO */}
            <TabsContent value="video" className="space-y-4 pt-4">
              {/* Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Select Ambient Looping Video</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {PRESET_VIDEOS.map((vid) => (
                    <div
                      key={vid.name}
                      onClick={() => setTempConfig(prev => ({ ...prev, videoUrl: vid.url }))}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                        tempConfig.videoUrl === vid.url
                          ? 'border-primary bg-primary/5'
                          : 'border-border/80 hover:border-border bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                          <Play className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{vid.name}</p>
                          <span className="text-[10px] text-muted-foreground">{vid.tag}</span>
                        </div>
                      </div>
                      {tempConfig.videoUrl === vid.url && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Video URL or Upload */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label htmlFor="custom-video-url" className="text-xs font-semibold">Or Enter Custom Video URL (.mp4 / .webm)</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-video-url"
                    placeholder="https://example.com/looping-video.mp4"
                    value={tempConfig.videoUrl || ''}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, videoUrl: e.target.value }))}
                    className="text-xs flex-1"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileUpload(e, 'video')}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" size="sm" asChild className="h-9 gap-1 text-xs">
                      <span>
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </TabsContent>

            {/* TAB 4: INTERACTIVE SIMULATION */}
            <TabsContent value="simulation" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Simulation Type</Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'constellation', name: 'Constellation', desc: 'Connected particle physics' },
                    { id: 'starfield', name: 'Hyperspace', desc: '3D Warp Starfield' },
                    { id: 'waves', name: 'Harmonic Waves', desc: 'Generative fluid curves' },
                  ].map((sim) => (
                    <div
                      key={sim.id}
                      onClick={() => setTempConfig(prev => ({ ...prev, simulationType: sim.id as SimulationType }))}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        tempConfig.simulationType === sim.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/80 hover:border-border bg-muted/20'
                      }`}
                    >
                      <p className="text-xs font-semibold text-foreground">{sim.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{sim.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold">Particle / Light Color</Label>
                <div className="flex items-center gap-3">
                  {[
                    { name: 'Indigo Electric', color: '#6366f1' },
                    { name: 'Neon Cyan', color: '#06b6d4' },
                    { name: 'Emerald Glow', color: '#10b981' },
                    { name: 'Cyber Violet', color: '#d946ef' },
                    { name: 'Solar Amber', color: '#f59e0b' },
                    { name: 'Pure White', color: '#ffffff' },
                  ].map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setTempConfig(prev => ({ ...prev, simulationColor: c.color }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                        tempConfig.simulationColor === c.color ? 'border-foreground scale-110 shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    >
                      {tempConfig.simulationColor === c.color && (
                        <Check className={`w-3.5 h-3.5 ${c.color === '#ffffff' ? 'text-black' : 'text-white'}`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 5: INSPIRING QUOTE */}
            <TabsContent value="quote" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Preset Quotes</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {PRESET_QUOTES.map((q, idx) => (
                    <div
                      key={idx}
                      onClick={() => setTempConfig(prev => ({ ...prev, quoteText: q.text, quoteAuthor: q.author }))}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        tempConfig.quoteText === q.text
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border/60 hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <p className="font-medium italic">"{q.text}"</p>
                      <p className="text-[10px] mt-1 font-semibold opacity-75">— {q.author}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Quote text & author */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <Label htmlFor="custom-quote-text" className="text-xs font-semibold">Custom Quote or Goal</Label>
                  <Input
                    id="custom-quote-text"
                    value={tempConfig.quoteText || ''}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, quoteText: e.target.value }))}
                    placeholder="Enter your personal motto or inspiring quote..."
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-quote-author" className="text-xs font-semibold">Author / Attribution</Label>
                  <Input
                    id="custom-quote-author"
                    value={tempConfig.quoteAuthor || ''}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, quoteAuthor: e.target.value }))}
                    placeholder="e.g. Steve Jobs, or My Personal Motto"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold">Quote Background Theme</Label>
                <div className="grid grid-cols-5 gap-2">
                  {(['indigo', 'sunset', 'emerald', 'slate', 'cyber'] as const).map((thm) => (
                    <button
                      key={thm}
                      type="button"
                      onClick={() => setTempConfig(prev => ({ ...prev, quoteTheme: thm }))}
                      className={`h-8 rounded-lg text-xs capitalize font-medium border-2 transition-all ${
                        tempConfig.quoteTheme === thm
                          ? 'border-primary shadow-xs'
                          : 'border-border/80 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {thm}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefault}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset to Default
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCustomizeOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="premium" size="sm" onClick={handleApplyChanges}>
                Apply Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
