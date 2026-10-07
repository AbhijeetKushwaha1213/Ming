import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Wand2,
  Video,
  Trophy,
  FolderOpen,
  Play,
  FileText,
  Flame,
  Send,
  Layers,
  ListChecks,
  BookOpen,
  Mic,
  ChevronLeft,
  ChevronRight,
  Target,
  Calendar,
  CheckCircle2,
  Award
} from 'lucide-react';

/* ───────────── typewriter helper ───────────── */
function useTypewriter(text: string, run: boolean, speed = 14) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!run) {
      setOut('');
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, run, speed]);
  return out;
}

/* ───────────── step helper ───────────── */
function useStep(run: boolean, max: number, ms: number) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    if (!run) return;
    const id = setInterval(() => setStep((s) => (s < max ? s + 1 : s)), ms);
    return () => clearInterval(id);
  }, [run, max, ms]);
  return step;
}

function Reveal({
  show,
  delay = 0,
  className = '',
  children,
}: {
  show: boolean;
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`transition-all duration-500 ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${className}`}
      style={{ transitionDelay: show ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

function WindowFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[26px] bg-[#0c1511] shadow-2xl ring-1 ring-emerald-500/20">
      <div className="flex items-center gap-2 border-b border-emerald-950/60 bg-[#122019] px-5 py-3.5">
        <span className="h-3 w-3 rounded-full bg-[#ef7a7a]" />
        <span className="h-3 w-3 rounded-full bg-[#f2c14e]" />
        <span className="h-3 w-3 rounded-full bg-[#6fd98a]" />
        <div className="mx-auto rounded-full bg-emerald-950/60 px-5 py-1 text-xs font-mono text-emerald-300/80 border border-emerald-800/30">
          {url}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

const Header = ({
  icon: I,
  title,
  right,
}: {
  icon: any;
  title: string;
  right?: string;
}) => (
  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
      <I size={16} />
    </span>
    <span className="text-sm font-medium text-white">{title}</span>
    {right && (
      <span className="ml-auto flex items-center gap-2 text-xs text-emerald-400/80 font-mono">
        <i className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        {right}
      </span>
    )}
  </div>
);

/* ───────────── slide 1 · AI Assistant ───────────── */
function ChatSlide({ active }: { active: boolean }) {
  const step = useStep(active, 4, 800);
  const reply = useTypewriter(
    'Check your queue. list.pop(0) is O(n), so every dequeue shifts the whole list. Using collections.deque gives you O(1) pops!',
    active && step >= 2
  );
  return (
    <div className="flex h-full flex-col gap-3 p-6 text-sm text-white">
      <Header icon={Sparkles} title="AI Tutor · Data Structures & Algorithms" right="Connected to syllabus" />
      <div className="mt-auto" />
      <Reveal show={active} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-emerald-700 px-5 py-3 text-white shadow-sm">
        My BFS gets TLE on 10⁵ nodes. Why? 🤔
      </Reveal>
      {step === 1 && (
        <div className="flex w-fit gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      )}
      {step >= 2 && (
        <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-slate-200">
          {reply}
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-emerald-400 align-middle" />
        </div>
      )}
      <Reveal show={step >= 3} className="rounded-xl border border-emerald-400/30 bg-black/50 p-3 font-mono text-xs">
        <span className="text-slate-400">from</span> <span className="text-sky-300">collections</span>{' '}
        <span className="text-slate-400">import</span> <span className="text-sky-300">deque</span>
        <br />
        queue = deque([start]) <span className="text-emerald-400"># popleft() is O(1) ✓</span>
      </Reveal>
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs text-slate-400">
        <Mic size={14} className="text-slate-400" />
        <span>Ask a course question…</span>
        <Send size={14} className="ml-auto text-emerald-400" />
      </div>
    </div>
  );
}

/* ───────────── slide 2 · AI Generator ───────────── */
function GeneratorSlide({ active }: { active: boolean }) {
  const step = useStep(active, 3, 800);
  const outs = [
    { I: BookOpen, t: 'Smart notes', s: '12 pages' },
    { I: Layers, t: 'Flashcards', s: '48 cards' },
    { I: ListChecks, t: 'Mock test', s: '20 MCQs' },
  ];
  return (
    <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
      <Header icon={Wand2} title="AI Generator" right="Ready" />
      <Reveal show={active} className="flex items-center gap-3 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/10 p-3.5">
        <FileText className="text-emerald-400" />
        <div>
          <div className="font-medium text-white text-xs sm:text-sm">OS_Unit3_Deadlocks.pdf</div>
          <div className="text-xs text-slate-400">42 pages · OCR parsed · 14 formulas</div>
        </div>
      </Reveal>
      <Reveal show={step >= 1}>
        <div className="mb-1.5 flex justify-between text-xs text-slate-400">
          <span>{step >= 2 ? 'Done ✓' : 'Analysing concepts & DAG...'}</span>
          <span className="font-mono text-emerald-400">{step >= 2 ? '100%' : '65%'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: step >= 2 ? '100%' : step >= 1 ? '65%' : '0%' }}
          />
        </div>
      </Reveal>
      <div className="grid grid-cols-3 gap-3">
        {outs.map(({ I, t, s }, i) => (
          <Reveal key={t} show={step >= 2} delay={i * 120} className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <I size={18} className="text-emerald-400" />
            <div className="mt-2 font-medium text-xs sm:text-sm">{t}</div>
            <div className="text-[11px] text-slate-400">{s}</div>
          </Reveal>
        ))}
      </div>
      <Reveal show={step >= 3} className="mt-auto rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3.5">
        <div className="text-[10px] tracking-widest text-emerald-300 font-mono">ACTIVE RECALL FLASHCARD</div>
        <div className="mt-1 font-medium text-xs sm:text-sm">Name the 4 Coffman conditions for deadlock.</div>
        <div className="mt-1 text-xs text-slate-300">Mutual exclusion · Hold & wait · No preemption · Circular wait</div>
      </Reveal>
    </div>
  );
}

/* ───────────── slide 3 · Adaptive Assessment ───────────── */
function AssessmentSlide({ active }: { active: boolean }) {
  const step = useStep(active, 4, 750);
  return (
    <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
      <Header icon={Target} title="Adaptive Assessment" right="Dynamic PID Leveling" />
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono">Question 4 of 10</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono">
            {step >= 3 ? 'Difficulty: Level 4 (Scaled Up)' : 'Difficulty: Level 3'}
          </span>
        </div>
        <div className="font-medium text-xs sm:text-sm leading-relaxed">
          "Why is Peterson's solution unsafe on modern out-of-order execution CPU architectures without memory fences?"
        </div>
      </div>

      <div className="space-y-2">
        <div className="p-3 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300">
          A. Register overflow on 64-bit kernels
        </div>
        <div
          className={`p-3 rounded-lg border text-xs transition-all ${
            step >= 2
              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200 font-medium'
              : 'border-white/10 bg-white/5 text-slate-300'
          }`}
        >
          B. CPU store buffer reordering allows both threads into the critical section ✓
        </div>
      </div>

      <Reveal show={step >= 3} className="mt-auto p-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-xs flex items-center justify-between">
        <span className="text-emerald-300">Evaluation: Correct! Calibrated next question to advanced tier.</span>
        <span className="font-mono font-bold text-emerald-400">+8% Mastery</span>
      </Reveal>
    </div>
  );
}

/* ───────────── slide 4 · Video & DAG Learning ───────────── */
function VideoSlide({ active }: { active: boolean }) {
  const step = useStep(active, 4, 700);
  const chapters = [
    ['00:00', 'Why normalization'],
    ['12:40', '1NF → 2NF dependencies'],
    ['31:05', 'BCNF candidate keys'],
    ['48:20', 'Exam practice problems'],
  ];
  return (
    <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
      <Header icon={Video} title="Lecture Video & Knowledge DAG" right="NPTEL · DBMS" />
      <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-4">
        <div className="flex flex-col gap-3">
          <div className="relative flex flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950 to-slate-900 border border-white/10 min-h-[140px]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,.5)] text-white">
              <Play size={20} fill="currentColor" />
            </span>
            <div className="absolute bottom-3 left-3 right-3">
              <div className="mb-1 text-[11px] text-slate-300">Normalization · Lecture 14</div>
              <div className="h-1 rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                  style={{ width: `${(active ? Math.min(step + 1, 5) : 0) * 20}%` }}
                />
              </div>
            </div>
          </div>
          <Reveal show={step >= 4} className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2 text-xs">
            <span>Quiz ready · 5 DAG-aligned questions</span>
            <span className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">Start</span>
          </Reveal>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] tracking-widest text-slate-400 font-mono">AUTO CHAPTERS</div>
          {chapters.map(([t, n], i) => (
            <Reveal
              key={t}
              show={step >= 1}
              delay={i * 100}
              className="flex items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs"
            >
              <span className="font-mono text-emerald-400 text-[11px]">{t}</span>
              <span className="truncate">{n}</span>
            </Reveal>
          ))}
          <Reveal show={step >= 3} className="rounded-lg border border-white/10 p-2.5 text-[11px] text-slate-300 mt-1">
            <Sparkles size={12} className="mr-1 inline text-emerald-400" />
            Notes: BCNF requires every determinant to be a superkey.
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ───────────── slide 5 · Circadian Daily Plan ───────────── */
function DailyPlanSlide({ active }: { active: boolean }) {
  const step = useStep(active, 4, 700);
  const items = [
    { time: '09:00', title: 'Process Scheduling', dur: '25 min', done: true },
    { time: '10:00', title: 'Flashcard SM-2 Queue', dur: '15 min', done: true },
    { time: '18:00', title: 'Deadlock Practice Problems', dur: '30 min', done: step >= 2 },
    { time: '21:00', title: 'Quick Consolidation', dur: '10 min', done: false },
  ];
  return (
    <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
      <Header icon={Calendar} title="Circadian Daily Planner" right="Dynamic Balancing" />
      <div className="space-y-2.5 flex-1">
        {items.map((item, i) => (
          <Reveal
            key={item.time}
            show={active}
            delay={i * 100}
            className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
              item.done
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-emerald-400 font-bold">{item.time}</span>
              <span className="font-medium text-xs sm:text-sm text-white">{item.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-slate-400">{item.dur}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                {item.done ? 'Done ✓' : 'Queued'}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal show={step >= 3} className="p-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-xs text-emerald-300 flex items-center justify-between">
        <span>Session completed early → 15 min buffer preserved for evening review.</span>
        <span className="font-bold">Auto-Balanced</span>
      </Reveal>
    </div>
  );
}

/* ───────────── slide 6 · Achievements & Progress ───────────── */
function AchievementsSlide({ active }: { active: boolean }) {
  const step = useStep(active, 4, 700);
  return (
    <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
      <Header icon={Trophy} title="Cumulative Progress & Streak" right="Level 7 Scholar" />
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-end justify-between">
          <span className="text-2xl sm:text-3xl font-semibold">
            {step >= 1 ? '1,480' : '1,240'}{' '}
            <span className="text-xs text-slate-400 font-mono">XP</span>
          </span>
          <span className="text-xs text-emerald-400 font-mono">+240 XP today</span>
        </div>
        <div className="mt-2.5 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: step >= 1 ? '74%' : '62%' }}
          />
        </div>
      </div>

      <Reveal show={step >= 2} className="flex items-center gap-3.5 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3.5">
        <Trophy className="text-amber-300 shrink-0" size={20} />
        <div>
          <div className="font-medium text-xs sm:text-sm text-white">Badge unlocked · Graph Guru</div>
          <div className="text-[11px] text-slate-300">Mastered 25 topological prerequisite nodes</div>
        </div>
      </Reveal>

      <Reveal show={step >= 3} className="flex items-center gap-3.5 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3.5">
        <Flame className="text-orange-400 shrink-0" size={20} />
        <div>
          <div className="font-medium text-xs sm:text-sm text-white">18-day active study streak</div>
          <div className="text-[11px] text-slate-300">Keep going. 2 more days for the Monthly Master trophy.</div>
        </div>
      </Reveal>

      <Reveal show={step >= 4} className="mt-auto">
        <div className="text-[10px] text-slate-400 font-mono mb-1">21-DAY ACTIVE RECALL HABIT GRID</div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 21 }).map((_, i) => (
            <span
              key={i}
              className={`h-4 rounded ${
                [2, 4, 5, 6, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19, 20].includes(i)
                  ? 'bg-emerald-500'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ───────────── main 3D cylinder showcase ───────────── */
const slides = [
  { label: 'AI Tutor', url: 'ming.ai/tutor', Comp: ChatSlide },
  { label: 'AI Generator', url: 'ming.ai/generator', Comp: GeneratorSlide },
  { label: 'Adaptive Quiz', url: 'ming.ai/adaptive', Comp: AssessmentSlide },
  { label: 'Video & DAG', url: 'ming.ai/dag', Comp: VideoSlide },
  { label: 'Daily Plan', url: 'ming.ai/planner', Comp: DailyPlanSlide },
  { label: 'Achievements', url: 'ming.ai/progress', Comp: AchievementsSlide },
];

export const InteractiveShowcase = () => {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const n = slides.length;

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => e && e.isIntersecting && setVisible(true),
      { threshold: 0.1 }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  // auto-advance around the cylinder every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => (a + 1) % n);
    }, 5000);
    return () => clearInterval(id);
  }, [n]);

  const nextSlide = () => setActive((a) => (a + 1) % n);
  const prevSlide = () => setActive((a) => (a - 1 + n) % n);

  return (
    <section
      id="showcase"
      ref={ref}
      className="relative overflow-hidden bg-[#f6fbf3] dark:bg-background py-20 lg:py-28 scroll-mt-20 border-b border-[#dfe4dd]/60 dark:border-border/60"
    >
      {/* Background Archival Grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-25 pointer-events-none" />

      {/* Heading */}
      <div className="mx-auto mb-10 max-w-3xl px-5 text-center relative z-10">
        <span className="rounded-full bg-[#DDF7EC] dark:bg-emerald-950/40 border border-[#20B486]/20 dark:border-emerald-800/30 px-4 py-1.5 text-xs font-bold font-mono tracking-wide text-[#063B2A] dark:text-emerald-300 uppercase shadow-xs">
          Interactive Product Showcase
        </span>
        <h2 className="mt-5 text-3xl sm:text-4xl lg:text-[44px] text-[#10231C] dark:text-foreground font-extrabold tracking-tight leading-[1.15]">
          From lecture to lab to <span className="text-[#20B486] dark:text-emerald-400">exam mastery.</span>
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#66736D] dark:text-muted-foreground leading-[1.65]">
          Experience the 3D rotating product cylinder. Click any card or indicator to inspect.
        </p>
      </div>

      {/* 3D Cylinder Windows Stage */}
      <div
        className={`relative mx-auto h-[540px] max-w-6xl transition-all duration-1000 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        }`}
        style={{ perspective: 1600 }}
      >
        {/* Floating Left and Right Navigation Arrow Buttons */}
        <button
          onClick={prevSlide}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white dark:bg-card hover:bg-[#DDF7EC] dark:hover:bg-accent text-[#063B2A] dark:text-foreground shadow-soft border border-[#DDE7E1] dark:border-border transition-all hover:scale-110 active:scale-95"
          aria-label="Rotate Cylinder Previous"
        >
          <ChevronLeft className="w-5 h-5 text-[#20B486] dark:text-emerald-400" />
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white dark:bg-card hover:bg-[#DDF7EC] dark:hover:bg-accent text-[#063B2A] dark:text-foreground shadow-soft border border-[#DDE7E1] dark:border-border transition-all hover:scale-110 active:scale-95"
          aria-label="Rotate Cylinder Next"
        >
          <ChevronRight className="w-5 h-5 text-[#20B486] dark:text-emerald-400" />
        </button>

        {slides.map(({ Comp, url }, i) => {
          const d = (i - active + n) % n;
          const offset = d === 0 ? 0 : d === 1 ? 1 : d === n - 1 ? -1 : 0;
          const hidden = d !== 0 && d !== 1 && d !== n - 1;
          const isCenter = offset === 0;

          return (
            <div
              key={i}
              onClick={() => {
                if (!isCenter) setActive(i);
              }}
              className={`absolute left-1/2 top-0 h-[500px] w-[min(780px,92vw)] transition-all duration-700 ease-out select-none ${
                isCenter ? 'cursor-default' : 'cursor-pointer hover:brightness-95'
              } ${offset !== 0 ? 'max-md:!opacity-0' : ''}`}
              style={{
                transform: `translateX(calc(-50% + ${offset * 60}%)) scale(${
                  isCenter ? 1 : 0.86
                }) rotateY(${offset * -12}deg) translateZ(${isCenter ? 0 : -80}px)`,
                filter: isCenter ? 'none' : 'blur(4px) brightness(.82)',
                opacity: hidden ? 0 : isCenter ? 1 : 0.72,
                zIndex: isCenter ? 20 : 10,
                pointerEvents: hidden ? 'none' : 'auto',
              }}
            >
              <WindowFrame url={url}>
                <Comp active={isCenter} />
              </WindowFrame>
            </div>
          );
        })}
      </div>

      {/* Rotating Cylinder Dots & Navigation Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 relative z-10 px-4">
        {slides.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setActive(i)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
              i === active
                ? 'bg-[#20B486] dark:bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-card border border-[#DDE7E1] dark:border-border text-[#66736D] dark:text-muted-foreground hover:text-[#063B2A] dark:hover:text-foreground'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                i === active ? 'bg-white' : 'bg-[#DDE7E1] dark:bg-muted-foreground/40'
              }`}
            />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
