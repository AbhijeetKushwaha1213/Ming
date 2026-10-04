import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export const PricingSection: React.FC = () => {
  const navigate = useNavigate();

  const betaFeatures = [
    'Unlimited lecture slide & syllabus uploads (PDF, PPTX up to 50MB)',
    'Automated flashcard generation with exact slide citations',
    'University 2-mark, 5-mark and GATE/placement MCQ creation',
    'Prerequisite Concept Dependency Graphs (DAG)',
    'SM-2 Spaced Repetition daily revision queue',
    'Personal study vault with offline local storage cache',
    'Full access during the semester exam academic beta',
  ];

  return (
    <section
      id="pricing"
      className="py-16 lg:py-24 bg-background border-b border-border scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center space-y-3 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
            Transparent Pricing
          </h2>
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            100% Free during our academic beta.
          </h3>
          <p className="text-muted-foreground text-base">
            We are students building for students. No hidden paywalls, no forced trial credit cards.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-xl mx-auto rounded-2xl border-2 border-primary/30 bg-card p-8 sm:p-10 shadow-lg relative overflow-hidden">
          
          {/* Top Badge */}
          <div className="flex items-center justify-between pb-6 border-b border-border">
            <div>
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                Open Academic Beta
              </span>
              <h4 className="text-2xl font-black text-foreground mt-2">
                Semester Pass
              </h4>
            </div>
            <div className="text-right">
              <span className="text-4xl font-extrabold text-foreground">₹0</span>
              <span className="text-xs text-muted-foreground block font-mono">Free Forever in Beta</span>
            </div>
          </div>

          {/* Value Proposition */}
          <p className="text-sm text-muted-foreground py-6 border-b border-border leading-relaxed">
            Everything you need to turn semester lecture decks into retention systems before university exams and technical placement rounds.
          </p>

          {/* Feature List */}
          <ul className="py-6 space-y-3.5 text-sm text-foreground">
            {betaFeatures.map((feat) => (
              <li key={feat} className="flex items-start gap-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>
                <span className="leading-snug">{feat}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="pt-4 space-y-3">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-3.5 px-6 text-base font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
            >
              <span>Create Free Account — No Card Needed</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Sign up with college Google account or email in 15 seconds.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
