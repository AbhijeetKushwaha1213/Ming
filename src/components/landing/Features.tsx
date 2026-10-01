
import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { 
  Brain, 
  BookOpen, 
  Target, 
  Zap, 
  BarChart3, 
  MessageSquare,
  FileText,
  Trophy
} from 'lucide-react';

export const Features = () => {
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = entry.target.querySelectorAll('[data-card-index]');
            cards.forEach((card, index) => {
              setTimeout(() => {
                setVisibleCards(prev => [...prev, index]);
              }, index * 100);
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
      description: 'Generate smart flashcards from any content using advanced AI technology.',
      gradient: 'from-purple-500 to-pink-500',
      shadowColor: 'shadow-purple-500/50'
    },
    {
      icon: MessageSquare,
      title: 'AI Study Assistant',
      description: 'Get instant help with explanations, concepts, and problem-solving.',
      gradient: 'from-blue-500 to-cyan-500',
      shadowColor: 'shadow-blue-500/50'
    },
    {
      icon: Target,
      title: 'Personalized Study Plans',
      description: 'Customized learning paths based on your goals and progress.',
      gradient: 'from-green-500 to-emerald-500',
      shadowColor: 'shadow-green-500/50'
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Monitor your learning journey with detailed analytics and insights.',
      gradient: 'from-orange-500 to-red-500',
      shadowColor: 'shadow-orange-500/50'
    },
    {
      icon: Zap,
      title: 'Quick Review Sessions',
      description: 'Efficient spaced repetition system for optimal retention.',
      gradient: 'from-yellow-500 to-orange-500',
      shadowColor: 'shadow-yellow-500/50'
    },
    {
      icon: FileText,
      title: 'Study Materials',
      description: 'Organize and manage all your study resources in one place.',
      gradient: 'from-indigo-500 to-purple-500',
      shadowColor: 'shadow-indigo-500/50'
    },
    {
      icon: Trophy,
      title: 'Achievement System',
      description: 'Stay motivated with gamified learning and progress rewards.',
      gradient: 'from-pink-500 to-rose-500',
      shadowColor: 'shadow-pink-500/50'
    },
    {
      icon: BookOpen,
      title: 'Resource Library',
      description: 'Access curated study materials and educational content.',
      gradient: 'from-teal-500 to-cyan-500',
      shadowColor: 'shadow-teal-500/50'
    }
  ];

  return (
    <section ref={sectionRef} className="py-24 px-4 bg-gradient-to-b from-white via-indigo-50/30 to-purple-50/30 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30">
        <div className="absolute top-20 right-20 w-72 h-72 bg-purple-300 rounded-full filter blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-blue-300 rounded-full filter blur-3xl animate-float-delayed"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-full text-sm font-semibold">
              ✨ Powerful Features
            </span>
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6">
            Everything You Need to 
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
              Excel
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Powerful AI-driven tools designed to make studying more effective, engaging, and personalized to your learning style.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isVisible = visibleCards.includes(index);
            return (
              <Card 
                key={index}
                data-card-index={index}
                className={`relative p-8 hover:shadow-2xl transition-all duration-500 transform border-0 bg-white/80 backdrop-blur-sm group overflow-hidden ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                
                {/* Icon Container */}
                <div className="relative">
                  <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300`}></div>
                  <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ${feature.shadowColor} shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-indigo-600 group-hover:to-purple-600 transition-all duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover Arrow */}
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${feature.gradient} flex items-center justify-center`}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20">
          <div className="inline-flex items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 cursor-pointer group">
            <Zap className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
            <span className="font-bold text-lg">Start your learning journey today</span>
            <svg className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};
