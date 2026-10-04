import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowRight, HelpCircle } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

export const FAQSection: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First open by default

  const faqs: FAQItem[] = [
    {
      q: 'Does it work with messy lecture slides and scanned handwritten PDFs?',
      a: 'Yes. StudyMate processes digital lecture slide PDFs, exported PPTX decks, and clean scanned course notes. While crystal-clear digital slides produce the highest citation fidelity, our pipeline handles complex diagrams, equations, and multi-column formatting. If a scanned page is too blurry to parse reliably, StudyMate flags the page so you know to review it manually.',
    },
    {
      q: 'How is this different from pasting my slides into ChatGPT or Claude?',
      a: 'General-purpose AI chatbots do not maintain strict page grounding—they frequently summarize away critical numerical examples, invent textbook definitions that cost marks in university evaluations, and cannot schedule your spaced-repetition recall. StudyMate anchors every single card and quiz item directly to your slide numbers, structures questions specifically for semester exams (2-mark & 5-mark schemes), and automates your daily review queue via the SM-2 algorithm.',
    },
    {
      q: 'Does it support Indian engineering university syllabi (AKTU, VTU, Anna Univ, SPPU, etc.)?',
      a: 'Yes. Because you upload your specific department slides and university syllabus, StudyMate extracts concepts strictly according to your professor’s curriculum. Whether your university follows AICTE, autonomous college regulations, or state technical university question patterns, the questions reflect your uploaded source material.',
    },
    {
      q: 'Can I export flashcards to Anki or Quizlet?',
      a: 'We are actively implementing one-click .apkg (Anki) and CSV export during this beta. For now, you can study all generated decks directly inside StudyMate on your laptop or mobile browser with offline caching support in your private vault.',
    },
    {
      q: 'How does the spaced repetition schedule work before my exams?',
      a: 'StudyMate uses an adapted SuperMemo SM-2 algorithm. When you review a flashcard, you rate your recall (Again, Hard, Good). The system calculates the exact day the memory trace begins to fade (typically +1 day, +3 days, +7 days, +16 days) and surfaces the card in your "Due Today" queue so you retain concepts with minimum study time.',
    },
    {
      q: 'Is StudyMate AI really free? Will you charge later?',
      a: 'StudyMate is 100% free during our open academic beta. We built this as engineering students participating in the hackathon to solve our own study struggles. In the future, core personal studying will remain free, and any optional paid tiers will be reserved for heavy institutional computing or multi-user study groups.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      className="py-16 lg:py-24 bg-muted/20 border-b border-border scroll-mt-16"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-3 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
            Frequently Asked Questions
          </h2>
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Everything you need to know about StudyMate.
          </h3>
          <p className="text-muted-foreground text-base">
            Clear answers about accuracy, exam formats, syllabus compatibility, and pricing.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4 mb-20">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.q}
                className="rounded-xl border border-border bg-card shadow-2xs transition-colors overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFAQ(index)}
                  className="flex w-full items-center justify-between p-5 sm:p-6 text-left text-base font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-expanded={isOpen}
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-6 sm:px-6 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Final CTA Banner */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 sm:p-12 text-center space-y-6 shadow-sm">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Ready For Your Next Exam?
          </span>
          <h4 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight max-w-2xl mx-auto leading-snug">
            Stop copying notes by hand at 2 AM. Turn your syllabus into a revision deck now.
          </h4>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Upload your first lecture slide PDF and have a complete flashcard set and quiz ready in less than a minute.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row justify-center items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-3.5 px-8 text-base font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
            >
              <span>Start Revising Free — No Card Needed</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Free academic beta · Private storage · Takes 30 seconds
          </p>
        </div>

      </div>
    </section>
  );
};
