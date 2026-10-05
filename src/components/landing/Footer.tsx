import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-white border-t border-[#DDE7E1] py-14 px-5 sm:px-8 text-[#66736D]">
      <div className="max-w-[1240px] mx-auto space-y-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          
          {/* Column 1: StudyMate Brand */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div
              onClick={() => navigate('/')}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#063B2A] flex items-center justify-center">
                <img
                  src="/assets/studymate-logo.png"
                  alt="StudyMate AI"
                  className="w-5 h-5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-[#063B2A]">
                StudyMate<span className="text-[#20B486]">.</span>
              </span>
            </div>
            <p className="text-xs text-[#66736D] leading-relaxed">
              Autonomous Multimodal Learning Platform for college students and exam preparation.
            </p>
          </div>

          {/* Column 2: AI Learning */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] uppercase font-mono tracking-wider">
              AI Learning
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#dag" className="hover:text-[#063B2A] transition-colors">
                  Knowledge DAG
                </a>
              </li>
              <li>
                <a href="#assessment" className="hover:text-[#063B2A] transition-colors">
                  Adaptive Assessment
                </a>
              </li>
              <li>
                <a href="#tutor" className="hover:text-[#063B2A] transition-colors">
                  Course AI Tutor
                </a>
              </li>
              <li>
                <a href="#timeline" className="hover:text-[#063B2A] transition-colors">
                  Spaced Repetition
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Features */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] uppercase font-mono tracking-wider">
              Features
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#materials" className="hover:text-[#063B2A] transition-colors">
                  Flashcard Generator
                </a>
              </li>
              <li>
                <a href="#materials" className="hover:text-[#063B2A] transition-colors">
                  Mock Quizzes
                </a>
              </li>
              <li>
                <a href="#materials" className="hover:text-[#063B2A] transition-colors">
                  Smart Notes
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-[#063B2A] transition-colors">
                  Personal Vault
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] uppercase font-mono tracking-wider">
              Resources
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#showcase" className="hover:text-[#063B2A] transition-colors">
                  Product Showcase
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-[#063B2A] transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-[#063B2A] transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <button onClick={() => navigate('/auth')} className="hover:text-[#063B2A] transition-colors text-left">
                  Documentation
                </button>
              </li>
            </ul>
          </div>

          {/* Column 5: Company */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#10231C] uppercase font-mono tracking-wider">
              Company
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="/auth" className="hover:text-[#063B2A] transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="/auth" className="hover:text-[#063B2A] transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="/auth" className="hover:text-[#063B2A] transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/auth" className="hover:text-[#063B2A] transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Strip */}
        <div className="pt-8 border-t border-[#DDE7E1] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#66736D]">
          <p>&copy; {new Date().getFullYear()} StudyMate AI. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#063B2A] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#20B486]" />
              Archival Academic Rigor
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
