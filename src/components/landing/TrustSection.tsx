
import React from 'react';
import { Card } from '@/components/ui/card';
import { Star, Users, Clock, Award } from 'lucide-react';

export const TrustSection = () => {
  const stats = [
    {
      icon: Users,
      number: '10K+',
      label: 'Active Learners',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Clock,
      number: '1M+',
      label: 'Study Hours',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: Award,
      number: '50K+',
      label: 'Flashcards Created',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: Star,
      number: '4.9/5',
      label: 'User Rating',
      gradient: 'from-yellow-500 to-orange-500'
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Students 
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Worldwide</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of students who are already achieving their academic goals with StudyMate AI.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={index}
                className="p-6 text-center hover:shadow-lg transition-all duration-300 border-0 bg-white/70 backdrop-blur-sm"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${stat.gradient} flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">
                  {stat.label}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Testimonial Placeholder */}
        <div className="bg-gradient-to-r from-white/80 to-indigo-50/80 backdrop-blur-sm rounded-2xl p-8 text-center border border-indigo-100">
          <div className="flex justify-center mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
            ))}
          </div>
          <blockquote className="text-xl text-gray-700 mb-4 font-medium italic">
            "StudyMate AI transformed how I study. The AI-generated flashcards and personalized study plans helped me ace my exams!"
          </blockquote>
          <div className="text-gray-600">
            <div className="font-semibold">Sarah Chen</div>
            <div className="text-sm">Computer Science Student</div>
          </div>
        </div>
      </div>
    </section>
  );
};
