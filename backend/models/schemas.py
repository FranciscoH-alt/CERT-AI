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
    question_text: str
    options: list[str]
    domain: str
    difficulty: float
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
    skill_before: float
    skill_after: float
    domain: str
    domain_skill_after: float


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


class UserProgress(BaseModel):
    global_skill: float
    total_questions: int
    total_correct: int
    accuracy: float
    pass_probability: float
    domain_skills: list[DomainSkill]
    recent_sessions: list[dict]


class DomainBreakdown(BaseModel):
    domains: list[DomainSkill]


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
