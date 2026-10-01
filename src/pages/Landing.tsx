
import React from 'react';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { TrustSection } from '../components/landing/TrustSection';
import { Footer } from '../components/landing/Footer';

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-accent/30 via-background to-accent/20">
      <Hero />
      <Features />
      <TrustSection />
      <Footer />
    </div>
  );
};

export default Landing;
