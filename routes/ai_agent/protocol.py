"""
Pure helpers: parsing agent output, and formatting query results back into the model's context.

No I/O here. No Gemini calls. No Mongo. Easy to unit-test.
"""

import json
import re

from .schema import ALLOWED_COLLECTIONS


# ── Agent envelope parsing ─────────────────────────────────────────────

def _strip_fence(text: str) -> str:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence:
        return fence.group(1).strip()
    return text


class EnvelopeError(Exception):
    pass


def parse_agent_envelope(text: str) -> dict:
    """
    Parse agent output into one of:
        {"queries": [{...real query dict...}, ...]}
        {"final": {...}}
        {"give_up": "reason"}

    Raises EnvelopeError on parse / shape failure.
    """
    raw = _strip_fence(text)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise EnvelopeError(f"agent output is not valid JSON: {exc}")

    if not isinstance(parsed, dict):
        raise EnvelopeError("agent output must be a JSON object")

    keys = set(parsed.keys())
    primary = keys & {"queries", "final", "give_up"}
    if len(primary) != 1:
        raise EnvelopeError(
            f"envelope must contain exactly one of queries/final/give_up; got {sorted(keys)}"
        )

    if "queries" in parsed:
        qs = parsed["queries"]
        if not isinstance(qs, list) or not qs:
            raise EnvelopeError("`queries` must be a non-empty list")

        cleaned = []
        for i, q in enumerate(qs):
            if not isinstance(q, dict):
                raise EnvelopeError(f"queries[{i}] must be an object")

            intent = str(q.get("intent", "")).strip()
            if not intent:
                raise EnvelopeError(f"queries[{i}].intent is required")

            collection = q.get("collection")
            if collection not in ALLOWED_COLLECTIONS:
                raise EnvelopeError(
                    f"queries[{i}].collection must be one of {sorted(ALLOWED_COLLECTIONS)}"
                )

            op = q.get("op")
            if op not in {"find", "aggregate"}:
                raise EnvelopeError(f"queries[{i}].op must be 'find' or 'aggregate'")

            cleaned_query = {
                "intent": intent,
                "collection": collection,
                "op": op,
            }

            if op == "find":
                filt = q.get("filter", {})
                if filt is None:
                    filt = {}
                if not isinstance(filt, dict):
                    raise EnvelopeError(f"queries[{i}].filter must be an object")
                cleaned_query["filter"] = filt

                proj = q.get("projection")
                if proj is not None:
                    if not isinstance(proj, dict):
                        raise EnvelopeError(f"queries[{i}].projection must be an object")
                    cleaned_query["projection"] = proj

                sort = q.get("sort")
                if sort is not None:
                    if not isinstance(sort, dict):
                        raise EnvelopeError(f"queries[{i}].sort must be an object")
                    cleaned_query["sort"] = sort

                limit = q.get("limit")
                if limit is not None:
                    if not isinstance(limit, int) or limit < 1:
                        raise EnvelopeError(f"queries[{i}].limit must be a positive integer")
                    cleaned_query["limit"] = min(limit, 500)

            else:
                pipeline = q.get("pipeline")
                if not isinstance(pipeline, list) or not pipeline:
                    raise EnvelopeError(f"queries[{i}].pipeline must be a non-empty list")
                cleaned_query["pipeline"] = pipeline

            cleaned.append(cleaned_query)

        return {"queries": cleaned}

    if "final" in parsed:
        final = parsed["final"]
        if not isinstance(final, dict):
            raise EnvelopeError("`final` must be an object")
        return {"final": final}

    return {"give_up": str(parsed["give_up"]).strip() or "(no reason given)"}


# ── Feeding results back to the model ─────────────────────────────────

def _truncate_json(obj, char_budget: int = 4000) -> str:
    text = json.dumps(obj, default=str, ensure_ascii=False)
    if len(text) <= char_budget:
        return text
    return text[:char_budget] + f"... (truncated; full length {len(text)} chars)"


def format_query_result_block(idx: int, result_entry: dict) -> str:
    """
    Single block per query. `result_entry` shape:
        {"intent": str, "real": dict|None, "outcome": {"ok": bool, "data": [...] | "error": str}}
    """
    intent = result_entry.get("intent", "")
    real = result_entry.get("real")
    outcome = result_entry.get("outcome", {})

    if outcome.get("ok"):
        data = outcome.get("data", [])
        outcome_line = f"outcome: ok, {len(data)} docs"
        data_line = "data: " + _truncate_json(data)
    else:
        outcome_line = f"outcome: error: {outcome.get('error', 'unknown')}"
        data_line = "data: (none)"

    real_line = "executed: " + _truncate_json(real if real else {"error": "no query produced"}, char_budget=1000)

    return (
        f"[{idx}] intent: {intent}\n"
        f"    {real_line}\n"
        f"    {outcome_line}\n"
        f"    {data_line}"
    )


def format_query_result_message_batch(results: list) -> str:
    """Combines per-query blocks into one user-turn payload."""
    if not results:
        return "QUERY RESULTS\n(none)"
    blocks = [format_query_result_block(i + 1, r) for i, r in enumerate(results)]
    return "QUERY RESULTS\n" + "\n\n".join(blocks)
