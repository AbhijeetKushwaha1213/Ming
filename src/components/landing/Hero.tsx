import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  RotateCw,
  CheckCircle2,
  Calendar,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Layers,
  HelpCircle,
} from 'lucide-react';

export const Hero: React.FC = () => {
  const navigate = useNavigate();
  const [flipped, setFlipped] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<'1d' | '3d' | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden bg-background pt-12 pb-16 lg:pt-20 lg:pb-24 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Outcome Headline & Subhead */}
          <div className="lg:col-span-6 space-y-6">
            {/* Context Pill */}
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Built for Engineering Students in India
            </div>

            {/* Headline */}
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-[1.12]">
              Turn 80-slide lecture decks into exam-ready revision packs in 30 seconds.
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Upload your semester PDFs and syllabi to get verified flashcards, practice quizzes, and an active recall revision plan grounded in your own course material.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
              >
                <span>Upload Slides — It's Free</span>
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>

              <a
                href="#interactive-sample"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-3.5 text-base font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>See a Sample</span>
              </a>
            </div>

            {/* Micro Assurances (No buzzwords, factual) */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Private local vault</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Grounded with slide citations</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Free during academic beta</span>
              </div>
            </div>
          </div>

          {/* Right Column: Faithful Product UI Mockup */}
          <div className="lg:col-span-6">
            <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              
              {/* Window Title Bar */}
              <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono font-medium text-foreground">
                    CS304_Unit4_Virtual_Memory.pdf
                  </span>
                </div>
                <span className="hidden sm:inline-block font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  42 slides · 18 cards generated
                </span>
              </div>

              {/* Sub-header Tabs */}
              <div className="flex items-center gap-4 border-b border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
                <button
                  type="button"
                  className="border-b-2 border-primary pb-1 font-semibold text-primary"
                >
                  Flashcards (18)
                </button>
                <button
                  type="button"
                  className="pb-1 hover:text-foreground transition-colors"
                >
                  Practice Quiz (10)
                </button>
                <button
                  type="button"
                  className="pb-1 hover:text-foreground transition-colors"
                >
                  Prerequisite Map
                </button>
              </div>

              {/* Main Mockup Body: Interactive Card Display */}
              <div className="p-5 sm:p-6 space-y-4 bg-muted/20">
                {/* Active Card Container */}
                <div
                  className="relative rounded-lg border border-border bg-background p-5 shadow-xs transition-all"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-border text-xs">
                    <span className="font-semibold text-primary">Card 3 of 18 · Page Replacement</span>
                    <span className="font-mono text-muted-foreground">SM-2 Interval: 2 days</span>
                  </div>

                  {/* Card Content (Flip state toggle) */}
                  <div className="py-4 min-h-[140px] flex flex-col justify-between">
                    {!flipped ? (
                      <div className="space-y-2">
                        <span className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">
                          Prompt / Question
                        </span>
                        <p className="text-sm sm:text-base font-medium text-foreground leading-snug">
                          What is <strong className="text-primary">Belady’s Anomaly</strong> in FIFO page replacement, and under what condition does it occur?
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                          Answer / Definition
                        </span>
                        <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                          Belady’s Anomaly is the phenomenon where allocating <em>more page frames</em> results in an <em>increase</em> in page faults for FIFO page replacement (e.g. reference string 1,2,3,4,1,2,5,1,2,3,4,5 has 9 faults with 3 frames, but 10 faults with 4 frames).
                        </p>
                      </div>
                    )}

                    {/* Grounded Citation */}
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-dashed border-border text-[11px]">
                      <span className="font-mono text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Source: Slide 14 · "Belady’s Anomaly Demonstration"</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setFlipped(!flipped)}
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <RotateCw className="h-3 w-3" />
                        <span>{flipped ? 'Show Prompt' : 'Reveal Answer'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Review Actions */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Rate your recall:</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedInterval('1d')}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                          selectedInterval === '1d'
                            ? 'bg-amber-600 text-white'
                            : 'bg-muted hover:bg-muted/80 text-foreground'
                        }`}
                      >
                        Review Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInterval('3d')}
                        className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                          selectedInterval === '3d'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        Mastered (+3d)
                      </button>
                    </div>
                  </div>

                  {selectedInterval && (
                    <div className="mt-2.5 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Next review scheduled in {selectedInterval === '1d' ? '24 hours' : '3 days'}. Spaced-repetition queue updated.</span>
                    </div>
                  )}
                </div>

                {/* Attached Quiz Snippet */}
                <div className="rounded-lg border border-border bg-background p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-primary" />
                      <span>End-Sem MCQ Preview</span>
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">Gate / University 2-Mark</span>
                  </div>
                  <p className="text-muted-foreground">
                    Which of the following algorithms NEVER suffers from Belady’s Anomaly?
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                    {[
                      { id: 'a', text: 'A) FIFO', correct: false },
                      { id: 'b', text: 'B) LRU (Stack Algo)', correct: true },
                      { id: 'c', text: 'C) Second Chance', correct: false },
                      { id: 'd', text: 'D) Random', correct: false },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setQuizAnswer(opt.id)}
                        className={`p-2 rounded border text-left transition-colors ${
                          quizAnswer === opt.id
                            ? opt.correct
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-bold'
                              : 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-300'
                            : 'border-border bg-card hover:bg-muted text-foreground'
                        }`}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                  {quizAnswer === 'b' && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-sans pt-1">
                      ✓ Correct: LRU is a stack algorithm, so the set of pages in memory for n frames is always a subset of n+1 frames.
                    </p>
                  )}
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
