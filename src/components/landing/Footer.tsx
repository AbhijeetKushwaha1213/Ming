import React from 'react';

export const Footer = () => {
  return (
    <footer className="bg-[#002313] text-[#e8f3ed] py-16 px-4 border-t border-[#165034]/40">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo & Identity */}
          <div className="flex items-center">
            <img
              src="/assets/studymate-logo.png"
              alt="StudyMate AI Logo"
              className="w-10 h-10 object-contain mr-3.5 drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <div className="font-serif text-xl font-bold tracking-tight text-white">StudyMate AI</div>
              <div className="text-xs text-[#a3b899] font-medium tracking-wide">Autonomous Multimodal Academic System</div>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-8 text-sm font-medium">
            <a href="#features" className="text-[#a3b899] hover:text-white transition-colors">Features</a>
            <a href="#impact" className="text-[#a3b899] hover:text-white transition-colors">Research Rigor</a>
            <a href="/login" className="text-[#a3b899] hover:text-white transition-colors">Sign In</a>
            <a href="/login" className="text-[#a3b899] hover:text-white transition-colors">Get Started</a>
          </div>
        </div>

        <div className="border-t border-[#165034]/50 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#7d9472]">
          <p>&copy; {new Date().getFullYear()} StudyMate AI. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Crafted for academic rigor, deep comprehension & cognitive mastery.
          </p>
        </div>
      </div>
    </footer>
  );
};
