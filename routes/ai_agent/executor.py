"""
Orchestrator: runs the two-agent loop for one /ai/chat request.

Public entry point: `run_conversation(client, model, history_messages, user_prompt)`
returns `(final_payload, trace)`.
"""

import json
from typing import Any

from google.genai import types

from config import db

from .protocol import (
    EnvelopeError,
    format_query_result_message_batch,
    validate_real_query,
)
from .reasoner import call_reasoner
from .query_builder import build_real_query
from .sessions import _message_to_content


MAX_OUTER_ROUNDS = 4
MAX_QUERIES_PER_ROUND = 5
MAX_RESULT_DOCS = 500


# ── Mongo execution ────────────────────────────────────────────────────

def _execute_query(real: dict) -> dict:
    """
    Runs a validated read-only query. Returns:
        {"ok": True,  "data": [<docs>]}     (data may be [])
        {"ok": False, "error": "<reason>"}
    """
    try:
        collection = db[real["collection"]]
        op = real["op"]

        if op == "find":
            cursor = collection.find(
                real.get("filter", {}),
                real.get("projection"),
            )
            sort = real.get("sort")
            if sort:
                cursor = cursor.sort(list(sort.items()))
            cursor = cursor.limit(real.get("limit", MAX_RESULT_DOCS))
            docs = list(cursor)
        else:  # aggregate
            cursor = collection.aggregate(real["pipeline"])
            docs = []
            for i, doc in enumerate(cursor):
                if i >= MAX_RESULT_DOCS:
                    break
                docs.append(doc)

        # JSON-serializable: stringify ObjectId / datetime via default=str at format time.
        return {"ok": True, "data": docs}
    except Exception as exc:
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}


def _execute_or_reject(real: Any) -> dict:
    """
    Combines validate + execute. Returns the same shape as _execute_query.
    """
    if not isinstance(real, dict):
        return {"ok": False, "error": "no query produced"}
    if "error" in real and len(real) == 1:
        return {"ok": False, "error": real["error"]}

    reason = validate_real_query(real)
    if reason:
        return {"ok": False, "error": f"query rejected: {reason}"}

    return _execute_query(real)


# ── One pseudo-query (with the single auto-retry) ─────────────────────

def _run_pseudo_query(client, model: str, intent: str, pseudo) -> dict:
    """
    Returns a trace entry:
        {"intent": str, "pseudo": ..., "real": dict|None, "outcome": {...},
         "attempts": int}
    """
    # Attempt 1
    real = build_real_query(client, model, intent, pseudo, retry_context=None)
    outcome = _execute_or_reject(real)

    needs_retry = (
        not outcome.get("ok")
        or (outcome.get("ok") and outcome.get("data") == [])
    )
    attempts = 1

    if needs_retry:
        if not outcome.get("ok"):
            retry_ctx = f"Previous attempt failed: {outcome.get('error')}"
        else:
            retry_ctx = "Previous query returned 0 documents."
        real_retry = build_real_query(client, model, intent, pseudo, retry_context=retry_ctx)
        outcome_retry = _execute_or_reject(real_retry)
        # Keep retry outcome whether better or not (caller can see trace).
        real = real_retry
        outcome = outcome_retry
        attempts = 2

    return {
        "intent": intent,
        "pseudo": pseudo,
        "real": real,
        "outcome": outcome,
        "attempts": attempts,
    }


# ── Outer loop ─────────────────────────────────────────────────────────

def _to_contents(history_messages: list, user_prompt: str) -> list:
    """Convert clean DB history + the new user prompt into Gemini Content list."""
    contents = [_message_to_content(m) for m in history_messages]
    contents.append(
        types.Content(role="user", parts=[types.Part(text=user_prompt)])
    )
    return contents


def _envelope_to_text(envelope: dict, raw_text: str) -> str:
    """Replay the reasoner's last turn back into contents as a 'model' message."""
    return raw_text or json.dumps(envelope, default=str, ensure_ascii=False)


def run_conversation(
    client,
    model: str,
    history_messages: list,
    user_prompt: str,
) -> tuple[dict, list]:
    """
    Args:
        history_messages: list of clean prior turns (each {"role","content"}).
                          Trace fields, if present, are ignored for Gemini context.
        user_prompt:      the new user message text.

    Returns:
        (final_payload, trace)

        final_payload — dict matching one of the bar_chart / pie_chart / table /
                        text schemas. Has additional fields appended by the
                        caller (assistantText, sessionId, sessionTitle).
        trace         — list of pseudo-query trace entries (see _run_pseudo_query).
    """
    contents = _to_contents(history_messages, user_prompt)
    trace: list = []

    for _ in range(MAX_OUTER_ROUNDS):
        try:
            envelope, raw_text = call_reasoner(client, model, contents)
        except EnvelopeError as exc:
            return (
                {
                    "type": "text",
                    "title": "Answer",
                    "summary": f"(reasoner produced unparseable output: {exc})",
                },
                trace,
            )

        if "final" in envelope:
            return envelope["final"], trace

        if "give_up" in envelope:
            return (
                {
                    "type": "text",
                    "title": "Couldn't answer",
                    "summary": envelope["give_up"],
                },
                trace,
            )

        # else "queries"
        queries = envelope["queries"][:MAX_QUERIES_PER_ROUND]
        results = []
        for q in queries:
            entry = _run_pseudo_query(client, model, q["intent"], q["pseudo"])
            results.append(entry)
            trace.append(entry)

        # Feed results back as a synthetic user turn so the reasoner can
        # see what came back on its next call.
        contents.append(
            types.Content(role="model", parts=[types.Part(text=_envelope_to_text(envelope, raw_text))])
        )
        contents.append(
            types.Content(role="user", parts=[types.Part(text=format_query_result_message_batch(results))])
        )

    # MAX_OUTER_ROUNDS exhausted without a final or give_up.
    return (
        {
            "type": "text",
            "title": "Couldn't converge",
            "summary": "I asked too many follow-up rounds without arriving at an answer. Please rephrase or narrow the question.",
        },
        trace,
    )
