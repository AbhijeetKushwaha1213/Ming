# 📚 StudyMate AI — Multimodal AI Study Companion

> An intelligent, multimodal AI-powered personal learning platform and study companion designed for students to master complex coursework, exam preparation, and skill development — all in one unified workspace.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-1.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)

---

## 🚀 Overview

**StudyMate AI** bridges the gap between scattered study materials (lecture slides, textbook PDFs, notes, and problem sets) and structured learning. By leveraging multimodal AI capabilities powered by Google Gemini, StudyMate helps learners understand concepts deeply, test their knowledge adaptively, and retain what they learn.

Developed by **Abhijeet Kushwaha** for the **Multimodal AI Hackathon 2026**.

---

## ✨ Key Features

### 🧠 1. Multimodal AI Content Generator
- **8 Interactive Material Types**: Generate Flashcards, Quizzes, Mind Maps, Flowcharts, Smart Summaries, Revision Sheets, and Concept Breakdowns.
- **Flexible Input Modes**: Upload document files (PDF/Text), paste lecture notes, or enter a topic for instant curriculum-aligned generation.
- **Adaptive Difficulty**: Select from Easy, Medium, Hard, or Adaptive AI modes with customized depth and key exam pointers.

### 📊 2. Dual-Mode Student Dashboards
- **College Mode**: Track academic courses, ongoing software projects, daily skill milestones, and portfolio progress.
- **Exam Preparation Mode**: Syllabus breakdown, mock test schedules, revision logs, and performance tracking across subjects.

### 💬 3. Grounded AI Tutor & Chat Assistant
- Interactive study assistant for instant doubt clarification, step-by-step problem solving, and concept deconstruction.
- Context-aware explanations with markdown formatting, code highlighting, and formula rendering.

### ⏱️ 4. Focus Workspace & Interactive Dev Tools
- Integrated Pomodoro focus timer with ambient soundscapes.
- Embedded Monaco code editor and scratchpad with live problem-solving environments.
- Practice launcher integrated with platforms like LeetCode and GitHub.

### 📝 5. Notion-Style Resource Manager & Vault
- Block-based rich text note-taking editor.
- Flashcard Vault with spaced revision cycles and difficulty rating.
- Offline support and caching via IndexedDB for uninterrupted learning.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, Lucide Icons |
| **State & Data** | TanStack React Query, Dexie (IndexedDB), LocalStorage |
| **Editor & UI** | Monaco Editor, TipTap, Framer-motion / Tailwind animations |
| **Backend & DB** | Supabase (PostgreSQL, Auth, Storage, Edge Functions), Node.js server, Prisma, LibSQL |
| **AI Engine** | Google Gemini API (`gemini-1.5-flash`), Supabase Edge Functions |

---

## 🏁 Getting Started

### Prerequisites
- Node.js (v18.0 or higher)
- npm or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AbhijeetKushwaha1213/StudyMate-Multimodal-AI-Hackathon-2026.git
   cd StudyMate-Multimodal-AI-Hackathon-2026
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   Provide your Supabase URL, Anon Key, and Google Gemini API Key in `.env`:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) or [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📁 Project Structure

```
├── api/                    # Server API handlers and SQLite resource management
├── prisma/                 # Prisma schema and SQLite database migrations
├── public/                 # Static assets, manifests, icons
├── server/                 # Express / Node backend server
├── src/
│   ├── api/                # Client-side API helpers and test mocks
│   ├── components/
│   │   ├── ai/             # Premium AI Generator wizard and components
│   │   ├── auth/           # Authentication forms and OAuth callbacks
│   │   ├── chat/           # AI Chat Assistant interface
│   │   ├── dashboard/      # College & Exam dashboards
│   │   ├── exam/           # Exam management and mock tests
│   │   ├── flashcards/     # Flashcard viewer, Quiz runner, Mind maps
│   │   ├── notion/         # Notion-style block editor and document trees
│   │   ├── planner/        # Multi-level study planners and timelines
│   │   ├── projects/       # College project tracking and Focus view
│   │   ├── resources/      # Resource management space
│   │   └── ui/             # Radix UI design system primitives
│   ├── hooks/              # Custom React hooks (AI, offline, stats, audio)
│   ├── integrations/       # Supabase client and generated types
│   ├── pages/              # Top-level view routes (Landing, Index, NotFound)
│   └── services/           # Cache, database sync, and storage services
└── supabase/               # Supabase migrations and Edge Functions
```

---

## 👨‍💻 Author

**Abhijeet Kushwaha**
- GitHub: [@AbhijeetKushwaha1213](https://github.com/AbhijeetKushwaha1213)
- Email: [abhijeetkushwaha1213@gmail.com](mailto:abhijeetkushwaha1213@gmail.com)

---

## 📄 License

This project is licensed under the MIT License — see the LICENSE file for details.
