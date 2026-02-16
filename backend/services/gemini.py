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
• Domain: {domain}
• Difficulty Rating: {difficulty} (1000=medium baseline, higher=harder)
• 4 answer options
• 1 correct answer
• Scenario-based where appropriate
• No ambiguous wording
• Professional tone
• Realistic Microsoft-style question

Return JSON ONLY in this exact format (no markdown, no code fences):

{{"question": "The full question text here", "options": ["Option A text", "Option B text", "Option C text", "Option D text"], "correct_index": 0, "explanation": "Detailed explanation of why the correct answer is right and others are wrong", "domain": "{domain}"}}"""


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
        Validated question dict with keys: question, options, correct_index,
        explanation, domain. Returns None if generation or validation fails.
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
            "maxOutputTokens": 1024,
            "topP": 0.95,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()

        # Extract the generated text from Gemini's response structure
        text = data["candidates"][0]["content"]["parts"][0]["text"]

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

    Checks:
    - All required keys are present
    - Exactly 4 options
    - correct_index is 0-3
    - All text fields are non-empty
    """
    required_keys = {"question", "options", "correct_index", "explanation", "domain"}
    if not required_keys.issubset(data.keys()):
        missing = required_keys - data.keys()
        raise ValueError(f"Missing required keys: {missing}")

    if not isinstance(data["options"], list) or len(data["options"]) != 4:
        raise ValueError("Must have exactly 4 options")

    if not isinstance(data["correct_index"], int) or data["correct_index"] not in range(4):
        raise ValueError(f"correct_index must be 0-3, got {data['correct_index']}")

    if not data["question"].strip():
        raise ValueError("Question text is empty")

    if not data["explanation"].strip():
        raise ValueError("Explanation is empty")

    if any(not opt.strip() for opt in data["options"]):
        raise ValueError("One or more options are empty")

    return {
        "question": data["question"].strip(),
        "options": [opt.strip() for opt in data["options"]],
        "correct_index": data["correct_index"],
        "explanation": data["explanation"].strip(),
        "domain": data["domain"].strip(),
    }
