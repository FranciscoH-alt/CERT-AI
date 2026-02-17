"""Pydantic models for API request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ============================================
# Auth / User schemas
# ============================================

class UserProfile(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    global_skill: float = 1000.0
    theme_preference: str = "light"
    created_at: Optional[datetime] = None


class UpdateUserProfile(BaseModel):
    display_name: Optional[str] = None
    theme_preference: Optional[str] = None
    daily_target: Optional[int] = None


# ============================================
# Question schemas
# ============================================

class GenerateQuestionRequest(BaseModel):
    """Request body for generating a new adaptive question."""
    certification_code: str = "PL-300"
    session_id: Optional[str] = None


class GeneratedQuestion(BaseModel):
    """A question returned from AI generation or cache."""
    question_id: str
    scenario_text: str = ""
    question_text: str
    options: list[str]
    domain: str
    difficulty: float
    concept_tag: str = ""
    session_id: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    """Request body for submitting an answer."""
    question_id: str
    selected_index: int = Field(ge=0, le=3)
    session_id: Optional[str] = None
    time_spent_seconds: Optional[int] = None


class SubmitAnswerResponse(BaseModel):
    """Response after submitting an answer."""
    is_correct: bool
    correct_index: int
    explanation: str
    why_correct: str = ""
    why_others_wrong: list[str] = []
    concept_tag: str = ""
    difficulty_label: str = ""
    skill_before: float
    skill_after: float
    domain: str
    domain_skill_after: float
    auto_queued_for_review: bool = False


# ============================================
# Progress schemas
# ============================================

class DomainSkill(BaseModel):
    domain_id: str
    domain_name: str
    skill_rating: float
    questions_answered: int
    questions_correct: int
    accuracy: float
    weight: float = 0.0
    proficiency_percent: float = 50.0
    suggestion: str = ""


class PassProbability(BaseModel):
    estimate: float
    confidence: str  # "low", "medium", "high"
    is_active: bool
    questions_remaining: int
    domain_contributions: dict[str, float] = {}


class UserProgress(BaseModel):
    global_skill: float
    total_questions: int
    total_correct: int
    accuracy: float
    pass_probability: PassProbability
    domain_skills: list[DomainSkill]
    recent_sessions: list[dict]
    current_streak: int = 0
    longest_streak: int = 0
    daily_target: int = 10
    today_answered: int = 0
    skill_label: str = "Baseline"
    skill_description: str = ""


class DomainBreakdown(BaseModel):
    domains: list[DomainSkill]


class SkillHistory(BaseModel):
    data_points: list[dict]
    last_10: list[dict]
    volatility: float = 0.0
    skill_label: str = "Baseline"
    skill_description: str = ""


# ============================================
# Review Queue schemas
# ============================================

class ReviewItem(BaseModel):
    id: str
    question_id: str
    concept_tag: str = ""
    question_text: str = ""
    domain: str = ""
    next_review_at: Optional[datetime] = None
    mastery_score: float = 0.0
    repetitions: int = 0


class ConceptMastery(BaseModel):
    concept_tag: str
    mastery_score: float
    question_count: int
    last_reviewed: Optional[datetime] = None


class AddReviewRequest(BaseModel):
    question_id: str


# ============================================
# Session schemas
# ============================================

class StartSessionRequest(BaseModel):
    certification_code: str = "PL-300"


class SessionResponse(BaseModel):
    session_id: str
    certification_code: str
    started_at: Optional[datetime] = None


# ============================================
# Certification schemas
# ============================================

class Certification(BaseModel):
    id: str
    code: str
    title: str
    description: Optional[str] = None
    is_active: bool = False
    question_count: int = 0


# ============================================
# Simulation schemas
# ============================================

class StartSimulationRequest(BaseModel):
    certification_code: str = "PL-300"


class SimulationQuestion(BaseModel):
    question_id: str
    question_index: int
    scenario_text: str = ""
    question_text: str
    options: list[str]
    domain: str


class SubmitSimAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    question_index: int
    selected_index: int = Field(ge=0, le=3)
    time_spent_seconds: Optional[int] = None


class SimulationDomainResult(BaseModel):
    domain_name: str
    questions_total: int
    questions_correct: int
    accuracy: float
    weight: float


class SimulationResults(BaseModel):
    session_id: str
    score: float
    is_passed: bool
    pass_threshold: int = 700
    total_questions: int
    correct_answers: int
    accuracy: float
    time_taken_minutes: float = 0.0
    domain_results: list[SimulationDomainResult]
    question_results: list[dict] = []


class SimulationSummary(BaseModel):
    session_id: str
    score: float
    is_passed: bool
    total_questions: int
    correct_answers: int
    started_at: Optional[datetime] = None
    time_taken_minutes: float = 0.0
