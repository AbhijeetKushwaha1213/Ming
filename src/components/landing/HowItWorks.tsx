import React from 'react';
import { UploadCloud, Cpu, RefreshCw, FileText, Check, ArrowRight } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Upload your syllabus or lecture slides',
      description:
        'Drop in PDF decks, PPT slides, or textbook chapter scans. StudyMate automatically organizes them by course code and topic unit.',
      badge: 'Input: PDF, PPTX, Doc',
      visual: (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <UploadCloud className="h-4 w-4 text-primary" />
              <span>Drag & Drop Slides</span>
            </span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Max 50MB</span>
          </div>
          <div className="rounded border border-dashed border-border bg-muted/30 p-3 text-center space-y-1">
            <FileText className="h-6 w-6 text-primary mx-auto" />
            <p className="text-foreground font-sans font-medium text-xs">
              CS304_Unit_4_Paging_VirtualMemory.pdf
            </p>
            <p className="text-[10px] text-muted-foreground">42 slides · 3.4 MB · Uploaded</p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>Course Tag:</span>
            <span className="font-semibold text-primary">CS304 · Operating Systems</span>
          </div>
        </div>
      ),
    },
    {
      step: '02',
      title: 'AI extracts key concepts and builds verified cards',
      description:
        'Instead of hallucinating answers, cards, MCQs, and summaries are strictly anchored to your exact slide numbers and textbook paragraphs.',
      badge: 'Zero Hallucination Anchor',
      visual: (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Cpu className="h-4 w-4 text-primary" />
              <span>Extraction Pipeline</span>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">18 Concepts</span>
          </div>
          <div className="space-y-2 font-sans">
            <div className="rounded border border-border bg-card p-2 text-xs space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">FIFO vs LRU Page Replacement</span>
                <span className="text-emerald-600 font-mono font-medium">Slide 14</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                "LRU uses recent past as approximation of future; does not exhibit Belady's anomaly..."
              </p>
            </div>
            <div className="rounded border border-border bg-card p-2 text-xs space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">Translation Lookaside Buffer (TLB)</span>
                <span className="text-emerald-600 font-mono font-medium">Slide 22</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                "Effective memory access time EAT = (1 + ε)α + (2 + ε)(1 - α)..."
              </p>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1 text-right justify-end">
            <Check className="h-3 w-3 text-emerald-600" />
            <span>Exact citations attached</span>
          </div>
        </div>
      ),
    },
    {
      step: '03',
      title: 'Revise with spaced repetition before your exams',
      description:
        'An algorithmic SM-2 schedule calculates optimal review dates. Revise tough topics frequently, and master easy ones without wasting study time.',
      badge: 'SM-2 Active Recall',
      visual: (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border pb-2 text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <RefreshCw className="h-4 w-4 text-primary" />
              <span>Daily Revision Queue</span>
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Due Today: 14</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center font-sans text-xs">
            <div className="p-2 rounded bg-muted/50 border border-border">
              <div className="text-[10px] text-muted-foreground uppercase font-medium">Mastered</div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">28</div>
            </div>
            <div className="p-2 rounded bg-muted/50 border border-border">
              <div className="text-[10px] text-muted-foreground uppercase font-medium">Due Now</div>
              <div className="text-base font-bold text-amber-600 dark:text-amber-400">14</div>
            </div>
            <div className="p-2 rounded bg-muted/50 border border-border">
              <div className="text-[10px] text-muted-foreground uppercase font-medium">Next In</div>
              <div className="text-base font-bold text-foreground">3 Days</div>
            </div>
          </div>
          <div className="rounded bg-primary/10 border border-primary/20 p-2 text-[11px] font-sans text-primary">
            ✓ Mid-term prep on track: 82% retention across Unit 1 to Unit 4.
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-16 lg:py-24 bg-background border-b border-border scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
            Simple 3-Step Workflow
          </h2>
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            From lecture slide to permanent retention.
          </h3>
          <p className="text-muted-foreground text-base">
            No copy-pasting prompts into generic chatbots. StudyMate handles the entire pipeline locally from your course files.
          </p>
        </div>

        {/* 3 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((item, idx) => (
            <div
              key={item.step}
              className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-6 hover:border-primary/40 transition-colors"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-black text-primary/40">
                    {item.step}
                  </span>
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {item.badge}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-foreground leading-snug">
                  {item.title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Product Visual Mockup */}
              <div className="pt-2">{item.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
