"""Spaced repetition review queue service.

Implements a simplified SM-2 algorithm for scheduling question reviews.
Questions are automatically added when answered incorrectly, or manually
added by the user. Review intervals increase with successful reviews.
"""

from datetime import datetime, timedelta, timezone
from services.supabase_client import get_supabase


async def add_to_review_queue(
    user_id: str,
    question_id: str,
    concept_tag: str = "",
    source: str = "manual",
) -> bool:
    """Add a question to the user's review queue.

    If already in queue, returns False (no duplicate).
    """
    db = get_supabase()

    # Check if already in queue
    existing = (
        db.table("review_queue")
        .select("id")
        .eq("user_id", user_id)
        .eq("question_id", question_id)
        .execute()
    )
    if existing.data:
        return False

    next_review = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    db.table("review_queue").insert({
        "user_id": user_id,
        "question_id": question_id,
        "concept_tag": concept_tag,
        "next_review_at": next_review,
        "interval_hours": 24,
        "ease_factor": 2.5,
        "repetitions": 0,
        "mastery_score": 0.0,
        "source": source,
    }).execute()

    return True


async def auto_queue_weak_concept(
    user_id: str,
    question_id: str,
    concept_tag: str = "",
) -> bool:
    """Called after an incorrect answer. Adds to queue if not already present."""
    return await add_to_review_queue(user_id, question_id, concept_tag, source="auto")


async def get_due_reviews(user_id: str, limit: int = 10) -> list[dict]:
    """Get questions due for review (next_review_at <= now)."""
    db = get_supabase()

    now = datetime.now(timezone.utc).isoformat()
    result = (
        db.table("review_queue")
        .select("*, questions(id, question_text, options, domain_id, domains(name), scenario_text, concept_tag)")
        .eq("user_id", user_id)
        .lte("next_review_at", now)
        .order("next_review_at")
        .limit(limit)
        .execute()
    )

    reviews = []
    for r in result.data:
        q = r.get("questions", {})
        reviews.append({
            "id": r["id"],
            "question_id": r["question_id"],
            "concept_tag": r.get("concept_tag", "") or q.get("concept_tag", "") or "",
            "question_text": q.get("question_text", ""),
            "domain": q.get("domains", {}).get("name", "") if q.get("domains") else "",
            "next_review_at": r["next_review_at"],
            "mastery_score": r["mastery_score"],
            "repetitions": r["repetitions"],
        })

    return reviews


async def update_review_after_answer(
    user_id: str,
    question_id: str,
    is_correct: bool,
) -> None:
    """Update spaced repetition intervals after reviewing a question.

    Uses simplified SM-2 algorithm:
    - Correct: interval *= ease_factor, ease_factor += 0.1 (max 2.5)
    - Incorrect: interval = 24h, ease_factor -= 0.2 (min 1.3)
    - mastery_score = weighted running average of correctness
    """
    db = get_supabase()

    result = (
        db.table("review_queue")
        .select("*")
        .eq("user_id", user_id)
        .eq("question_id", question_id)
        .execute()
    )

    if not result.data:
        return

    item = result.data[0]
    ease = item["ease_factor"]
    interval = item["interval_hours"]
    reps = item["repetitions"]
    mastery = item["mastery_score"]

    if is_correct:
        interval = int(interval * ease)
        ease = min(2.5, ease + 0.1)
        reps += 1
        # Update mastery: weighted average (0.7 old + 0.3 new)
        mastery = 0.7 * mastery + 0.3 * 1.0
    else:
        interval = 24  # Reset to 24 hours
        ease = max(1.3, ease - 0.2)
        mastery = 0.7 * mastery + 0.3 * 0.0

    next_review = (datetime.now(timezone.utc) + timedelta(hours=interval)).isoformat()

    db.table("review_queue").update({
        "interval_hours": interval,
        "ease_factor": ease,
        "repetitions": reps,
        "mastery_score": round(mastery, 3),
        "next_review_at": next_review,
    }).eq("id", item["id"]).execute()


async def get_concept_mastery(user_id: str) -> list[dict]:
    """Get mastery scores grouped by concept_tag."""
    db = get_supabase()

    result = (
        db.table("review_queue")
        .select("concept_tag, mastery_score, updated_at")
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        return []

    # Group by concept_tag
    concepts: dict[str, dict] = {}
    for r in result.data:
        tag = r.get("concept_tag") or "General"
        if tag not in concepts:
            concepts[tag] = {
                "concept_tag": tag,
                "mastery_score": 0.0,
                "question_count": 0,
                "last_reviewed": None,
            }
        concepts[tag]["mastery_score"] += r["mastery_score"]
        concepts[tag]["question_count"] += 1
        if r.get("updated_at"):
            if not concepts[tag]["last_reviewed"] or r["updated_at"] > concepts[tag]["last_reviewed"]:
                concepts[tag]["last_reviewed"] = r["updated_at"]

    # Calculate average mastery
    for tag in concepts:
        if concepts[tag]["question_count"] > 0:
            concepts[tag]["mastery_score"] = round(
                concepts[tag]["mastery_score"] / concepts[tag]["question_count"], 3
            )

    return list(concepts.values())


async def remove_from_review_queue(user_id: str, question_id: str) -> bool:
    """Remove a question from the review queue."""
    db = get_supabase()

    result = (
        db.table("review_queue")
        .delete()
        .eq("user_id", user_id)
        .eq("question_id", question_id)
        .execute()
    )

    return len(result.data) > 0
