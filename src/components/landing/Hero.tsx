import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  GitBranch,
  FileText,
  BookOpen,
  ShieldCheck,
  Code2,
  Layers,
  CalendarClock,
  Play,
  RotateCcw,
} from 'lucide-react';

export const Hero = () => {
  const navigate = useNavigate();
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);

  return (
    <>
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f8fafc]/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <img
              src="/assets/studymate-logo.png"
              alt="StudyMate AI Logo"
              className="h-9 w-9 rounded-lg object-cover shadow-sm group-hover:scale-105 transition-transform"
            />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg tracking-tight text-slate-900">
                StudyMate AI
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                Free Student Beta
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#showcase"
              className="hover:text-emerald-700 transition-colors"
            >
              Product Tour
            </a>
            <a
              href="#features"
              className="hover:text-emerald-700 transition-colors"
            >
              Core Features
            </a>
            <a
              href="#impact"
              className="hover:text-emerald-700 transition-colors"
            >
              How It Works
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/auth')}
              className="hidden sm:inline-flex text-slate-700 hover:text-slate-900 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 transition-all shadow-sm gap-1.5 active:scale-98"
            >
              <span>Start Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <section
        id="hero"
        className="relative w-full overflow-hidden bg-gradient-to-b from-[#f8fafc] via-white to-[#f0fdf4]/30 pt-28 pb-16 lg:pt-36 lg:pb-20 border-b border-slate-200/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">

            {/* Left Content Column */}
            <div className="lg:col-span-6 flex flex-col items-start space-y-6">
              {/* Honest Audience Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold tracking-wide">
                <Code2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>BUILT FOR B.TECH & ENGINEERING STUDENTS</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-bold text-slate-900 tracking-tight leading-[1.12]">
                Turn heavy lecture slides into{' '}
                <span className="text-emerald-700 underline decoration-emerald-300 decoration-wavy underline-offset-4">
                  verified revision cards & quizzes
                </span>
                .
              </h1>

              {/* Honest, Clear Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
                Upload your semester PPTs, syllabus PDFs, and textbook chapters. StudyMate builds interactive concept dependency graphs, generates active-recall flashcards with exact slide citations, and auto-schedules spaced reviews.
              </p>

              {/* Real Value Pillars (No Buzzwords) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl pt-1">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <FileText className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Exact Citations</div>
                    <div className="text-[11px] text-slate-500">Every card cites the slide & page #</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <GitBranch className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Concept DAGs</div>
                    <div className="text-[11px] text-slate-500">Prerequisite learning paths</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <CalendarClock className="w-4 h-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900">SM-2 Spaced Recall</div>
                    <div className="text-[11px] text-slate-500">Exam-ready retention schedules</div>
                  </div>
                </div>
              </div>

              {/* Primary Call to Action */}
              <div className="flex flex-wrap items-center gap-3 pt-2 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/auth')}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-all shadow-md hover:shadow-lg active:scale-98"
                >
                  <span>Start Studying Free</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#showcase"
                  className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-lg bg-white text-slate-700 border border-slate-300 font-medium hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Play className="w-4 h-4 text-emerald-700 fill-emerald-100" />
                  <span>See Interactive Tour</span>
                </a>
              </div>

              {/* Honest Micro-Proof */}
              <div className="flex flex-wrap items-center gap-4 text-slate-500 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Free during beta</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>No credit card required</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Local-first vault</span>
                </div>
              </div>
            </div>

            {/* Right Column: Genuine Product Mockup */}
            <div className="lg:col-span-6 mt-4 lg:mt-0">
              <div className="rounded-2xl border border-slate-300 shadow-2xl bg-white overflow-hidden ring-1 ring-slate-900/5">

                {/* Simulated App Window Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/90 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-xs font-medium text-slate-600 font-mono">
                      studymate.ai/workspace/operating-systems
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Active Study Session
                  </span>
                </div>

                {/* Product Workspace Body */}
                <div className="p-5 sm:p-6 bg-slate-50/60 space-y-4">

                  {/* Course & Module Context */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        Semester 5 · Core CS
                      </div>
                      <div className="text-base font-bold text-slate-900">
                        Operating Systems · Unit 3: Deadlocks
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 font-medium">Concept Mastery</div>
                      <div className="text-sm font-bold text-emerald-700">8 / 10 Mastered (80%)</div>
                    </div>
                  </div>

                  {/* Mini Prerequisite DAG Breadcrumb Bar */}
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <GitBranch className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="text-slate-400">Prerequisites:</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">Process Sync</span>
                      <span className="text-slate-400">→</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">Semaphores</span>
                      <span className="text-slate-400">→</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px]">Deadlock Conditions</span>
                    </div>
                    <span className="hidden sm:inline text-[11px] text-emerald-700 font-medium">DAG Level 3</span>
                  </div>

                  {/* The Active Recall Card */}
                  <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <BookOpen className="w-3.5 h-3.5" />
                        Flashcard · Active Recall Mode
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Silberschatz OS §8.5 · Slide 24
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Question</div>
                      <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                        "What 4 conditions must hold simultaneously for a system deadlock to occur?"
                      </p>
                    </div>

                    {showExplanation && (
                      <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-100 text-xs text-slate-700 space-y-1.5 animate-in fade-in duration-200">
                        <div className="font-semibold text-emerald-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Coffman Conditions (Exam Key Points):</span>
                        </div>
                        <ol className="list-decimal pl-4 space-y-0.5 text-slate-700 font-medium">
                          <li><strong className="text-slate-900">Mutual Exclusion:</strong> At least one resource held non-shareably.</li>
                          <li><strong className="text-slate-900">Hold and Wait:</strong> Process holds 1 resource while requesting others.</li>
                          <li><strong className="text-slate-900">No Preemption:</strong> Resources can only be released voluntarily.</li>
                          <li><strong className="text-slate-900">Circular Wait:</strong> P0 waits for P1, P1 for P2... Pn for P0.</li>
                        </ol>
                      </div>
                    )}

                    {/* Interactive SM-2 Interval Selector */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          How well did you recall this?
                        </span>
                        {selectedRating && (
                          <span className="text-[11px] text-emerald-700 font-semibold">
                            Scheduled for next revision!
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                        {[
                          { key: 'again', label: 'Again', time: '< 10m', color: 'hover:border-rose-300 hover:bg-rose-50 text-rose-700' },
                          { key: 'hard', label: 'Hard', time: '1 day', color: 'hover:border-amber-300 hover:bg-amber-50 text-amber-700' },
                          { key: 'good', label: 'Good', time: '3 days', color: 'hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700' },
                          { key: 'easy', label: 'Easy', time: '6 days', color: 'hover:border-blue-300 hover:bg-blue-50 text-blue-700' },
                        ].map((btn) => (
                          <button
                            key={btn.key}
                            onClick={() => setSelectedRating(btn.key)}
                            className={`p-1.5 sm:p-2 rounded-lg border text-center transition-all ${
                              selectedRating === btn.key
                                ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                                : `border-slate-200 bg-white ${btn.color}`
                            }`}
                          >
                            <div className="text-[11px] font-bold leading-tight">{btn.label}</div>
                            <div className={`text-[10px] ${selectedRating === btn.key ? 'text-emerald-100' : 'text-slate-400'}`}>
                              {btn.time}
                            </div>
                          </button>
                        ))}
                      </div>

                      {selectedRating && (
                        <div className="mt-2.5 text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200/80 flex items-center justify-between">
                          <span>SM-2 matrix updated. Next review interval saved in your vault.</span>
                          <button
                            onClick={() => setSelectedRating(null)}
                            className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-[10px]"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Lecture Source</div>
                      <div className="font-semibold text-slate-900 mt-0.5">Slides (Unit 3).pdf</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Cards in Deck</div>
                      <div className="font-semibold text-emerald-700 mt-0.5">32 Flashcards</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <div className="text-[10px] text-slate-500 font-medium uppercase">Spaced Schedule</div>
                      <div className="font-semibold text-slate-900 mt-0.5">SM-2 Algorithm</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Genuine Value Ribbon (Replaces fake 120,000+ metrics) */}
      <section id="impact" className="w-full bg-white py-10 border-b border-slate-200 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center flex-shrink-0 text-emerald-700">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">100% Slide-Grounded</div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Every card and quiz answer is linked directly to your uploaded slide page and textbook reference.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center flex-shrink-0 text-emerald-700">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Prerequisite DAGs</div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Visual concept trees ensure you never get stuck on complex topics without mastering basics first.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center flex-shrink-0 text-emerald-700">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">SM-2 Spaced Recall</div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Proven spaced repetition calculates your optimal review day so you retain material until semester exams.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center flex-shrink-0 text-emerald-700">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Built for Core CS & IT</div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Tailored for engineering subjects: DSA, Operating Systems, DBMS, Computer Networks, and GATE prep.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
};
