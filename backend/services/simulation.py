"""Exam simulation service.

Manages full-length practice exam simulations with:
- 60 questions weighted by PL-300 domain distribution
- Mixed difficulty levels
- No feedback during simulation
- Scoring on 0-1000 scale with 700 pass threshold
"""

import random
from datetime import datetime, timezone
from services.supabase_client import get_supabase
from services.gemini import generate_question
from services.elo import PL300_DOMAIN_WEIGHTS


async def create_simulation(
    user_id: str,
    certification_id: str,
    cert_name: str = "PL-300 Microsoft Power BI Data Analyst",
) -> dict | None:
    """Create a simulation session with 60 pre-selected questions.

    Distribution based on PL-300 domain weights:
    - Prepare the Data: 17 questions (0.275 * 60)
    - Model the Data: 17 questions
    - Visualize and Analyze: 17 questions
    - Deploy and Maintain: 9 questions (0.175 * 60)

    Returns dict with session_id and questions list, or None on failure.
    """
    db = get_supabase()

    # Get domains with their weights
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

    # Calculate questions per domain (total = 60)
    total_questions = 60
    domain_question_counts = []
    remaining = total_questions

    for i, domain in enumerate(domains):
        if i == len(domains) - 1:
            count = remaining  # Last domain gets whatever's left
        else:
            count = round(domain["weight"] * total_questions)
            remaining -= count
        domain_question_counts.append((domain, count))

    # Get user's skill for difficulty targeting
    user = db.table("users").select("global_skill").eq("id", user_id).single().execute()
    user_skill = user.data["global_skill"]

    # Collect questions for each domain
    all_questions = []

    for domain, count in domain_question_counts:
        # Try to get questions from cache first
        try:
            cached = (
                db.table("questions")
                .select("id, question_text, options, domain_id, scenario_text, concept_tag, difficulty_estimate")
                .eq("domain_id", domain["id"])
                .limit(count * 2)
                .execute()
            )
        except Exception:
            # Fallback if scenario_text/concept_tag columns don't exist
            cached = (
                db.table("questions")
                .select("id, question_text, options, domain_id, difficulty_estimate")
                .eq("domain_id", domain["id"])
                .limit(count * 2)
                .execute()
            )

        available = cached.data[:count]

        # If not enough cached questions, generate more
        generated_count = 0
        while len(available) < count and generated_count < count:
            generated_count += 1
            gen = await generate_question(
                domain=domain["name"],
                difficulty=user_skill + random.randint(-200, 200),
                cert_name=cert_name,
            )
            if gen:
                # Store in DB
                q_data = {
                    "domain_id": domain["id"],
                    "certification_id": certification_id,
                    "question_text": gen["question"],
                    "options": gen["options"],
                    "correct_index": gen["correct_index"],
                    "explanation": gen.get("explanation_correct") or gen.get("explanation", ""),
                    "difficulty_estimate": user_skill,
                    "scenario_text": gen.get("scenario", ""),
                    "concept_tag": gen.get("concept_tag", ""),
                }
                try:
                    insert_res = db.table("questions").insert(q_data).execute()
                except Exception:
                    # Retry without v2 columns if they don't exist
                    q_data.pop("scenario_text", None)
                    q_data.pop("concept_tag", None)
                    insert_res = db.table("questions").insert(q_data).execute()
                if insert_res.data:
                    q = insert_res.data[0]
                    available.append({
                        "id": q["id"],
                        "question_text": q["question_text"],
                        "options": q["options"],
                        "domain_id": q["domain_id"],
                        "scenario_text": q.get("scenario_text") or "",
                        "concept_tag": q.get("concept_tag") or "",
                        "difficulty_estimate": q["difficulty_estimate"],
                    })

        # Shuffle and take required count
        random.shuffle(available)
        all_questions.extend(available[:count])

    # Shuffle all questions for mixed domain presentation
    random.shuffle(all_questions)

    # Create question order (list of question IDs)
    question_order = [q["id"] for q in all_questions]

    # Create simulation session
    session = (
        db.table("simulation_sessions")
        .insert({
            "user_id": user_id,
            "certification_id": certification_id,
            "total_questions": len(question_order),
            "question_order": question_order,
            "answers": {},
        })
        .execute()
    )

    if not session.data:
        return None

    sim = session.data[0]

    # Build question list with indices
    questions = []
    for i, q in enumerate(all_questions):
        questions.append({
            "question_id": q["id"],
            "question_index": i,
            "scenario_text": q.get("scenario_text") or "",
            "question_text": q["question_text"],
            "options": q["options"],
            "domain": next(
                (d["name"] for d in domains if d["id"] == q["domain_id"]),
                "Unknown"
            ),
        })

    return {
        "session_id": sim["id"],
        "questions": questions,
        "total_questions": len(questions),
        "time_limit_minutes": 90,
        "time_limit_seconds": 5400,  # 90 * 60
    }


async def submit_sim_answer(
    session_id: str,
    question_id: str,
    question_index: int,
    selected_index: int,
    time_spent_seconds: int | None = None,
) -> bool:
    """Record an answer during simulation (no feedback returned)."""
    db = get_supabase()

    # Get current session
    session = (
        db.table("simulation_sessions")
        .select("answers, questions_answered")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not session.data:
        return False

    answers = session.data.get("answers") or {}
    answers[str(question_index)] = {
        "question_id": question_id,
        "selected_index": selected_index,
        "time_spent_seconds": time_spent_seconds,
    }

    db.table("simulation_sessions").update({
        "answers": answers,
        "questions_answered": len(answers),
    }).eq("id", session_id).execute()

    return True


async def complete_simulation(session_id: str, user_id: str) -> dict | None:
    """Finalize a simulation and calculate results."""
    db = get_supabase()

    # Get session
    session = (
        db.table("simulation_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not session.data:
        return None

    sim = session.data
    question_order = sim.get("question_order") or []
    answers = sim.get("answers") or {}

    if not question_order:
        return None

    # Fetch all questions
    questions = []
    for qid in question_order:
        q = (
            db.table("questions")
            .select("*, domains(id, name, weight)")
            .eq("id", qid)
            .single()
            .execute()
        )
        if q.data:
            questions.append(q.data)

    # Calculate results
    domain_results = {}  # domain_name -> {total, correct, weight}
    question_results = []
    correct_count = 0

    for i, q in enumerate(questions):
        answer = answers.get(str(i))
        selected = answer["selected_index"] if answer else -1
        is_correct = selected == q["correct_index"]
        if is_correct:
            correct_count += 1

        domain_name = q["domains"]["name"] if q.get("domains") else "Unknown"
        weight = q["domains"]["weight"] if q.get("domains") else 0.25

        if domain_name not in domain_results:
            domain_results[domain_name] = {
                "domain_name": domain_name,
                "questions_total": 0,
                "questions_correct": 0,
                "weight": weight,
            }
        domain_results[domain_name]["questions_total"] += 1
        if is_correct:
            domain_results[domain_name]["questions_correct"] += 1

        question_results.append({
            "index": i,
            "question_id": q["id"],
            "question_text": q["question_text"],
            "options": q["options"],
            "correct_index": q["correct_index"],
            "selected_index": selected,
            "is_correct": is_correct,
            "explanation": q.get("explanation") or "",
            "domain": domain_name,
            "scenario_text": q.get("scenario_text") or "",
            "concept_tag": q.get("concept_tag") or "",
        })

    # Calculate domain accuracies
    domain_result_list = []
    for dr in domain_results.values():
        total = dr["questions_total"]
        correct = dr["questions_correct"]
        dr["accuracy"] = round(correct / total * 100, 1) if total > 0 else 0
        domain_result_list.append(dr)

    # Calculate weighted score (0-1000)
    score = 0.0
    total_weight = sum(dr["weight"] for dr in domain_result_list)
    if total_weight > 0:
        for dr in domain_result_list:
            domain_accuracy = dr["questions_correct"] / dr["questions_total"] if dr["questions_total"] > 0 else 0
            score += (dr["weight"] / total_weight) * domain_accuracy * 1000

    score = round(score)
    is_passed = score >= 700
    total = len(questions)
    accuracy = round(correct_count / total * 100, 1) if total > 0 else 0

    # Calculate time taken
    started = datetime.fromisoformat(sim["started_at"].replace("Z", "+00:00")) if isinstance(sim["started_at"], str) else sim["started_at"]
    now = datetime.now(timezone.utc)
    time_taken = round((now - started).total_seconds() / 60, 1) if started else 0

    # Update session
    db.table("simulation_sessions").update({
        "is_complete": True,
        "ended_at": now.isoformat(),
        "correct_answers": correct_count,
        "score": score,
        "is_passed": is_passed,
        "domain_results": {dr["domain_name"]: dr for dr in domain_result_list},
    }).eq("id", session_id).execute()

    return {
        "session_id": session_id,
        "score": score,
        "is_passed": is_passed,
        "pass_threshold": 700,
        "total_questions": total,
        "correct_answers": correct_count,
        "accuracy": accuracy,
        "time_taken_minutes": time_taken,
        "domain_results": domain_result_list,
        "question_results": question_results,
    }
