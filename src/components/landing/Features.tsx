import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { 
  Brain, 
  MessageSquare, 
  Target, 
  BarChart3, 
  Zap, 
  FileText, 
  Trophy, 
  BookOpen,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Features = () => {
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardElements = entry.target.querySelectorAll('[data-card-index]');
            cardElements.forEach((el, index) => {
              setTimeout(() => {
                setVisibleCards((prev) => [...prev, index]);
              }, index * 80);
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Flashcards',
      description: 'Generate high-yield smart flashcards and prerequisite learning graphs from course materials.',
    },
    {
      icon: MessageSquare,
      title: 'AI Study Assistant',
      description: 'Ask deep technical questions grounded strictly in textbook pages, slides, and lecture videos.',
    },
    {
      icon: Target,
      title: 'Personalized Study Plans',
      description: 'Topological learning paths and Bayesian Knowledge Tracing based on your mastery targets.',
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Monitor learning curves, mastery states, and active retention with actionable analytics.',
    },
    {
      icon: Zap,
      title: 'Quick Review Sessions',
      description: 'Algorithmically timed revision schedules to maximize memory retention before major exams.',
    },
    {
      icon: FileText,
      title: 'Study Materials',
      description: 'Auto-compile structured summaries, interactive mind maps, and high-yield study packages.',
    },
    {
      icon: Trophy,
      title: 'Achievement System',
      description: 'Stay disciplined with structured learning streaks, focus milestones, and study tracking.',
    },
    {
      icon: BookOpen,
      title: 'Resource Library',
      description: 'Archive your lecture transcripts, notes, and generated study packages in a personal library.',
    }
  ];

  return (
    <section id="features" ref={sectionRef} className="py-24 px-4 bg-[#f6fbf3] relative overflow-hidden scroll-mt-20 border-t border-[#dfe4dd]/60">
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#e8f3ed] text-[#165034] border border-[#165034]/20 rounded-full text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Learning Architecture</span>
          </div>
          <h2 className="font-serif text-3xl md:text-5xl lg:text-6xl font-normal text-[#002313] mb-6 tracking-tight">
            Everything You Need to <span className="italic font-serif text-[#165034]">Excel</span>
          </h2>
          <p className="text-base sm:text-lg text-[#2d4a3e] max-w-2xl mx-auto leading-relaxed">
            AI-driven scholarly tools designed for university engineering, science, and professional exam preparation.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isVisible = visibleCards.includes(index);
            return (
              <Card 
                key={index}
                data-card-index={index}
                className={`relative p-7 hover:shadow-md transition-all duration-300 border border-[#dfe4dd] bg-white/90 rounded-2xl group flex flex-col justify-between ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${index * 40}ms` }}
              >
                <div>
                  {/* Icon Container */}
                  <div className="w-12 h-12 rounded-xl bg-[#e8f3ed] text-[#165034] flex items-center justify-center mb-5 group-hover:bg-[#165034] group-hover:text-white transition-colors duration-300">
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="font-serif text-lg font-semibold text-[#002313] mb-2.5">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#2d4a3e] leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#dfe4dd]/50 flex items-center text-xs font-medium text-[#165034] opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Learn more</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-3 bg-[#002313] hover:bg-[#165034] text-white px-8 py-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 font-medium text-base group cursor-pointer"
          >
            <Zap className="w-5 h-5 text-[#a3b899] group-hover:rotate-12 transition-transform" />
            <span>Start Your Autonomous Learning Journey</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
};
