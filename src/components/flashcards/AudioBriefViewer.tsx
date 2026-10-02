import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  FileText,
  Copy,
  Check,
  Headphones,
  Flame,
  BookmarkCheck,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface AudioBriefData {
  title: string;
  topic: string;
  target_concept?: string;
  mastery_score?: number; // e.g. 0.28 for 28%
  duration_minutes?: number;
  script: string;
  key_takeaways?: string[];
  citations?: Array<{
    label: string;
    coordinate: string;
    source_type: string;
  }>;
}

interface AudioBriefViewerProps {
  brief: AudioBriefData;
  onClose?: () => void;
  className?: string;
}

export const AudioBriefViewer: React.FC<AudioBriefViewerProps> = ({
  brief,
  onClose,
  className = '',
}) => {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const totalEstimatedSeconds = Math.max(
    45,
    Math.round((brief.script.split(/\s+/).length / 150) * 60)
  );

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<any>(null);

  // Initialize Speech Synthesis
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTogglePlay = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast({
        title: 'Speech Synthesis not supported',
        description: 'Your browser does not support native audio speech playback.',
        variant: 'destructive',
      });
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
        startTimer();
      } else {
        window.speechSynthesis.cancel();
        // Strip citation bracket tags [CHUNK_xxx] for natural spoken synthesis
        const cleanScript = brief.script.replace(/\[[A-Za-z0-9_\-]+\]/g, '');
        const utter = new SpeechSynthesisUtterance(cleanScript);
        utter.rate = speed;
        utter.pitch = 1.0;

        utter.onend = () => {
          setIsPlaying(false);
          setElapsedSeconds(totalEstimatedSeconds);
          if (timerRef.current) clearInterval(timerRef.current);
          toast({
            title: 'Audio Brief Complete',
            description: 'You finished this high-yield revision brief!',
          });
        };

        utter.onerror = () => {
          setIsPlaying(false);
          if (timerRef.current) clearInterval(timerRef.current);
        };

        utteranceRef.current = utter;
        window.speechSynthesis.speak(utter);
        setIsPlaying(true);
        startTimer();
      }
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (prev >= totalEstimatedSeconds) {
          clearInterval(timerRef.current);
          return totalEstimatedSeconds;
        }
        return prev + 1;
      });
    }, 1000 / speed);
  };

  const handleRestart = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    setElapsedSeconds(0);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (isPlaying) {
      // Restart with new rate
      handleRestart();
      setTimeout(handleTogglePlay, 100);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(brief.script);
    setCopied(true);
    toast({
      title: 'Script copied',
      description: 'Audio revision brief text copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(100, Math.round((elapsedSeconds / totalEstimatedSeconds) * 100));
  const masteryPct = brief.mastery_score !== undefined ? Math.round(brief.mastery_score * 100) : null;

  return (
    <Card className={`border shadow-lg overflow-hidden bg-gradient-to-b from-indigo-50/40 via-white to-white ${className}`}>
      {/* Header Bar */}
      <CardHeader className="p-5 pb-3 border-b bg-white/70 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs px-2.5 py-0.5">
              <Headphones className="w-3.5 h-3.5" />
              2-Min Spoken Audio Brief
            </Badge>
            {masteryPct !== null && masteryPct <= 45 && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-xs gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                Targeting Weak Area ({masteryPct}% Mastery)
              </Badge>
            )}
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-xs gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Source Grounded
            </Badge>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-gray-900 pt-1">
            {brief.title}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Topic: <span className="font-semibold text-gray-700">{brief.topic}</span>
            {brief.target_concept && ` • Focused on: ${brief.target_concept}`}
          </p>
        </div>

        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="self-start md:self-auto text-xs">
            Close
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* Modern Audio Player Deck */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-md relative overflow-hidden">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            {/* Waveform & Playback Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  onClick={handleTogglePlay}
                  className="w-12 h-12 rounded-full bg-white text-indigo-900 hover:bg-indigo-50 hover:scale-105 transition-transform shadow-lg cursor-pointer"
                  title={isPlaying ? 'Pause Audio Brief' : 'Play Audio Brief'}
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                </Button>
                <div>
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    {isPlaying ? 'Now Playing Spoken Brief' : 'Ready to Listen'}
                    {isPlaying && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                  </div>
                  <div className="text-xs text-indigo-200">
                    {formatTime(elapsedSeconds)} / {formatTime(totalEstimatedSeconds)} • High-Yield Audio
                  </div>
                </div>
              </div>

              {/* Animated Audio Equalizer Bars */}
              <div className="flex items-end gap-1 h-8 px-2">
                {[12, 24, 18, 28, 14, 26, 20, 16, 22].map((height, i) => (
                  <span
                    key={i}
                    style={{
                      height: isPlaying ? `${height}px` : '4px',
                      animationDuration: `${0.4 + (i % 3) * 0.2}s`,
                    }}
                    className={`w-1 rounded-full bg-indigo-300 transition-all ${
                      isPlaying ? 'animate-pulse' : 'opacity-40'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-indigo-950/60 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-400 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-indigo-300">
                <span>{progressPercent}% Complete</span>
                <span>{formatTime(totalEstimatedSeconds - elapsedSeconds)} left</span>
              </div>
            </div>

            {/* Player Controls (Speed, Restart, Voice) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-indigo-700/50">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-indigo-300 mr-1">Speed:</span>
                {[0.8, 1.0, 1.25, 1.5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSpeedChange(s)}
                    className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                      speed === s
                        ? 'bg-white text-indigo-900 font-bold'
                        : 'bg-indigo-800/60 text-indigo-200 hover:bg-indigo-700'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRestart}
                  className="h-7 text-xs text-indigo-200 hover:text-white hover:bg-indigo-800/50 gap-1 px-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restart
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyScript}
                  className="h-7 text-xs text-indigo-200 hover:text-white hover:bg-indigo-800/50 gap-1 px-2"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Script
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Key Revision Takeaways */}
        {brief.key_takeaways && brief.key_takeaways.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-600" />
              High-Yield Exam Takeaways
            </div>
            <ul className="space-y-1 text-sm text-amber-900">
              {brief.key_takeaways.map((takeaway, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{takeaway}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Spoken Audio Script */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-600" /> Spoken Narration Script
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              ~{brief.script.split(/\s+/).length} words
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200 text-sm text-gray-800 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-sans">
            {brief.script}
          </div>
        </div>

        {/* Verified Course Citations */}
        {brief.citations && brief.citations.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Source Material Grounding Coordinates
            </span>
            <div className="flex flex-wrap gap-2">
              {brief.citations.map((c, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-white border-indigo-200 text-indigo-800 text-xs py-1 px-2.5 gap-1.5 shadow-2xs"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-semibold">{c.label}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">({c.coordinate})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
