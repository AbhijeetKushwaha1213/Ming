import React, { useState } from 'react';
import {
  Network,
  CheckCircle2,
  Lock,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Brain,
  Layers,
  Sparkles
} from 'lucide-react';

interface DAGNode {
  id: string;
  title: string;
  category: string;
  mastery: number;
  status: 'Mastered' | 'Proficient' | 'Developing' | 'Locked';
  description: string;
  prerequisites: string[];
  reference: string;
  x: number;
  y: number;
}

export const KnowledgeDAGSection = () => {
  const nodes: DAGNode[] = [
    {
      id: 'basics',
      title: 'Computer Basics',
      category: 'Foundation',
      mastery: 100,
      status: 'Mastered',
      description: 'Fundamental architecture of computing machines, von Neumann model, and I/O subsystems.',
      prerequisites: [],
      reference: 'Hennessy & Patterson §1.1 · MIT 6.004',
      x: 12,
      y: 50,
    },
    {
      id: 'cpu',
      title: 'CPU Architecture',
      category: 'Hardware',
      mastery: 96,
      status: 'Mastered',
      description: 'Instruction cycles, arithmetic logic units, program counters, and bus topologies.',
      prerequisites: ['Computer Basics'],
      reference: 'Patterson §2.1–2.4 · Berkeley CS61C',
      x: 30,
      y: 50,
    },
    {
      id: 'registers',
      title: 'Registers & ALU',
      category: 'Hardware',
      mastery: 90,
      status: 'Mastered',
      description: 'Hardware general-purpose registers, condition flags, and high-speed working storage.',
      prerequisites: ['CPU Architecture'],
      reference: 'Silberschatz §1.3 · Stanford CS107',
      x: 48,
      y: 25,
    },
    {
      id: 'memory',
      title: 'Memory Hierarchy',
      category: 'Memory',
      mastery: 88,
      status: 'Mastered',
      description: 'Caches, RAM latency, paging hardware, and address translation mechanisms.',
      prerequisites: ['CPU Architecture'],
      reference: 'Silberschatz §8.1 · CMU 15-213',
      x: 48,
      y: 75,
    },
    {
      id: 'processes',
      title: 'Process Management',
      category: 'Kernel',
      mastery: 82,
      status: 'Proficient',
      description: 'Process control blocks (PCB), process states (New, Ready, Running, Waiting), and context switches.',
      prerequisites: ['Registers & ALU', 'Memory Hierarchy'],
      reference: 'Silberschatz §3.1–3.4 · Harvard CS61',
      x: 65,
      y: 50,
    },
    {
      id: 'scheduling',
      title: 'CPU Scheduling',
      category: 'Scheduling',
      mastery: 74,
      status: 'Proficient',
      description: 'Preemptive vs non-preemptive algorithms: FCFS, SJF, Round Robin, and Multilevel feedback queues.',
      prerequisites: ['Process Management'],
      reference: 'Silberschatz §5.1–5.4 · MIT 6.033',
      x: 80,
      y: 30,
    },
    {
      id: 'synchronization',
      title: 'Synchronization',
      category: 'Concurrency',
      mastery: 58,
      status: 'Developing',
      description: 'Critical section problem, Peterson’s solution, hardware atomic instructions, and Semaphores.',
      prerequisites: ['Process Management', 'CPU Scheduling'],
      reference: 'Silberschatz §6.2–6.8 · Stanford CS110',
      x: 80,
      y: 70,
    },
    {
      id: 'deadlocks',
      title: 'Deadlock Avoidance',
      category: 'Resource',
      mastery: 32,
      status: 'Locked',
      description: 'The four Coffman conditions, resource allocation graphs, Banker’s safety algorithm, and recovery.',
      prerequisites: ['CPU Scheduling', 'Synchronization'],
      reference: 'Silberschatz §7.1–7.7 · Tanenbaum §2.4',
      x: 95,
      y: 50,
    },
  ];

  const [activeNode, setActiveNode] = useState<DAGNode>(nodes[6]); // Synchronization default

  const getStatusColor = (status: DAGNode['status']) => {
    switch (status) {
      case 'Mastered':
        return 'bg-[#20B486] text-white';
      case 'Proficient':
        return 'bg-[#063B2A] dark:bg-emerald-800 text-white';
      case 'Developing':
        return 'bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40';
      case 'Locked':
        return 'bg-[#F7FAF7] dark:bg-muted/40 text-[#66736D] dark:text-muted-foreground border border-[#DDE7E1] dark:border-border';
    }
  };

  return (
    <section
      id="dag"
      className="py-20 lg:py-28 px-5 sm:px-8 bg-white dark:bg-background border-b border-[#DDE7E1] dark:border-border scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-[1240px] mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF7EC] dark:bg-emerald-950/40 border border-[#20B486]/20 dark:border-emerald-800/30 text-[#063B2A] dark:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Network className="w-3.5 h-3.5 text-[#20B486] dark:text-emerald-400" />
            <span>Interactive Prerequisite Graph</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#10231C] dark:text-foreground tracking-tight leading-[1.15] mb-4">
            Don't just study topics.{' '}
            <span className="text-[#20B486] dark:text-emerald-400">Understand how they connect.</span>
          </h2>

          <p className="text-base sm:text-lg text-[#66736D] dark:text-muted-foreground max-w-2xl mx-auto leading-[1.65]">
            StudyMate builds prerequisite-aware concept graphs so you know what to learn first, what comes next, and where you're struggling.
          </p>
        </div>

        {/* Master DAG Canvas + Details Drawer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left / Center: Interactive SVG DAG Canvas */}
          <div className="lg:col-span-8 bg-[#F7FAF7] dark:bg-card/90 rounded-[24px] border border-[#DDE7E1] dark:border-border shadow-soft p-6 sm:p-8 relative min-h-[480px] flex flex-col justify-between overflow-hidden">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE7E1] dark:border-border">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#20B486] animate-pulse" />
                <span className="text-xs font-mono font-bold text-[#063B2A] dark:text-foreground uppercase">
                  Curriculum Graph: CS301 Operating Systems
                </span>
              </div>
              <span className="text-xs text-[#66736D] dark:text-muted-foreground font-medium hidden sm:inline">
                Click any node to inspect details
              </span>
            </div>

            {/* SVG Connecting Flow Lines */}
            <div className="relative w-full h-[340px] sm:h-[370px] my-3">
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Basics -> CPU */}
                <line x1="16" y1="50" x2="26" y2="50" stroke="#20B486" strokeWidth="0.8" strokeDasharray="2 2" className="animate-dash-flow" />
                {/* CPU -> Registers */}
                <line x1="34" y1="46" x2="44" y2="28" stroke="#20B486" strokeWidth="0.8" strokeDasharray="2 2" className="animate-dash-flow" />
                {/* CPU -> Memory */}
                <line x1="34" y1="54" x2="44" y2="72" stroke="#20B486" strokeWidth="0.8" strokeDasharray="2 2" className="animate-dash-flow" />
                {/* Registers -> Processes */}
                <line x1="52" y1="28" x2="61" y2="46" stroke="#20B486" strokeWidth="0.8" strokeDasharray="2 2" className="animate-dash-flow" />
                {/* Memory -> Processes */}
                <line x1="52" y1="72" x2="61" y2="54" stroke="#20B486" strokeWidth="0.8" strokeDasharray="2 2" className="animate-dash-flow" />
                {/* Processes -> Scheduling */}
                <line x1="69" y1="46" x2="76" y2="33" stroke="#20B486" strokeWidth="0.8" strokeDasharray="2 2" className="animate-dash-flow" />
                {/* Processes -> Synchronization */}
                <line x1="69" y1="54" x2="76" y2="67" stroke="#20B486" strokeWidth="0.8" strokeDasharray="2 2" className="animate-dash-flow" />
                {/* Scheduling -> Deadlocks */}
                <line x1="84" y1="33" x2="91" y2="46" stroke="#DDE7E1" strokeWidth="0.8" strokeDasharray="2 2" />
                {/* Synchronization -> Deadlocks */}
                <line x1="84" y1="67" x2="91" y2="54" stroke="#DDE7E1" strokeWidth="0.8" strokeDasharray="2 2" />
              </svg>

              {/* Node Chips */}
              {nodes.map((node) => {
                const isSelected = activeNode.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setActiveNode(node)}
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute z-10 cursor-pointer p-2.5 sm:p-3 rounded-xl border transition-all duration-300 w-32 sm:w-36 text-left ${
                      isSelected
                        ? 'bg-white dark:bg-card border-2 border-[#20B486] dark:border-emerald-500 shadow-soft-lg scale-105 ring-4 ring-[#20B486]/15'
                        : 'bg-white/90 dark:bg-card/80 border-[#DDE7E1] dark:border-border hover:border-[#20B486]/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-mono text-[#66736D] dark:text-muted-foreground truncate">{node.category}</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${getStatusColor(node.status)}`}>
                        {node.status}
                      </span>
                    </div>

                    <div className="font-bold text-xs text-[#10231C] dark:text-foreground truncate">
                      {node.title}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#66736D] dark:text-muted-foreground">
                      <span>Mastery</span>
                      <span className="font-mono font-bold text-[#063B2A] dark:text-emerald-400">{node.mastery}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status Legend Strip */}
            <div className="pt-3 border-t border-[#DDE7E1] dark:border-border flex flex-wrap items-center justify-between gap-3 text-xs text-[#66736D] dark:text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#20B486]" />
                  Mastered (90%+)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#063B2A] dark:bg-emerald-600" />
                  Proficient (70–89%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Developing (&lt;70%)
                </span>
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#66736D] dark:text-muted-foreground" />
                  Locked
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Node Details & Actions Drawer */}
          <div className="lg:col-span-4 bg-[#F7FAF7] dark:bg-card/90 rounded-[24px] border border-[#DDE7E1] dark:border-border shadow-soft p-6 sm:p-7 space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#DDE7E1] dark:border-border">
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${getStatusColor(activeNode.status)}`}>
                {activeNode.status}
              </span>
              <span className="text-xs font-mono font-bold text-[#063B2A] dark:text-emerald-400">
                {activeNode.mastery}% Mastery
              </span>
            </div>

            <div>
              <h3 className="font-extrabold text-2xl text-[#10231C] dark:text-foreground">
                {activeNode.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#66736D] dark:text-muted-foreground mt-2 leading-[1.65]">
                {activeNode.description}
              </p>
            </div>

            {/* Prerequisites */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#10231C] dark:text-foreground uppercase font-mono tracking-wider">
                Prerequisites:
              </div>
              {activeNode.prerequisites.length > 0 ? (
                <div className="space-y-1.5">
                  {activeNode.prerequisites.map((p, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-white dark:bg-card border border-[#DDE7E1] dark:border-border text-xs font-semibold text-[#10231C] dark:text-foreground flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#20B486] dark:text-emerald-400 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-white dark:bg-card border border-[#DDE7E1] dark:border-border text-xs text-[#66736D] dark:text-muted-foreground">
                  None — Root foundational concept.
                </div>
              )}
            </div>

            {/* Source Reference */}
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#10231C] dark:text-foreground uppercase font-mono tracking-wider">
                Source Material:
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-card border border-[#DDE7E1] dark:border-border text-xs text-[#063B2A] dark:text-emerald-300 flex items-center gap-2 font-medium">
                <BookOpen className="w-4 h-4 text-[#20B486] dark:text-emerald-400 shrink-0" />
                <span className="truncate">{activeNode.reference}</span>
              </div>
            </div>

            {/* Actions Requested by Prompt: Generate material, Practice quiz, Ask AI Tutor */}
            <div className="pt-3 border-t border-[#DDE7E1] dark:border-border space-y-2">
              <button
                onClick={() => window.location.href = '/signup'}
                className="w-full py-2.5 px-4 rounded-xl bg-[#20B486] hover:bg-[#1aa378] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Practice 5-Question Quiz →</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => window.location.href = '/signup'}
                  className="py-2 px-3 rounded-xl bg-white dark:bg-card border border-[#DDE7E1] dark:border-border text-[#063B2A] dark:text-foreground text-xs font-bold hover:bg-[#DDF7EC] dark:hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-[#20B486] dark:text-emerald-400" />
                  <span>Flashcards</span>
                </button>
                <button
                  onClick={() => window.location.href = '/signup'}
                  className="py-2 px-3 rounded-xl bg-white dark:bg-card border border-[#DDE7E1] dark:border-border text-[#063B2A] dark:text-foreground text-xs font-bold hover:bg-[#DDF7EC] dark:hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                >
                  <Brain className="w-3.5 h-3.5 text-[#20B486] dark:text-emerald-400" />
                  <span>Ask AI Tutor</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
