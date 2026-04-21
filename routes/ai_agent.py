import json
import re

from flask import Blueprint, request, jsonify
from google import genai
from google.genai import types

from config import db, GEMINI_API, GEMINI_MODEL

ai_bp = Blueprint("ai", __name__)

# ── Collections ────────────────────────────────────────────────────────────────
_villages = db.villages
_families = db.testing      # actual families collection is named 'testing'
_plots    = db.plots
_houses   = db.house

# ── Tools (plain Python functions that query MongoDB) ──────────────────────────

def get_village_overview():
    """
    Returns every non-deleted village with its family count and current
    relocation stage.  Good for high-level dashboards.
    """
    docs = list(_villages.find(
        {"delete": False},
        {"_id": 0, "villageId": 1, "name": 1, "district": 1, "currentStage": 1}
    ))
    result = []
    for v in docs:
        fam_count = _families.count_documents({"villageId": v["villageId"]})
        result.append({
            "villageId":    v["villageId"],
            "name":         v.get("name", "Unknown"),
            "district":     v.get("district", ""),
            "currentStage": v.get("currentStage") or "Not Started",
            "familyCount":  fam_count,
        })
    return result


def get_family_relocation_stats(village_id=None):
    """
    Returns family distribution split by relocation option (Option_1 / Option_2)
    and by current process stage.  Pass village_id to scope to one village or
    omit to get system-wide stats.
    """
    match = {}
    if village_id:
        match["villageId"] = village_id

    option_agg = list(_families.aggregate([
        {"$match": match},
        {"$group": {"_id": "$relocationOption", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    stage_agg = list(_families.aggregate([
        {"$match": match},
        {"$group": {"_id": "$currentStage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))

    return {
        "scope":              village_id or "All Villages",
        "total":              _families.count_documents(match),
        "byRelocationOption": [
            {"option": r["_id"] or "Unassigned", "count": r["count"]}
            for r in option_agg
        ],
        "byCurrentStage": [
            {"stage": r["_id"] or "INIT", "count": r["count"]}
            for r in stage_agg
        ],
    }


def get_construction_progress(village_id=None):
    """
    Returns how many plots and individual house units sit at each construction
    stage.  Pass village_id to scope to one village.
    """
    match = {"deleted": False}
    if village_id:
        match["villageId"] = village_id

    plot_agg = list(_plots.aggregate([
        {"$match": match},
        {"$group": {"_id": "$currentStage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    house_agg = list(_houses.aggregate([
        {"$match": match},
        {"$unwind": "$homeDetails"},
        {"$group": {"_id": "$homeDetails.currentStage", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))

    return {
        "scope":        village_id or "All Villages",
        "totalPlots":   _plots.count_documents(match),
        "totalHouses":  _houses.count_documents(match),
        "plotsByStage": [
            {"stage": r["_id"] or "Not Started", "count": r["count"]}
            for r in plot_agg
        ],
        "housesByStage": [
            {"stage": r["_id"] or "Not Started", "count": r["count"]}
            for r in house_agg
        ],
    }


TOOLS_MAP = {
    "get_village_overview":        get_village_overview,
    "get_family_relocation_stats": get_family_relocation_stats,
    "get_construction_progress":   get_construction_progress,
}

# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are an AI analytics assistant embedded inside a Village Relocation Management
System (VRMS) used by Indian government officials to track the progress of forest
village relocation.

You have exactly 3 tools available to fetch live data from the database:

1. get_village_overview()
   Returns: [{villageId, name, district, currentStage, familyCount}, ...]
   Use when: user asks about villages, overall progress, or family distribution
   across villages.

2. get_family_relocation_stats(village_id="VILL_X")   ← village_id is optional
   Returns: {scope, total, byRelocationOption:[{option,count}],
             byCurrentStage:[{stage,count}]}
   Use when: user asks about families, relocation option choices, or family
   stage breakdown.

3. get_construction_progress(village_id="VILL_X")     ← village_id is optional
   Returns: {scope, totalPlots, totalHouses,
             plotsByStage:[{stage,count}], housesByStage:[{stage,count}]}
   Use when: user asks about construction, plots, or houses.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT WORKFLOW — follow exactly:

STEP A — Call a tool by responding ONLY with this JSON (no other text):
  {"action": "tool_name", "args": {"village_id": "VILL_X"}}
  (omit args or leave {} if no arguments needed)

STEP B — After receiving the tool result, either call another tool or produce
         your FINAL answer.  Never call the same tool twice with the same args.

STEP C — Final answer MUST be ONLY this JSON (no other text):
  {"final": { ... }}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL ANSWER SCHEMA — pick the best type:

bar_chart  → best for comparing values across categories (stages, villages):
{"final": {
  "type":    "bar_chart",
  "title":   "Descriptive chart title",
  "summary": "1–2 sentence plain-English insight",
  "data":    [{"name": "Stage 1", "value": 12}, ...],
  "xKey":    "name",
  "bars":    [{"key": "value", "color": "#4F46E5", "label": "Count"}]
}}

pie_chart  → best for proportional splits (option A vs B):
{"final": {
  "type":    "pie_chart",
  "title":   "...",
  "summary": "...",
  "data":    [{"name": "Option_1", "value": 45}, ...]
}}

table  → best for multi-column overviews:
{"final": {
  "type":    "table",
  "title":   "...",
  "summary": "...",
  "columns": [{"key": "name", "label": "Village"}, {"key": "familyCount", "label": "Families"}, ...],
  "rows":    [{"name": "Rampur", "familyCount": 120, ...}, ...]
}}

text  → for simple factual questions with no chart needed:
{"final": {
  "type":    "text",
  "title":   "...",
  "summary": "Full plain-English answer here."
}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES:
- Respond with ONLY valid JSON — no markdown, no prose outside JSON.
- Always use real numbers from tool results.  Never invent data.
- Always include a "summary" field with a human-readable insight.
- If data is empty or zero, say so honestly in the summary.
"""

# ── Helper ─────────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Parse JSON from model output, stripping markdown fences if present."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


# ── Route ──────────────────────────────────────────────────────────────────────

@ai_bp.route("/ai/chat", methods=["POST"])
def ai_chat():
    body        = request.get_json(silent=True) or {}
    user_prompt = body.get("prompt", "").strip()

    if not user_prompt:
        return jsonify({"error": True, "message": "Prompt is required", "result": None}), 400

    if not GEMINI_API:
        return jsonify({"error": True, "message": "AI service not configured (missing GEMINI_API)", "result": None}), 503

    try:
        client     = genai.Client(api_key=GEMINI_API)
        model_name = GEMINI_MODEL or "gemini-2.0-flash"

        # Conversation history — grows as the ReAct loop runs
        history = [
            types.Content(role="user", parts=[types.Part(text=user_prompt)])
        ]

        max_iterations = 6
        for _ in range(max_iterations):
            response = client.models.generate_content(
                model=model_name,
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,        # low temp → deterministic JSON
                ),
            )

            reply_text = response.text.strip()

            # ── Parse the model's JSON reply ───────────────────────────────
            try:
                parsed = _extract_json(reply_text)
            except (json.JSONDecodeError, ValueError):
                # Model returned non-JSON — surface as plain text answer
                return jsonify({
                    "error":  False,
                    "result": {
                        "type":    "text",
                        "title":   "Answer",
                        "summary": reply_text,
                    },
                }), 200

            # ── Final answer ───────────────────────────────────────────────
            if "final" in parsed:
                return jsonify({"error": False, "result": parsed["final"]}), 200

            # ── Tool call ──────────────────────────────────────────────────
            if "action" in parsed:
                tool_name = parsed.get("action", "")
                args      = parsed.get("args") or {}

                if tool_name not in TOOLS_MAP:
                    return jsonify({
                        "error":   True,
                        "message": f"Model requested unknown tool '{tool_name}'.",
                        "result":  None,
                    }), 500

                tool_result      = TOOLS_MAP[tool_name](**args)
                tool_result_text = (
                    f"Tool '{tool_name}' returned:\n{json.dumps(tool_result, indent=2)}"
                )

                # Append exchange to history
                history.append(types.Content(role="model", parts=[types.Part(text=reply_text)]))
                history.append(types.Content(role="user",  parts=[types.Part(text=tool_result_text)]))
                continue

            # ── Unrecognised response structure ────────────────────────────
            return jsonify({
                "error":  False,
                "result": {
                    "type":    "text",
                    "title":   "Answer",
                    "summary": reply_text,
                },
            }), 200

        # If we exhaust the loop without a final answer
        return jsonify({
            "error":   True,
            "message": "The AI could not converge on an answer. Please rephrase your question.",
            "result":  None,
        }), 500

    except Exception as exc:
        return jsonify({
            "error":   True,
            "message": f"AI service error: {str(exc)}",
            "result":  None,
        }), 500
