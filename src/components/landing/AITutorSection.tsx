import React, { useState } from 'react';
import {
  Brain,
  MessageSquare,
  Sparkles,
  BookOpen,
  Network,
  Send,
  User,
  ArrowRight
} from 'lucide-react';

export const AITutorSection = () => {
  const [activeQuestion, setActiveQuestion] = useState(0);

  const conversations = [
    {
      student: 'Explain why deadlock detection comes after synchronization.',
      context: 'Context: Operating Systems → Deadlocks (Node #6)',
      ai: 'Deadlocks can only occur when multiple processes use synchronization primitives (like Mutexes or Semaphores) to lock non-shareable resources. Without understanding race conditions, critical sections, and mutual exclusion first, the cyclic dependency graph that defines a deadlock makes no mathematical sense.',
      citation: 'Silberschatz OS Chapter 7 · Slide 18 Prerequisite Trace',
    },
    {
      student: 'How does Banker Algorithm differ from simple cycle detection?',
      context: 'Context: Operating Systems → Resource Allocation',
      ai: "Cycle detection only identifies whether a deadlock already exists under single-resource conditions. Banker's Algorithm is an avoidance technique for multiple resource instances: it runs a safety check simulation before granting an allocation to verify a safe sequence still exists.",
      citation: 'Tanenbaum §2.4.3 · Midterm Review Sheet',
    },
  ];

  const current = conversations[activeQuestion];

  return (
    <section
      id="tutor"
      className="py-20 lg:py-28 px-5 sm:px-8 bg-white border-b border-[#DDE7E1] scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-[1240px] mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] border border-[#20B486]/20 text-[#063B2A] text-xs font-bold uppercase tracking-wider mb-4">
            <Brain className="w-3.5 h-3.5 text-[#20B486]" />
            <span>Course-Aware Neural Tutor</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#10231C] tracking-tight leading-[1.15] mb-4">
            Your course-aware{' '}
            <span className="text-[#20B486]">AI tutor.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#66736D] max-w-2xl mx-auto leading-[1.65]">
            Grounded directly in your professor’s slides, textbook chapters, and exact position in the knowledge graph.
          </p>
        </div>

        {/* Conversational UI Container */}
        <div className="max-w-3xl mx-auto bg-[#F7FAF7] rounded-[24px] border border-[#DDE7E1] shadow-soft p-6 sm:p-8 space-y-6">
          
          {/* Question Switcher Tabs */}
          <div className="flex gap-2 pb-3 border-b border-[#DDE7E1]">
            <button
              onClick={() => setActiveQuestion(0)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeQuestion === 0
                  ? 'bg-[#063B2A] text-white'
                  : 'bg-white text-[#66736D] border border-[#DDE7E1] hover:text-[#10231C]'
              }`}
            >
              Question 1: Deadlocks & Sync
            </button>
            <button
              onClick={() => setActiveQuestion(1)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeQuestion === 1
                  ? 'bg-[#063B2A] text-white'
                  : 'bg-white text-[#66736D] border border-[#DDE7E1] hover:text-[#10231C]'
              }`}
            >
              Question 2: Banker Algorithm
            </button>
          </div>

          {/* Student Question Bubble */}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#DDE7E1] text-[#063B2A] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              <User className="w-4 h-4 text-[#20B486]" />
            </div>
            <div className="p-4 rounded-[20px] bg-white border border-[#DDE7E1] text-sm sm:text-base text-[#10231C] font-semibold leading-relaxed shadow-xs max-w-xl">
              "{current.student}"
            </div>
          </div>

          {/* Visual Context Indicator (Exact Prompt Spec!) */}
          <div className="ml-12 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DDF7EC] border border-[#20B486]/30 text-[#063B2A] text-xs font-bold font-mono">
            <Network className="w-3.5 h-3.5 text-[#20B486]" />
            <span>{current.context}</span>
          </div>

          {/* AI Tutor Grounded Response Bubble */}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#063B2A] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Brain className="w-5 h-5 text-[#20B486]" />
            </div>
            <div className="p-5 sm:p-6 rounded-[20px] bg-white border border-[#DDE7E1] shadow-xs space-y-3 max-w-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-[#063B2A] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#20B486]" />
                  StudyMate AI Tutor
                </span>
                <span className="text-[11px] font-mono text-[#20B486] font-bold">
                  Zero Hallucinations
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[#10231C] leading-[1.7] font-normal">
                {current.ai}
              </p>

              <div className="pt-2 border-t border-[#DDE7E1] flex items-center justify-between text-[11px] text-[#66736D]">
                <span>Source: {current.citation}</span>
                <span className="text-[#20B486] font-bold">Syllabus Grounded</span>
              </div>
            </div>
          </div>

          {/* Interactive Input Teaser */}
          <div className="pt-2 flex items-center gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-white border border-[#DDE7E1] text-xs text-[#66736D] flex items-center justify-between">
              <span>Ask anything about your syllabus, lecture slides, or exam problems...</span>
              <Send className="w-4 h-4 text-[#20B486]" />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
