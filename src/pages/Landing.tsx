import React, { useEffect } from 'react';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { InteractiveSample } from '../components/landing/InteractiveSample';
import { Features } from '../components/landing/Features';
import { TrustSection } from '../components/landing/TrustSection';
import { PricingSection } from '../components/landing/PricingSection';
import { FAQSection } from '../components/landing/FAQSection';
import { Footer } from '../components/landing/Footer';

const Landing: React.FC = () => {
  // Update document title and canonical meta tags on mount
  useEffect(() => {
    document.title = "StudyMate AI — Turn Lecture Slides into Flashcards & Quizzes";
    
    // Check or create canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = window.location.origin + '/landing';
      document.head.appendChild(canonical);
    }

    // Add JSON-LD Structured Data for WebApplication
    const schemaId = 'studymate-jsonld-schema';
    let schemaScript = document.getElementById(schemaId) as HTMLScriptElement;
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.id = schemaId;
      schemaScript.type = 'application/ld+json';
      schemaScript.innerHTML = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'StudyMate AI',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'All',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
        },
        description:
          'Turn lecture slides, PDFs and engineering syllabi into verified flashcards, practice quizzes and spaced-repetition revision plans.',
        audience: {
          '@type': 'Audience',
          audienceType: 'Engineering College Students',
        },
      });
      document.head.appendChild(schemaScript);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main id="main-content" role="main">
        {/* 1. Hero with Real Product Mockup */}
        <Hero />

        {/* 2. How It Works (3 Steps) */}
        <HowItWorks />

        {/* 3. Live Interactive Sample (Slide in -> Flashcard & Quiz out) */}
        <InteractiveSample />

        {/* 4. 4 Outcome-Driven Features with Citations */}
        <Features />

        {/* 5. Honest Trust & Privacy Section */}
        <TrustSection />

        {/* 6. Free During Beta Pricing */}
        <PricingSection />

        {/* 7. FAQs & Final CTA */}
        <FAQSection />
      </main>

      {/* 8. Semantic Footer */}
      <Footer />
    </div>
  );
};

export default Landing;
