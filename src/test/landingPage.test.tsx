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
    expect(screen.getByText(/Turn your syllabus into/i)).toBeInTheDocument();

    // InteractiveShowcase verification
    expect(screen.getByText(/From lecture to lab to/i)).toBeInTheDocument();
    expect(screen.getByText(/Interactive Product Showcase/i)).toBeInTheDocument();

    // Features verification
    expect(screen.getAllByText(/Core Capabilities/i).length).toBeGreaterThan(0);

    // Footer verification
    expect(container.querySelector('footer')).toBeInTheDocument();

    // Anchor IDs exist for navigation
    expect(container.querySelector('#showcase')).toBeInTheDocument();
    expect(container.querySelector('#features')).toBeInTheDocument();
  });

  it('renders valid image paths without missing assets', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    const images = screen.getAllByRole('img');
    const srcList = images.map((img) => img.getAttribute('src'));
    expect(srcList).toContain('/assets/hero-student.png');
  });

  it('renders call to action buttons in hero', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Start Learning/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore Ming/i })).toBeInTheDocument();
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
