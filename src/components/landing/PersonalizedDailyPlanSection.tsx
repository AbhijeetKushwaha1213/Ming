import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  Zap,
  RotateCcw,
  Check,
  TrendingUp,
  Award
} from 'lucide-react';

interface Task {
  id: number;
  time: string;
  title: string;
  duration: string;
  category: string;
  completed: boolean;
  notes: string;
}

export const PersonalizedDailyPlanSection = () => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      time: '09:00',
      title: 'Process Scheduling',
      duration: '25 min',
      category: 'Deep Work · High Cognitive Load',
      completed: true,
      notes: 'Completed in 20 min. Mastery reached 84%.',
    },
    {
      id: 2,
      time: '10:00',
      title: 'Flashcard Review',
      duration: '15 min',
      category: 'Spaced Repetition Queue',
      completed: true,
      notes: '18 cards reviewed · 94% retention score.',
    },
    {
      id: 3,
      time: '18:00',
      title: 'Deadlock Practice',
      duration: '30 min',
      category: 'Adaptive Problem Set',
      completed: false,
      notes: 'Calibrated from today’s assessment metrics.',
    },
    {
      id: 4,
      time: '21:00',
      title: 'Quick Revision',
      duration: '10 min',
      category: 'Pre-Sleep Consolidation',
      completed: false,
      notes: 'Review Coffman conditions before sleep.',
    },
  ]);

  const [notification, setNotification] = useState<string | null>(
    'Schedule dynamically optimized: 15 min buffer preserved after morning session.'
  );

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = !t.completed;
          if (updated) {
            setNotification(
              `Task "${t.title}" completed! System automatically recalibrated upcoming slots.`
            );
          }
          return { ...t, completed: updated };
        }
        return t;
      })
    );
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <section
      id="planner"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#dfe4dd]/60 scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#e8f3ed] border border-[#165034]/20 text-[#165034] text-xs font-bold uppercase tracking-wider mb-4">
            <Calendar className="w-3.5 h-3.5" />
            <span>Circadian Study Scheduling</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#002313] tracking-tight mb-3">
            Know what to <span className="italic font-serif text-[#165034]">study next.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#2d4a3e]">
            Your schedule continuously re-optimizes based on your actual pace and concept retention.
          </p>
        </div>

        {/* Daily Planner Card Layout */}
        <div className="max-w-3xl mx-auto bg-[#f6fbf3] rounded-2xl border border-[#dfe4dd] shadow-premium p-6 sm:p-8 space-y-6">
          
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-[#dfe4dd]">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#002313] text-white text-xs font-bold font-mono uppercase">
                TODAY
              </span>
              <span className="text-xs font-semibold text-[#002313]">
                {completedCount} of {tasks.length} Sessions Completed
              </span>
            </div>

            <div className="text-xs font-mono font-bold text-[#165034] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Balancing Active</span>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-3">
            {tasks.map((task) => {
              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                    task.completed
                      ? 'bg-white/80 border-[#dfe4dd] opacity-80'
                      : 'bg-white border-2 border-[#165034] shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-[#165034] text-white'
                          : 'border-2 border-[#dfe4dd] text-transparent hover:border-[#165034]'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#165034]">
                          {task.time}
                        </span>
                        <span className="text-xs text-[#52796f]">·</span>
                        <span
                          className={`font-serif text-base font-bold text-[#002313] ${
                            task.completed ? 'line-through text-[#52796f]' : ''
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <div className="text-xs text-[#52796f] mt-0.5">
                        {task.category}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="px-2.5 py-1 rounded-md bg-[#f0f5ee] font-mono text-xs font-bold text-[#002313]">
                      {task.duration}
                    </span>
                    <div className="text-[10px] text-[#165034] font-medium mt-1">
                      {task.completed ? 'Done ✓' : 'Queued'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dynamic Adaptation Banner */}
          {notification && (
            <div className="p-3.5 rounded-xl bg-[#e8f3ed] border border-[#165034]/20 text-xs text-[#165034] flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#165034] shrink-0" />
                <span>{notification}</span>
              </div>
              <span className="font-mono text-[10px] text-[#52796f] shrink-0">Real-Time</span>
            </div>
          )}

          {/* Bottom Summary Strip */}
          <div className="pt-3 border-t border-[#dfe4dd] flex flex-wrap items-center justify-between gap-3 text-xs text-[#52796f]">
            <span>Click any session above to simulate real-time completion & adaptive reschedule.</span>
            <span className="font-bold text-[#165034]">80 Min Total Study Time</span>
          </div>

        </div>

      </div>
    </section>
  );
};
