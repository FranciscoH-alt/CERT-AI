"""ELO-based adaptive difficulty algorithm.

This module implements the core adaptive learning engine. It uses an ELO rating
system (similar to chess) to track both user skill and question difficulty.

Key concepts:
- Each user has a global_skill and per-domain skill_rating (default 1000)
- Each question has a difficulty_estimate (default 1000)
- When a user answers correctly, their skill goes up and question difficulty goes down
- When a user answers incorrectly, their skill goes down and question difficulty goes up
- The K-factor (32) controls how much each answer shifts the ratings
- Expected score is based on the difference between user skill and question difficulty
"""

from config import ELO_K_FACTOR, ELO_DEFAULT_SKILL

# Constants for pass probability
MIN_QUESTIONS_FOR_PREDICTION = 20
RELIABLE_PREDICTION_THRESHOLD = 50

# PL-300 domain weights
PL300_DOMAIN_WEIGHTS = {
    "Prepare the Data (25-30%)": 0.275,
    "Model the Data (25-30%)": 0.275,
    "Visualize and Analyze the Data (25-30%)": 0.275,
    "Deploy and Maintain Assets (15-20%)": 0.175,
}


def expected_score(user_skill: float, question_difficulty: float) -> float:
    """Calculate the expected probability of a correct answer.

    Uses the standard ELO expected score formula.
    A user with skill equal to question difficulty has a 50% expected score.

    Args:
        user_skill: The user's current skill rating.
        question_difficulty: The question's difficulty rating.

    Returns:
        Float between 0 and 1 representing expected probability of correct answer.
    """
    return 1.0 / (1.0 + 10.0 ** ((question_difficulty - user_skill) / 400.0))


def update_ratings(
    user_skill: float,
    question_difficulty: float,
    is_correct: bool,
) -> tuple[float, float]:
    """Update both user skill and question difficulty after an answer.

    Args:
        user_skill: Current user skill rating.
        question_difficulty: Current question difficulty rating.
        is_correct: Whether the user answered correctly.

    Returns:
        Tuple of (new_user_skill, new_question_difficulty).
    """
    expected = expected_score(user_skill, question_difficulty)
    actual = 1.0 if is_correct else 0.0

    # User skill increases if they outperform expectation
    new_user_skill = user_skill + ELO_K_FACTOR * (actual - expected)

    # Question difficulty moves opposite to user skill
    new_question_difficulty = question_difficulty + ELO_K_FACTOR * (expected - actual)

    return new_user_skill, new_question_difficulty


def calculate_pass_probability(user_skill: float, pass_threshold: float = 1100.0) -> float:
    """Estimate the probability that a user would pass the real exam.

    Uses the ELO expected score formula with a configurable pass threshold.
    A skill of 1100 roughly corresponds to passing-level knowledge.

    Args:
        user_skill: The user's current global skill rating.
        pass_threshold: The skill level that corresponds to a passing score.

    Returns:
        Float between 0 and 1 representing estimated pass probability.
    """
    return expected_score(user_skill, pass_threshold - 200)


def calculate_weighted_pass_probability(
    domain_skills: list[dict],
    total_questions: int,
    recent_responses: list[dict],
    pass_threshold: float = 1100.0,
) -> dict:
    """Calculate a domain-weighted pass probability with confidence levels.

    Args:
        domain_skills: List of dicts with 'name', 'skill_rating', 'questions_answered'.
        total_questions: Total questions answered across all domains.
        recent_responses: Last 25 responses with 'is_correct' field.
        pass_threshold: The skill level that corresponds to a passing score.

    Returns:
        Dict with estimate, confidence, is_active, questions_remaining, domain_contributions.
    """
    questions_remaining = max(0, MIN_QUESTIONS_FOR_PREDICTION - total_questions)

    if total_questions < MIN_QUESTIONS_FOR_PREDICTION:
        return {
            "estimate": 0.0,
            "confidence": "low",
            "is_active": False,
            "questions_remaining": questions_remaining,
            "domain_contributions": {},
        }

    # Build domain skill map
    domain_skill_map = {}
    for ds in domain_skills:
        domain_skill_map[ds["name"]] = ds["skill_rating"]

    # Calculate domain-weighted skill
    weighted_skill = 0.0
    domain_contributions = {}
    total_weight = 0.0

    for domain_name, weight in PL300_DOMAIN_WEIGHTS.items():
        skill = domain_skill_map.get(domain_name, ELO_DEFAULT_SKILL)
        contribution = weight * skill
        weighted_skill += contribution
        total_weight += weight
        domain_contributions[domain_name] = round(skill, 1)

    if total_weight > 0:
        weighted_skill /= total_weight

    # Calculate base probability from weighted skill
    base_prob = expected_score(weighted_skill, pass_threshold - 200)

    # Adjust with recent accuracy trend (moving average over last 25)
    if recent_responses:
        recent_accuracy = sum(1 for r in recent_responses if r["is_correct"]) / len(recent_responses)
        # Blend: 70% ELO-based, 30% recent performance
        adjusted_prob = 0.7 * base_prob + 0.3 * recent_accuracy
    else:
        adjusted_prob = base_prob

    estimate = round(min(99.0, max(0.0, adjusted_prob * 100)), 1)

    # Determine confidence level
    if total_questions >= RELIABLE_PREDICTION_THRESHOLD:
        confidence = "high"
    elif total_questions >= 30:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "estimate": estimate,
        "confidence": confidence,
        "is_active": True,
        "questions_remaining": 0,
        "domain_contributions": domain_contributions,
    }


def get_skill_label(skill: float) -> tuple[str, str]:
    """Get a human-readable label and description for a skill rating.

    Scale:
        < 1000: Below Baseline
        1000-1199: Baseline
        1200-1399: Likely Pass
        1400-1599: Strong Pass
        >= 1600: Expert
    """
    if skill >= 1600:
        return ("Expert", "You demonstrate expert-level mastery across all domains.")
    elif skill >= 1400:
        return ("Strong Pass", "You are well above the passing threshold with strong domain coverage.")
    elif skill >= 1200:
        return ("Likely Pass", "You are at or above the expected passing level.")
    elif skill >= 1000:
        return ("Baseline", "You are at the starting level. Keep practicing to improve.")
    else:
        return ("Below Baseline", "Focus on your weakest domains to build foundational knowledge.")


def get_difficulty_label(difficulty: float) -> str:
    """Get a human-readable difficulty label."""
    if difficulty >= 1300:
        return "Hard"
    elif difficulty >= 1100:
        return "Medium-Hard"
    elif difficulty >= 900:
        return "Medium"
    else:
        return "Easy"


def get_proficiency_percent(skill_rating: float) -> float:
    """Map ELO skill rating to a 0-100% proficiency scale.

    700 = 0%, 1000 = 50%, 1300 = 100%
    """
    return round(max(0.0, min(100.0, (skill_rating - 700) / 600 * 100)), 1)


def get_domain_suggestion(skill_rating: float, domain_name: str) -> str:
    """Generate a targeted improvement suggestion based on skill level."""
    short_name = domain_name.split("(")[0].strip()

    if skill_rating >= 1200:
        return f"Strong in {short_name}. Focus on edge cases and complex scenarios."
    elif skill_rating >= 1000:
        return f"Solid foundation in {short_name}. Practice more advanced questions."
    elif skill_rating >= 800:
        return f"Building skills in {short_name}. Review core concepts and practice regularly."
    else:
        return f"Needs attention: {short_name}. Start with fundamentals and work up gradually."
