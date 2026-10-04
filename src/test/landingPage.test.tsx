import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../pages/Landing';
import { Hero } from '../components/landing/Hero';
import ProductShowcase from '../components/landing/ProductShowcase';

describe('Landing Page Integration & Friend PR Fixes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders the complete landing page with Hero, ProductShowcase, Features, TrustSection, and Footer', () => {
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // Hero verification
    expect(screen.getByText(/Study smarter/i)).toBeInTheDocument();
    expect(screen.getByText(/Archival Rigor · Neural Precision/i)).toBeInTheDocument();

    // ProductShowcase verification (was dead code before our fix)
    expect(screen.getByText(/From lecture to lab to placement/i)).toBeInTheDocument();
    expect(screen.getByText(/BUILT FOR B.TECH CSE/i)).toBeInTheDocument();

    // Features verification
    expect(screen.getByText(/AI-Powered Flashcards/i)).toBeInTheDocument();

    // TrustSection verification
    expect(screen.getByText(/Trusted by Students/i)).toBeInTheDocument();

    // Anchor IDs exist for navigation
    expect(container.querySelector('#showcase')).toBeInTheDocument();
    expect(container.querySelector('#features')).toBeInTheDocument();
    expect(container.querySelector('#impact')).toBeInTheDocument();
  });

  it('renders valid image paths without missing assets', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    const images = screen.getAllByRole('img');
    const srcList = images.map((img) => img.getAttribute('src'));
    expect(srcList).toContain('/assets/studymate-logo.png');
    expect(srcList).toContain('/assets/hero-student.png');
  });

  it('supports interactive SM-2 review simulation state toggles', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    const reviewBtn = screen.getByText(/Review \(12h\)/i);
    const masteredBtn = screen.getByText(/Mastered \(4d\)/i);

    expect(screen.queryByText(/Interval rescheduled/i)).not.toBeInTheDocument();

    fireEvent.click(reviewBtn);
    expect(screen.getByText(/Interval rescheduled. SM-2 decay matrix updated./i)).toBeInTheDocument();

    fireEvent.click(masteredBtn);
    expect(screen.getByText(/Interval rescheduled. SM-2 decay matrix updated./i)).toBeInTheDocument();
  });

  it('auto-rotates ProductShowcase slides on timer interval', () => {
    render(
      <MemoryRouter>
        <ProductShowcase />
      </MemoryRouter>
    );

    expect(screen.getByText(/AI assistant/i)).toBeInTheDocument();

    // Advance by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const labels = screen.getAllByText(/AI generator/i);
    expect(labels.length).toBeGreaterThan(0);
  });
});
