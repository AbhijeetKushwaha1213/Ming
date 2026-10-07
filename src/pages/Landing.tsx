import React from 'react';
import { Navbar } from '../components/landing/Navbar';
import { Hero } from '../components/landing/Hero';
import { CoreFeaturesSection } from '../components/landing/CoreFeaturesSection';
import { KnowledgeDAGSection } from '../components/landing/KnowledgeDAGSection';
import { AIMaterialGeneratorSection } from '../components/landing/AIMaterialGeneratorSection';
import { AdaptiveAssessmentSection } from '../components/landing/AdaptiveAssessmentSection';
import { AITutorSection } from '../components/landing/AITutorSection';
import { InteractiveShowcase } from '../components/landing/InteractiveShowcase';
import { MaterialToMasteryTimeline } from '../components/landing/MaterialToMasteryTimeline';
import { FinalCTASection } from '../components/landing/FinalCTASection';
import { Footer } from '../components/landing/Footer';

const Landing = () => {
  return (
    <div className="min-h-screen bg-[#F7FAF7] dark:bg-background text-[#10231C] dark:text-foreground font-sans antialiased selection:bg-[#DDF7EC] dark:selection:bg-emerald-900 selection:text-[#063B2A] dark:selection:text-emerald-200">
      {/* 1. Clean Navigation Bar */}
      <Navbar />

      {/* 2. Hero Section inspired by Ed-Tech Reference */}
      <Hero />

      {/* 3. Core Features Showcase (5 Key Capabilities) */}
      <CoreFeaturesSection />

      {/* 5. Prerequisite Knowledge DAG Showcase */}
      <KnowledgeDAGSection />

      {/* 6. AI Study Material Generator (Material -> AI -> 5 Formats) */}
      <AIMaterialGeneratorSection />

      {/* 7. Adaptive Learning & AI Recommendation Showcase */}
      <AdaptiveAssessmentSection />

      {/* 8. Course-Aware AI Tutor Section */}
      <AITutorSection />

      {/* 9. 3D Rotating Cylinder Product Showcase */}
      <InteractiveShowcase />

      {/* 10. From Material to Mastery 8-Stage Timeline */}
      <MaterialToMasteryTimeline />

      {/* 11. Final Strong Minimal CTA */}
      <FinalCTASection />

      {/* 12. Clean Minimalist Footer */}
      <Footer />
    </div>
  );
};

export default Landing;
