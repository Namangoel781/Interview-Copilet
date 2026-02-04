import requests
from settings import settings

class AIError(RuntimeError):
    pass

def chat_complete(system: str, user: str) -> str:
    """
    OpenAI-compatible /v1/chat/completions call.
    Works with many providers that support the same interface.
    """
    if not settings.OPENAI_API_KEY:
        raise AIError("OPENAI_API_KEY is missing. Set it in backend/.env")

    url = settings.OPENAI_BASE_URL.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.4,
    }

    try:
        timeout_secs = getattr(settings, "AI_TIMEOUT_SECS", 60)
        # requests supports a (connect, read) timeout tuple; keep connect small.
        r = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=(10, float(timeout_secs)),
        )
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]
    except requests.HTTPError as e:
        # Include provider error payload when available
        try:
            body = r.text  # type: ignore[name-defined]
        except Exception:
            body = ""
        msg = f"AI request failed: {e}"
        if body:
            msg += f"\nResponse body: {body[:1000]}"
        raise AIError(msg) from e
    except requests.RequestException as e:
        raise AIError(f"AI request failed: {e}") from e
    except (KeyError, IndexError, ValueError) as e:
        raise AIError(f"AI response parse failed: {e}") from e

def generate_code_suggestion(
    topic: str,
    difficulty: str,
    problem_description: str,
    user_code: str,
) -> str:
    """
    Generate a code suggestion based on the problem and user's current code.
    Returns a JSON string containing 'suggestion_code' and 'explanation'.
    """
    # Import here to avoid circular dependencies if any, or just for cleanliness
    from prompts import code_assistance_prompt

    skill = "Coding" # Default skill for simulator
    prompt = code_assistance_prompt(skill, topic, difficulty, problem_description, user_code)

    return chat_complete(
        system="You are a helpful coding assistant that outputs JSON.",
        user=prompt
    )