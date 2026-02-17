/**
 * Zustand global state management.
 *
 * Four stores:
 * 1. useAuthStore — user session and profile
 * 2. useExamStore — current exam session state
 * 3. useThemeStore — light/dark mode preference
 * 4. useSimulationStore — simulation exam state
 */

import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import type { SimulationQuestion, SimulationResults, SubmitAnswerResponse } from "./api";

// ============================================
// Auth Store
// ============================================

interface AuthState {
  user: User | null;
  session: Session | null;
  displayName: string;
  globalSkill: number;
  isLoading: boolean;
  setAuth: (user: User | null, session: Session | null) => void;
  setProfile: (displayName: string, globalSkill: number) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  displayName: "",
  globalSkill: 1000,
  isLoading: true,
  setAuth: (user, session) => set({ user, session }),
  setProfile: (displayName, globalSkill) => set({ displayName, globalSkill }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () =>
    set({
      user: null,
      session: null,
      displayName: "",
      globalSkill: 1000,
    }),
}));

// ============================================
// Exam Store
// ============================================

interface ExamState {
  sessionId: string | null;
  currentQuestion: {
    question_id: string;
    question_text: string;
    options: string[];
    domain: string;
    difficulty: number;
    scenario_text: string;
    concept_tag: string;
  } | null;
  selectedAnswer: number | null;
  showResult: boolean;
  lastResult: SubmitAnswerResponse | null;
  questionsAnswered: number;
  correctAnswers: number;
  isLoading: boolean;
  markedForReview: string[];
  flaggedQuestions: string[];
  timedMode: boolean;
  questionTimer: number;
  questionTimeLimit: number;
  // Actions
  setSessionId: (id: string | null) => void;
  setQuestion: (q: ExamState["currentQuestion"]) => void;
  setSelectedAnswer: (index: number | null) => void;
  setShowResult: (show: boolean) => void;
  setLastResult: (result: ExamState["lastResult"]) => void;
  incrementAnswered: (correct: boolean) => void;
  setLoading: (loading: boolean) => void;
  toggleMarkedForReview: (id: string) => void;
  toggleFlagged: (id: string) => void;
  setTimedMode: (on: boolean) => void;
  tickTimer: () => void;
  resetTimer: () => void;
  reset: () => void;
}

export const useExamStore = create<ExamState>((set) => ({
  sessionId: null,
  currentQuestion: null,
  selectedAnswer: null,
  showResult: false,
  lastResult: null,
  questionsAnswered: 0,
  correctAnswers: 0,
  isLoading: false,
  markedForReview: [],
  flaggedQuestions: [],
  timedMode: false,
  questionTimer: 0,
  questionTimeLimit: 120,
  setSessionId: (sessionId) => set({ sessionId }),
  setQuestion: (currentQuestion) =>
    set({ currentQuestion, selectedAnswer: null, showResult: false, lastResult: null }),
  setSelectedAnswer: (selectedAnswer) => set({ selectedAnswer }),
  setShowResult: (showResult) => set({ showResult }),
  setLastResult: (lastResult) => set({ lastResult }),
  incrementAnswered: (correct) =>
    set((state) => ({
      questionsAnswered: state.questionsAnswered + 1,
      correctAnswers: state.correctAnswers + (correct ? 1 : 0),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  toggleMarkedForReview: (id) =>
    set((state) => ({
      markedForReview: state.markedForReview.includes(id)
        ? state.markedForReview.filter((qId) => qId !== id)
        : [...state.markedForReview, id],
    })),
  toggleFlagged: (id) =>
    set((state) => ({
      flaggedQuestions: state.flaggedQuestions.includes(id)
        ? state.flaggedQuestions.filter((qId) => qId !== id)
        : [...state.flaggedQuestions, id],
    })),
  setTimedMode: (timedMode) => set({ timedMode }),
  tickTimer: () =>
    set((state) => ({ questionTimer: state.questionTimer + 1 })),
  resetTimer: () => set({ questionTimer: 0 }),
  reset: () =>
    set({
      sessionId: null,
      currentQuestion: null,
      selectedAnswer: null,
      showResult: false,
      lastResult: null,
      questionsAnswered: 0,
      correctAnswers: 0,
      isLoading: false,
      markedForReview: [],
      flaggedQuestions: [],
      timedMode: false,
      questionTimer: 0,
    }),
}));

// ============================================
// Theme Store
// ============================================

interface ThemeState {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "light",
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === "light" ? "dark" : "light",
    })),
}));

// ============================================
// Simulation Store
// ============================================

interface SimulationState {
  sessionId: string | null;
  questions: SimulationQuestion[];
  currentIndex: number;
  answers: Record<number, number>;
  markedForReview: number[];
  timeRemaining: number;
  isActive: boolean;
  isComplete: boolean;
  results: SimulationResults | null;
  // Actions
  startSim: (sessionId: string, questions: SimulationQuestion[], timeLimit: number) => void;
  setCurrentIndex: (index: number) => void;
  setAnswer: (questionIndex: number, selectedIndex: number) => void;
  toggleMarkedForReview: (questionIndex: number) => void;
  tickTime: () => void;
  completeSim: (results: SimulationResults) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  sessionId: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  markedForReview: [],
  timeRemaining: 5400,
  isActive: false,
  isComplete: false,
  results: null,
  startSim: (sessionId, questions, timeLimit) =>
    set({
      sessionId,
      questions,
      currentIndex: 0,
      answers: {},
      markedForReview: [],
      timeRemaining: timeLimit,
      isActive: true,
      isComplete: false,
      results: null,
    }),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setAnswer: (questionIndex, selectedIndex) =>
    set((state) => ({
      answers: { ...state.answers, [questionIndex]: selectedIndex },
    })),
  toggleMarkedForReview: (questionIndex) =>
    set((state) => ({
      markedForReview: state.markedForReview.includes(questionIndex)
        ? state.markedForReview.filter((i) => i !== questionIndex)
        : [...state.markedForReview, questionIndex],
    })),
  tickTime: () =>
    set((state) => ({
      timeRemaining: Math.max(0, state.timeRemaining - 1),
    })),
  completeSim: (results) =>
    set({
      isActive: false,
      isComplete: true,
      results,
    }),
  reset: () =>
    set({
      sessionId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      markedForReview: [],
      timeRemaining: 5400,
      isActive: false,
      isComplete: false,
      results: null,
    }),
}));
