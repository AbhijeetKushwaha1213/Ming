import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../pages/Landing';
import { Hero } from '../components/landing/Hero';
import { InteractiveSample } from '../components/landing/InteractiveSample';
import { FAQSection } from '../components/landing/FAQSection';

describe('Redesigned Landing Page (Authentic & Production-Ready)', () => {
  it('renders all 9 required sections with proper semantic hierarchy', () => {
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // 1. Navbar
    expect(screen.getByLabelText(/StudyMate AI Homepage/i)).toBeInTheDocument();

    // 2. Hero with outcome headline
    expect(
      screen.getByText(/Turn 80-slide lecture decks into exam-ready revision packs in 30 seconds/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Upload your semester PDFs and syllabi/i)
    ).toBeInTheDocument();

    // 3. How It Works
    expect(screen.getByText(/Simple 3-Step Workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload your syllabus or lecture slides/i)).toBeInTheDocument();

    // 4. Interactive Sample
    expect(screen.getByText(/Interactive Live Demonstration/i)).toBeInTheDocument();

    // 5. Features
    expect(screen.getByText(/Engineered For Exam Performance/i)).toBeInTheDocument();
    expect(screen.getByText(/Every card cited to your professor’s exact slide/i)).toBeInTheDocument();

    // 6. Honest Trust Section
    expect(screen.getByText(/Honest Guarantees & Real Limitations/i)).toBeInTheDocument();
    expect(screen.getByText(/Your notes stay in your private vault/i)).toBeInTheDocument();
    expect(screen.getByText(/AI makes mistakes — always verify/i)).toBeInTheDocument();

    // 7. Pricing Beta Block
    expect(screen.getByText(/100% Free during our academic beta/i)).toBeInTheDocument();
    expect(screen.getByText(/Semester Pass/i)).toBeInTheDocument();

    // 8. FAQ Section
    expect(screen.getByText(/Frequently Asked Questions/i)).toBeInTheDocument();

    // 9. Semantic Footer
    expect(container.querySelector('footer')).toBeInTheDocument();

    // Check anchor links exist
    expect(container.querySelector('#how-it-works')).toBeInTheDocument();
    expect(container.querySelector('#interactive-sample')).toBeInTheDocument();
    expect(container.querySelector('#features')).toBeInTheDocument();
    expect(container.querySelector('#trust')).toBeInTheDocument();
    expect(container.querySelector('#pricing')).toBeInTheDocument();
    expect(container.querySelector('#faq')).toBeInTheDocument();
  });

  it('strictly enforces no fabricated stats or buzzwords, and includes marked placeholders', () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // Hard rules: NO fake stats, NO Oxford/Stanford claims, NO "zero hallucinations" claims
    expect(screen.queryByText(/120,000\+ Scholars/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Oxford, Stanford & MIT/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/94\.6% 90-Day Exam Concept Retention/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Zero Hallucinations/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/neural precision/i)).not.toBeInTheDocument();

    // Check that marked placeholders are present
    expect(screen.getByText(/{{REAL_USER_COUNT}}/i)).toBeInTheDocument();
    expect(screen.getByText(/{{REAL_CAMPUS_COUNT}}/i)).toBeInTheDocument();
  });

  it('supports interactive card flip and SM-2 recall rating in Hero', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    // Initial question is visible
    expect(screen.getByText(/What is/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Belady’s Anomaly/i).length).toBeGreaterThan(0);

    // Click flip to reveal answer
    const flipBtn = screen.getByText(/Reveal Answer/i);
    fireEvent.click(flipBtn);
    expect(screen.getByText(/Show Prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/Answer \/ Definition/i)).toBeInTheDocument();

    // Click recall rating
    const masterBtn = screen.getByText(/Mastered \(\+3d\)/i);
    fireEvent.click(masterBtn);
    expect(screen.getByText(/Next review scheduled in 3 days/i)).toBeInTheDocument();
  });

  it('supports topic switching and live quiz answering in InteractiveSample', () => {
    render(
      <MemoryRouter>
        <InteractiveSample />
      </MemoryRouter>
    );

    // Default OS topic
    expect(screen.getAllByText(/CS304/i).length).toBeGreaterThan(0);

    // Switch to DBMS topic
    const dbmsBtn = screen.getByRole('tab', { name: /CS305/i });
    fireEvent.click(dbmsBtn);
    expect(screen.getByText(/Concurrency Control & 2PL/i)).toBeInTheDocument();

    // Switch to Practice MCQ tab
    const quizTab = screen.getByText(/Practice MCQ/i);
    fireEvent.click(quizTab);

    // Click option
    const correctOpt = screen.getByText(/Only during the Growing Phase/i);
    fireEvent.click(correctOpt);
    expect(screen.getByText(/✓ Correct/i)).toBeInTheDocument();
    expect(screen.getByText(/Explanation:/i)).toBeInTheDocument();
  });

  it('allows expanding and collapsing FAQ accordion items', () => {
    render(
      <MemoryRouter>
        <FAQSection />
      </MemoryRouter>
    );

    const secondQuestionBtn = screen.getByText(/How is this different from pasting my slides into ChatGPT/i);
    fireEvent.click(secondQuestionBtn);
    expect(
      screen.getByText(/General-purpose AI chatbots do not maintain strict page grounding/i)
    ).toBeInTheDocument();
  });
});
