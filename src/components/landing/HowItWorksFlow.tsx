import React, { useState } from 'react';
import {
  FileText,
  Brain,
  Network,
  Target,
  Calendar,
  Layers,
  Award,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export const HowItWorksFlow = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 'material',
      num: '01',
      title: 'Your Course Material',
      label: 'MATERIAL',
      desc: 'Upload course syllabus, lecture slides, textbooks, or notes. Ming parses every concept, formula, and diagram.',
      icon: FileText,
      preview: {
        badge: 'Multimodal Parsing',
        title: 'CS301_Operating_Systems.pdf',
        subtitle: '48 Pages · 14 Lectures · Silberschatz 10th Ed.',
        highlights: ['Syllabus parsed', '6 Units mapped', '142 Formulas extracted'],
      },
    },
    {
      id: 'understanding',
      num: '02',
      title: 'AI Understands Content',
      label: 'UNDERSTAND',
      desc: 'Neural parser builds an entity knowledge model, identifying dependencies and concepts without hallucinations.',
      icon: Brain,
      preview: {
        badge: 'Zero Hallucination Grounding',
        title: 'Extracted Conceptual Entities',
        subtitle: 'Tied strictly to textbook page numbers & slide references',
        highlights: ['Process Synchronization (99% match)', 'Banker Algorithm (97% match)', 'Virtual Paging (98% match)'],
      },
    },
    {
      id: 'dag',
      num: '03',
      title: 'Concept & Prerequisite Graph',
      label: 'KNOWLEDGE GRAPH',
      desc: 'Concepts connect in a directed acyclic graph (DAG). You never jump to advanced units without mastering prerequisites.',
      icon: Network,
      preview: {
        badge: 'Topological Prerequisite Order',
        title: 'Interactive Curriculum Graph',
        subtitle: 'Hardware Basics → Processes → Scheduling → Deadlocks',
        highlights: ['Prerequisites verified', 'No cognitive blind spots', 'Dynamic visual map'],
      },
    },
    {
      id: 'assessment',
      num: '04',
      title: 'Adaptive Assessment',
      label: 'ASSESSMENT',
      desc: 'Diagnostic quizzes adapt difficulty in real time. Answer correctly and challenge scales up; struggle and foundation reviews trigger.',
      icon: Target,
      preview: {
        badge: 'Dynamic PID Calibration',
        title: 'Live Calibrated Quiz',
        subtitle: 'Difficulty adjusts automatically with each student answer',
        highlights: ['Accuracy: 82%', 'Difficulty: Level 4 Adaptive', 'Weak concepts flagged'],
      },
    },
    {
      id: 'path',
      num: '05',
      title: 'Personalized Learning Path',
      label: 'DAILY PLAN',
      desc: 'Ming schedules time-blocked sessions around your classes, exams, and circadian peak focus hours.',
      icon: Calendar,
      preview: {
        badge: 'Circadian Study Scheduling',
        title: "Today's Dynamic Timeline",
        subtitle: '09:00 Deep Work · 10:00 Flashcards · 18:00 Practice',
        highlights: ['Auto-balances when done early', '25-min micro-slots', 'Zero cramming'],
      },
    },
    {
      id: 'materials',
      num: '06',
      title: 'AI-Generated Study Material',
      label: 'STUDY ASSETS',
      desc: 'Instantly generate 7 interconnected formats: smart notes, flashcards, mind maps, mock quizzes, and cheat sheets.',
      icon: Layers,
      preview: {
        badge: '1.4s Generation Speed',
        title: 'Multi-Format Study Package',
        subtitle: 'Exportable to Anki, PDF, or Notion with verified citations',
        highlights: ['48 SM-2 Flashcards', '12-Page Smart Notes', '20 Calibrated MCQs'],
      },
    },
    {
      id: 'mastery',
      num: '07',
      title: 'Revision & Mastery',
      label: 'MASTERY',
      desc: 'SM-2 spaced repetition schedules micro-reviews at the exact moment of memory decay, locking concepts in long-term storage.',
      icon: Award,
      preview: {
        badge: 'Algorithmic Retention',
        title: '100% Exam Readiness',
        subtitle: 'Reviews prompt at 48h, 7d, and 30d optimal intervals',
        highlights: ['Concept Mastery: 92%', 'Forgetting curve interrupted', 'Permanent recall'],
      },
    },
  ];

  const current = steps[activeStep];
  const Icon = current.icon;

  return (
    <section
      id="how-it-works"
      className="py-20 lg:py-28 px-5 sm:px-8 bg-white dark:bg-background border-b border-[#DDE7E1] dark:border-border scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-[1240px] mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] dark:bg-emerald-950/40 border border-[#20B486]/20 text-[#063B2A] dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#20B486]" />
            <span>The Product Workflow</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#10231C] dark:text-foreground tracking-tight leading-[1.15] mb-4">
            From your syllabus to a{' '}
            <span className="text-[#20B486]">smarter learning path.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#66736D] dark:text-muted-foreground max-w-2xl mx-auto leading-[1.65]">
            A continuous, intelligent system that converts unstructured academic resources into predictable exam mastery.
          </p>
        </div>

        {/* Horizontal Process Steps Ribbon */}
        <div className="hidden lg:flex items-center justify-between mb-12 p-2.5 bg-[#F7FAF7] dark:bg-card/80 border border-[#DDE7E1] dark:border-border rounded-[20px] shadow-xs">
          {steps.map((stg, i) => {
            const isSelected = activeStep === i;
            return (
              <React.Fragment key={stg.id}>
                <button
                  onClick={() => setActiveStep(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#063B2A] dark:bg-primary text-white shadow-xs'
                      : 'text-[#66736D] dark:text-muted-foreground hover:text-[#10231C] dark:hover:text-foreground hover:bg-white dark:hover:bg-muted'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-mono font-bold ${
                      isSelected ? 'bg-[#20B486] text-white' : 'bg-[#DDE7E1] dark:bg-muted text-[#10231C] dark:text-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span>{stg.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-[#DDE7E1] dark:text-muted-foreground/40 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* 2-Column Product Story View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left: Step Selector List */}
          <div className="lg:col-span-5 space-y-3">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isSelected = activeStep === idx;
              return (
                <div
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  className={`p-4 rounded-[20px] border transition-all cursor-pointer flex items-start gap-4 ${
                    isSelected
                      ? 'bg-[#F7FAF7] dark:bg-card border-2 border-[#20B486] shadow-soft -translate-y-0.5'
                      : 'bg-white dark:bg-card/50 border-[#DDE7E1] dark:border-border hover:border-[#20B486]/40'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#20B486] text-white'
                        : 'bg-[#DDF7EC] dark:bg-emerald-950/50 text-[#063B2A] dark:text-emerald-300'
                    }`}
                  >
                    <StepIcon className="w-5 h-5" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#20B486] uppercase">
                        Stage {step.num}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DDF7EC] dark:bg-emerald-950/60 text-[#063B2A] dark:text-emerald-300">
                          Active Preview
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-base sm:text-lg text-[#10231C] dark:text-foreground mt-0.5">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#66736D] dark:text-muted-foreground mt-1 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Stage Visual Illustration Card */}
          <div className="lg:col-span-7">
            <div className="bg-[#F7FAF7] dark:bg-card/90 rounded-[24px] border border-[#DDE7E1] dark:border-border shadow-soft p-6 sm:p-8 min-h-[440px] flex flex-col justify-between">
              
              <div className="space-y-6">
                {/* Header of Active Stage Preview */}
                <div className="flex items-center justify-between pb-4 border-b border-[#DDE7E1] dark:border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#063B2A] dark:bg-primary text-white flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#20B486] dark:text-white" />
                    </div>
                    <div>
                      <div className="font-mono text-xs font-bold text-[#20B486] uppercase">
                        Stage {current.num} Preview
                      </div>
                      <div className="font-extrabold text-base text-[#10231C] dark:text-foreground">
                        {current.title}
                      </div>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-white dark:bg-card border border-[#DDE7E1] dark:border-border text-xs font-bold text-[#063B2A] dark:text-emerald-300">
                    {current.preview.badge}
                  </span>
                </div>

                {/* Main Visual Box for the Current Stage */}
                <div className="p-6 rounded-[20px] bg-white dark:bg-card border border-[#DDE7E1] dark:border-border shadow-xs space-y-4">
                  <div>
                    <h4 className="font-extrabold text-lg text-[#10231C] dark:text-foreground">
                      {current.preview.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-[#66736D] dark:text-muted-foreground mt-1">
                      {current.preview.subtitle}
                    </p>
                  </div>

                  {/* Highlights checklist */}
                  <div className="space-y-2.5 pt-2">
                    {current.preview.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-[#10231C] dark:text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-[#20B486] shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Nav Buttons for Stage */}
              <div className="pt-4 border-t border-[#DDE7E1] dark:border-border flex items-center justify-between text-xs text-[#66736D] dark:text-muted-foreground">
                <span>Stage {activeStep + 1} of {steps.length}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-card border border-[#DDE7E1] dark:border-border font-bold text-[#10231C] dark:text-foreground hover:bg-[#DDF7EC] dark:hover:bg-muted transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setActiveStep((prev) => (prev + 1) % steps.length)}
                    className="px-4 py-1.5 rounded-xl bg-[#20B486] text-white font-bold hover:bg-[#1aa378] transition-colors"
                  >
                    Next Stage →
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
