import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Network,
  Repeat,
  CheckCircle2,
  FileText,
  Brain,
  Zap,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Award,
  Layers,
  ChevronRight
} from 'lucide-react';

export const Hero = () => {
  const navigate = useNavigate();
  const [activeNode, setActiveNode] = useState<'processes' | 'scheduling' | 'deadlocks'>('scheduling');

  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-[#F7FAF7] pt-28 sm:pt-36 pb-16 lg:pb-24 border-b border-[#DDE7E1]"
    >
      {/* Concentric Subtle Radar/Orbit Rings (Inspired by reference) */}
      <div className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-[#20B486]/10 pointer-events-none hidden lg:block" />
      <div className="absolute top-1/2 right-[10%] -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-[#20B486]/5 pointer-events-none hidden lg:block" />

      {/* Decorative Mint Floating Dots */}
      <div className="absolute top-36 left-12 w-3.5 h-3.5 rounded-full bg-[#20B486]/30 pointer-events-none" />
      <div className="absolute top-1/2 left-[45%] w-2.5 h-2.5 rounded-full bg-[#20B486]/20 pointer-events-none" />
      <div className="absolute bottom-20 left-28 w-4 h-4 rounded-full bg-[#20B486]/40 pointer-events-none" />

      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headline, Copy, CTAs */}
          <div className="lg:col-span-7 flex flex-col items-start space-y-6">
            
            {/* Small Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] border border-[#20B486]/20 text-[#063B2A] text-xs font-bold uppercase tracking-wider shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#20B486]" />
              <span>AI-Powered Personal Learning</span>
            </div>

            {/* Main Headline (Plus Jakarta Sans, 64-72px desktop, font-weight 800) */}
            <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-extrabold text-[#10231C] tracking-[-2px] lg:tracking-[-3px] leading-[1.08]">
              Turn your syllabus into a{' '}
              <span className="text-[#20B486] relative inline-block">
                smarter learning path.
              </span>
            </h1>

            {/* Supporting Text (Short & Scannable) */}
            <p className="text-base sm:text-lg text-[#66736D] max-w-xl font-normal leading-[1.65]">
              StudyMate turns your course material into adaptive assessments, AI-generated study resources, prerequisite-aware learning paths, and personalized revision.
            </p>

            {/* CTAs matching Reference Button System */}
            <div className="flex flex-wrap items-center gap-4 pt-1 w-full sm:w-auto">
              <button
                onClick={() => navigate('/auth')}
                className="inline-flex items-center justify-center gap-2.5 h-13 px-8 rounded-xl bg-[#20B486] text-white text-base font-bold hover:bg-[#1aa378] transition-all shadow-[0_6px_20px_rgba(32,180,134,0.30)] hover:shadow-[0_8px_25px_rgba(32,180,134,0.40)] active:scale-98"
              >
                <span>Start Learning</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#showcase"
                className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-xl bg-[#DDF7EC] text-[#063B2A] text-base font-bold hover:bg-[#cff2e3] transition-all"
              >
                <span>Explore StudyMate</span>
              </a>
            </div>

            {/* Category Badges with Icons (Directly inspired by reference) */}
            <div className="pt-4 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-[#10231C]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#DDF7EC] flex items-center justify-center text-[#20B486]">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span>AI Study Materials</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#DDF7EC] flex items-center justify-center text-[#20B486]">
                  <Network className="w-4 h-4" />
                </div>
                <span>Topological DAGs</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#DDF7EC] flex items-center justify-center text-[#20B486]">
                  <Repeat className="w-4 h-4" />
                </div>
                <span>Spaced Recall</span>
              </div>
            </div>

          </div>

          {/* Right Column: Hero Visual with Circular Fresh-Green Backdrop & Floating UI Elements */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            
            {/* Main Composition Container */}
            <div className="relative w-full max-w-[460px] h-[460px] sm:h-[500px] flex items-center justify-center">
              
              {/* Circular Fresh-Green Accent Backdrop (Reference visual anchor) */}
              <div className="absolute w-[340px] h-[340px] sm:w-[400px] sm:h-[400px] rounded-full bg-[#20B486] shadow-[0_20px_60px_rgba(32,180,134,0.25)] flex items-center justify-center overflow-hidden">
                <img
                  src="/assets/hero-student.png"
                  alt="Student learning with StudyMate AI"
                  className="w-full h-full object-cover object-center mix-blend-multiply opacity-95 scale-105"
                  onError={(e) => {
                    // Fallback to minimal academic graphic if image fails
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              {/* Floating Element 1: Top Right Progress Gauge (like 5K+ in reference) */}
              <div className="absolute top-2 sm:top-6 -right-2 sm:-right-4 rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-3.5 sm:p-4 z-20 animate-float flex items-center gap-3">
                <div className="relative w-11 h-11 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#DDF7EC" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#20B486"
                      strokeWidth="3.2"
                      strokeDasharray="88 100"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-extrabold text-[11px] text-[#063B2A]">92%</span>
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#10231C]">Course Mastery</div>
                  <div className="text-[11px] text-[#66736D]">Operating Systems</div>
                </div>
              </div>

              {/* Floating Element 2: Left Floating Badge (like 2K+ in reference) */}
              <div className="absolute top-28 -left-4 sm:-left-8 rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-3 sm:p-3.5 z-20 animate-float-delayed flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#DDF7EC] flex items-center justify-center text-[#20B486]">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-[#10231C]">48 Flashcards</div>
                  <div className="text-[11px] text-[#66736D]">SM-2 Active Recall</div>
                </div>
              </div>

              {/* Floating Element 3: Bottom Right Badge (like Tutors 250+ in reference) */}
              <div className="absolute bottom-6 -right-2 sm:-right-6 rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft p-3 sm:p-3.5 z-20 animate-float-slow flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#063B2A] flex items-center justify-center text-white">
                  <Brain className="w-5 h-5 text-[#20B486]" />
                </div>
                <div>
                  <div className="font-extrabold text-xs text-[#10231C]">Course AI Tutor</div>
                  <div className="text-[10px] font-semibold text-[#20B486]">Syllabus Grounded</div>
                </div>
              </div>

              {/* Floating Center Dock: StudyMate Dashboard Miniature */}
              <div className="absolute -bottom-8 left-4 sm:left-6 rounded-[20px] bg-white border border-[#DDE7E1] shadow-soft-lg p-4 w-[280px] sm:w-[310px] z-30 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#DDE7E1]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#063B2A]">
                    <Sparkles className="w-3.5 h-3.5 text-[#20B486]" />
                    <span>StudyMate Dashboard</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#20B486] bg-[#DDF7EC] px-2 py-0.5 rounded-full">
                    Live Path
                  </span>
                </div>

                {/* Micro DAG Nodes */}
                <div className="space-y-1.5 text-xs font-semibold">
                  <div
                    onClick={() => setActiveNode('processes')}
                    className={`p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                      activeNode === 'processes' ? 'bg-[#DDF7EC] text-[#063B2A]' : 'bg-[#F7FAF7] text-[#66736D]'
                    }`}
                  >
                    <span>Process Management</span>
                    <span className="text-[10px] font-bold text-[#20B486]">100% ✓</span>
                  </div>

                  <div
                    onClick={() => setActiveNode('scheduling')}
                    className={`p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                      activeNode === 'scheduling' ? 'bg-[#DDF7EC] text-[#063B2A]' : 'bg-[#F7FAF7] text-[#66736D]'
                    }`}
                  >
                    <span>CPU Scheduling</span>
                    <span className="text-[10px] font-bold text-[#20B486]">84% Active</span>
                  </div>

                  <div
                    onClick={() => setActiveNode('deadlocks')}
                    className={`p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                      activeNode === 'deadlocks' ? 'bg-[#DDF7EC] text-[#063B2A]' : 'bg-[#F7FAF7] text-[#66736D]'
                    }`}
                  >
                    <span>Deadlocks Avoidance</span>
                    <span className="text-[10px] font-bold text-[#66736D]">Target Exam</span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-[#66736D]">
                  <span>Next: 5 Practice Questions</span>
                  <span className="font-bold text-[#063B2A]">78% Mastery</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Institution / Scholar Collaboration Bar (Inspired by the reference image's partner row) */}
        <div className="mt-16 sm:mt-20 pt-10 border-t border-[#DDE7E1] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <div className="font-extrabold text-xl text-[#063B2A]">120,000+</div>
            <div className="text-xs text-[#66736D] font-medium">Students & Scholars Worldwide</div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-sm sm:text-base font-bold text-[#66736D]/60 tracking-wider">
            <span className="hover:text-[#063B2A] transition-colors">OXFORD</span>
            <span className="hover:text-[#063B2A] transition-colors">STANFORD</span>
            <span className="hover:text-[#063B2A] transition-colors">MIT</span>
            <span className="hover:text-[#063B2A] transition-colors">BERKELEY</span>
            <span className="hover:text-[#063B2A] transition-colors">CAMBRIDGE</span>
          </div>
        </div>

      </div>
    </section>
  );
};
