"""Adaptive question selection engine.

This module implements the core question selection logic:
1. Identify the user's weakest domain
2. Target difficulty = user_skill ± 50
3. Check for existing questions in the DB within that range
4. If none found, generate a new question via Gemini AI
"""

from services.supabase_client import get_supabase
from services.gemini import generate_question
from config import ELO_DEFAULT_SKILL, ELO_DIFFICULTY_RANGE


async def select_next_question(
    user_id: str,
    certification_id: str,
    cert_name: str = "PL-300 Microsoft Power BI Data Analyst",
) -> dict | None:
    """Select or generate the next adaptive question for a user.

    Algorithm:
    1. Load the user's domain skills
    2. Find the weakest domain (lowest skill_rating)
    3. Calculate target difficulty range
    4. Try to find an unanswered cached question in range
    5. If none found, generate a new one via Gemini

    Args:
        user_id: The authenticated user's UUID.
        certification_id: The certification UUID (e.g., PL-300's UUID).
        cert_name: Full certification name for the AI prompt.

    Returns:
        Dict with question data and metadata, or None if generation fails.
    """
    db = get_supabase()

    # Step 1: Get all domains for this certification
    domains_res = (
        db.table("domains")
        .select("*")
        .eq("certification_id", certification_id)
        .order("sort_order")
        .execute()
    )
    domains = domains_res.data
    if not domains:
        return None

    # Step 2: Get user's domain skills
    skills_res = (
        db.table("user_domain_skills")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )
    user_skills = {s["domain_id"]: s for s in skills_res.data}

    # Step 3: Find weakest domain (lowest skill_rating or unattempted)
    weakest_domain = None
    weakest_skill = float("inf")

    for domain in domains:
        domain_id = domain["id"]
        if domain_id in user_skills:
            skill = user_skills[domain_id]["skill_rating"]
        else:
            # Unattempted domain — prioritize it
            skill = ELO_DEFAULT_SKILL - 100  # slightly below default to prioritize
        if skill < weakest_skill:
            weakest_skill = skill
            weakest_domain = domain

    if not weakest_domain:
        return None

    # Step 4: Get the user's effective skill for this domain
    domain_id = weakest_domain["id"]
    user_domain_skill = (
        user_skills[domain_id]["skill_rating"]
        if domain_id in user_skills
        else ELO_DEFAULT_SKILL
    )

    # Target difficulty: centered on user's skill ± range
    target_low = user_domain_skill - ELO_DIFFICULTY_RANGE
    target_high = user_domain_skill + ELO_DIFFICULTY_RANGE

    # Step 5: Try to find an existing unanswered question in range
    # Get IDs of questions user has already answered
    answered_res = (
        db.table("user_responses")
        .select("question_id")
        .eq("user_id", user_id)
        .execute()
    )
    answered_ids = [r["question_id"] for r in answered_res.data]

    # Query for cached questions in the target difficulty range
    query = (
        db.table("questions")
        .select("*")
        .eq("domain_id", domain_id)
        .gte("difficulty_estimate", target_low)
        .lte("difficulty_estimate", target_high)
        .limit(10)
        .execute()
    )

    # Filter out already-answered questions
    available = [q for q in query.data if q["id"] not in answered_ids]

    if available:
        # Serve from cache — pick the one closest to user's skill level
        best = min(available, key=lambda q: abs(q["difficulty_estimate"] - user_domain_skill))
        return {
            "question_id": best["id"],
            "question_text": best["question_text"],
            "options": best["options"],
            "domain": weakest_domain["name"],
            "difficulty": best["difficulty_estimate"],
            "from_cache": True,
        }

    # Step 6: No cached question available — generate new one via Gemini
    generated = await generate_question(
        domain=weakest_domain["name"],
        difficulty=user_domain_skill,
        cert_name=cert_name,
    )

    if not generated:
        return None

    # Store the generated question in the database for future use
    insert_res = (
        db.table("questions")
        .insert({
            "domain_id": domain_id,
            "certification_id": certification_id,
            "question_text": generated["question"],
            "options": generated["options"],
            "correct_index": generated["correct_index"],
            "explanation": generated["explanation"],
            "difficulty_estimate": user_domain_skill,  # Start at user's level
        })
        .execute()
    )

    new_question = insert_res.data[0]
    return {
        "question_id": new_question["id"],
        "question_text": new_question["question_text"],
        "options": new_question["options"],
        "domain": weakest_domain["name"],
        "difficulty": new_question["difficulty_estimate"],
        "from_cache": False,
    }
