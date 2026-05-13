"""Agent 2 invocation: translate one pseudo-query into one real query."""

import json

from google.genai import types

from .prompt_query_builder import QUERY_BUILDER_PROMPT
from .protocol import parse_builder_output


def _format_request(intent: str, pseudo, retry_context: str | None) -> str:
    parts = [
        f"intent: {intent}",
        f"pseudo: {json.dumps(pseudo, default=str, ensure_ascii=False)}",
    ]
    if retry_context:
        parts.append(f"retry: {retry_context}")
    return "\n".join(parts)


def build_real_query(
    client,
    model: str,
    intent: str,
    pseudo,
    retry_context: str | None = None,
) -> dict:
    """
    Run one Agent-2 call. Returns a dict that is either:
        {"error": "<reason>"}        — builder declined OR parse failed
        the full real-query dict     — to be validated then executed
    """
    user_text = _format_request(intent, pseudo, retry_context)
    contents = [types.Content(role="user", parts=[types.Part(text=user_text)])]
    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=QUERY_BUILDER_PROMPT,
                temperature=0.0,
            ),
        )
    except Exception as exc:
        return {"error": f"query-builder call failed: {exc}"}

    raw_text = (response.text or "").strip()
    return parse_builder_output(raw_text)
