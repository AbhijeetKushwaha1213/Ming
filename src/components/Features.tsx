
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Calendar, Trophy, Users, MessageCircle, BarChart3 } from 'lucide-react';

export const Features = () => {
  const features = [
    {
      icon: BookOpen,
      title: "Smart Study Plans",
      description: "AI-generated daily micro-plans tailored to your exam schedule and learning style.",
      badge: "Adaptive",
      color: "from-blue-500 to-indigo-600"
    },
    {
      icon: Calendar,
      title: "Timeline Tracking",
      description: "Visual timeline showing your progress from Day 1 with achievements and milestones.",
      badge: "Visual",
      color: "from-purple-500 to-pink-600"
    },
    {
      icon: Trophy,
      title: "Gamification",
      description: "Earn badges, maintain streaks, and level up your learning journey.",
      badge: "Motivating",
      color: "from-green-500 to-teal-600"
    },
    {
      icon: Users,
      title: "Study Communities",
      description: "Connect with peers, join study groups, and learn together.",
      badge: "Social",
      color: "from-orange-500 to-red-600"
    },
    {
      icon: MessageCircle,
      title: "AI Tutor Chat",
      description: "Get instant answers to your doubts with our intelligent AI tutor.",
      badge: "24/7",
      color: "from-cyan-500 to-blue-600"
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Detailed insights into your learning patterns and improvement areas.",
      badge: "Insights",
      color: "from-violet-500 to-purple-600"
    }
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Everything You Need to
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> Excel</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our comprehensive suite of features adapts to your learning style and keeps you motivated throughout your study journey.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="p-8 bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <Badge variant="secondary" className="text-xs font-medium">
                  {feature.badge}
                </Badge>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
