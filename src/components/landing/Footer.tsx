
import React from 'react';
import { Brain } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Logo */}
          <div className="flex items-center mb-6 md:mb-0">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center mr-3">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold">StudyMate AI</div>
              <div className="text-sm text-gray-400">Smart Study Companion</div>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-8 text-sm">
            <a href="#" className="text-gray-300 hover:text-white transition-colors">About</a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors">Support</a>
            <a href="#" className="text-gray-300 hover:text-white transition-colors">Privacy</a>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} StudyMate AI. All rights reserved. Made with ❤️ for students worldwide.</p>
        </div>
      </div>
    </footer>
  );
};
