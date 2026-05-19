"""
Orchestrator: runs the two-agent loop for one /ai/chat request.

Public entry point: `run_conversation(client, model, history_messages, user_prompt)`
returns `(final_payload, trace)`.
"""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from typing import Any

from bson import ObjectId
from bson.decimal128 import Decimal128
from google.genai import types

from config import db


def _jsonable(value):
    """Recursively convert BSON / datetime types to JSON-serializable equivalents."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal128):
        return str(value.to_decimal())
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    return value

from .protocol import (
    ALLOWED_COLLECTIONS,
    EnvelopeError,
    format_query_result_message_batch,
)
from .agent import call_agent
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

        return {"ok": True, "data": _jsonable(docs)}
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

    collection = real.get("collection")
    if collection not in ALLOWED_COLLECTIONS:
        return {
            "ok": False,
            "error": f"query rejected: collection {collection!r} is not allowed",
        }

    op = real.get("op")
    if op not in {"find", "aggregate"}:
        return {
            "ok": False,
            "error": "query rejected: op must be 'find' or 'aggregate'",
        }

    return _execute_query(real)


def _run_query_batch(queries: list) -> list[dict]:
    """Execute one batch of real queries in parallel and return trace entries."""
    if not queries:
        return []

    results = []
    max_workers = min(len(queries), MAX_QUERIES_PER_ROUND)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_execute_or_reject, q) for q in queries]
        for query, future in zip(queries, futures):
            try:
                outcome = future.result()
            except Exception as exc:
                outcome = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
            results.append({"intent": query.get("intent", ""), "real": query, "outcome": outcome})
    return results


# ── Outer loop ─────────────────────────────────────────────────────────

def _to_contents(history_messages: list, user_prompt: str) -> list:
    """Convert clean DB history + the new user prompt into Gemini Content list."""
    contents = [_message_to_content(m) for m in history_messages]
    contents.append(
        types.Content(role="user", parts=[types.Part(text=user_prompt)])
    )
    return contents


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
        trace         — list of query trace entries.
    """
    contents = _to_contents(history_messages, user_prompt)
    trace: list = []

    try:
        for _ in range(MAX_OUTER_ROUNDS):
            try:
                envelope, raw_text = call_agent(client, model, contents)
            except EnvelopeError as exc:
                return (
                    {
                        "type": "text",
                        "title": "Answer",
                        "summary": f"(agent produced unparseable output: {exc})",
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

            queries = envelope["queries"][:MAX_QUERIES_PER_ROUND]
            results = _run_query_batch(queries)
            trace.extend(results)

            contents.append(
                types.Content(role="model", parts=[types.Part(text=raw_text)])
            )
            contents.append(
                types.Content(role="user", parts=[types.Part(text=format_query_result_message_batch(results))])
            )
    except Exception as exc:
        return (
            {
                "type": "text",
                "title": "AI execution failed",
                "summary": f"Internal execution failed: {type(exc).__name__}: {exc}",
            },
            trace,
        )

    return (
        {
            "type": "text",
            "title": "Couldn't converge",
            "summary": "I asked too many follow-up rounds without arriving at an answer. Please rephrase or narrow the question.",
        },
        trace,
    )

