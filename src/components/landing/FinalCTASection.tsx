import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Compass } from 'lucide-react';

export const FinalCTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 lg:py-28 px-5 sm:px-8 bg-[#063B2A] dark:bg-emerald-950/70 dark:border-t dark:border-b dark:border-emerald-800/30 text-white relative overflow-hidden">
      {/* Background Subtle Mint Radial Accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#20B486]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[1240px] mx-auto text-center relative z-10 space-y-8">
        
        {/* Eyebrow badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#20B486]/20 border border-[#20B486]/30 text-[#20B486] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Zero Cramming · 100% Comprehension</span>
        </div>

        {/* Heading from Prompt */}
        <h2 className="text-3xl sm:text-5xl lg:text-[56px] font-extrabold text-white tracking-tight leading-[1.1] max-w-3xl mx-auto">
          Your syllabus has a structure.<br />
          <span className="text-[#20B486]">Now make it work for you.</span>
        </h2>

        {/* Subtext */}
        <p className="text-base sm:text-lg text-[#DDF7EC]/90 max-w-xl mx-auto leading-[1.65]">
          Turn scattered study material into a personalized learning system.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate('/signup')}
            className="inline-flex items-center justify-center gap-2.5 min-w-[210px] sm:min-w-[230px] h-14 px-9 rounded-full bg-[#20B486] text-white text-base font-bold hover:bg-[#1aa378] transition-all shadow-[0_6px_20px_rgba(32,180,134,0.35)] active:scale-98"
          >
            <span>Start Learning</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#showcase"
            className="inline-flex items-center justify-center gap-2 min-w-[210px] sm:min-w-[230px] h-14 px-9 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/20 text-base font-bold transition-all backdrop-blur-sm active:scale-98"
          >
            <span>Explore the platform</span>
          </a>
        </div>

        {/* Trust Badges */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-[#DDF7EC]/70">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#20B486]" />
            No credit card required
          </span>
          <span>·</span>
          <span>Free tier available</span>
          <span>·</span>
          <span>Private local vault</span>
        </div>

      </div>
    </section>
  );
};
