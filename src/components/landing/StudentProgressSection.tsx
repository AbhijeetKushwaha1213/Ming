import React from 'react';
import {
  Flame,
  Award,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  BookOpen,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const StudentProgressSection = () => {
  return (
    <section
      id="progress"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#dfe4dd]/60 scroll-mt-20 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#e8f3ed] border border-[#165034]/20 text-[#165034] text-xs font-bold uppercase tracking-wider mb-4">
            <Award className="w-3.5 h-3.5" />
            <span>Learning Analytics</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#002313] tracking-tight mb-3">
            Real-time <span className="italic font-serif text-[#165034]">student progress.</span>
          </h2>

          <p className="text-sm sm:text-base text-[#2d4a3e]">
            One cohesive dashboard. Track overall mastery, active streaks, weak topics, and scheduled reviews at a glance.
          </p>
        </div>

        {/* Cohesive Dashboard Visualization (Not just boring cards!) */}
        <div className="bg-[#f6fbf3] rounded-2xl border border-[#dfe4dd] shadow-premium p-6 sm:p-8 space-y-6">
          
          {/* Top Command Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#dfe4dd]">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#165034] text-white flex items-center justify-center font-serif font-bold text-lg shadow-sm">
                AR
              </div>
              <div>
                <div className="font-serif text-lg font-bold text-[#002313] flex items-center gap-2">
                  <span>Alex Rivera</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#e8f3ed] text-[#165034] font-sans font-bold">
                    Pro Scholar
                  </span>
                </div>
                <div className="text-xs text-[#52796f]">
                  B.Tech Computer Science · Semester 5 · Midterm Target: 9.2 CGPA
                </div>
              </div>
            </div>

            {/* Top Stat Pills */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#dfe4dd] shadow-2xs">
                <Flame className="w-4 h-4 text-orange-500" />
                <div>
                  <div className="text-[10px] text-[#52796f] uppercase font-mono">Streak</div>
                  <div className="text-xs font-bold text-[#002313]">18 Days Active</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#dfe4dd] shadow-2xs">
                <Clock className="w-4 h-4 text-[#165034]" />
                <div>
                  <div className="text-[10px] text-[#52796f] uppercase font-mono">Hours</div>
                  <div className="text-xs font-bold text-[#002313]">38.5 hrs logged</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#165034] text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
                <div>
                  <div className="text-[10px] text-emerald-200 uppercase font-mono">Overall Mastery</div>
                  <div className="text-sm font-bold">84% Across Syllabi</div>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Course Progress Bars */}
            <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-[#dfe4dd] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-sm text-[#002313] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#165034]" />
                  <span>Enrolled Course Progress</span>
                </h4>
                <span className="text-xs text-[#52796f] font-mono">4 Active</span>
              </div>

              <div className="space-y-3.5">
                {[
                  { course: 'CS301 · Operating Systems', mastery: 88, status: 'Exam in 12d' },
                  { course: 'CS304 · Database Management', mastery: 92, status: 'Mastered' },
                  { course: 'CS308 · Computer Networks', mastery: 74, status: 'Needs Practice' },
                  { course: 'CS312 · Design & Analysis of Algo', mastery: 82, status: 'On Track' },
                ].map((c, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#002313]">{c.course}</span>
                      <span className="font-mono font-bold text-[#165034]">{c.mastery}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#dfe4dd] overflow-hidden">
                      <div
                        className="h-full bg-[#165034] rounded-full transition-all"
                        style={{ width: `${c.mastery}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle Column: Weak Topics Remediation */}
            <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-[#dfe4dd] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif font-bold text-sm text-[#002313] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>3 Flagged Weak Topics</span>
                </h4>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                  Action Required
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  { name: "Peterson's Algorithm proof", course: 'OS', decay: '42% retention' },
                  { name: 'Multi-level Paging TLB misses', course: 'OS', decay: '55% retention' },
                  { name: 'B+ Tree internal page split', course: 'DBMS', decay: '58% retention' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-[#f6fbf3] border border-[#dfe4dd] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#002313]">{item.name}</div>
                      <div className="text-[10px] text-[#52796f]">{item.course} · {item.decay}</div>
                    </div>
                    <button className="px-2 py-1 rounded bg-[#002313] text-white text-[11px] font-semibold hover:bg-[#165034] transition-colors">
                      Fix Now
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Upcoming Spaced Reviews & Streak Heatmap */}
            <div className="lg:col-span-3 bg-white p-5 rounded-xl border border-[#dfe4dd] shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif font-bold text-sm text-[#002313] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#165034]" />
                    <span>Upcoming Reviews</span>
                  </h4>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#e8f3ed] text-[#165034] font-medium flex items-center justify-between">
                    <span>Tomorrow, 09:00</span>
                    <span className="font-bold">14 Cards Due</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f0f5ee] text-[#2d4a3e] font-medium flex items-center justify-between">
                    <span>Thursday, 18:00</span>
                    <span className="font-bold">8 Cards Due</span>
                  </div>
                </div>
              </div>

              {/* Mini 14-day study heatmap preview */}
              <div className="pt-3 border-t border-[#dfe4dd]">
                <div className="text-[11px] text-[#52796f] mb-1.5 flex justify-between">
                  <span>14-Day Activity</span>
                  <span className="text-emerald-700 font-bold">100% Consistency</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-4 rounded bg-[#165034] opacity-90 shadow-2xs"
                      title={`Day ${i + 1}: Study goal met`}
                    />
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
