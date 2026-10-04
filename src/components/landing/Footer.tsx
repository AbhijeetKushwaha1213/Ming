import React from 'react';
import { BookOpen, Github, Mail, Shield, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-card text-muted-foreground text-sm">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
        
        {/* Top Grid: Brand & Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          
          {/* Brand Column */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
                <BookOpen className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                StudyMate<span className="text-primary font-black">AI</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              Turns lecture decks, syllabus PDFs, and course notes into verified flashcards, practice quizzes, and an active recall revision plan for engineering students in India.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="{{GITHUB_REPO_URL}}"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors"
                aria-label="GitHub Repository"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="mailto:{{CONTACT_EMAIL}}"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors"
                aria-label="Contact Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Product
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#how-it-works" className="hover:text-foreground transition-colors">
                  How it Works
                </a>
              </li>
              <li>
                <a href="#interactive-sample" className="hover:text-foreground transition-colors">
                  Interactive Sample
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Features & Citations
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-foreground transition-colors">
                  Free Beta Plan
                </a>
              </li>
            </ul>
          </div>

          {/* Core Subjects */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Coursework
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#interactive-sample" className="hover:text-foreground transition-colors">
                  Operating Systems (CS304)
                </a>
              </li>
              <li>
                <a href="#interactive-sample" className="hover:text-foreground transition-colors">
                  DBMS & SQL (CS305)
                </a>
              </li>
              <li>
                <a href="#interactive-sample" className="hover:text-foreground transition-colors">
                  Computer Networks (CS306)
                </a>
              </li>
              <li>
                <a href="#interactive-sample" className="hover:text-foreground transition-colors">
                  Data Structures & Algorithms
                </a>
              </li>
            </ul>
          </div>

          {/* Trust & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Trust & Legal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#trust" className="hover:text-foreground transition-colors">
                  Data Privacy & Vault
                </a>
              </li>
              <li>
                <a href="#trust" className="hover:text-foreground transition-colors">
                  AI Accuracy Disclosures
                </a>
              </li>
              <li>
                <span className="text-muted-foreground/80 cursor-default">
                  Honor Code & Integrity
                </span>
              </li>
              <li>
                <span className="text-muted-foreground/80 cursor-default">
                  Terms of Beta Service
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} StudyMate AI. Built for semester exams and placements.</p>
          <div className="flex items-center gap-1">
            <span>Built by students for students in India</span>
            <span className="text-rose-500">♥</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
