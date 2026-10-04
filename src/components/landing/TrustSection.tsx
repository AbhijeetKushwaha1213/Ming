import React from 'react';
import { Shield, AlertTriangle, UserCheck, Lock, CheckCircle2 } from 'lucide-react';

export const TrustSection: React.FC = () => {
  return (
    <section
      id="trust"
      className="py-16 lg:py-24 bg-muted/20 border-b border-border scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
            Honest Guarantees & Real Limitations
          </h2>
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Built with transparency, not marketing claims.
          </h3>
          <p className="text-muted-foreground text-base">
            No fake metrics, no exaggerated claims. Here is exactly how your data is handled, where AI can fail, and why this tool was built.
          </p>
        </div>

        {/* 3 Trust Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          
          {/* Pillar 1: Data Privacy & Storage */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-7 space-y-4 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lock className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-foreground">
              Your notes stay in your private vault
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Uploaded syllabus files, PPTs, and flashcards are stored privately in your authenticated account and local offline cache. We do not sell your academic coursework to third parties or train public foundation models on your private class materials.
            </p>
            <div className="pt-2 border-t border-border flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Encrypted at rest & in transit</span>
            </div>
          </div>

          {/* Pillar 2: AI Limitations & Cross-Verification */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-7 space-y-4 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-foreground">
              AI makes mistakes — always verify
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Language models can occasionally misinterpret complex mathematical proofs, blurry handwritten scans, or ambiguous teacher notes. That is why StudyMate explicitly links every card back to its exact slide source so you can cross-check with standard reference books (Galvin, Korth, Tanenbaum).
            </p>
            <div className="pt-2 border-t border-border flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
              <span>Exact slide citations included on every card</span>
            </div>
          </div>

          {/* Pillar 3: Built by an Engineering Student */}
          <div className="rounded-xl border border-border bg-card p-6 sm:p-7 space-y-4 shadow-xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserCheck className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-bold text-foreground">
              Built by an engineering student
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              StudyMate wasn't dreamed up in a corporate board room. It was built out of the painful reality of cramming 400-slide professor PPTs the night before semester mid-terms. It is tailored specifically for the Indian engineering curriculum (AKTU, VTU, Anna Univ, SPPU, etc.).
            </p>
            <div className="pt-2 border-t border-border flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Designed for real university syllabi</span>
            </div>
          </div>

        </div>

        {/* Real User Stats Block with Clearly Marked Placeholders */}
        <div className="rounded-xl border border-border bg-card p-6 text-center max-w-2xl mx-auto shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
            Current Community Status
          </span>
          <p className="text-sm text-foreground mt-2 font-mono">
            Currently serving <strong className="text-primary font-bold">{"{{REAL_USER_COUNT}}"}</strong> engineering students across <strong className="text-primary font-bold">{"{{REAL_CAMPUS_COUNT}}"}</strong> college campuses during the open academic beta.
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            Open-source and student-driven. Star and inspect the code on GitHub.
          </p>
        </div>

      </div>
    </section>
  );
};
