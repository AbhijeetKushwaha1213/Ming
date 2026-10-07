import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Layers,
  HelpCircle,
  BookOpen,
  Network,
  FileSpreadsheet,
  ArrowRight,
  Zap,
  CheckCircle2
} from 'lucide-react';

export const AIMaterialGeneratorSection = () => {
  const formats = [
    {
      id: 'flashcards',
      name: 'Flashcards',
      count: '48 Cards',
      icon: Layers,
      previewTitle: 'Dijkstra Banker Safety Criterion',
      previewContent: 'Q: How does the Banker Algorithm determine whether a state is safe?\nA: By verifying the existence of a sequence <P1, P2... Pn> such that each process can complete with currently available + held resources.',
      badge: 'SM-2 Active Recall',
    },
    {
      id: 'quiz',
      name: 'Quiz',
      count: '20 MCQs',
      icon: HelpCircle,
      previewTitle: 'Adaptive Diagnostic Set #2',
      previewContent: 'Q: Which scheduling algorithm minimizes average waiting time for a given set of processes?\n✓ Shortest Job First (SJF) — Provably optimal for non-preemptive batches.',
      badge: 'Calibrated MCQ',
    },
    {
      id: 'summary',
      name: 'Summary',
      count: '4-Page Brief',
      icon: BookOpen,
      previewTitle: 'Executive Unit Brief: Concurrency Primitives',
      previewContent: 'Key Takeaways: 1. Deadlock requires 4 simultaneous Coffman conditions. 2. Prevention eliminates at least 1 condition. 3. Avoidance dynamically checks resource graphs.',
      badge: 'High-Yield Synthesis',
    },
    {
      id: 'mindmap',
      name: 'Mind Map',
      count: 'Visual Hierarchy',
      icon: Network,
      previewTitle: 'Process Management Taxonomy',
      previewContent: 'Processes ──┬── States (New, Ready, Running, Waiting, Terminated)\n          ├── PCB (PID, Program Counter, CPU Registers)\n          └── Scheduling (Preemptive vs Non-Preemptive)',
      badge: 'Topological Tree',
    },
    {
      id: 'revision',
      name: 'Revision Sheet',
      count: 'Cheat Sheet',
      icon: FileSpreadsheet,
      previewTitle: 'Formula & Axiom Cheat Sheet',
      previewContent: 'Turnaround Time = Completion - Arrival | Waiting Time = Turnaround - Burst | Normalized CPU Utilization = Busy / (Busy + Idle)',
      badge: 'Formula Index',
    },
  ];

  const [selectedFormat, setSelectedFormat] = useState(formats[0]);

  return (
    <section
      id="materials"
      className="py-20 lg:py-28 px-5 sm:px-8 bg-[#F7FAF7] dark:bg-background border-b border-[#DDE7E1] dark:border-border scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-[1240px] mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] dark:bg-emerald-950/40 border border-[#20B486]/20 dark:border-emerald-800/30 text-[#063B2A] dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5 text-[#20B486] dark:text-emerald-400" />
            <span>Multi-Modal Transformation</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#10231C] dark:text-foreground tracking-tight leading-[1.15] mb-4">
            One course.{' '}
            <span className="text-[#20B486] dark:text-emerald-400">Every format you need.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#66736D] dark:text-muted-foreground max-w-2xl mx-auto leading-[1.65]">
            Upload your syllabus or lecture slides once. StudyMate structures raw documents into interconnected, high-yield study resources.
          </p>
        </div>

        {/* Source on Left -> Transformation Pipeline -> Formats on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Source Document Card (Left) */}
          <div className="lg:col-span-5">
            <div className="rounded-[24px] bg-white dark:bg-card/90 border border-[#DDE7E1] dark:border-border shadow-soft p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#DDE7E1] dark:border-border">
                <span className="text-xs font-mono font-bold text-[#66736D] dark:text-muted-foreground uppercase">
                  Input Source Document
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#DDF7EC] dark:bg-emerald-950/50 text-[#063B2A] dark:text-emerald-300 text-[11px] font-bold border border-transparent dark:border-emerald-800/30">
                  OCR Ready
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#F7FAF7] dark:bg-muted/40 border border-[#DDE7E1] dark:border-border flex items-center gap-4">
                <div className="w-12 h-14 rounded-xl bg-white dark:bg-card border border-[#DDE7E1] dark:border-border flex flex-col items-center justify-center shadow-xs shrink-0">
                  <FileText className="w-6 h-6 text-[#20B486] dark:text-emerald-400" />
                  <span className="text-[8px] font-mono font-bold text-red-600 dark:text-red-400">PDF</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-[#10231C] dark:text-foreground">
                    Lecture 3 — Operating Systems.pdf
                  </h4>
                  <p className="text-xs text-[#66736D] dark:text-muted-foreground mt-0.5">
                    42 Pages · Silberschatz Chapter 7: Deadlocks
                  </p>
                </div>
              </div>

              {/* Extraction checklist */}
              <div className="space-y-2 text-xs font-semibold text-[#10231C] dark:text-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#20B486] dark:text-emerald-400" />
                  <span>14 Prerequisite theorems parsed</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#20B486] dark:text-emerald-400" />
                  <span>24 Practice exam problems detected</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#20B486] dark:text-emerald-400" />
                  <span>Citations mapped to syllabus schedule</span>
                </div>
              </div>

              {/* Transformation Indicator */}
              <div className="p-3.5 rounded-xl bg-[#DDF7EC] dark:bg-emerald-950/40 text-xs font-bold text-[#063B2A] dark:text-emerald-300 flex items-center justify-between border border-transparent dark:border-emerald-800/30">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#20B486] dark:text-emerald-400" />
                  <span>Material → AI → Learning Resources</span>
                </span>
                <span className="font-mono text-[#20B486] dark:text-emerald-400">1.2s</span>
              </div>
            </div>
          </div>

          {/* Right: Output Formats Selector & Interactive Preview */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Format Buttons Bar */}
            <div className="flex flex-wrap gap-2">
              {formats.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = selectedFormat.id === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-[#20B486] dark:bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-card text-[#66736D] dark:text-muted-foreground border border-[#DDE7E1] dark:border-border hover:text-[#10231C] dark:hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{fmt.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Format Preview Card */}
            <div className="rounded-[24px] bg-white dark:bg-card/90 border border-[#DDE7E1] dark:border-border shadow-soft p-6 sm:p-7 space-y-4 min-h-[300px] flex flex-col justify-between">
              
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DDE7E1] dark:border-border">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#DDF7EC] dark:bg-emerald-950/50 text-[#063B2A] dark:text-emerald-300 text-xs font-bold border border-transparent dark:border-emerald-800/30">
                      {selectedFormat.badge}
                    </span>
                    <span className="text-xs text-[#66736D] dark:text-muted-foreground">·</span>
                    <span className="text-xs font-mono text-[#66736D] dark:text-muted-foreground">{selectedFormat.count}</span>
                  </div>
                  <span className="text-xs font-bold text-[#20B486] dark:text-emerald-400">Verified Citation: §7.4</span>
                </div>

                <div className="mt-4">
                  <h4 className="font-extrabold text-lg text-[#10231C] dark:text-foreground">
                    {selectedFormat.previewTitle}
                  </h4>

                  <pre className="mt-3 p-4 rounded-xl bg-[#F7FAF7] dark:bg-muted/40 border border-[#DDE7E1] dark:border-border font-sans text-xs sm:text-sm text-[#10231C] dark:text-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedFormat.previewContent}
                  </pre>
                </div>
              </div>

              <div className="pt-3 border-t border-[#DDE7E1] dark:border-border flex items-center justify-between text-xs text-[#66736D] dark:text-muted-foreground">
                <span>Generated automatically from your course syllabus in seconds.</span>
                <span className="text-[#20B486] dark:text-emerald-400 font-bold flex items-center gap-1">
                  Ready to Study <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
