import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Network,
  Repeat,
  CheckCircle2,
  FileText,
  Zap,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Award,
  ChevronRight
} from 'lucide-react';

const TAGLINES = [
  'smarter study path.',
  'custom learning plan.',
  'clear knowledge map.',
  'mastery study roadmap.',
  'daily action plan.'
];

export const Hero = () => {
  const navigate = useNavigate();
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(TAGLINES[0].length);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = TAGLINES[taglineIndex];

    // When typing is complete, pause before deleting
    if (!isDeleting && subIndex === currentPhrase.length) {
      const timeout = setTimeout(() => {
        setIsDeleting(true);
      }, 2200);
      return () => clearTimeout(timeout);
    }

    // When deleting is complete, move to next phrase
    if (isDeleting && subIndex === 0) {
      setIsDeleting(false);
      setTaglineIndex((prev) => (prev + 1) % TAGLINES.length);
      return;
    }

    // Dynamic typing and backspacing speeds
    const speed = isDeleting ? 30 : 65;
    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, speed);

    return () => clearTimeout(timeout);
  }, [subIndex, isDeleting, taglineIndex]);

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

            {/* Main Headline with Fixed First Line and Zero-Shift Dynamic Rotating Second Line */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] xl:text-[60px] font-extrabold text-[#10231C] tracking-[-1.5px] lg:tracking-[-2.5px] leading-[1.12] min-h-[2.35em] sm:min-h-[2.3em] flex flex-col justify-start">
              <span className="block truncate sm:overflow-visible">Turn your syllabus into a</span>
              <span className="text-[#20B486] inline-flex items-center whitespace-nowrap min-h-[1.15em] shrink-0">
                <span>{TAGLINES[taglineIndex].substring(0, subIndex)}</span>
                <span className="inline-block w-[3.5px] h-[0.8em] bg-[#20B486] ml-1.5 animate-pulse rounded-full shrink-0" />
              </span>
            </h1>

            {/* Supporting Text (Short & Scannable) */}
            <p className="text-base sm:text-lg text-[#66736D] max-w-xl font-normal leading-[1.65]">
              StudyMate turns your course material into adaptive assessments, AI-generated study resources, prerequisite-aware learning paths, and personalized revision.
            </p>

            {/* CTAs matching Reference Button System */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-5 pt-2 w-full sm:w-auto">
              <button
                onClick={() => navigate('/signup')}
                className="inline-flex items-center justify-center gap-2.5 min-w-[210px] sm:min-w-[230px] h-14 px-9 rounded-full bg-[#063B2A] text-white text-base sm:text-[17px] font-bold hover:bg-[#0A4D37] transition-all shadow-[0_8px_24px_rgba(6,59,42,0.25)] hover:shadow-[0_12px_28px_rgba(6,59,42,0.35)] active:scale-98"
              >
                <span>Start Learning</span>
                <ArrowRight className="w-4 h-4 text-[#20B486]" />
              </button>

              <a
                href="#showcase"
                className="inline-flex items-center justify-center gap-2 min-w-[210px] sm:min-w-[230px] h-14 px-9 rounded-full bg-[#10231C] text-white hover:bg-[#063B2A] border border-[#20B486]/35 text-base sm:text-[17px] font-bold transition-all shadow-[0_6px_20px_rgba(16,35,28,0.18)] hover:shadow-[0_10px_24px_rgba(6,59,42,0.25)] active:scale-98"
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
            <div className="relative w-full max-w-[460px] h-[360px] sm:h-[420px] flex items-center justify-center">
              
              {/* Circular Fresh-Green Accent Backdrop */}
              <div className="w-[320px] h-[320px] sm:w-[380px] sm:h-[380px] rounded-full bg-[#20B486] shadow-[0_20px_60px_rgba(32,180,134,0.22)] flex items-center justify-center overflow-hidden border-4 border-white/80">
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

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
