import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../pages/Landing';
import { Hero } from '../components/landing/Hero';
import ProductShowcase from '../components/landing/ProductShowcase';

describe('Landing Page Integration & Authentic Engineering Hero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders the complete landing page with authentic Hero, ProductShowcase, Features, TrustSection, and Footer', () => {
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    );

    // Authentic Hero verification
    expect(screen.getByText(/Turn heavy lecture slides into/i)).toBeInTheDocument();
    expect(screen.getByText(/BUILT FOR B.TECH & ENGINEERING STUDENTS/i)).toBeInTheDocument();
    expect(screen.getByText(/Operating Systems · Unit 3: Deadlocks/i)).toBeInTheDocument();

    // ProductShowcase verification
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

  it('renders valid brand logo without broken assets', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    const images = screen.getAllByRole('img');
    const srcList = images.map((img) => img.getAttribute('src'));
    expect(srcList).toContain('/assets/studymate-logo.png');
  });

  it('supports interactive SM-2 rating buttons on the product mockup flashcard', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    const goodBtn = screen.getByText('Good');
    expect(screen.queryByText(/SM-2 matrix updated/i)).not.toBeInTheDocument();

    fireEvent.click(goodBtn);
    expect(screen.getByText(/SM-2 matrix updated/i)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled for next revision!/i)).toBeInTheDocument();
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
