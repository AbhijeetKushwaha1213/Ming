import React from 'react';
import {
  Target,
  Wand2,
  Network,
  Brain,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles
} from 'lucide-react';

export const CoreFeaturesSection = () => {
  return (
    <section
      id="features"
      className="py-20 lg:py-28 px-5 sm:px-8 bg-[#F7FAF7] border-b border-[#DDE7E1] scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-[1240px] mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] border border-[#20B486]/20 text-[#063B2A] text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#20B486]" />
            <span>Core Capabilities</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#10231C] tracking-tight leading-[1.15] mb-4">
            Everything your syllabus needs,{' '}
            <span className="text-[#20B486]">nothing it doesn't.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#66736D] max-w-2xl mx-auto leading-[1.65]">
            Built specifically for college students and exam prep. Five core capabilities replacing scattered notes and disjointed tools.
          </p>
        </div>

        {/* 5 Core Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Feature 1: Adaptive Assessment */}
          <div className="rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-6 flex flex-col justify-between hover:shadow-soft-lg transition-all duration-300">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#DDF7EC] text-[#20B486] flex items-center justify-center mb-5">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl text-[#10231C] mb-2">
                Adaptive Assessment
              </h3>
              <p className="text-sm text-[#66736D] leading-[1.65] mb-4">
                Questions scale in difficulty based on your answers in real time. Never waste time on questions too easy or unproductively hard.
              </p>
            </div>

            {/* Micro visual */}
            <div className="p-3.5 rounded-xl bg-[#F7FAF7] border border-[#DDE7E1] space-y-1.5 text-xs font-semibold text-[#10231C]">
              <div className="flex justify-between text-[#66736D] text-[11px]">
                <span>Question</span>
                <span className="text-[#20B486] font-bold">Live AI Eval</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span>Student Answer</span>
                <span className="text-[#20B486]">→</span>
                <span>Difficulty Scales Up</span>
              </div>
            </div>
          </div>

          {/* Feature 2: AI Study Material Generator */}
          <div className="rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-6 flex flex-col justify-between hover:shadow-soft-lg transition-all duration-300">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#DDF7EC] text-[#20B486] flex items-center justify-center mb-5">
                <Wand2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl text-[#10231C] mb-2">
                AI Study Material Generator
              </h3>
              <p className="text-sm text-[#66736D] leading-[1.65] mb-4">
                Upload raw PDFs or lecture slides once. Instantly generate flashcards, quizzes, summaries, mind maps, and revision sheets.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7FAF7] border border-[#DDE7E1] flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#063B2A]">
              <span className="px-2 py-0.5 rounded bg-white border border-[#DDE7E1]">Flashcards</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#DDE7E1]">Quiz</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#DDE7E1]">Summary</span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#DDE7E1]">Mind Map</span>
            </div>
          </div>

          {/* Feature 3: AI Learning Path & DAG */}
          <div className="rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-6 flex flex-col justify-between hover:shadow-soft-lg transition-all duration-300">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#DDF7EC] text-[#20B486] flex items-center justify-center mb-5">
                <Network className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl text-[#10231C] mb-2">
                Prerequisite DAG Graph
              </h3>
              <p className="text-sm text-[#66736D] leading-[1.65] mb-4">
                Concepts arrange into a topological map with explicit mastery states: Mastered, Proficient, Developing, and Locked.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7FAF7] border border-[#DDE7E1] flex items-center justify-between text-[11px] font-bold">
              <span className="text-[#20B486]">✓ Mastered</span>
              <span className="text-[#063B2A]">● Proficient</span>
              <span className="text-amber-600">▲ Developing</span>
              <span className="text-[#66736D] flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Locked
              </span>
            </div>
          </div>

          {/* Feature 4: Context-Aware AI Tutor */}
          <div className="rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-6 flex flex-col justify-between hover:shadow-soft-lg transition-all duration-300 lg:col-span-2">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#DDF7EC] text-[#20B486] flex items-center justify-center mb-5">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl text-[#10231C] mb-2">
                Context-Aware AI Tutor
              </h3>
              <p className="text-sm text-[#66736D] leading-[1.65] mb-4">
                Never gives generic answers. Understands your exact course slides, current learning context, and prerequisite gaps.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F7FAF7] border border-[#DDE7E1] space-y-2 text-xs">
              <div className="text-[#66736D]">
                <strong>Student:</strong> "Why do I need to study Synchronization before Deadlocks?"
              </div>
              <div className="text-[#063B2A] bg-white p-2.5 rounded-lg border border-[#DDE7E1] font-medium">
                <strong>AI Tutor:</strong> "Deadlock requires Coffman Condition #4 (Circular Wait on Locks). Without understanding mutual exclusion and semaphores from Unit 3, deadlock prevention formulas cannot be proven."
              </div>
            </div>
          </div>

          {/* Feature 5: Personal Vault */}
          <div className="rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-6 flex flex-col justify-between hover:shadow-soft-lg transition-all duration-300">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#DDF7EC] text-[#20B486] flex items-center justify-center mb-5">
                <FolderOpen className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl text-[#10231C] mb-2">
                Personal Academic Vault
              </h3>
              <p className="text-sm text-[#66736D] leading-[1.65] mb-4">
                Your syllabi, textbooks, and generated assets organized in a secure, searchable local-first workspace.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7FAF7] border border-[#DDE7E1] flex items-center justify-between text-xs font-semibold text-[#063B2A]">
              <span>Private & Local-First</span>
              <span className="text-[#20B486]">Encrypted Vault</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
