import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Sparkles, Target, ArrowRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Hero = () => {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-20 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        {/* Floating Orbs with Mouse Parallax */}
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"
          style={{
            top: '10%',
            right: '10%',
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`
          }}
        ></div>
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"
          style={{
            bottom: '10%',
            left: '10%',
            transform: `translate(${mousePosition.x * -0.02}px, ${mousePosition.y * -0.02}px)`
          }}
        ></div>
        <div 
          className="absolute w-96 h-96 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-slow"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(${mousePosition.x * 0.01}px, ${mousePosition.y * 0.01}px)`
          }}
        ></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      </div>

      <div className="relative z-10 text-center max-w-6xl mx-auto">
        {/* Logo/Brand with Animation */}
        <div className="flex items-center justify-center mb-8 animate-fade-in-down">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mr-4 shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
              <Brain className="w-8 h-8 text-white animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
            StudyMate AI
          </h1>
        </div>

        {/* Main Heading with Typing Effect */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
            Your Smart Study 
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
                Companion
              </span>
              <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-full animate-expand"></span>
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed animate-fade-in-up">
            Personalized learning powered by AI. Master your exams, build your skills, and achieve your academic goals with intelligent study tools.
          </p>
        </div>

        {/* Feature Pills with Stagger Animation */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {[
            { icon: Sparkles, text: 'AI-Powered Flashcards', color: 'indigo', delay: '0' },
            { icon: Target, text: 'Smart Study Plans', color: 'purple', delay: '100' },
            { icon: Brain, text: 'Progress Tracking', color: 'pink', delay: '200' }
          ].map((item, index) => (
            <div 
              key={index}
              className="flex items-center bg-white/90 backdrop-blur-md px-5 py-3 rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 border border-gray-100 animate-fade-in-up group"
              style={{ animationDelay: `${item.delay}ms` }}
            >
              <item.icon className={`w-5 h-5 text-${item.color}-600 mr-2 group-hover:scale-110 transition-transform`} />
              <span className="text-sm font-semibold text-gray-700">{item.text}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons with Enhanced Styling */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <Button
            size="lg"
            className="relative group bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white px-10 py-6 text-lg font-bold rounded-2xl shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300 overflow-hidden"
            onClick={() => navigate('/auth')}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
            <span className="relative flex items-center">
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="group border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white px-10 py-6 text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 bg-white/80 backdrop-blur-sm"
            onClick={() => navigate('/auth')}
          >
            <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Watch Demo
          </Button>
        </div>

        {/* Trust Indicators with Animation */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-gray-600 animate-fade-in" style={{ animationDelay: '400ms' }}>
          {[
            { color: 'green', text: 'Free to start' },
            { color: 'blue', text: 'No credit card required' },
            { color: 'purple', text: 'AI-powered learning' }
          ].map((item, index) => (
            <div key={index} className="flex items-center group">
              <div className={`w-3 h-3 bg-${item.color}-400 rounded-full mr-2 animate-pulse group-hover:scale-125 transition-transform`}></div>
              <span className="text-sm font-medium group-hover:text-gray-900 transition-colors">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 animate-float">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-2xl opacity-20 blur-sm"></div>
        </div>
        <div className="absolute bottom-20 right-10 animate-float-delayed">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full opacity-20 blur-sm"></div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-gray-400 rounded-full mt-2 animate-scroll"></div>
        </div>
      </div>
    </section>
  );
};
