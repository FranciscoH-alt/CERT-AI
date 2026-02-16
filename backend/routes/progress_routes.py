"""Progress and analytics routes.

These endpoints provide the data for the Progress page:
- Overall user progress and pass probability
- Per-domain skill breakdown
- Recent performance history
"""

from fastapi import APIRouter, Depends
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from services.elo import calculate_pass_probability
from models.schemas import UserProgress, DomainBreakdown, DomainSkill

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/user", response_model=UserProgress)
async def get_user_progress(user_id: str = Depends(get_current_user_id)):
    """Get comprehensive progress data for the current user.

    Returns global skill, pass probability, domain breakdown,
    and recent session history.
    """
    db = get_supabase()

    # Fetch user profile
    user = db.table("users").select("*").eq("id", user_id).single().execute()
    u = user.data

    # Fetch all domain skills with domain names
    domain_skills_res = (
        db.table("user_domain_skills")
        .select("*, domains(id, name)")
        .eq("user_id", user_id)
        .execute()
    )

    # Build domain skill list
    domain_skills = []
    total_questions = 0
    total_correct = 0

    for ds in domain_skills_res.data:
        answered = ds["questions_answered"]
        correct = ds["questions_correct"]
        total_questions += answered
        total_correct += correct

        domain_skills.append(DomainSkill(
            domain_id=ds["domain_id"],
            domain_name=ds["domains"]["name"] if ds.get("domains") else "Unknown",
            skill_rating=ds["skill_rating"],
            questions_answered=answered,
            questions_correct=correct,
            accuracy=round(correct / answered * 100, 1) if answered > 0 else 0,
        ))

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
    pass_prob = round(calculate_pass_probability(u["global_skill"]) * 100, 1)

    return UserProgress(
        global_skill=u["global_skill"],
        total_questions=total_questions,
        total_correct=total_correct,
        accuracy=accuracy,
        pass_probability=pass_prob,
        domain_skills=domain_skills,
        recent_sessions=recent_sessions,
    )


@router.get("/domains", response_model=DomainBreakdown)
async def get_domain_breakdown(user_id: str = Depends(get_current_user_id)):
    """Get per-domain skill breakdown for chart visualization."""
    db = get_supabase()

    domain_skills_res = (
        db.table("user_domain_skills")
        .select("*, domains(id, name)")
        .eq("user_id", user_id)
        .execute()
    )

    domains = []
    for ds in domain_skills_res.data:
        answered = ds["questions_answered"]
        correct = ds["questions_correct"]
        domains.append(DomainSkill(
            domain_id=ds["domain_id"],
            domain_name=ds["domains"]["name"] if ds.get("domains") else "Unknown",
            skill_rating=ds["skill_rating"],
            questions_answered=answered,
            questions_correct=correct,
            accuracy=round(correct / answered * 100, 1) if answered > 0 else 0,
        ))

    return DomainBreakdown(domains=domains)
