import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X, Sparkles } from 'lucide-react';

export const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How it Works', href: '#how-it-works' },
    { label: 'AI Learning', href: '#dag' },
    { label: 'Resources', href: '#materials' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-[#DDE7E1] shadow-[0_4px_20px_rgba(6,59,42,0.04)] py-3.5'
          : 'bg-[#F7FAF7]/90 backdrop-blur-sm py-5'
      }`}
    >
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 flex items-center justify-between gap-6">
        {/* Logo */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#063B2A] flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
            <img
              src="/assets/studymate-logo.png"
              alt="StudyMate AI"
              className="w-7 h-7 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-xl tracking-tight text-[#063B2A]">
              StudyMate<span className="text-[#20B486]">.</span>
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-[#66736D]">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:text-[#063B2A] transition-colors py-1"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/auth')}
            className="hidden sm:inline-flex text-[#10231C] hover:text-[#063B2A] px-3 py-2 text-sm font-semibold transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/auth')}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#20B486] text-white text-sm font-bold hover:bg-[#1aa378] transition-all shadow-[0_4px_14px_rgba(32,180,134,0.25)] hover:shadow-[0_6px_20px_rgba(32,180,134,0.35)] active:scale-98"
          >
            <span>Start Free</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#10231C] hover:bg-[#DDF7EC] transition-colors"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#DDE7E1] px-6 py-5 space-y-3 shadow-lg animate-fade-in">
          <nav className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[#10231C] hover:text-[#20B486] py-1 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-[#DDE7E1] flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/auth');
                }}
                className="w-full text-center py-2.5 text-sm font-bold text-[#063B2A] bg-[#F7FAF7] rounded-xl hover:bg-[#DDF7EC] transition-colors"
              >
                Log in
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
