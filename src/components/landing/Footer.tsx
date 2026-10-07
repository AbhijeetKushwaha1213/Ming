import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-white dark:bg-card border-t border-[#DDE7E1] dark:border-border py-14 px-5 sm:px-8 text-[#66736D] dark:text-muted-foreground">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          
          {/* Column 1: StudyMate Brand */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div
              onClick={() => navigate('/')}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#063B2A] dark:bg-emerald-800 flex items-center justify-center">
                <img
                  src="/assets/studymate-logo.png"
                  alt="StudyMate AI"
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-[#063B2A] dark:text-foreground">
                StudyMate<span className="text-[#20B486]">.</span>
              </span>
            </div>
            <p className="text-xs text-[#66736D] dark:text-muted-foreground leading-relaxed">
              Autonomous Multimodal Learning Platform for college students and exam preparation.
            </p>
          </div>

          {/* Column 2: AI Learning */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] dark:text-foreground uppercase font-mono tracking-wider">
              AI Learning
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#dag" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Knowledge DAG
                </a>
              </li>
              <li>
                <a href="#assessment" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Adaptive Assessment
                </a>
              </li>
              <li>
                <a href="#tutor" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Course AI Tutor
                </a>
              </li>
              <li>
                <a href="#timeline" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Spaced Repetition
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Features */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] dark:text-foreground uppercase font-mono tracking-wider">
              Features
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#materials" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Flashcard Generator
                </a>
              </li>
              <li>
                <a href="#materials" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Mock Quizzes
                </a>
              </li>
              <li>
                <a href="#materials" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Smart Notes
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Personal Vault
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] dark:text-foreground uppercase font-mono tracking-wider">
              Resources
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#showcase" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Product Showcase
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <button onClick={() => navigate('/login')} className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors text-left">
                  Documentation
                </button>
              </li>
            </ul>
          </div>

          {/* Column 5: Company */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] dark:text-foreground uppercase font-mono tracking-wider">
              Company
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="/login" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/login" className="hover:text-[#063B2A] dark:hover:text-emerald-400 transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-[#DDE7E1] dark:border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#66736D] dark:text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} StudyMate AI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#063B2A] dark:text-foreground font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#20B486]" />
              Archival Academic Rigor
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
