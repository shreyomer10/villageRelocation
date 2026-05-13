"""Agent 1 invocation: one Gemini call returning a parsed envelope."""

from google.genai import types

from .prompt_reasoner import REASONER_PROMPT
from .protocol import EnvelopeError, parse_reasoner_envelope


def call_reasoner(client, model: str, contents: list) -> tuple[dict, str]:
    """
    Run one turn of Agent 1.

    Args:
        client:   google.genai.Client
        model:    model name string
        contents: list of types.Content — full conversation so far

    Returns:
        (envelope, raw_text)
          envelope is one of {"queries":[...]}, {"final":{...}}, {"give_up":"..."}.
          raw_text is the model's literal reply (kept so the orchestrator can
          replay it as a 'model' turn in the next contents window).

    Raises:
        EnvelopeError if the model output cannot be parsed.
    """
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=REASONER_PROMPT,
            temperature=0.1,
        ),
    )
    raw_text = (response.text or "").strip()
    envelope = parse_reasoner_envelope(raw_text)
    return envelope, raw_text


__all__ = ["call_reasoner", "EnvelopeError"]
