import React, { useState } from 'react';
import {
  Clock,
  TrendingUp,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Brain,
  ShieldCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

export const SpacedRepetitionSection = () => {
  const [activeInterval, setActiveInterval] = useState<'learn' | '48h' | '7d' | '30d'>('48h');

  const intervals = [
    {
      id: 'learn',
      stage: 'Learn',
      time: 'Day 0',
      label: 'Initial Encoding',
      retentionWithout: 100,
      retentionWith: 100,
      detail: 'Concept first ingested from course slides. Full short-term working memory activation.',
      action: '25 min deep lecture session',
    },
    {
      id: '48h',
      stage: 'Review',
      time: '48 Hours',
      label: 'First Recall Micro-Burst',
      retentionWithout: 42,
      retentionWith: 94,
      detail: 'Ming prompts an active 6-card recall quiz right before exponential memory decay sets in.',
      action: '4 min quick flashcard recall',
    },
    {
      id: '7d',
      stage: 'Recall',
      time: '7 Days',
      label: 'Synaptic Consolidation',
      retentionWithout: 24,
      retentionWith: 92,
      detail: 'Interval doubles as neural pathways stabilize. Questions test higher-order variations.',
      action: '3 adaptive scenario problems',
    },
    {
      id: '30d',
      stage: 'Master',
      time: '30 Days',
      label: 'Long-Term Storage',
      retentionWithout: 14,
      retentionWith: 95,
      detail: 'Permanent exam-ready recall established. Concept locked in long-term memory vault.',
      action: 'Final diagnostic verification',
    },
  ];

  const current = intervals.find((i) => i.id === activeInterval) || intervals[1];

  return (
    <section
      id="spaced-repetition"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[#f6fbf3] dark:bg-background border-b border-[#dfe4dd]/60 dark:border-border/60 scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#e8f3ed] dark:bg-emerald-950/40 border border-[#165034]/20 dark:border-emerald-800/30 text-[#165034] dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Clock className="w-3.5 h-3.5" />
            <span>Algorithmic Memory Retention</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#002313] dark:text-foreground tracking-tight mb-3">
            Review at the <span className="italic font-serif text-[#165034] dark:text-emerald-400">right moment.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#2d4a3e] dark:text-muted-foreground">
            Interrupt the forgetting curve with mathematically spaced micro-reviews. Learn once, retain forever.
          </p>
        </div>

        {/* Timeline Stepper from Prompt: Learn -> Review (48h) -> Recall (7d) -> Master (30d) */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="grid grid-cols-4 gap-2 sm:gap-4 relative">
            {intervals.map((item, idx) => {
              const isSelected = activeInterval === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveInterval(item.id as any)}
                  className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-card border-2 border-[#165034] dark:border-emerald-500 shadow-md -translate-y-0.5'
                      : 'bg-white/60 dark:bg-card/50 border-[#dfe4dd] dark:border-border hover:bg-white dark:hover:bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
                    <span className="text-[#165034] dark:text-emerald-400">Step 0{idx + 1}</span>
                    <span className="text-[#52796f] dark:text-muted-foreground">{item.time}</span>
                  </div>
                  <div className="font-serif font-bold text-sm sm:text-base text-[#002313] dark:text-foreground mt-1">
                    {item.stage}
                  </div>
                  <div className="text-[11px] text-[#52796f] dark:text-muted-foreground truncate mt-0.5">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Retention Comparison Box */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-card/90 rounded-2xl border border-[#dfe4dd] dark:border-border shadow-premium p-6 sm:p-8 space-y-8">
          
          {/* Header of Active Interval */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#dfe4dd] dark:border-border">
            <div>
              <span className="text-xs font-mono font-bold text-[#165034] dark:text-emerald-400 uppercase">
                Active Cycle: {current.stage} · {current.time}
              </span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#002313] dark:text-foreground mt-0.5">
                {current.label}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-[#e8f3ed] dark:bg-emerald-950/40 text-[#165034] dark:text-emerald-300 text-xs font-bold font-mono">
                Ming Retention: {current.retentionWith}%
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs font-mono line-through">
                Traditional: {current.retentionWithout}%
              </div>
            </div>
          </div>

          {/* Graphical Comparison Bar Visual */}
          <div className="space-y-4">
            {/* With Ming */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-[#165034] dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  With Ming (Spaced Micro-Reviews)
                </span>
                <span className="font-mono font-bold text-[#165034] dark:text-emerald-400">{current.retentionWith}% Memory Retention</span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-[#dfe4dd] dark:bg-muted overflow-hidden">
                <div
                  className="h-full bg-[#165034] dark:bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${current.retentionWith}%` }}
                />
              </div>
            </div>

            {/* Without Spaced Repetition */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-700 dark:text-red-400 font-medium">
                  Without Spaced Repetition (Ebbinghaus Decay)
                </span>
                <span className="font-mono text-red-700 dark:text-red-400 font-semibold">{current.retentionWithout}% Retained</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#dfe4dd] dark:bg-muted overflow-hidden">
                <div
                  className="h-full bg-red-400 rounded-full transition-all duration-700"
                  style={{ width: `${current.retentionWithout}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Callout */}
          <div className="p-4 rounded-xl bg-[#f6fbf3] dark:bg-muted/40 border border-[#dfe4dd] dark:border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <div className="font-bold text-[#002313] dark:text-foreground">{current.detail}</div>
              <div className="text-[#52796f] dark:text-muted-foreground mt-0.5">Recommended Micro-Action: <strong>{current.action}</strong></div>
            </div>
            <button
              onClick={() => {
                const nextIdx = (intervals.findIndex((i) => i.id === activeInterval) + 1) % intervals.length;
                setActiveInterval(intervals[nextIdx].id as any);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#002313] dark:bg-emerald-700 text-white font-semibold hover:bg-[#165034] dark:hover:bg-emerald-600 transition-colors shrink-0"
            >
              <span>Next Timeline Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </section>
  );
};
