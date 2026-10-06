import React, { useState } from 'react';
import {
  Target,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Zap,
  Award
} from 'lucide-react';

export const AdaptiveAssessmentSection = () => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [difficultyTier, setDifficultyTier] = useState('Level 3 · Standard');

  const question = {
    title: 'Process Synchronization & Lock Ordering',
    text: 'Why does Peterson’s algorithm guarantee mutual exclusion for two processes P0 and P1 in critical sections?',
    options: [
      { id: 'A', text: 'Hardware atomic test-and-set instructions force serial execution', correct: false },
      { id: 'B', text: 'The turn variable and flag array prevent both processes from entering simultaneously', correct: true },
      { id: 'C', text: 'The kernel disables all interrupts during critical section transitions', correct: false },
    ],
    citation: 'Silberschatz OS §6.3 · Prerequisite for Deadlocks',
  };

  const handleSelect = (idx: number, isCorrect: boolean) => {
    setSelectedOption(idx);
    if (isCorrect) {
      setDifficultyTier('Level 4 · Adaptive Challenge (Scaled Up)');
    }
  };

  return (
    <section
      id="assessment"
      className="py-20 lg:py-28 px-5 sm:px-8 bg-white border-b border-[#DDE7E1] scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-[1240px] mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] border border-[#20B486]/20 text-[#063B2A] text-xs font-bold uppercase tracking-wider mb-4">
            <Target className="w-3.5 h-3.5 text-[#20B486]" />
            <span>Personalized Difficulty Engine</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#10231C] tracking-tight leading-[1.15] mb-4">
            An assessment that{' '}
            <span className="text-[#20B486]">adapts to you.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#66736D] max-w-2xl mx-auto leading-[1.65]">
            Diagnostic quizzes dynamically adjust based on your performance. Target weak spots before they turn into exam-day surprises.
          </p>
        </div>

        {/* 2-Column: Live Adaptive Question on Left, Mastery Breakdown on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Simulated Adaptive Quiz */}
          <div className="lg:col-span-7 bg-[#F7FAF7] rounded-[24px] border border-[#DDE7E1] shadow-soft p-6 sm:p-8 space-y-6">
            
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DDE7E1]">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#063B2A] text-white text-xs font-bold font-mono">
                  Live Adaptive Drill
                </span>
                <span className="text-xs font-bold text-[#10231C]">{question.title}</span>
              </div>

              <span className="px-2.5 py-0.5 rounded-full bg-[#DDF7EC] text-[#20B486] text-xs font-bold font-mono">
                {difficultyTier}
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-base font-bold text-[#10231C] leading-snug">
                "{question.text}"
              </p>

              <div className="space-y-2 pt-2">
                {question.options.map((opt, i) => {
                  const isSelected = selectedOption === i;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelect(i, opt.correct)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? opt.correct
                            ? 'bg-[#DDF7EC] border-2 border-[#20B486] text-[#063B2A] font-bold'
                            : 'bg-red-50 border-2 border-red-500 text-red-950'
                          : 'bg-white border-[#DDE7E1] text-[#10231C] hover:border-[#20B486]/50'
                      }`}
                    >
                      <span>{opt.text}</span>
                      {isSelected && opt.correct && (
                        <CheckCircle2 className="w-5 h-5 text-[#20B486] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedOption !== null && (
              <div className="p-3.5 rounded-xl bg-white border border-[#DDE7E1] text-xs space-y-1 animate-fade-in">
                <div className="flex items-center justify-between font-bold text-[#063B2A]">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#20B486]" />
                    AI Evaluation & Citation
                  </span>
                  <span className="text-[11px] font-mono text-[#66736D]">{question.citation}</span>
                </div>
                <p className="text-[#66736D]">
                  Correct! Both processes check their turn & intent. StudyMate has adjusted your difficulty to Level 4 for the next question.
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between text-xs text-[#66736D]">
              <span>Click options above to test real-time difficulty recalibration.</span>
              <button
                onClick={() => {
                  setSelectedOption(null);
                  setDifficultyTier('Level 3 · Standard');
                }}
                className="font-bold text-[#063B2A] hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>

          </div>

          {/* Right Column: Mastery Breakdown & AI Recommendation (Exact Prompt Spec!) */}
          <div className="lg:col-span-5 bg-[#F7FAF7] rounded-[24px] border border-[#DDE7E1] shadow-soft p-6 sm:p-7 space-y-6">
            
            {/* Header */}
            <div className="pb-3 border-b border-[#DDE7E1]">
              <span className="text-xs font-mono font-bold text-[#20B486] uppercase">
                Diagnostic Feedback
              </span>
              <h3 className="font-extrabold text-xl text-[#10231C] mt-0.5">
                Your Concept Mastery
              </h3>
            </div>

            {/* Mastery Items from Prompt */}
            <div className="space-y-3">
              {[
                { name: 'CPU Scheduling', mastery: 82, status: '✓ Mastered', color: 'text-[#20B486]', bar: 'bg-[#20B486]' },
                { name: 'Process Management', mastery: 74, status: 'Proficient', color: 'text-[#063B2A]', bar: 'bg-[#063B2A]' },
                { name: 'Deadlocks', mastery: 41, status: '! Weak', color: 'text-amber-600', bar: 'bg-amber-500' },
                { name: 'Synchronization', mastery: 63, status: 'Developing', color: 'text-[#66736D]', bar: 'bg-[#20B486]/70' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-xl bg-white border border-[#DDE7E1] space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#10231C]">
                    <span>{item.name}</span>
                    <span className="font-mono flex items-center gap-1.5">
                      <span>{item.mastery}%</span>
                      <span className={`text-[11px] ${item.color}`}>{item.status}</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F7FAF7] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.bar}`}
                      style={{ width: `${item.mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* AI Recommendation Card (Directly from Prompt Spec) */}
            <div className="p-4 rounded-xl bg-white border-2 border-[#20B486] shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#063B2A] uppercase font-mono">
                <Sparkles className="w-3.5 h-3.5 text-[#20B486]" />
                <span>AI Recommendation</span>
              </div>

              <div className="text-sm font-extrabold text-[#10231C]">
                Focus on: Deadlock Prevention
              </div>

              <p className="text-xs text-[#66736D] leading-relaxed">
                <strong>Reason:</strong> Your prerequisite mastery in Synchronization is below 70%. Resolving race conditions first guarantees a 92% retention rate on Deadlocks.
              </p>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => window.location.href = '/signup'}
                  className="px-3.5 py-1.5 rounded-lg bg-[#20B486] text-white text-xs font-bold hover:bg-[#1aa378] transition-colors"
                >
                  Start Remediation →
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
