import React from 'react';
import {
  Upload,
  Brain,
  Network,
  Target,
  BookOpen,
  Zap,
  Repeat,
  Award,
  Sparkles,
  ArrowDown
} from 'lucide-react';

export const MaterialToMasteryTimeline = () => {
  const steps = [
    {
      code: 'UPLOAD',
      title: 'Upload Course Material',
      desc: 'Ingest course syllabi, lecture slides, textbooks, and notes.',
      icon: Upload,
    },
    {
      code: 'UNDERSTAND',
      title: 'AI Understands Content',
      desc: 'Neural parser extracts entities, formulas, and dependencies.',
      icon: Brain,
    },
    {
      code: 'MAP',
      title: 'Topological DAG Mapping',
      desc: 'Concepts connect in order of prerequisites and depth.',
      icon: Network,
    },
    {
      code: 'ASSESS',
      title: 'Adaptive Assessment',
      desc: 'Diagnostic questions calibrate your exact baseline mastery.',
      icon: Target,
    },
    {
      code: 'LEARN',
      title: 'Personalized Daily Plan',
      desc: 'Time-blocked study schedule fits around your classes and exams.',
      icon: BookOpen,
    },
    {
      code: 'PRACTICE',
      title: 'Active Recall & Practice',
      desc: 'Flashcards, smart notes, and problem sets with AI Tutor guidance.',
      icon: Zap,
    },
    {
      code: 'REVISE',
      title: 'SM-2 Spaced Revision',
      desc: 'Automated reviews at 48h, 7d, and 30d interrupt memory decay.',
      icon: Repeat,
    },
    {
      code: 'MASTER',
      title: '100% Concept Mastery',
      desc: 'Permanent exam retention locked into long-term memory.',
      icon: Award,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-20 lg:py-28 px-5 sm:px-8 bg-[#F7FAF7] border-b border-[#DDE7E1] scroll-mt-20 relative overflow-hidden"
    >
      <div id="timeline" className="scroll-mt-20" />
      <div className="max-w-[1240px] mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] border border-[#20B486]/20 text-[#063B2A] text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#20B486]" />
            <span>The 8-Stage Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#10231C] tracking-tight leading-[1.15] mb-4">
            From material to{' '}
            <span className="text-[#20B486]">cognitive mastery.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#66736D] max-w-2xl mx-auto leading-[1.65]">
            A structured cognitive science pipeline guiding every hour from your initial PDF upload to permanent exam recall.
          </p>
        </div>

        {/* Visual Timeline (8 Steps) */}
        <div className="max-w-4xl mx-auto relative">
          
          {/* Central Connecting Vertical Line for Desktop */}
          <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-0.5 bg-[#DDE7E1] -translate-x-1/2" />

          <div className="space-y-6 md:space-y-10 relative">
            {steps.map((stg, i) => {
              const Icon = stg.icon;
              const isEven = i % 2 === 0;

              return (
                <div
                  key={stg.code}
                  className={`flex flex-col md:flex-row items-center gap-4 md:gap-8 ${
                    isEven ? 'md:flex-row-reverse text-left md:text-right' : 'text-left'
                  }`}
                >
                  {/* Content Card */}
                  <div className="w-full md:w-1/2">
                    <div className="p-5 rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft hover:shadow-soft-lg hover:border-[#20B486]/40 transition-all duration-300">
                      <div className={`flex items-center gap-2 mb-1.5 ${isEven ? 'md:justify-end' : ''}`}>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#DDF7EC] text-[#063B2A]">
                          Step 0{i + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#20B486] uppercase tracking-wider">
                          {stg.code}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base sm:text-lg text-[#10231C]">
                        {stg.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-[#66736D] mt-1 leading-relaxed">
                        {stg.desc}
                      </p>
                    </div>
                  </div>

                  {/* Center Node Icon */}
                  <div className="w-12 h-12 rounded-2xl bg-[#063B2A] text-white flex items-center justify-center shrink-0 z-10 shadow-xs border-4 border-white">
                    <Icon className="w-5 h-5 text-[#20B486]" />
                  </div>

                  {/* Empty Spacer on Opposite Side */}
                  <div className="hidden md:block w-1/2" />
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
};
