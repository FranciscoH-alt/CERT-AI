"""Gemini AI integration for generating certification exam questions.

This service communicates with Google's Gemini API to generate
realistic, scenario-based certification exam questions. It validates
the AI response to ensure proper JSON structure and content quality.
"""

import json
import httpx
from config import GEMINI_API_KEY, GEMINI_API_URL


# Prompt template for generating certification questions
QUESTION_PROMPT_TEMPLATE = """You are generating a {cert_name} certification exam question.

Constraints:
- Domain: {domain}
- Difficulty Rating: {difficulty} (1000=medium baseline, higher=harder)
- 4 answer options, 1 correct answer
- Scenario-based where appropriate
- No ambiguous wording
- Professional tone, realistic Microsoft-style question

Return JSON ONLY in this exact format (no markdown, no code fences):

{{"scenario": "A brief scenario/context (1-3 sentences). Leave empty string if question is direct.", "question": "The actual question prompt", "options": ["Option A", "Option B", "Option C", "Option D"], "correct_index": 0, "explanation_correct": "Why the correct answer is right", "explanation_wrong": ["Why A is wrong or correct", "Why B is wrong or correct", "Why C is wrong or correct", "Why D is wrong or correct"], "concept_tag": "Primary concept being tested (e.g. DAX CALCULATE, Star Schema, RLS)", "domain": "{domain}"}}"""


async def generate_question(
    domain: str,
    difficulty: float,
    cert_name: str = "PL-300 Microsoft Power BI Data Analyst",
) -> dict | None:
    """Generate a certification exam question using the Gemini API.

    Args:
        domain: The exam domain/topic area (e.g., "Prepare the Data").
        difficulty: Target difficulty as ELO rating (1000 = medium).
        cert_name: Full certification name for context.

    Returns:
        Validated question dict with keys: scenario, question, options, correct_index,
        explanation_correct, explanation_wrong, concept_tag, domain.
        Returns None if generation or validation fails.
    """
    prompt = QUESTION_PROMPT_TEMPLATE.format(
        cert_name=cert_name,
        domain=domain,
        difficulty=difficulty,
    )

    # Gemini API request payload
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 8192,
            "topP": 0.95,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

        # Extract the generated text from Gemini's response structure
        # Gemini 2.5+ models may return multiple parts (thought + text)
        parts = data["candidates"][0]["content"]["parts"]
        text = None
        for part in parts:
            if "text" in part and not part.get("thought"):
                text = part["text"]
        if text is None:
            # Fallback: use the last part with text
            for part in reversed(parts):
                if "text" in part:
                    text = part["text"]
                    break
        if text is None:
            print(f"[Gemini] No text found in response parts: {parts}")
            return None

        # Clean up response — strip markdown code fences if present
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        # Parse and validate the JSON response
        question_data = json.loads(text)
        validated = _validate_question(question_data)
        return validated

    except (httpx.HTTPError, json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"[Gemini] Question generation failed: {e}")
        return None


def _validate_question(data: dict) -> dict:
    """Validate that the AI-generated question meets all requirements.

    Raises ValueError if validation fails.

    Supports both new format (with scenario, explanation_correct, etc.)
    and legacy format (with single explanation field).
    """
    required_keys = {"question", "options", "correct_index", "domain"}
    if not required_keys.issubset(data.keys()):
        missing = required_keys - data.keys()
        raise ValueError(f"Missing required keys: {missing}")

    if not isinstance(data["options"], list) or len(data["options"]) != 4:
        raise ValueError("Must have exactly 4 options")

    if not isinstance(data["correct_index"], int) or data["correct_index"] not in range(4):
        raise ValueError(f"correct_index must be 0-3, got {data['correct_index']}")

    if not data["question"].strip():
        raise ValueError("Question text is empty")

    if any(not opt.strip() for opt in data["options"]):
        raise ValueError("One or more options are empty")

    # Handle both new and legacy explanation formats
    explanation_correct = data.get("explanation_correct", "")
    explanation_wrong = data.get("explanation_wrong", [])
    legacy_explanation = data.get("explanation", "")

    if not explanation_correct and legacy_explanation:
        explanation_correct = legacy_explanation

    if not explanation_correct:
        raise ValueError("Missing explanation")

    return {
        "scenario": data.get("scenario", "").strip(),
        "question": data["question"].strip(),
        "options": [opt.strip() for opt in data["options"]],
        "correct_index": data["correct_index"],
        "explanation": explanation_correct.strip(),
        "explanation_correct": explanation_correct.strip(),
        "explanation_wrong": [e.strip() if isinstance(e, str) else "" for e in explanation_wrong],
        "concept_tag": data.get("concept_tag", "").strip(),
        "domain": data["domain"].strip(),
    }
