# Changelog

All notable changes and milestones for **Ming AI** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-02

### Multimodal AI Hackathon Release

#### Added
- **AI Content Generator**
  - Multi-step wizard supporting 8 material types: Flashcards, Quizzes, Mind Maps, Flowcharts, Smart Summaries, and Revision Sheets.
  - Multi-mode inputs: File upload (PDF/Text), rich note paste, or direct topic input.
  - Custom generation controls: Difficulty levels (Easy/Medium/Hard/Adaptive), output size, and exam-focused pointers.
  - Animated multi-stage AI reasoning and generation feedback.
  - Rich action interface: Export to PDF, Save to Vault, and instant preview.

- **Dual-Mode Dashboard System**
  - **College Mode**: Track academic course units, software projects, milestone tasks, and external portfolio metrics.
  - **Exam Preparation Mode**: Syllabus progress, mock test scheduling, revision logs, and performance tracking.

- **Integrated Study & Focus Tools**
  - Pomodoro timer with study tracking.
  - In-browser code editor (Monaco Editor) and simulated terminal.
  - Practice problem integration for coding and algorithmic exercises.

- **Notion-Style Document Vault & Resource Space**
  - Block-based document editor with slash commands and rich formatting.
  - Hierarchical folder and document tree organization.
  - Offline-first caching with IndexedDB and background synchronization.

- **Authentication & Backend Integration**
  - Full Supabase Auth supporting Email/Password and Google OAuth.
  - Automated user profile bootstrapping.
  - LibSQL and Prisma local caching support.
  - Supabase Edge Functions for AI assistant interactions.
