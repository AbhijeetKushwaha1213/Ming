import React from 'react';
import {
  FileText,
  Brain,
  Network,
  Layers,
  Target,
  Calendar,
  Zap,
  Award,
  Sparkles,
  ArrowDown
} from 'lucide-react';

export const EcosystemPipeline = () => {
  return (
    <section
      id="architecture"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-[#f6fbf3] border-b border-[#dfe4dd]/60 scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#e8f3ed] border border-[#165034]/20 text-[#165034] text-xs font-bold uppercase tracking-wider mb-4">
            <Network className="w-3.5 h-3.5" />
            <span>End-to-End System Architecture</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#002313] tracking-tight mb-3">
            Resource <span className="text-[#a3b899]">→</span> Intelligence <span className="text-[#a3b899]">→</span>{' '}
            <span className="italic font-serif text-[#165034]">Learning.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#2d4a3e]">
            The complete StudyMate ecosystem in one visual. Scattered study inputs convert into structured mastery.
          </p>
        </div>

        {/* Master Ecosystem Architecture Diagram */}
        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-[#dfe4dd] shadow-premium p-6 sm:p-10 space-y-8 relative">
          
          {/* Level 1: Input Resources */}
          <div>
            <div className="text-xs font-mono font-bold text-[#52796f] uppercase text-center mb-3 tracking-wider">
              1. Raw Academic Ingestion
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {['Course Material', 'Lecture Slides', 'Handwritten Notes', 'Syllabus & Exams'].map((item, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#f6fbf3] border border-[#dfe4dd] text-center shadow-xs flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-[#165034]" />
                  <span className="text-xs font-bold text-[#002313]">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Central Connecting Flow Pulse */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-[#165034]" />
            <div className="p-4 rounded-2xl bg-[#002313] text-white shadow-md flex items-center gap-3 text-center max-w-sm w-full justify-center">
              <Brain className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-300">
                  Core AI Understanding
                </div>
                <div className="text-[11px] text-[#e8f3ed]">
                  OCR · Semantic Parsing · Citation Anchoring
                </div>
              </div>
            </div>
            <div className="w-0.5 h-6 bg-[#165034]" />
          </div>

          {/* Level 2: Three Parallel Processing Pillars */}
          <div>
            <div className="text-xs font-mono font-bold text-[#52796f] uppercase text-center mb-3 tracking-wider">
              2. Core Intelligence Engines
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              
              {/* Pillar 1: DAG */}
              <div className="p-4 rounded-xl bg-[#e8f3ed] border border-[#165034]/25 space-y-2 text-center shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-[#165034] text-white flex items-center justify-center mx-auto mb-1">
                  <Network className="w-4 h-4" />
                </div>
                <div className="font-serif font-bold text-sm text-[#002313]">Knowledge DAG</div>
                <p className="text-[11px] text-[#2d4a3e]">
                  Topological prerequisite trees ordering concepts by cognitive dependencies.
                </p>
              </div>

              {/* Pillar 2: AI Materials */}
              <div className="p-4 rounded-xl bg-[#e8f3ed] border border-[#165034]/25 space-y-2 text-center shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-[#165034] text-white flex items-center justify-center mx-auto mb-1">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="font-serif font-bold text-sm text-[#002313]">AI Study Materials</div>
                <p className="text-[11px] text-[#2d4a3e]">
                  7 Multi-modal formats: Flashcards, Quizzes, Mind Maps, and Revision Briefs.
                </p>
              </div>

              {/* Pillar 3: Adaptive Assessment */}
              <div className="p-4 rounded-xl bg-[#e8f3ed] border border-[#165034]/25 space-y-2 text-center shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-[#165034] text-white flex items-center justify-center mx-auto mb-1">
                  <Target className="w-4 h-4" />
                </div>
                <div className="font-serif font-bold text-sm text-[#002313]">Adaptive Assessment</div>
                <p className="text-[11px] text-[#2d4a3e]">
                  Live calibrated questions dynamically adjusting difficulty based on response accuracy.
                </p>
              </div>

            </div>
          </div>

          {/* Level 3: Personalized Daily Plan */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-[#165034]" />
            <div className="p-4 rounded-2xl bg-[#f6fbf3] border-2 border-[#165034] text-center max-w-md w-full shadow-xs">
              <div className="flex items-center justify-center gap-2 text-xs font-bold font-mono text-[#165034] uppercase">
                <Calendar className="w-4 h-4" />
                <span>Personalized Daily Plan</span>
              </div>
              <div className="text-xs text-[#2d4a3e] mt-1">
                Circadian task allocation · Auto-reschedules when sessions finish early
              </div>
            </div>
            <div className="w-0.5 h-6 bg-[#165034]" />
          </div>

          {/* Level 4: Active Practice */}
          <div className="flex flex-col items-center">
            <div className="p-3.5 rounded-xl bg-white border border-[#dfe4dd] text-center max-w-sm w-full shadow-xs">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#002313]">
                <Zap className="w-4 h-4 text-[#165034]" />
                <span>Learn + Practice with AI Tutor</span>
              </div>
            </div>
            <div className="w-0.5 h-6 bg-[#165034]" />
          </div>

          {/* Level 5: Continuous Mastery (Final State) */}
          <div className="text-center pt-2">
            <div className="inline-flex items-center gap-3 p-4 rounded-2xl bg-[#165034] text-white shadow-md">
              <Award className="w-6 h-6 text-emerald-300" />
              <div className="text-left">
                <div className="font-serif text-base font-bold">100% Concept Mastery</div>
                <div className="text-[11px] text-emerald-200 font-mono">
                  SM-2 Spaced Recall Guarantee · Exam-Ready
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
