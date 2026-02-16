"""Exam session and question routes.

These endpoints power the adaptive exam system:
- Start/end exam sessions
- Generate adaptive questions
- Submit answers and update ELO ratings
"""

from fastapi import APIRouter, Depends, HTTPException
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from services.question_selector import select_next_question
from services.elo import update_ratings, calculate_pass_probability
from models.schemas import (
    GenerateQuestionRequest,
    GeneratedQuestion,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    StartSessionRequest,
    SessionResponse,
)

router = APIRouter(prefix="/exam", tags=["exam"])


@router.post("/session/start", response_model=SessionResponse)
async def start_session(
    req: StartSessionRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Start a new exam session for tracking progress within a sitting."""
    db = get_supabase()

    # Lookup the certification
    cert = (
        db.table("certifications")
        .select("id")
        .eq("code", req.certification_code)
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not cert.data:
        raise HTTPException(status_code=404, detail="Certification not found or not active")

    # Get current user skill for snapshot
    user = db.table("users").select("global_skill").eq("id", user_id).single().execute()

    # Create session
    session = (
        db.table("exam_sessions")
        .insert({
            "user_id": user_id,
            "certification_id": cert.data["id"],
            "skill_before": user.data["global_skill"],
        })
        .execute()
    )

    return SessionResponse(
        session_id=session.data[0]["id"],
        certification_code=req.certification_code,
        started_at=session.data[0]["started_at"],
    )


@router.post("/generate-question", response_model=GeneratedQuestion)
async def generate_question_endpoint(
    req: GenerateQuestionRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Generate the next adaptive question for the user.

    Uses the question selector to find or generate an appropriately
    difficult question targeting the user's weakest domain.
    """
    db = get_supabase()

    # Lookup the certification
    cert = (
        db.table("certifications")
        .select("id, title")
        .eq("code", req.certification_code)
        .eq("is_active", True)
        .single()
        .execute()
    )
    if not cert.data:
        raise HTTPException(status_code=404, detail="Certification not found or not active")

    # Use adaptive question selector
    question = await select_next_question(
        user_id=user_id,
        certification_id=cert.data["id"],
        cert_name=f"{req.certification_code} {cert.data['title']}",
    )

    if not question:
        raise HTTPException(
            status_code=500,
            detail="Unable to generate question. Please try again.",
        )

    return GeneratedQuestion(
        question_id=question["question_id"],
        question_text=question["question_text"],
        options=question["options"],
        domain=question["domain"],
        difficulty=question["difficulty"],
        session_id=req.session_id,
    )


@router.post("/submit-answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    req: SubmitAnswerRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Submit an answer and update ELO ratings for user and question.

    This is the core adaptive loop:
    1. Check if the answer is correct
    2. Update user's global skill via ELO
    3. Update user's domain-specific skill via ELO
    4. Update question difficulty via ELO
    5. Record the response
    """
    db = get_supabase()

    # Fetch the question
    question = (
        db.table("questions")
        .select("*, domains(id, name)")
        .eq("id", req.question_id)
        .single()
        .execute()
    )
    if not question.data:
        raise HTTPException(status_code=404, detail="Question not found")

    q = question.data
    is_correct = req.selected_index == q["correct_index"]

    # Fetch current user skill
    user = db.table("users").select("global_skill").eq("id", user_id).single().execute()
    user_skill_before = user.data["global_skill"]

    # ============================================
    # ELO UPDATE: Global skill + question difficulty
    # ============================================
    new_user_skill, new_question_difficulty = update_ratings(
        user_skill=user_skill_before,
        question_difficulty=q["difficulty_estimate"],
        is_correct=is_correct,
    )

    # ============================================
    # ELO UPDATE: Domain-specific skill
    # ============================================
    domain_id = q["domain_id"]
    domain_skill_res = (
        db.table("user_domain_skills")
        .select("*")
        .eq("user_id", user_id)
        .eq("domain_id", domain_id)
        .execute()
    )

    if domain_skill_res.data:
        # Update existing domain skill
        ds = domain_skill_res.data[0]
        new_domain_skill, _ = update_ratings(
            user_skill=ds["skill_rating"],
            question_difficulty=q["difficulty_estimate"],
            is_correct=is_correct,
        )
        db.table("user_domain_skills").update({
            "skill_rating": new_domain_skill,
            "questions_answered": ds["questions_answered"] + 1,
            "questions_correct": ds["questions_correct"] + (1 if is_correct else 0),
        }).eq("id", ds["id"]).execute()
    else:
        # Create new domain skill entry
        new_domain_skill, _ = update_ratings(
            user_skill=1000.0,
            question_difficulty=q["difficulty_estimate"],
            is_correct=is_correct,
        )
        db.table("user_domain_skills").insert({
            "user_id": user_id,
            "domain_id": domain_id,
            "skill_rating": new_domain_skill,
            "questions_answered": 1,
            "questions_correct": 1 if is_correct else 0,
        }).execute()

    # ============================================
    # PERSIST: Update user skill, question stats
    # ============================================
    db.table("users").update({"global_skill": new_user_skill}).eq("id", user_id).execute()

    db.table("questions").update({
        "difficulty_estimate": new_question_difficulty,
        "times_answered": q["times_answered"] + 1,
        "times_correct": q["times_correct"] + (1 if is_correct else 0),
    }).eq("id", q["id"]).execute()

    # Record the user's response
    db.table("user_responses").insert({
        "user_id": user_id,
        "question_id": q["id"],
        "session_id": req.session_id,
        "selected_index": req.selected_index,
        "is_correct": is_correct,
        "time_spent_seconds": req.time_spent_seconds,
        "skill_before": user_skill_before,
        "skill_after": new_user_skill,
    }).execute()

    # Update session stats if session_id provided
    if req.session_id:
        session = (
            db.table("exam_sessions")
            .select("total_questions, correct_answers")
            .eq("id", req.session_id)
            .single()
            .execute()
        )
        if session.data:
            db.table("exam_sessions").update({
                "total_questions": session.data["total_questions"] + 1,
                "correct_answers": session.data["correct_answers"] + (1 if is_correct else 0),
                "skill_after": new_user_skill,
            }).eq("id", req.session_id).execute()

    return SubmitAnswerResponse(
        is_correct=is_correct,
        correct_index=q["correct_index"],
        explanation=q["explanation"],
        skill_before=user_skill_before,
        skill_after=new_user_skill,
        domain=q["domains"]["name"] if q.get("domains") else "",
        domain_skill_after=new_domain_skill,
    )


@router.post("/session/end")
async def end_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Mark an exam session as complete."""
    db = get_supabase()

    user = db.table("users").select("global_skill").eq("id", user_id).single().execute()

    db.table("exam_sessions").update({
        "is_complete": True,
        "ended_at": "now()",
        "skill_after": user.data["global_skill"],
    }).eq("id", session_id).eq("user_id", user_id).execute()

    return {"status": "session_ended"}
