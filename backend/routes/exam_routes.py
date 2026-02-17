"""Exam session and question routes.

These endpoints power the adaptive exam system:
- Start/end exam sessions
- Generate adaptive questions
- Submit answers and update ELO ratings
- Review queue management
"""

from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from services.question_selector import select_next_question
from services.elo import update_ratings, get_difficulty_label
from services.review_queue import (
    add_to_review_queue,
    auto_queue_weak_concept,
    get_due_reviews,
    get_concept_mastery,
)
from models.schemas import (
    GenerateQuestionRequest,
    GeneratedQuestion,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    StartSessionRequest,
    SessionResponse,
    AddReviewRequest,
)

router = APIRouter(prefix="/exam", tags=["exam"])


@router.post("/session/start", response_model=SessionResponse)
async def start_session(
    req: StartSessionRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Start a new exam session for tracking progress within a sitting."""
    db = get_supabase()

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

    user = db.table("users").select("global_skill").eq("id", user_id).single().execute()

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
    """Generate the next adaptive question for the user."""
    db = get_supabase()

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
        scenario_text=question.get("scenario_text", ""),
        question_text=question["question_text"],
        options=question["options"],
        domain=question["domain"],
        difficulty=question["difficulty"],
        concept_tag=question.get("concept_tag", ""),
        session_id=req.session_id,
    )


@router.post("/submit-answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    req: SubmitAnswerRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Submit an answer and update ELO ratings for user and question."""
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
    try:
        user = db.table("users").select("global_skill, current_streak, longest_streak, last_active_date").eq("id", user_id).single().execute()
    except Exception:
        # Fallback if v2 columns don't exist yet
        user = db.table("users").select("global_skill").eq("id", user_id).single().execute()
        user.data["current_streak"] = 0
        user.data["longest_streak"] = 0
        user.data["last_active_date"] = None
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

    # ============================================
    # DAILY ACTIVITY & STREAK TRACKING
    # ============================================
    today = date.today().isoformat()
    try:
        existing_activity = (
            db.table("daily_activity")
            .select("*")
            .eq("user_id", user_id)
            .eq("activity_date", today)
            .execute()
        )
        if existing_activity.data:
            da = existing_activity.data[0]
            db.table("daily_activity").update({
                "questions_answered": da["questions_answered"] + 1,
                "questions_correct": da["questions_correct"] + (1 if is_correct else 0),
                "time_spent_seconds": da["time_spent_seconds"] + (req.time_spent_seconds or 0),
            }).eq("id", da["id"]).execute()
        else:
            db.table("daily_activity").insert({
                "user_id": user_id,
                "activity_date": today,
                "questions_answered": 1,
                "questions_correct": 1 if is_correct else 0,
                "time_spent_seconds": req.time_spent_seconds or 0,
            }).execute()

        # Update streak
        u = user.data
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        last_active = str(u.get("last_active_date") or "") if u.get("last_active_date") else ""
        if last_active == yesterday:
            new_streak = (u.get("current_streak") or 0) + 1
        elif last_active == today:
            new_streak = u.get("current_streak") or 1
        else:
            new_streak = 1

        db.table("users").update({
            "current_streak": new_streak,
            "longest_streak": max(new_streak, u.get("longest_streak") or 0),
            "last_active_date": today,
        }).eq("id", user_id).execute()
    except Exception:
        pass  # Non-critical: don't fail answer submission over streak tracking

    # ============================================
    # AUTO-QUEUE FOR REVIEW (incorrect answers)
    # ============================================
    auto_queued = False
    if not is_correct:
        try:
            auto_queued = await auto_queue_weak_concept(
                user_id=user_id,
                question_id=q["id"],
                concept_tag=q.get("concept_tag") or "",
            )
        except Exception:
            pass  # Non-critical

    return SubmitAnswerResponse(
        is_correct=is_correct,
        correct_index=q["correct_index"],
        explanation=q.get("explanation") or "",
        why_correct=q.get("explanation") or "",
        why_others_wrong=[],
        concept_tag=q.get("concept_tag") or "",
        difficulty_label=get_difficulty_label(q["difficulty_estimate"]),
        skill_before=user_skill_before,
        skill_after=new_user_skill,
        domain=q["domains"]["name"] if q.get("domains") else "",
        domain_skill_after=new_domain_skill,
        auto_queued_for_review=auto_queued,
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


# ============================================
# Review Queue Endpoints
# ============================================

@router.post("/review/add")
async def add_review(
    req: AddReviewRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Manually add a question to the review queue."""
    try:
        db = get_supabase()
        q = db.table("questions").select("concept_tag").eq("id", req.question_id).single().execute()
        concept_tag = q.data.get("concept_tag") or "" if q.data else ""
        added = await add_to_review_queue(user_id, req.question_id, concept_tag, source="manual")
        return {"added": added}
    except Exception:
        # review_queue table may not exist yet (pre-migration)
        return {"added": False, "message": "Review queue not available. Run database migration 002_v2_features.sql."}


@router.get("/review/due")
async def get_reviews_due(user_id: str = Depends(get_current_user_id)):
    """Get questions due for review."""
    try:
        reviews = await get_due_reviews(user_id)
        return {"reviews": reviews, "count": len(reviews)}
    except Exception:
        return {"reviews": [], "count": 0}


@router.get("/review/concepts")
async def get_concepts(user_id: str = Depends(get_current_user_id)):
    """Get mastery scores per concept."""
    try:
        concepts = await get_concept_mastery(user_id)
        return {"concepts": concepts}
    except Exception:
        return {"concepts": []}
