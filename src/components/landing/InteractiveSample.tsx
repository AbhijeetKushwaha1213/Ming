import React, { useState } from 'react';
import {
  FileText,
  RotateCw,
  CheckCircle2,
  HelpCircle,
  Layers,
  ChevronRight,
  BookOpen,
  ArrowRight,
} from 'lucide-react';

interface SampleTopic {
  id: string;
  courseCode: string;
  courseName: string;
  topicTitle: string;
  sourceDoc: string;
  slideExcerpt: string;
  flashcard: {
    question: string;
    answer: string;
    citation: string;
    conceptLevel: string;
  };
  examQuestion: {
    marks: string;
    question: string;
    modelAnswer: string;
    citation: string;
  };
  quiz: {
    question: string;
    options: { id: string; text: string; correct: boolean }[];
    explanation: string;
  };
}

const SAMPLE_DATA: SampleTopic[] = [
  {
    id: 'os',
    courseCode: 'CS304',
    courseName: 'Operating Systems',
    topicTitle: 'Virtual Memory & Page Replacement',
    sourceDoc: 'OS_Unit_4_Lecture_Slides_2026.pdf (Slide 18)',
    slideExcerpt: `SLIDE 18: Belady's Anomaly in FIFO
- Common intuition: increasing page frames should decrease page faults.
- Definition: For some page replacement algorithms (specifically FIFO), the page-fault rate may INCREASE as the number of allocated page frames increases.
- Example Reference String: 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5
  * With 3 frames: 9 page faults.
  * With 4 frames: 10 page faults (Fault rate increases!).
- Cause: FIFO does not satisfy the Stack Property (where set of pages in m frames is a subset of m+1 frames).`,
    flashcard: {
      question: "What is Belady's Anomaly and which page replacement algorithm experiences it?",
      answer: "Belady's Anomaly is the phenomenon where adding more physical page frames causes an INCREASE in page faults. It occurs in First-In First-Out (FIFO) replacement because FIFO is not a stack algorithm.",
      citation: "Slide 18 · CS304 Unit 4 · Galvin §9.4",
      conceptLevel: "Core Concept · Memory Management",
    },
    examQuestion: {
      marks: "5 Marks (University End-Sem)",
      question: "Differentiate FIFO and LRU page replacement algorithms with respect to Belady's Anomaly. Prove why LRU is immune.",
      modelAnswer: "1. FIFO replaces the oldest page in memory without considering recent access patterns. It violates the inclusion (stack) property, leading to Belady's anomaly.\n2. LRU replaces the page unused for the longest period. LRU is proven to be a Stack Algorithm: for any reference string, the set of pages in 'n' frames is always a strict subset of pages in 'n+1' frames, mathematically precluding Belady's anomaly.",
      citation: "Slide 18-20 · CS304 Unit 4",
    },
    quiz: {
      question: "Which of the following conditions is required for an algorithm to be immune to Belady's Anomaly?",
      options: [
        { id: 'a', text: 'It must be implemented using hardware FIFO queues', correct: false },
        { id: 'b', text: 'It must satisfy the Stack (Inclusion) Property', correct: true },
        { id: 'c', text: 'It must use a random replacement policy', correct: false },
        { id: 'd', text: 'It must enforce fixed-size partitions only', correct: false },
      ],
      explanation: "Stack algorithms ensure that the set of pages in memory with n frames is a subset of the pages in memory with n+1 frames, completely preventing Belady's Anomaly.",
    },
  },
  {
    id: 'dbms',
    courseCode: 'CS305',
    courseName: 'Database Management Systems',
    topicTitle: 'Concurrency Control & 2PL',
    sourceDoc: 'DBMS_Unit_3_Transactions_2026.pdf (Slide 24)',
    slideExcerpt: `SLIDE 24: Two-Phase Locking (2PL) Protocol
- Phase 1: Growing Phase. Transaction may obtain locks, but cannot release any lock.
- Phase 2: Shrinking Phase. Transaction may release locks, but cannot acquire any new lock.
- Guarantee: 2PL guarantees Conflict Serializability.
- Limitation: Basic 2PL is NOT free from Cascading Rollbacks or Deadlocks.
- Strict 2PL: All Exclusive (X) locks must be held until COMMIT/ABORT. Prevents cascading aborts.`,
    flashcard: {
      question: "What does the Two-Phase Locking (2PL) protocol guarantee, and does it prevent deadlocks?",
      answer: "2PL guarantees Conflict Serializability of concurrent transactions. However, basic 2PL does NOT prevent deadlocks (transactions may still wait cyclically for locks held by others).",
      citation: "Slide 24 · CS305 Unit 3 · Korth §15.1",
      conceptLevel: "Core Concept · Transactions & Concurrency",
    },
    examQuestion: {
      marks: "5 Marks (University End-Sem)",
      question: "Explain the difference between Basic 2PL and Strict 2PL. Why is Strict 2PL preferred in commercial DBMS?",
      modelAnswer: "1. Basic 2PL allows locks to be released during the shrinking phase before commit, which can cause cascading rollbacks if a transaction aborts.\n2. Strict 2PL holds all exclusive locks until transaction completion (COMMIT/ABORT). This eliminates cascading aborts and guarantees recoverable, conflict-serializable schedules.",
      citation: "Slide 24-25 · CS305 Unit 3",
    },
    quiz: {
      question: "In Two-Phase Locking, when is a transaction allowed to acquire a new lock?",
      options: [
        { id: 'a', text: 'Only during the Growing Phase', correct: true },
        { id: 'b', text: 'At any point before COMMIT', correct: false },
        { id: 'c', text: 'During the Shrinking Phase if it holds shared locks', correct: false },
        { id: 'd', text: 'Whenever a deadlock is detected', correct: false },
      ],
      explanation: "Once a transaction releases any lock (enters Shrinking Phase), the 2PL protocol strictly forbids acquiring any new locks.",
    },
  },
  {
    id: 'cn',
    courseCode: 'CS306',
    courseName: 'Computer Networks',
    topicTitle: 'Transport Layer: TCP vs UDP',
    sourceDoc: 'CN_Unit_4_Transport_Protocols_2026.pdf (Slide 12)',
    slideExcerpt: `SLIDE 12: TCP 3-Way Handshake Connection Establishment
1. Client -> Server: SYN (seq = x)
   * Client transitions to SYN_SENT state.
2. Server -> Client: SYN-ACK (seq = y, ack = x + 1)
   * Server allocates buffer and variables; enters SYN_RCVD state.
3. Client -> Server: ACK (ack = y + 1)
   * Client enters ESTABLISHED state. May contain application payload.
- Why 3-way? Prevents delayed duplicate SYN packets from creating phantom half-open connections.`,
    flashcard: {
      question: "Explain why TCP uses a 3-way handshake rather than a 2-way handshake to establish connections.",
      answer: "A 3-way handshake prevents old, delayed duplicate SYN packets from causing the server to allocate resources for a dead connection. Both sender and receiver must synchronize and acknowledge each other's initial sequence numbers (ISNs).",
      citation: "Slide 12 · CS306 Unit 4 · Kurose & Ross §3.5",
      conceptLevel: "Core Protocol · Transport Layer",
    },
    examQuestion: {
      marks: "2 Marks (University Definition)",
      question: "What is the purpose of the SYN and ACK flags during the TCP connection setup?",
      modelAnswer: "SYN (Synchronize) establishes and exchanges Initial Sequence Numbers (ISNs) between client and server. ACK (Acknowledge) confirms receipt of the other endpoint's sequence number (ACK = seq + 1).",
      citation: "Slide 12 · CS306 Unit 4",
    },
    quiz: {
      question: "In the second step of the TCP 3-way handshake, what does the server send?",
      options: [
        { id: 'a', text: 'ACK packet only', correct: false },
        { id: 'b', text: 'SYN packet only with random sequence', correct: false },
        { id: 'c', text: 'SYN-ACK packet with its own seq and ack = client_seq + 1', correct: true },
        { id: 'd', text: 'RST packet if client port is active', correct: false },
      ],
      explanation: "The server acknowledges the client's SYN (ack = x + 1) and simultaneously sends its own SYN (seq = y).",
    },
  },
];

export const InteractiveSample: React.FC = () => {
  const [activeTopicId, setActiveTopicId] = useState<string>('os');
  const [activeTab, setActiveTab] = useState<'flashcard' | 'exam' | 'quiz'>('flashcard');
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const currentTopic = SAMPLE_DATA.find((t) => t.id === activeTopicId) || SAMPLE_DATA[0];

  const handleTopicChange = (id: string) => {
    setActiveTopicId(id);
    setIsFlipped(false);
    setSelectedOption(null);
  };

  return (
    <section
      id="interactive-sample"
      className="py-16 lg:py-24 bg-muted/30 border-b border-border scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-12">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
            Interactive Live Demonstration
          </h2>
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            See raw lecture slides turn into exam material.
          </h3>
          <p className="text-muted-foreground text-base">
            Select a subject below to inspect actual slide text on the left, and the verified revision cards generated on the right.
          </p>
        </div>

        {/* Subject Selector Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-8" role="tablist">
          {SAMPLE_DATA.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTopicId === t.id}
              onClick={() => handleTopicChange(t.id)}
              className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTopicId === t.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <span className="font-mono">{t.courseCode}</span> · {t.courseName}
            </button>
          ))}
        </div>

        {/* 2-Column Playground: Slide In vs Cards Out */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Raw Slide Excerpt (Input) */}
          <div className="lg:col-span-5 rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                <span>Raw Slide Excerpt</span>
              </span>
              <span className="font-mono text-[11px] truncate max-w-[200px]">
                {currentTopic.sourceDoc}
              </span>
            </div>
            <div className="p-4 bg-muted/20 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap select-text">
              {currentTopic.slideExcerpt}
            </div>
            <div className="px-4 py-2.5 border-t border-border bg-card text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Detected: {currentTopic.topicTitle}</span>
              <span className="text-primary font-semibold">100% Parsed</span>
            </div>
          </div>

          {/* Right Column: Generated Interactive Output */}
          <div className="lg:col-span-7 rounded-xl border border-border bg-card shadow-xs overflow-hidden">
            {/* Output Sub-Tabs */}
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 text-xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('flashcard')}
                  className={`py-1 font-semibold transition-colors ${
                    activeTab === 'flashcard'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Flashcard
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('exam')}
                  className={`py-1 font-semibold transition-colors ${
                    activeTab === 'exam'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  End-Sem Q&A
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('quiz')}
                  className={`py-1 font-semibold transition-colors ${
                    activeTab === 'quiz'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Practice MCQ
                </button>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                Verified with Citation
              </span>
            </div>

            {/* Tab 1: Interactive Flashcard */}
            {activeTab === 'flashcard' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">{currentTopic.flashcard.conceptLevel}</span>
                  <span className="font-mono text-muted-foreground">Interactive Flip</span>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-5 min-h-[160px] flex flex-col justify-between">
                  {!isFlipped ? (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Question
                      </span>
                      <p className="text-base font-semibold text-foreground leading-snug">
                        {currentTopic.flashcard.question}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                        Answer
                      </span>
                      <p className="text-sm text-foreground leading-relaxed">
                        {currentTopic.flashcard.answer}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-dashed border-border flex items-center justify-between text-xs text-muted-foreground mt-3">
                    <span className="font-mono text-[11px] text-primary">
                      {currentTopic.flashcard.citation}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="font-medium text-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>{isFlipped ? 'Show Front' : 'Flip to Answer'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Next Review Interval:</span>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 rounded bg-muted border border-border font-mono text-[11px]">
                      Again: 10m
                    </span>
                    <span className="px-2.5 py-1 rounded bg-muted border border-border font-mono text-[11px]">
                      Hard: 1d
                    </span>
                    <span className="px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20 font-mono text-[11px] font-bold">
                      Good: 3d
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: End-Sem Question & Model Answer */}
            {activeTab === 'exam' && (
              <div className="p-6 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {currentTopic.examQuestion.marks}
                  </span>
                  <span className="font-mono text-muted-foreground">{currentTopic.examQuestion.citation}</span>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Question
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {currentTopic.examQuestion.question}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                      Standard University Scheme Model Answer
                    </span>
                    <p className="text-xs text-foreground whitespace-pre-line leading-relaxed font-sans">
                      {currentTopic.examQuestion.modelAnswer}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Practice MCQ */}
            {activeTab === 'quiz' && (
              <div className="p-6 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">Self-Check Quiz</span>
                  <span className="font-mono text-muted-foreground">1 Mark GATE Format</span>
                </div>

                <p className="text-sm font-semibold text-foreground">
                  {currentTopic.quiz.question}
                </p>

                <div className="space-y-2 pt-1">
                  {currentTopic.quiz.options.map((opt) => {
                    const isSelected = selectedOption === opt.id;
                    const isCorrect = opt.correct;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedOption(opt.id)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors flex items-center justify-between text-xs ${
                          isSelected
                            ? isCorrect
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-semibold'
                              : 'border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-200'
                            : 'border-border bg-card hover:bg-muted text-foreground'
                        }`}
                      >
                        <span>{opt.text}</span>
                        {isSelected && (
                          <span className="font-bold">
                            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedOption && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    <strong>Explanation:</strong> {currentTopic.quiz.explanation}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>
    </section>
  );
};
