import React from 'react';
import {
  FileCheck,
  GraduationCap,
  GitFork,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export const Features: React.FC = () => {
  const features = [
    {
      id: 'citations',
      icon: FileCheck,
      badge: 'Grounded Accuracy',
      title: 'Every card cited to your professor’s exact slide',
      description:
        'University evaluators grade against standard course syllabi. StudyMate attaches the exact slide number, diagram reference, and quote to every generated answer so you can verify before writing exams.',
      uiSnippet: (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border pb-2">
            <span className="font-semibold text-foreground">Card Citation Inspector</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Match</span>
          </div>
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-900 dark:text-emerald-200 font-sans space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Grounded in Source: Slide 28, Unit 2</span>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground">
              "Dijkstra’s Banker's Algorithm requires 3 data structures: Available[m], Max[n][m], Allocation[n][m], and Need[n][m] where Need = Max - Allocation."
            </p>
          </div>
          <div className="text-[11px] text-muted-foreground flex justify-between items-center font-sans">
            <span>Evaluator match confidence:</span>
            <span className="font-mono text-foreground font-semibold">Strict Syllabus Aligned</span>
          </div>
        </div>
      ),
    },
    {
      id: 'formats',
      icon: GraduationCap,
      badge: 'Exam & GATE Formats',
      title: 'Built for 2-mark, 5-mark & technical placement questions',
      description:
        'Instead of generic paragraphs, StudyMate formats content into the exact structures Indian engineering papers require: concise definitions for 2-markers, comparison tables for 5-markers, and GATE-style numericals.',
      uiSnippet: (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border pb-2">
            <span className="font-semibold text-foreground">Question Format Preset</span>
            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">5-Mark Comparison</span>
          </div>
          <div className="space-y-1.5 font-sans">
            <p className="font-semibold text-foreground text-xs">
              Q: Differentiate Paging and Segmentation (5 Marks)
            </p>
            <div className="rounded border border-border bg-muted/40 p-2 text-[11px] space-y-1">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground font-mono">
                <div>• Paging: Fixed size blocks (Frames & Pages)</div>
                <div>• Segmentation: Variable size user logical units</div>
                <div>• Paging: No external fragmentation</div>
                <div>• Segmentation: External fragmentation possible</div>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground font-sans block">
            Generated following standard university answer schemes.
          </span>
        </div>
      ),
    },
    {
      id: 'dag',
      icon: GitFork,
      badge: 'Concept Dependency Graph',
      title: 'Prerequisite maps so you don’t study out of order',
      description:
        'Tackling Virtual Memory without understanding Page Tables or Hardware TLB leads to rote memorization that fails during placement interviews. StudyMate draws a prerequisite DAG showing what to master first.',
      uiSnippet: (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border pb-2">
            <span className="font-semibold text-foreground">Prerequisite Flow (DAG)</span>
            <span className="text-primary font-bold">4 Levels</span>
          </div>
          <div className="space-y-2 font-sans text-xs">
            <div className="flex items-center gap-2">
              <span className="h-6 px-2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 flex items-center font-mono text-[11px]">
                01. Logical Address
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="h-6 px-2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 flex items-center font-mono text-[11px]">
                02. Page Table
              </span>
            </div>
            <div className="flex items-center gap-2 pl-4">
              <span className="text-muted-foreground">↳</span>
              <span className="h-6 px-2 rounded bg-primary/20 text-primary border border-primary/30 flex items-center font-mono text-[11px] font-bold">
                03. TLB & Address Translation
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="h-6 px-2 rounded bg-muted text-muted-foreground border border-border flex items-center font-mono text-[11px]">
                04. Inverted Page Table
              </span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground font-sans pt-1">
            Topic 03 unlocked after mastering Logical Address & Page Table.
          </p>
        </div>
      ),
    },
    {
      id: 'sm2',
      icon: CalendarClock,
      badge: 'Spaced Repetition',
      title: 'SM-2 scheduling timed for semester internals & finals',
      description:
        'Instead of frantic all-nighters, StudyMate calculates when your memory of a formula or algorithm begins to decay, scheduling quick 5-minute active recall drills so knowledge sticks permanently.',
      uiSnippet: (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border pb-2">
            <span className="font-semibold text-foreground">Active Recall Decay Tracker</span>
            <span className="text-amber-600 font-bold">Recall Score: 86%</span>
          </div>
          <div className="space-y-2 font-sans text-xs">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Deadlock Detection:</span>
              <span className="font-mono text-emerald-600 font-medium">Due in 5 days</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full w-[78%]" />
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Paging TLB Formula:</span>
              <span className="font-mono text-amber-600 font-medium">Review Tomorrow (24h)</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full w-[45%]" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">
            Optimized to reach 90%+ retention by exam date.
          </p>
        </div>
      ),
    },
  ];

  return (
    <section
      id="features"
      className="py-16 lg:py-24 bg-background border-b border-border scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
            Engineered For Exam Performance
          </h2>
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Everything you need to master tough engineering syllabi.
          </h3>
          <p className="text-muted-foreground text-base">
            Engineered for real engineering coursework: no superficial summaries, no fabricated citations, and no generic answers.
          </p>
        </div>

        {/* 4 Features Grid (2x2) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.id}
                className="rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xs hover:border-primary/40 transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {f.badge}
                    </span>
                  </div>

                  <h4 className="text-xl font-bold text-foreground leading-snug">
                    {f.title}
                  </h4>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </p>
                </div>

                {/* UI Snippet */}
                <div className="pt-2">{f.uiSnippet}</div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
