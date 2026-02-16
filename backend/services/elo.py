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

from config import ELO_K_FACTOR


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
    # If a user gets it right, the question is deemed slightly easier
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
