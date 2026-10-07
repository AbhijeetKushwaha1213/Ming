import React from 'react';
import { Card } from '@/components/ui/card';
import { Star, Users, Clock, Award, ShieldCheck } from 'lucide-react';

export const TrustSection = () => {
  const stats = [
    {
      icon: Users,
      number: '10K+',
      label: 'Active Learners',
    },
    {
      icon: Clock,
      number: '1M+',
      label: 'Study Hours Tracked',
    },
    {
      icon: Award,
      number: '50K+',
      label: 'Study Materials Generated',
    },
    {
      icon: Star,
      number: '4.9/5',
      label: 'Student Rating',
    }
  ];

  return (
    <section id="impact" className="py-24 px-4 scroll-mt-20 bg-[#f6fbf3] dark:bg-background border-t border-[#dfe4dd]/60 dark:border-border/60">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#e8f3ed] dark:bg-emerald-950/40 text-[#165034] dark:text-emerald-300 border border-[#165034]/20 dark:border-emerald-800/30 mb-4 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Academic Validation</span>
          </div>
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-[#002313] dark:text-foreground mb-4 tracking-tight">
            Trusted by Students <span className="italic font-serif text-[#165034] dark:text-emerald-400">Worldwide</span>
          </h2>
          <p className="text-base sm:text-lg text-[#2d4a3e] dark:text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Join thousands of university students and researchers who prepare for complex exams with Ming AI.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={index}
                className="p-6 text-center hover:shadow-md transition-all duration-300 border border-[#dfe4dd] dark:border-border bg-white/90 dark:bg-card/90 rounded-2xl shadow-xs"
              >
                <div className="w-12 h-12 rounded-xl bg-[#e8f3ed] dark:bg-emerald-950/40 text-[#165034] dark:text-emerald-300 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-[#165034] dark:text-emerald-300" />
                </div>
                <div className="font-serif text-3xl font-bold text-[#002313] dark:text-foreground mb-1">
                  {stat.number}
                </div>
                <div className="text-sm font-medium text-[#2d4a3e] dark:text-muted-foreground">
                  {stat.label}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Testimonial Quote */}
        <div className="bg-white/90 dark:bg-card/90 backdrop-blur-sm rounded-2xl p-8 sm:p-10 text-center border border-[#dfe4dd] dark:border-border shadow-xs max-w-3xl mx-auto">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-500" />
            ))}
          </div>
          <blockquote className="font-serif text-lg sm:text-xl text-[#002313] dark:text-foreground mb-6 leading-relaxed italic">
            "Ming AI transformed my coursework workflow. Having an automated prerequisite knowledge graph alongside verifiable source citations makes technical exam prep structured and confident."
          </blockquote>
          <div className="text-[#2d4a3e] dark:text-muted-foreground">
            <div className="font-semibold text-sm text-[#002313] dark:text-foreground">Sarah Chen</div>
            <div className="text-xs text-[#52796f] dark:text-muted-foreground">Computer Science & Engineering Student</div>
          </div>
        </div>
      </div>
    </section>
  );
};
