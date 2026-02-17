"""Progress and analytics routes.

These endpoints provide the data for the Progress page:
- Overall user progress and pass probability
- Per-domain skill breakdown
- Skill history and trends
- Recent performance history
"""

import statistics
from datetime import date
from fastapi import APIRouter, Depends
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from services.elo import (
    calculate_weighted_pass_probability,
    get_skill_label,
    get_proficiency_percent,
    get_domain_suggestion,
)
from models.schemas import (
    UserProgress,
    DomainBreakdown,
    DomainSkill,
    PassProbability,
    SkillHistory,
)

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/user", response_model=UserProgress)
async def get_user_progress(user_id: str = Depends(get_current_user_id)):
    """Get comprehensive progress data for the current user."""
    db = get_supabase()

    # Fetch user profile
    user = db.table("users").select("*").eq("id", user_id).single().execute()
    u = user.data

    # Fetch all domain skills with domain info
    domain_skills_res = (
        db.table("user_domain_skills")
        .select("*, domains(id, name, weight)")
        .eq("user_id", user_id)
        .execute()
    )

    # Build domain skill list
    domain_skills = []
    total_questions = 0
    total_correct = 0
    domain_skill_dicts = []  # For pass probability calculation

    for ds in domain_skills_res.data:
        answered = ds["questions_answered"]
        correct = ds["questions_correct"]
        total_questions += answered
        total_correct += correct

        domain_name = ds["domains"]["name"] if ds.get("domains") else "Unknown"
        skill_rating = ds["skill_rating"]
        weight = ds["domains"]["weight"] if ds.get("domains") else 0.0

        domain_skill_dicts.append({
            "name": domain_name,
            "skill_rating": skill_rating,
            "questions_answered": answered,
        })

        domain_skills.append(DomainSkill(
            domain_id=ds["domain_id"],
            domain_name=domain_name,
            skill_rating=skill_rating,
            questions_answered=answered,
            questions_correct=correct,
            accuracy=round(correct / answered * 100, 1) if answered > 0 else 0,
            weight=weight,
            proficiency_percent=get_proficiency_percent(skill_rating),
            suggestion=get_domain_suggestion(skill_rating, domain_name),
        ))

    # Fetch recent responses for pass probability (last 25)
    recent_res = (
        db.table("user_responses")
        .select("is_correct, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(25)
        .execute()
    )
    recent_responses = [{"is_correct": r["is_correct"]} for r in recent_res.data]

    # Calculate weighted pass probability
    pass_prob_data = calculate_weighted_pass_probability(
        domain_skills=domain_skill_dicts,
        total_questions=total_questions,
        recent_responses=recent_responses,
    )

    # Fetch recent sessions (last 10)
    sessions_res = (
        db.table("exam_sessions")
        .select("*")
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .limit(10)
        .execute()
    )

    recent_sessions = [
        {
            "id": s["id"],
            "started_at": s["started_at"],
            "total_questions": s["total_questions"],
            "correct_answers": s["correct_answers"],
            "skill_before": s["skill_before"],
            "skill_after": s["skill_after"],
            "is_complete": s["is_complete"],
        }
        for s in sessions_res.data
    ]

    accuracy = round(total_correct / total_questions * 100, 1) if total_questions > 0 else 0

    # Streak and daily activity
    today_answered = 0
    try:
        today_activity = (
            db.table("daily_activity")
            .select("questions_answered")
            .eq("user_id", user_id)
            .eq("activity_date", date.today().isoformat())
            .execute()
        )
        today_answered = today_activity.data[0]["questions_answered"] if today_activity.data else 0
    except Exception:
        pass  # daily_activity table may not exist yet (pre-migration)

    skill_label, skill_description = get_skill_label(u["global_skill"])

    return UserProgress(
        global_skill=u["global_skill"],
        total_questions=total_questions,
        total_correct=total_correct,
        accuracy=accuracy,
        pass_probability=PassProbability(**pass_prob_data),
        domain_skills=domain_skills,
        recent_sessions=recent_sessions,
        current_streak=u.get("current_streak") or 0,
        longest_streak=u.get("longest_streak") or 0,
        daily_target=u.get("daily_target") or 10,
        today_answered=today_answered,
        skill_label=skill_label,
        skill_description=skill_description,
    )


@router.get("/domains", response_model=DomainBreakdown)
async def get_domain_breakdown(user_id: str = Depends(get_current_user_id)):
    """Get per-domain skill breakdown for chart visualization."""
    db = get_supabase()

    domain_skills_res = (
        db.table("user_domain_skills")
        .select("*, domains(id, name, weight)")
        .eq("user_id", user_id)
        .execute()
    )

    domains = []
    for ds in domain_skills_res.data:
        answered = ds["questions_answered"]
        correct = ds["questions_correct"]
        domain_name = ds["domains"]["name"] if ds.get("domains") else "Unknown"
        skill_rating = ds["skill_rating"]
        weight = ds["domains"]["weight"] if ds.get("domains") else 0.0

        domains.append(DomainSkill(
            domain_id=ds["domain_id"],
            domain_name=domain_name,
            skill_rating=skill_rating,
            questions_answered=answered,
            questions_correct=correct,
            accuracy=round(correct / answered * 100, 1) if answered > 0 else 0,
            weight=weight,
            proficiency_percent=get_proficiency_percent(skill_rating),
            suggestion=get_domain_suggestion(skill_rating, domain_name),
        ))

    return DomainBreakdown(domains=domains)


@router.get("/skill-history", response_model=SkillHistory)
async def get_skill_history(user_id: str = Depends(get_current_user_id)):
    """Get the user's skill rating history from user_responses."""
    db = get_supabase()

    # Fetch all responses ordered by time
    responses_res = (
        db.table("user_responses")
        .select("skill_after, skill_before, is_correct, created_at")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )

    data_points = [
        {
            "timestamp": r["created_at"],
            "skill": r["skill_after"],
        }
        for r in responses_res.data
    ]

    # Last 10 performance
    last_10_data = responses_res.data[-10:] if len(responses_res.data) >= 10 else responses_res.data
    last_10 = [
        {
            "is_correct": r["is_correct"],
            "skill_delta": round((r["skill_after"] or 0) - (r["skill_before"] or 0), 1),
        }
        for r in last_10_data
    ]

    # Volatility: std dev of skill deltas over last 20
    recent_deltas = [
        (r["skill_after"] or 0) - (r["skill_before"] or 0)
        for r in responses_res.data[-20:]
    ]
    volatility = round(statistics.stdev(recent_deltas), 1) if len(recent_deltas) >= 2 else 0.0

    # Get current skill for label
    user = db.table("users").select("global_skill").eq("id", user_id).single().execute()
    label, description = get_skill_label(user.data["global_skill"])

    return SkillHistory(
        data_points=data_points,
        last_10=last_10,
        volatility=volatility,
        skill_label=label,
        skill_description=description,
    )
