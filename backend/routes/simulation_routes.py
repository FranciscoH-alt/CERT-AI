"""Simulation exam routes.

Full-length practice exam simulation:
- 60 questions, 90 minutes
- Mixed domains weighted by PL-300 distribution
- No feedback until completion
- Score on 0-1000 scale, pass = 700
"""

from fastapi import APIRouter, Depends, HTTPException
from services.auth import get_current_user_id
from services.supabase_client import get_supabase
from services.simulation import create_simulation, submit_sim_answer, complete_simulation
from models.schemas import (
    StartSimulationRequest,
    SubmitSimAnswerRequest,
)

router = APIRouter(prefix="/simulate", tags=["simulation"])


@router.post("/start")
async def start_simulation(
    req: StartSimulationRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Start a new simulation session with 60 pre-selected questions."""
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

    try:
        result = await create_simulation(
            user_id=user_id,
            certification_id=cert.data["id"],
            cert_name=f"{req.certification_code} {cert.data['title']}",
        )
    except Exception as e:
        error_msg = str(e)
        if "simulation_sessions" in error_msg:
            raise HTTPException(
                status_code=503,
                detail="Simulation not available. Run database migration 002_v2_features.sql in Supabase SQL Editor."
            )
        raise HTTPException(status_code=500, detail=f"Failed to create simulation: {error_msg}")

    if not result:
        raise HTTPException(status_code=500, detail="Failed to create simulation")

    return result


@router.post("/answer")
async def submit_answer(
    req: SubmitSimAnswerRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Submit an answer during simulation (no feedback returned)."""
    success = await submit_sim_answer(
        session_id=req.session_id,
        question_id=req.question_id,
        question_index=req.question_index,
        selected_index=req.selected_index,
        time_spent_seconds=req.time_spent_seconds,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Simulation session not found")

    return {"submitted": True}


@router.post("/complete/{session_id}")
async def complete_sim(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Complete the simulation and get results."""
    results = await complete_simulation(session_id, user_id)

    if not results:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return results


@router.get("/results/{session_id}")
async def get_results(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Get results for a completed simulation."""
    db = get_supabase()

    sim = (
        db.table("simulation_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )

    if not sim.data:
        raise HTTPException(status_code=404, detail="Simulation not found")

    if not sim.data.get("is_complete"):
        raise HTTPException(status_code=400, detail="Simulation not yet completed")

    return sim.data


@router.get("/history")
async def get_history(user_id: str = Depends(get_current_user_id)):
    """Get list of past simulation sessions."""
    db = get_supabase()

    result = (
        db.table("simulation_sessions")
        .select("id, score, is_passed, total_questions, correct_answers, started_at, ended_at, is_complete")
        .eq("user_id", user_id)
        .order("started_at", desc=True)
        .limit(20)
        .execute()
    )

    sims = []
    for s in result.data:
        if s.get("is_complete"):
            sims.append({
                "session_id": s["id"],
                "score": s.get("score") or 0,
                "is_passed": s.get("is_passed") or False,
                "total_questions": s["total_questions"],
                "correct_answers": s.get("correct_answers") or 0,
                "started_at": s["started_at"],
                "time_taken_minutes": 0,
            })

    return {"simulations": sims}
