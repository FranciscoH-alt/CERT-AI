/**
 * API client for communicating with the FastAPI backend.
 * Automatically attaches the Supabase JWT for authenticated requests.
 */

import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Make an authenticated API request to the backend.
 * Retrieves the current session token and includes it as a Bearer token.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// User endpoints
// ============================================

export async function getUserProfile() {
  return apiRequest<{
    id: string;
    email: string;
    display_name: string;
    global_skill: number;
    theme_preference: string;
  }>("/user/profile");
}

export async function updateUserProfile(data: {
  display_name?: string;
  theme_preference?: string;
}) {
  return apiRequest("/user/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ============================================
// Certification endpoints
// ============================================

export interface Certification {
  id: string;
  code: string;
  title: string;
  description: string;
  is_active: boolean;
  question_count: number;
}

export async function getCertifications(): Promise<Certification[]> {
  return apiRequest("/certifications/");
}

// ============================================
// Exam endpoints
// ============================================

export interface GeneratedQuestion {
  question_id: string;
  question_text: string;
  options: string[];
  domain: string;
  difficulty: number;
  session_id?: string;
  scenario_text: string;
  concept_tag: string;
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_index: number;
  explanation: string;
  skill_before: number;
  skill_after: number;
  domain: string;
  domain_skill_after: number;
  why_correct: string;
  why_others_wrong: string[];
  concept_tag: string;
  difficulty_label: string;
  auto_queued_for_review: boolean;
}

export async function startSession(certificationCode: string = "PL-300") {
  return apiRequest<{ session_id: string; certification_code: string }>("/exam/session/start", {
    method: "POST",
    body: JSON.stringify({ certification_code: certificationCode }),
  });
}

export async function generateQuestion(
  certificationCode: string = "PL-300",
  sessionId?: string
): Promise<GeneratedQuestion> {
  return apiRequest("/exam/generate-question", {
    method: "POST",
    body: JSON.stringify({
      certification_code: certificationCode,
      session_id: sessionId,
    }),
  });
}

export async function submitAnswer(data: {
  question_id: string;
  selected_index: number;
  session_id?: string;
  time_spent_seconds?: number;
}): Promise<SubmitAnswerResponse> {
  return apiRequest("/exam/submit-answer", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function endSession(sessionId: string) {
  return apiRequest(`/exam/session/end?session_id=${sessionId}`, {
    method: "POST",
  });
}

// ============================================
// Progress endpoints
// ============================================

export interface DomainSkill {
  domain_id: string;
  domain_name: string;
  skill_rating: number;
  questions_answered: number;
  questions_correct: number;
  accuracy: number;
  weight: number;
  proficiency_percent: number;
  suggestion: string;
}

export interface PassProbability {
  estimate: number;
  confidence: "low" | "medium" | "high";
  is_active: boolean;
  questions_remaining: number;
  domain_contributions: Record<string, number>;
}

export interface UserProgress {
  global_skill: number;
  total_questions: number;
  total_correct: number;
  accuracy: number;
  pass_probability: PassProbability;
  domain_skills: DomainSkill[];
  current_streak: number;
  longest_streak: number;
  daily_target: number;
  today_answered: number;
  skill_label: string;
  skill_description: string;
  recent_sessions: {
    id: string;
    started_at: string;
    total_questions: number;
    correct_answers: number;
    skill_before: number;
    skill_after: number;
    is_complete: boolean;
  }[];
}

export async function getUserProgress(): Promise<UserProgress> {
  return apiRequest("/progress/user");
}

export async function getDomainBreakdown(): Promise<{ domains: DomainSkill[] }> {
  return apiRequest("/progress/domains");
}

// ============================================
// Skill History endpoints
// ============================================

export interface SkillHistory {
  data_points: { timestamp: string; skill: number }[];
  last_10: { is_correct: boolean; skill_delta: number }[];
  volatility: number;
  skill_label: string;
  skill_description: string;
}

export async function getSkillHistory(): Promise<SkillHistory> {
  return apiRequest("/progress/skill-history");
}

// ============================================
// Review Queue endpoints
// ============================================

export interface ReviewItem {
  id: string;
  question_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  concept_tag: string;
  domain: string;
  due_at: string;
  interval: number;
  ease_factor: number;
}

export async function addToReviewQueue(questionId: string): Promise<{ added: boolean }> {
  return apiRequest("/exam/review/add", {
    method: "POST",
    body: JSON.stringify({ question_id: questionId }),
  });
}

export async function getDueReviews(): Promise<{ reviews: ReviewItem[]; count: number }> {
  return apiRequest("/exam/review/due");
}

// ============================================
// Concept Mastery endpoints
// ============================================

export async function getConceptMastery(): Promise<{
  concepts: Record<string, { mastery_score: number; question_count: number }>;
}> {
  return apiRequest("/exam/review/concepts");
}

// ============================================
// Simulation endpoints
// ============================================

export interface SimulationQuestion {
  question_id: string;
  question_index: number;
  question_text: string;
  scenario_text: string;
  options: string[];
  domain: string;
}

export interface SimulationDomainResult {
  domain_name: string;
  questions_total: number;
  questions_correct: number;
  accuracy: number;
  weight: number;
}

export interface SimulationResults {
  session_id: string;
  score: number;
  is_passed: boolean;
  pass_threshold: number;
  total_questions: number;
  correct_answers: number;
  accuracy: number;
  time_taken_minutes: number;
  domain_results: SimulationDomainResult[];
  question_results: Record<string, unknown>[];
}

export interface SimulationSummary {
  session_id: string;
  score: number;
  is_passed: boolean;
  total_questions: number;
  correct_answers: number;
  started_at: string;
  time_taken_minutes: number;
}

export async function startSimulation(
  certificationCode: string = "PL-300"
): Promise<{
  session_id: string;
  questions: SimulationQuestion[];
  time_limit_seconds: number;
}> {
  return apiRequest("/simulate/start", {
    method: "POST",
    body: JSON.stringify({ certification_code: certificationCode }),
  });
}

export async function submitSimAnswer(data: {
  session_id: string;
  question_id: string;
  question_index: number;
  selected_index: number;
  time_spent_seconds?: number;
}): Promise<{ submitted: boolean }> {
  return apiRequest("/simulate/answer", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function completeSimulation(sessionId: string): Promise<SimulationResults> {
  return apiRequest(`/simulate/complete/${sessionId}`, {
    method: "POST",
  });
}

export async function getSimResults(sessionId: string): Promise<SimulationResults> {
  return apiRequest(`/simulate/results/${sessionId}`);
}

export async function getSimHistory(): Promise<{ simulations: SimulationSummary[] }> {
  return apiRequest("/simulate/history");
}
