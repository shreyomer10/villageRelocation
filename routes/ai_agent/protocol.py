"""
Pure helpers: parsing reasoner output, validating builder output for
read-only safety, and formatting query results back into Agent 1's context.

No I/O here. No Gemini calls. No Mongo. Easy to unit-test.
"""

import json
import re

from .schema import ALLOWED_COLLECTIONS


FORBIDDEN_OPERATORS = {"$out", "$merge", "$function", "$where", "$accumulator"}
ALLOWED_OPS = {"find", "aggregate"}
DEFAULT_LIMIT = 500
MAX_LIMIT = 500
MAX_PIPELINE_STAGES = 20


# ── Reasoner envelope parsing ──────────────────────────────────────────

def _strip_fence(text: str) -> str:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence:
        return fence.group(1).strip()
    return text


class EnvelopeError(Exception):
    pass


def parse_reasoner_envelope(text: str) -> dict:
    """
    Parse Agent 1's output into one of:
        {"queries": [{"intent": str, "pseudo": dict}, ...]}
        {"final":   {...}}
        {"give_up": "reason"}

    Raises EnvelopeError on parse / shape failure.
    """
    raw = _strip_fence(text)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise EnvelopeError(f"reasoner output is not valid JSON: {exc}")

    if not isinstance(parsed, dict):
        raise EnvelopeError("reasoner output must be a JSON object")

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
            pseudo = q.get("pseudo", {})
            if not intent:
                raise EnvelopeError(f"queries[{i}].intent is required")
            if not isinstance(pseudo, (dict, list)):
                raise EnvelopeError(f"queries[{i}].pseudo must be object or list")
            cleaned.append({"intent": intent, "pseudo": pseudo})
        return {"queries": cleaned}

    if "final" in parsed:
        final = parsed["final"]
        if not isinstance(final, dict):
            raise EnvelopeError("`final` must be an object")
        return {"final": final}

    return {"give_up": str(parsed["give_up"]).strip() or "(no reason given)"}


# ── Query-builder output parsing ───────────────────────────────────────

def parse_builder_output(text: str) -> dict:
    """
    Returns either {"error": "<reason>"} or the full real-query dict.
    Never raises — parse failures become {"error": "..."}.
    """
    raw = _strip_fence(text)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        return {"error": f"builder output is not JSON: {exc}"}
    if not isinstance(parsed, dict):
        return {"error": "builder output must be a JSON object"}
    return parsed


# ── Read-only validation ───────────────────────────────────────────────

def _contains_forbidden(node) -> str | None:
    """
    Recursively walk a dict/list and return the first forbidden operator
    encountered, or None if clean.
    """
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(k, str) and k in FORBIDDEN_OPERATORS:
                return k
            hit = _contains_forbidden(v)
            if hit:
                return hit
    elif isinstance(node, list):
        for v in node:
            hit = _contains_forbidden(v)
            if hit:
                return hit
    return None


def validate_real_query(real: dict) -> str | None:
    """
    Validate a real query for shape + read-only safety.

    Returns None if the query is acceptable.
    Returns a human-readable rejection reason if it is not.

    Side-effect: caps limit / pipeline length in place (mutates `real`).
    """
    if not isinstance(real, dict):
        return "query must be a JSON object"
    if "error" in real:
        return f"builder declined: {real['error']}"

    coll = real.get("collection")
    if coll not in ALLOWED_COLLECTIONS:
        return f"collection {coll!r} is not allowed (allowed: {sorted(ALLOWED_COLLECTIONS)})"

    op = real.get("op")
    if op not in ALLOWED_OPS:
        return f"op must be 'find' or 'aggregate', got {op!r}"

    hit = _contains_forbidden(real)
    if hit:
        return f"forbidden operator: {hit}"

    if op == "find":
        filt = real.get("filter")
        if filt is None:
            real["filter"] = {}
        elif not isinstance(filt, dict):
            return "find.filter must be an object"
        proj = real.get("projection")
        if proj is not None and not isinstance(proj, dict):
            return "find.projection must be an object"
        sort = real.get("sort")
        if sort is not None and not isinstance(sort, dict):
            return "find.sort must be an object"
        limit = real.get("limit")
        if limit is None or not isinstance(limit, int) or limit < 1 or limit > MAX_LIMIT:
            real["limit"] = DEFAULT_LIMIT
        return None

    # op == "aggregate"
    pipeline = real.get("pipeline")
    if not isinstance(pipeline, list) or not pipeline:
        return "aggregate.pipeline must be a non-empty list"
    if len(pipeline) > MAX_PIPELINE_STAGES:
        return f"pipeline has {len(pipeline)} stages (max {MAX_PIPELINE_STAGES})"
    for i, stage in enumerate(pipeline):
        if not isinstance(stage, dict) or len(stage) != 1:
            return f"pipeline[{i}] must be an object with exactly one stage operator"
    return None


# ── Feeding results back to the reasoner ───────────────────────────────

def _truncate_json(obj, char_budget: int = 4000) -> str:
    text = json.dumps(obj, default=str, ensure_ascii=False)
    if len(text) <= char_budget:
        return text
    return text[:char_budget] + f"... (truncated; full length {len(text)} chars)"


def format_query_result_block(idx: int, result_entry: dict) -> str:
    """
    Single block per pseudo-query. `result_entry` shape:
        {"intent": str, "pseudo": dict,
         "real": dict|None, "outcome": {"ok": bool, "data": [...] | "error": str}}
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
