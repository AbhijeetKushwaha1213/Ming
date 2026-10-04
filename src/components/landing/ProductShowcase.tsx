import { useEffect, useRef, useState } from "react";
import {
    Sparkles, Wand2, Video, Trophy, FolderOpen, Play, FileText,
    Flame, Send, Layers, ListChecks, BookOpen, Mic,
} from "lucide-react";

/* ───────────── helpers ───────────── */
function useTypewriter(text: string, run: boolean, speed = 12) {
    const [out, setOut] = useState("");
    useEffect(() => {
        if (!run) { setOut(""); return; }
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

// 0 → max, one step every `ms`. Restarts from 0 each time `run` turns true.
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

function Reveal({ show, delay = 0, className = "", children }: {
    show: boolean; delay?: number; className?: string; children: React.ReactNode;
}) {
    return (
        <div
            className={`transition-all duration-500 ${show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"} ${className}`}
            style={{ transitionDelay: show ? `${delay}ms` : "0ms" }}
        >
            {children}
        </div>
    );
}

function WindowFrame({ url, children }: { url: string; children: React.ReactNode }) {
    return (
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[28px] bg-[#0f141b] shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-2 border-b border-white/5 bg-[#161c25] px-5 py-4">
                <span className="h-3 w-3 rounded-full bg-[#ef7a7a]" />
                <span className="h-3 w-3 rounded-full bg-[#f2c14e]" />
                <span className="h-3 w-3 rounded-full bg-[#6fd98a]" />
                <div className="mx-auto rounded-full bg-white/5 px-5 py-1.5 text-xs text-slate-400">{url}</div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
    );
}

const Header = ({ icon: I, title, right }: { icon: any; title: string; right?: string }) => (
    <div className="flex items-center gap-3 border-b border-white/5 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"><I size={16} /></span>
        <span className="text-sm font-medium text-white">{title}</span>
        {right && (
            <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <i className="h-2 w-2 rounded-full bg-emerald-400" />{right}
            </span>
        )}
    </div>
);

/* ───────────── slide 1 · AI Assistant ───────────── */
function ChatSlide({ active }: { active: boolean }) {
    const step = useStep(active, 4, 800);
    const reply = useTypewriter(
        "Check your queue. list.pop(0) is O(n), so every dequeue shifts the whole list. What would a deque give you instead?",
        active && step >= 2
    );
    return (
        <div className="flex h-full flex-col gap-3 p-6 text-sm text-white">
            <Header icon={Sparkles} title="AI Tutor · Data Structures & Algorithms" right="Connected to your project" />
            <div className="mt-auto" />
            <Reveal show={active} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-emerald-600 px-5 py-3">
                My BFS gets TLE on 10⁵ nodes. Why? 🤔
            </Reveal>
            {step === 1 && (
                <div className="flex w-fit gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    {[0, 1, 2].map((i) => (
                        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                </div>
            )}
            {step >= 2 && (
                <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
                    {reply}<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-emerald-400 align-middle" />
                </div>
            )}
            <Reveal show={step >= 3} className="rounded-xl border border-emerald-400/30 bg-black/40 p-3 font-mono text-xs">
                <span className="text-slate-500">from</span> <span className="text-sky-300">collections</span>{" "}
                <span className="text-slate-500">import</span> <span className="text-sky-300">deque</span>
                <br />queue = deque([start]) <span className="text-emerald-400"># popleft() is O(1) ✓</span>
            </Reveal>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs text-slate-400">
                <Mic size={14} /> Ask a question… <Send size={14} className="ml-auto text-emerald-400" />
            </div>
        </div>
    );
}

/* ───────────── slide 2 · AI Generator ───────────── */
function GeneratorSlide({ active }: { active: boolean }) {
    const step = useStep(active, 3, 800);
    const outs = [
        { I: BookOpen, t: "Smart notes", s: "12 pages" },
        { I: Layers, t: "Flashcards", s: "48 cards" },
        { I: ListChecks, t: "Mock test", s: "20 MCQs" },
    ];
    return (
        <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
            <Header icon={Wand2} title="AI Generator" right="Ready" />
            <Reveal show={active} className="flex items-center gap-3 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/5 p-4">
                <FileText className="text-emerald-400" />
                <div><div className="font-medium">OS_Unit3_Deadlocks.pdf</div><div className="text-xs text-slate-400">42 pages · uploaded</div></div>
            </Reveal>
            <Reveal show={step >= 1}>
                <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                    <span>{step >= 2 ? "Done ✓" : "Analysing concepts…"}</span><span>{step >= 2 ? "100%" : "55%"}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: step >= 2 ? "100%" : step >= 1 ? "55%" : "0%" }} />
                </div>
            </Reveal>
            <div className="grid grid-cols-3 gap-3">
                {outs.map(({ I, t, s }, i) => (
                    <Reveal key={t} show={step >= 2} delay={i * 120} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <I size={18} className="text-emerald-400" />
                        <div className="mt-2 font-medium">{t}</div>
                        <div className="text-xs text-slate-400">{s}</div>
                    </Reveal>
                ))}
            </div>
            <Reveal show={step >= 3} className="mt-auto rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <div className="text-[10px] tracking-widest text-emerald-300">FLASHCARD</div>
                <div className="mt-1 font-medium">Name the 4 Coffman conditions for deadlock.</div>
                <div className="mt-1 text-xs text-slate-300">Mutual exclusion · Hold &amp; wait · No preemption · Circular wait</div>
            </Reveal>
        </div>
    );
}

/* ───────────── slide 3 · Video Learning ───────────── */
function VideoSlide({ active }: { active: boolean }) {
    const step = useStep(active, 4, 700);
    const chapters = [["00:00", "Why normalization"], ["12:40", "1NF → 2NF"], ["31:05", "BCNF"], ["48:20", "Practice problems"]];
    return (
        <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
            <Header icon={Video} title="Video Learning" right="NPTEL · DBMS" />
            <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-5">
                <div className="flex flex-col gap-3">
                    <div className="relative flex flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,.5)]">
                            <Play size={22} fill="currentColor" />
                        </span>
                        <div className="absolute bottom-3 left-3 right-3">
                            <div className="mb-1 text-xs text-slate-300">Normalization · Lecture 14</div>
                            <div className="h-1 rounded-full bg-white/15">
                                <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${(active ? Math.min(step + 1, 5) : 0) * 20}%` }} />
                            </div>
                        </div>
                    </div>
                    <Reveal show={step >= 4} className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
                        <span>Quiz ready · 5 questions</span>
                        <span className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-medium">Start</span>
                    </Reveal>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-[10px] tracking-widest text-slate-400">AUTO CHAPTERS</div>
                    {chapters.map(([t, n], i) => (
                        <Reveal key={t} show={step >= 1} delay={i * 120} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                            <span className="font-mono text-xs text-emerald-400">{t}</span>{n}
                        </Reveal>
                    ))}
                    <Reveal show={step >= 3} className="rounded-lg border border-white/10 p-3 text-xs text-slate-300">
                        <Sparkles size={12} className="mr-1 inline text-emerald-400" />
                        Notes: BCNF needs every determinant to be a candidate key.
                    </Reveal>
                </div>
            </div>
        </div>
    );
}

/* ───────────── slide 4 · Achievements ───────────── */
function AchievementsSlide({ active }: { active: boolean }) {
    const step = useStep(active, 4, 700);
    return (
        <div className="flex h-full flex-col gap-4 p-6 text-sm text-white">
            <Header icon={Trophy} title="Achievements" right="Level 7" />
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-end justify-between">
                    <span className="text-3xl font-semibold">{step >= 1 ? "1,480" : "1,240"} <span className="text-sm text-slate-400">XP</span></span>
                    <span className="text-xs text-emerald-400">+240 today</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: step >= 1 ? "74%" : "62%" }} />
                </div>
            </div>
            <Reveal show={step >= 2} className="flex items-center gap-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
                <Trophy className="text-amber-300" />
                <div><div className="font-medium">Badge unlocked · Graph Guru</div><div className="text-xs text-slate-300">Solved 25 graph problems</div></div>
            </Reveal>
            <Reveal show={step >= 3} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <Flame className="text-orange-400" />
                <div><div className="font-medium">12-day study streak</div><div className="text-xs text-slate-400">Keep going. 2 more days for a new badge.</div></div>
            </Reveal>
            <Reveal show={step >= 4} className="mt-auto grid grid-cols-7 gap-1.5">
                {Array.from({ length: 21 }).map((_, i) => (
                    <span key={i} className={`h-5 rounded ${[2, 5, 6, 9, 10, 12, 13, 15, 16, 17, 19, 20].includes(i) ? "bg-emerald-500" : "bg-white/10"}`} />
                ))}
            </Reveal>
        </div>
    );
}

/* ───────────── slide 5 · Resources ───────────── */
function ResourcesSlide({ active }: { active: boolean }) {
    const step = useStep(active, 3, 700);
    const items = [
        ["GATE CSE PYQs (2015–24)", "PDF · 320 questions"],
        ["DSA Sheet · 450 problems", "Arrays → DP"],
        ["Computer Networks notes", "Unit 1–5 · Handwritten"],
        ["OS Previous Year Papers", "University exams"],
    ];
    return (
        <div className="flex h-full flex-col gap-3 p-6 text-sm text-white">
            <Header icon={FolderOpen} title="Resources" right="CSE · Semester 5" />
            <div className="grid flex-1 grid-cols-2 gap-3 pt-1">
                {items.map(([t, s], i) => (
                    <Reveal key={t} show={active && step >= Math.min(i, 3)} delay={i * 100} className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                        <FileText size={18} className="text-emerald-400" />
                        <div><div className="mt-3 font-medium">{t}</div><div className="text-xs text-slate-400">{s}</div></div>
                    </Reveal>
                ))}
            </div>
            <Reveal show={step >= 3} className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-xs">
                <Wand2 size={14} className="text-emerald-400" /> Generate flashcards from any resource with one click
            </Reveal>
        </div>
    );
}

/* ───────────── main showcase ───────────── */
const slides = [
    { label: "AI assistant", url: "getstudymate.com/ai-chat", Comp: ChatSlide },
    { label: "AI generator", url: "getstudymate.com/generator", Comp: GeneratorSlide },
    { label: "Video learning", url: "getstudymate.com/video", Comp: VideoSlide },
    { label: "Achievements", url: "getstudymate.com/achievements", Comp: AchievementsSlide },
    { label: "Resources", url: "getstudymate.com/resources", Comp: ResourcesSlide },
];

export default function ProductShowcase() {
    const [active, setActive] = useState(0);
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const n = slides.length;

    // fade-in when scrolled into view
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        const io = new IntersectionObserver(([e]) => e && e.isIntersecting && setVisible(true), { threshold: 0.1 });
        if (ref.current) io.observe(ref.current);
        return () => io.disconnect();
    }, []);

    // auto-advance: always runs, no hover pause, no clicking needed
    useEffect(() => {
        const id = setInterval(() => {
            setActive((a) => (a + 1) % n);
        }, 5000);
        return () => clearInterval(id);
    }, [n]);

    return (
        <section id="showcase" ref={ref} className="relative overflow-hidden bg-[#f6f8f4] py-20 scroll-mt-20">
            {/* heading */}
            <div className="mx-auto mb-10 max-w-3xl px-5 text-center">
                <span className="rounded-full bg-emerald-900 px-4 py-1.5 text-xs font-medium tracking-wide text-emerald-100">
                    BUILT FOR B.TECH CSE
                </span>
                <h2 className="mt-5 font-serif text-4xl text-emerald-950 md:text-5xl">
                    From lecture to lab to placement.
                </h2>
                <p className="mt-3 text-slate-600">DSA, OS, DBMS, CN and GATE prep, all in one workflow.</p>
            </div>

            {/* social proof */}
            <div className="mb-10 flex items-center justify-center gap-3 text-sm text-slate-500">
                <div className="flex -space-x-2">
                    {["bg-emerald-800", "bg-teal-700", "bg-emerald-600", "bg-amber-700"].map((c) => (
                        <span key={c} className={`h-8 w-8 rounded-full border-2 border-white ${c}`} />
                    ))}
                </div>
                Used by 2.2K+ students · <span className="text-amber-500">★★★★★</span> 4.9
            </div>

            {/* windows */}
            <div
                className={`relative mx-auto h-[540px] max-w-6xl transition-all duration-1000 ${visible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0"}`}
                style={{ perspective: 1600 }}
            >
                {slides.map(({ Comp, url }, i) => {
                    const d = (i - active + n) % n;
                    const offset = d === 0 ? 0 : d === 1 ? 1 : d === n - 1 ? -1 : 0;
                    const hidden = d !== 0 && d !== 1 && d !== n - 1;
                    return (
                        <div
                            key={i}
                            className={`pointer-events-none absolute left-1/2 top-0 h-[500px] w-[min(780px,90vw)] cursor-default transition-all duration-500 ease-out ${offset !== 0 ? "max-md:!opacity-0" : ""}`}
                            style={{
                                transform: `translateX(calc(-50% + ${offset * 62}%)) scale(${offset === 0 ? 1 : 0.86}) rotateY(${offset * -10}deg)`,
                                filter: offset === 0 ? "none" : "blur(5px) brightness(.8)",
                                opacity: hidden ? 0 : offset === 0 ? 1 : 0.75,
                                zIndex: offset === 0 ? 10 : 1,
                            }}
                        >
                            <WindowFrame url={url}>
                                <Comp active={d === 0} />
                            </WindowFrame>
                        </div>
                    );
                })}
            </div>

            {/* dots (indicators only) */}
            <div className="mt-6 flex items-center justify-center gap-3">
                {slides.map((s, i) => (
                    <span
                        key={s.label}
                        className={`h-2.5 rounded-full transition-all duration-500 ${i === active ? "w-10 bg-emerald-700" : "w-2.5 bg-emerald-700/30"}`}
                    />
                ))}
                <span className="ml-3 text-sm text-slate-500">{slides[active].label}</span>
            </div>
        </section>
    );
}