"""Single-agent executor for the Village Relocation Management System AI."""

from google.genai import types

from .prompt_agent import AGENT_PROMPT
from .protocol import EnvelopeError, parse_agent_envelope


def call_agent(client, model: str, contents: list) -> tuple[dict, str]:
    """Call Gemini with the single-agent prompt and return parsed output."""
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=AGENT_PROMPT,
            temperature=0.1,
        ),
    )
    raw_text = (response.text or "").strip()
    envelope = parse_agent_envelope(raw_text)
    return envelope, raw_text


__all__ = ["call_agent"]
