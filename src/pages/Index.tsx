
import React from 'react';
import { Hero } from '../components/Hero';
import { Features } from '../components/Features';
import { Dashboard } from '../components/Dashboard';
import { StudyProgress } from '../components/StudyProgress';
import { AIAssistant } from '../components/AIAssistant';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Hero />
      <Features />
      <Dashboard />
      <StudyProgress />
      <AIAssistant />
    </div>
  );
};

export default Index;
