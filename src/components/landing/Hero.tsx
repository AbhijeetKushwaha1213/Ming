import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export const Hero = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [heroInView, setHeroInView] = useState(false);
  const [activeReviewState, setActiveReviewState] = useState<'idle' | 'reviewed' | 'mastered'>('idle');
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 16;
      const y = (e.clientY / innerHeight - 0.5) * 16;
      setMouseOffset({ x, y });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const timer = setTimeout(() => setHeroInView(true), 150);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {/* Fixed Top Header / Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f6fbf3]/85 backdrop-blur-xl border-b border-[#dfe4dd]/60 transition-all duration-300">
        <div className="h-20 max-w-[1340px] mx-auto px-5 sm:px-8 lg:px-12 flex items-center justify-between gap-6">
          {/* Official StudyMate AI Green Learning Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img
              src="/assets/studymate-logo.png"
              alt="StudyMate AI Official Logo"
              className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-['Newsreader'] text-2xl font-bold tracking-tight text-[#002313]">
                StudyMate AI
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#a3f1bf] text-[#217048] font-['Plus_Jakarta_Sans'] text-[10px] uppercase font-bold tracking-wider">
                v2.4 Pro
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-[#414843] font-['Plus_Jakarta_Sans'] text-[13px] font-semibold">
            <a
              href="#features"
              className="text-[#002313] hover:text-[#1b6b44] transition-colors"
            >
              Features
            </a>
            <a
              href="#story"
              className="hover:text-[#002313] transition-colors"
            >
              Day in the Life
            </a>
            <a
              href="#workspace"
              className="hover:text-[#002313] transition-colors"
            >
              Studio Lab
            </a>
            <a
              href="#methodology"
              className="hover:text-[#002313] transition-colors"
            >
              Protocol
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="hidden sm:inline-flex text-[#414843] hover:text-[#002313] px-3 py-1.5 font-['Plus_Jakarta_Sans'] text-[13px] font-semibold transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center justify-center h-[38px] px-4 rounded-lg bg-[#002313] text-white font-['Plus_Jakarta_Sans'] text-[13px] font-semibold hover:bg-[#1b6b44] transition-all shadow-sm hover:shadow-md gap-1.5 active:scale-95"
            >
              <span>Start Free</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section with Cinematic Editorial Composition */}
      <section
        id="hero"
        ref={heroRef}
        className="relative w-full overflow-hidden bg-[#f6fbf3] pt-28 pb-16 lg:pt-36 lg:pb-24 border-b border-[#dfe4dd]/60"
      >
        {/* Subtle Archival Grid Backdrop with Slow Parallax */}
        <div
          className="absolute inset-0 pointer-events-none opacity-35 bg-grid-pattern"
          style={{
            transform: `translateY(${scrollY * 0.12}px)`
          }}
        />

        <div className="relative max-w-[1340px] mx-auto px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* Left Content Column */}
            <div className="lg:col-span-6 flex flex-col items-start space-y-5 z-10">
              {/* Eyebrow badge */}
              <div className="reveal stagger-1 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#a3f1bf]/50 border border-[#1b6b44]/20 text-[#217048] font-['Plus_Jakarta_Sans'] text-[11px] font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-[#1b6b44] animate-pulse" />
                Archival Rigor · Neural Precision
              </div>

              {/* Main Headline */}
              <h1 className="reveal stagger-2 font-['Newsreader'] text-4xl sm:text-5xl lg:text-[56px] text-[#002313] tracking-tight font-normal leading-[1.08]">
                Study smarter.<br />
                Make{' '}
                <span className="relative inline-block text-[#1b6b44] font-medium italic">
                  every hour count
                  <span className="absolute bottom-1.5 left-0 w-full h-[3px] bg-[#1b6b44]/25 rounded-full" />
                </span>
                .
              </h1>

              {/* Punchy Scannable Badges */}
              <div className="reveal stagger-3 flex flex-wrap gap-2 pt-1 pb-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0f5ee] text-[#002313] border border-[#c1c8c1]/50 font-['Plus_Jakarta_Sans'] text-[13px] font-medium hover:border-[#1b6b44]/40 transition-colors">
                  <span className="material-symbols-outlined text-[#1b6b44] text-[16px]">schedule</span>
                  Algorithmic SM-2 Recall
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0f5ee] text-[#002313] border border-[#c1c8c1]/50 font-['Plus_Jakarta_Sans'] text-[13px] font-medium hover:border-[#1b6b44]/40 transition-colors">
                  <span className="material-symbols-outlined text-[#1b6b44] text-[16px]">bedtime</span>
                  Circadian Scheduling
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0f5ee] text-[#002313] border border-[#c1c8c1]/50 font-['Plus_Jakarta_Sans'] text-[13px] font-medium hover:border-[#1b6b44]/40 transition-colors">
                  <span className="material-symbols-outlined text-[#1b6b44] text-[16px]">verified</span>
                  Zero Hallucinations
                </span>
              </div>

              {/* Body Prose */}
              <p className="reveal stagger-4 font-['Plus_Jakarta_Sans'] text-base sm:text-lg text-[#414843] max-w-lg leading-relaxed">
                Transforms complex syllabi and raw lecture slides into mathematically spaced retrieval cycles, structured DAG prerequisite trees, and verified citations.
              </p>

              {/* Primary Actions */}
              <div className="reveal stagger-5 flex flex-wrap items-center gap-3 pt-2 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/auth')}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-[#002313] text-white font-['Plus_Jakarta_Sans'] text-sm font-semibold hover:bg-[#1b6b44] transition-all shadow-md hover:shadow-lg active:scale-98"
                >
                  <span>Start Free Study Session</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
                <a
                  href="#story"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg bg-white text-[#181d19] border border-[#c1c8c1]/70 font-['Plus_Jakarta_Sans'] text-sm font-semibold hover:bg-[#ebefe8] transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#1b6b44]">explore</span>
                  <span>Explore A Day in the Life</span>
                </a>
              </div>

              {/* Quick Verification Pill Row */}
              <div className="reveal stagger-6 pt-2 flex flex-wrap items-center gap-3 sm:gap-4 text-[#414843] font-['Plus_Jakarta_Sans'] text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1b6b44] text-[16px]">bolt</span>
                  <span>3-min quick setup</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-[#c1c8c1]" />
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1b6b44] text-[16px]">school</span>
                  <span>120k+ Top Scholars</span>
                </div>
                <span className="w-1 h-1 rounded-full bg-[#c1c8c1]" />
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#1b6b44] text-[16px]">encrypted</span>
                  <span>Private Local Vault</span>
                </div>
              </div>
            </div>

            {/* Right Hero Showcase with Zoom Parallax & Precision UI Dock */}
            <div
              className="lg:col-span-6 mt-6 lg:mt-0 relative"
              style={{
                transform: `translate(${mouseOffset.x * 0.4}px, ${mouseOffset.y * 0.4}px)`
              }}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#c1c8c1]/60 bg-white">

                {/* Atmospheric Photographic Layer with Zoom Parallax */}
                <div className="relative h-52 sm:h-64 w-full overflow-hidden zoom-parallax-container">
                  <img
                    src="/assets/hero-student.png"
                    alt="University student at study desk sanctuary near window"
                    className={`w-full h-full object-cover object-center filter brightness-[0.94] contrast-[1.03] zoom-parallax-image ${heroInView ? 'in-view' : ''
                      }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />

                  {/* Floating Photographic Badges with Parallax depth */}
                  <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#002313]/85 backdrop-blur-md text-[#c2ecd0] font-['Plus_Jakarta_Sans'] text-[10px] uppercase font-bold tracking-wider shadow-sm">
                    <span className="material-symbols-outlined text-[14px] text-[#a5f3c2]">nightlight</span>
                    Dusk Focus Session · 2h 14m Logged
                  </div>

                  <div className="absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[#002313] font-['Plus_Jakarta_Sans'] text-xs font-semibold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-[#1b6b44] animate-ping" />
                    <span className="font-mono font-bold">SM-2 Interval: +48h</span>
                  </div>
                </div>

                {/* Precision Interactive UI Dock */}
                <div className="p-5 pt-2 space-y-4">
                  {/* Live Target Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#dfe4dd]">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[#1b6b44] text-[20px]">psychology</span>
                      <div>
                        <div className="font-['Plus_Jakarta_Sans'] text-sm text-[#002313] font-bold">
                          Distributed Deadlock Resolution
                        </div>
                        <div className="text-[11px] text-[#414843] font-mono">
                          Set 3 of 12 · USMLE & EECS Standards
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#a3f1bf] text-[#217048] font-['Plus_Jakarta_Sans'] text-xs font-bold">
                        88% Mastery
                      </span>
                    </div>
                  </div>

                  {/* Active Interactive Card Preview */}
                  <div className="p-4 rounded-xl bg-[#f0f5ee] border border-[#c1c8c1]/40 space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-[#414843]">
                      <span className="font-['Plus_Jakarta_Sans'] font-bold uppercase text-[#1b6b44] tracking-wider text-[10px]">
                        Active Prompt
                      </span>
                      <span className="font-mono">Next: 3 Days</span>
                    </div>
                    <p className="font-['Plus_Jakarta_Sans'] text-[15px] font-semibold text-[#002313] leading-snug">
                      "Differentiate Dijkstra’s Banker’s Algorithm from Wait-For Graph cycle detection under distributed state machines."
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#414843]">
                        <span className="material-symbols-outlined text-[#1b6b44] text-[15px]">verified</span>
                        <span>Silberschatz §19.4 Verified</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setActiveReviewState('reviewed')}
                          className={`px-2.5 py-1 rounded font-['Plus_Jakarta_Sans'] text-xs transition-colors ${activeReviewState === 'reviewed'
                              ? 'bg-[#1b6b44] text-white font-bold'
                              : 'bg-[#ebefe8] hover:bg-[#dfe4dd] text-[#181d19]'
                            }`}
                        >
                          Review (12h)
                        </button>
                        <button
                          onClick={() => setActiveReviewState('mastered')}
                          className={`px-2.5 py-1 rounded font-['Plus_Jakarta_Sans'] text-xs shadow-sm transition-colors ${activeReviewState === 'mastered'
                              ? 'bg-[#1b6b44] text-white font-bold'
                              : 'bg-[#002313] text-white hover:bg-[#1b6b44]'
                            }`}
                        >
                          Mastered (4d)
                        </button>
                      </div>
                    </div>
                    {activeReviewState !== 'idle' && (
                      <div className="text-[11px] text-[#1b6b44] bg-[#a3f1bf]/40 p-2 rounded border border-[#1b6b44]/20 animate-fade-in flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        <span>Interval rescheduled. SM-2 decay matrix updated.</span>
                      </div>
                    )}
                  </div>

                  {/* Real-time Streak Bar */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-lg bg-[#f0f5ee]">
                      <div className="text-[10px] uppercase font-['Plus_Jakarta_Sans'] font-bold text-[#414843]">Retention</div>
                      <div className="font-['Plus_Jakarta_Sans'] text-[#002313] font-bold text-base">94.6%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#f0f5ee]">
                      <div className="text-[10px] uppercase font-['Plus_Jakarta_Sans'] font-bold text-[#1b6b44] font-bold text-base">18 Days</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#f0f5ee]">
                      <div className="text-[10px] uppercase font-['Plus_Jakarta_Sans'] font-bold text-[#414843]">Cognitive Load</div>
                      <div className="font-['Plus_Jakarta_Sans'] text-[#002313] font-bold text-base">Balanced</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Institutional Impact Metric Ribbon */}
      <section className="w-full bg-white py-8 border-b border-[#dfe4dd]/60">
        <div className="max-w-[1340px] mx-auto px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <span className="material-symbols-outlined text-[#1b6b44] text-[32px]">school</span>
              <div>
                <div className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#002313]">120,000+</div>
                <p className="text-xs text-[#414843] font-['Plus_Jakarta_Sans']">Scholars at Oxford, Stanford & MIT</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <span className="material-symbols-outlined text-[#1b6b44] text-[32px]">timer</span>
              <div>
                <div className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#002313]">4.2M+</div>
                <p className="text-xs text-[#414843] font-['Plus_Jakarta_Sans']">Hours of Active Recall Logged</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <span className="material-symbols-outlined text-[#1b6b44] text-[32px]">verified_user</span>
              <div>
                <div className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#1b6b44]">94.6%</div>
                <p className="text-xs text-[#414843] font-['Plus_Jakarta_Sans']">90-Day Exam Concept Retention</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-center md:justify-start">
              <span className="material-symbols-outlined text-[#1b6b44] text-[32px]">hotel_class</span>
              <div>
                <div className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#002313]">4.9 / 5.0</div>
                <p className="text-xs text-[#414843] font-['Plus_Jakarta_Sans']">Bar, USMLE & PhD Endorsement</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
